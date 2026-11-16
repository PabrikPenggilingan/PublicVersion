import toast from 'react-hot-toast'
import { useTableCards } from '@/utils/useTableCards'
import { NumberInput } from '@/components/ui/NumberInput'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { inventoryAPI, batchesAPI } from '@/api/client'
import Modal from '@/components/ui/Modal'
import { Plus, Warehouse, Calendar, MapPin, Package, Wheat, Layers, Truck, Tag, Droplets, Wind } from 'lucide-react'
import { formatDateShort, getStatusClasses } from '@/utils/helpers'
import { confirmDialog } from '@/utils/confirmDialog'

interface InventoryItem {
    id: string
    source_type: 'batch' | 'drying' | 'batch_pribadi' | 'titipan_basah' | 'titipan_kering' | 'titipan' | 'process' | 'manual' | string
    batch_id?: string
    drying_id?: string
    batch_date?: string
    drying_name?: string
    jenis_gabah?: string
    jenisGabah?: string
    area?: string
    tanda?: string
    kualitas?: string
    total_weight_kg: number
    remaining_weight_kg: number
    available_weight_kg?: number
    initial_batch_weight_kg?: number
    total_sacks: number
    remaining_sacks: number
    status: 'AVAILABLE' | 'RESERVED' | 'DEPLETED'
    entry_date: string
    created_at: string
    product_category_code?: string
    category_name?: string
    category_color?: string
    category_icon?: string
    is_titipan?: boolean
    titipan_subtype?: string
    notes?: string
}

interface CategoryStat {
    code: string
    name: string
    color_hex: string
    icon: string
    item_count: number | string
    total_remaining_kg: number | string
    total_remaining_sacks: number | string
}

interface Pagination {
    page: number
    total: number
    totalPages: number
}

const STATUS_LABELS: Record<string, string> = {
    'AVAILABLE': 'Tersedia',
    'RESERVED': 'Direservasi',
    'DEPLETED': 'Habis',
}

const ICON_MAP: Record<string, React.ReactNode> = {
    Wheat: <Wheat size={20} />,
    Package: <Package size={20} />,
    Layers: <Layers size={20} />,
    Warehouse: <Warehouse size={20} />,
    Truck: <Truck size={20} />,
}

export default function InventoryList() {
    const tableCardsRef = useTableCards()

    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [items, setItems] = useState<InventoryItem[]>([])
    const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, totalPages: 0 })
    const [statusFilter, setStatusFilter] = useState('')
    const [titipanFilter, setTitipanFilter] = useState('')
    // activeTab synced with URL ?category param
    const [activeTab, setActiveTab] = useState<string>(
        searchParams.get('category') || 'ALL'
    )

    // Create modal — item type
    const JENIS_GABAH_OPTIONS = ['IR64', 'Ciherang', 'Mekongga', 'Inpari', 'Situ Bagendit', 'Rojolele', 'Mentik Wangi', 'Lainnya']
    const [itemMode, setItemMode] = useState<'reguler' | 'titipan'>('reguler')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [creating, setCreating] = useState(false)
    const [newItem, setNewItem] = useState({
        sourceType: 'manual',
        productCategoryCode: 'TURUNAN', // Set default to something that is not disabled
        area: '',
        tanda: '',
        kualitas: '',
        jenisGabah: JENIS_GABAH_OPTIONS[0],
        notes: '',
        totalSackCount: '',
        sackWeight: '',
        packagingSizeKg: ''
    })

    // Gabah Titipan form state
    const [titipanSubtype, setTitipanSubtype] = useState<'basah' | 'kering'>('basah')
    const [titipanPemilik, setTitipanPemilik] = useState('')
    const [titipanJenis, setTitipanJenis] = useState(JENIS_GABAH_OPTIONS[0])
    const [titipanBerat, setTitipanBerat] = useState('')

    useEffect(() => {
        loadCategoryStats()
    }, [])

    // Sync activeTab when URL ?category param changes (e.g. via sidebar click)
    useEffect(() => {
        const cat = searchParams.get('category') || 'ALL'
        if (cat !== activeTab) {
            setActiveTab(cat)
            setPagination(prev => ({ ...prev, page: 1 }))
        }
    }, [searchParams])

    useEffect(() => {
        loadItems()
    }, [pagination.page, statusFilter, titipanFilter, activeTab])

    const loadCategoryStats = async () => {
        try {
            const res = await inventoryAPI.getCategoryStats()
            let stats = (res.data || []) as CategoryStat[]

            // Append Open Batches to GABAH_BASAH stats
            try {
                const batchRes = await batchesAPI.getAll({ status: 'OPEN', limit: 100 })
                const openBatches = batchRes.data || []

                if (openBatches.length > 0) {
                    const batchCount = openBatches.length
                    const batchWeight = openBatches.reduce((sum: number, b: any) => sum + (Number(b.total_qty_kg) || 0), 0)

                    stats = stats.map(cat => {
                        if (cat.code === 'GABAH_BASAH') {
                            return {
                                ...cat,
                                item_count: Number(cat.item_count) + batchCount,
                                total_remaining_kg: Number(cat.total_remaining_kg) + batchWeight
                            }
                        }
                        return cat
                    })
                }
            } catch (err) {
                console.error('Failed to fetch batches for category stats:', err)
            }

            setCategoryStats(stats)
        } catch (e) {
            console.error('Failed to load category stats:', e)
        }
    }

    const loadItems = async () => {
        try {
            setLoading(true)
            const params: Record<string, unknown> = {
                status: statusFilter || undefined,
                page: pagination.page,
                limit: 20
            }
            if (activeTab !== 'ALL') {
                if (activeTab === 'GABAH_TITIPAN') {
                    params.isTitipan = 'true'
                } else if (activeTab === 'GABAH') {
                    params.categoryCode = 'GABAH_BASAH,GABAH_KERING'
                } else {
                    params.categoryCode = activeTab
                }
            }
            if (titipanFilter === 'TITIPAN_ALL') {
                params.isTitipan = 'true'
            } else if (titipanFilter === 'TITIPAN_GABAH_BASAH') {
                params.isTitipan = 'true'
                params.titipanSubtype = 'basah'
            } else if (titipanFilter === 'TITIPAN_GABAH_KERING') {
                params.isTitipan = 'true'
                params.titipanSubtype = 'kering'
            } else if (titipanFilter === 'TITIPAN_BERAS') {
                params.isTitipan = 'true'
                params.categoryCode = 'BERAS'
            } else if (titipanFilter === 'TITIPAN_TURUNAN') {
                params.isTitipan = 'true'
                params.categoryCode = 'TURUNAN,LIMBAH'
            } else if (titipanFilter === 'REGULER') {
                params.isTitipan = 'false'
            }

            const itemsRes = await inventoryAPI.getAll(params as any)
            let fetchedItems: any[] = itemsRes.data || []

            // Append Batches as Gabah Basah Pribadi based on statusFilter
            if ((activeTab === 'ALL' || activeTab === 'GABAH_BASAH' || activeTab === 'GABAH') && (titipanFilter === 'ALL' || titipanFilter === 'REGULER' || titipanFilter === '')) {
                try {
                    // If filter is explicitly RESERVED, batches don't apply
                    if (statusFilter !== 'RESERVED') {
                        const targetBatchStatus = statusFilter === 'DEPLETED' ? 'CLOSED' : 'OPEN'
                        const batchRes = await batchesAPI.getAll({ status: targetBatchStatus, limit: 100 })
                        const mappedBatches = (batchRes.data || []).map(b => ({
                            id: b.id,
                            product_category_code: 'GABAH_BASAH',
                            category_name: 'Gabah Pribadi (Batch)',
                            category_color: '#F59E0B',
                            is_titipan: false,
                            jenis_gabah: b.jenis_gabah,
                            created_at: b.batch_date,
                            source_type: 'batch_pribadi',
                            remaining_weight_kg: targetBatchStatus === 'CLOSED' ? 0 : (b.total_qty_kg || 0),
                            remaining_sacks: 0,
                            status: targetBatchStatus === 'CLOSED' ? 'DEPLETED' : 'AVAILABLE',
                            area: (b as any).areas || 'Multiple'
                        }))

                        // Prepend batches to the list
                        fetchedItems = [...mappedBatches, ...fetchedItems]
                    }
                } catch (err) {
                    console.error('Failed to fetch batches for inventory view', err)
                }
            }

            setItems(fetchedItems as InventoryItem[])
            setPagination(prev => ({
                ...prev,
                total: itemsRes.pagination?.total || 0,
                totalPages: itemsRes.pagination?.totalPages || 0
            }))
        } catch (error) {
            console.error('Failed to load inventory:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleTabChange = (code: string) => {
        setActiveTab(code)
        setPagination(prev => ({ ...prev, page: 1 }))
        // Sync URL so the sidebar highlights the correct sub-item
        const url = code !== 'ALL' ? `/inventory?category=${code}` : '/inventory'
        navigate(url, { replace: true })
    }

    const handleCreate = async () => {
        if (itemMode === 'titipan') {
            // --- Gabah Titipan creation ---
            if (!titipanPemilik.trim()) { toast.error('Nama pemilik harus diisi'); return }
            if (!titipanBerat || parseFloat(titipanBerat) <= 0) { toast.error('Berat harus diisi dan lebih dari 0'); return }

            try {
                setCreating(true)
                const response = await inventoryAPI.create({
                    sourceType: titipanSubtype === 'basah' ? 'titipan_basah' : 'titipan_kering',
                    weightKg: parseFloat(titipanBerat),
                    titipanData: {
                        pemilikNama: titipanPemilik,
                        jenisGabah: titipanJenis,
                        beratKg: parseFloat(titipanBerat)
                    }
                })
                setShowCreateModal(false)
                resetForm()
                loadCategoryStats()
                const createdId = (response.data as { id: string })?.id
                if (createdId) navigate(`/inventory/${createdId}`)
                else loadItems()
            } catch (error) {
                console.error('Failed to create titipan:', error)
                toast.error(error instanceof Error ? error.message : 'Gagal membuat item')
            } finally {
                setCreating(false)
            }
            return
        }

        // --- Regular item creation ---
        const count = parseInt(newItem.totalSackCount)
        const weight = parseFloat(newItem.sackWeight)

        if (!count || count <= 0) { toast.error('Jumlah karung harus diisi'); return }
        if (!weight || weight <= 0) { toast.error('Berat per karung harus diisi'); return }

        const sacks = Array(count).fill({ weightKg: weight })

        try {
            setCreating(true)
            const response = await inventoryAPI.create({
                sourceType: newItem.sourceType,
                productCategoryCode: newItem.productCategoryCode,
                area: newItem.area,
                tanda: newItem.tanda,
                kualitas: newItem.kualitas,
                jenisGabah: newItem.productCategoryCode.includes('GABAH') ? newItem.jenisGabah : undefined,
                notes: newItem.notes,
                packagingSizeKg: newItem.packagingSizeKg ? parseFloat(newItem.packagingSizeKg) : undefined,
                sacks: sacks
            })
            setShowCreateModal(false)
            resetForm()
            loadCategoryStats()
            const createdId = (response.data as { id: string })?.id
            if (createdId) navigate(`/inventory/${createdId}`)
            else loadItems()
        } catch (error) {
            console.error('Failed to create:', error)
            toast.error(error instanceof Error ? error.message : 'Gagal membuat item')
        } finally {
            setCreating(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!await confirmDialog('Yakin ingin menghapus item ini?')) return
        try {
            await inventoryAPI.delete(id)
            loadItems()
            loadCategoryStats()
        } catch (error: any) {
            const msg = error.response?.data?.message || error.message || 'Gagal menghapus'
            toast.error(msg)
        }
    }

    const resetForm = () => {
        setItemMode('reguler')
        setNewItem({
            sourceType: 'manual',
            productCategoryCode: 'GABAH',
            area: '',
            tanda: '',
            kualitas: '',
            notes: '',
            totalSackCount: '',
            sackWeight: '',
            packagingSizeKg: '',
            jenisGabah: JENIS_GABAH_OPTIONS[0]
        })
        setTitipanSubtype('basah')
        setTitipanPemilik('')
        setTitipanJenis('IR64')
        setTitipanBerat('')
    }

    const totalWeight = (parseInt(newItem.totalSackCount) || 0) * (parseFloat(newItem.sackWeight) || 0)

    // Aggregate total stock
    const totalKg = categoryStats.reduce((s, c) => s + Number(c.total_remaining_kg), 0)
    const totalSacks = categoryStats.reduce((s, c) => s + Number(c.total_remaining_sacks), 0)

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <Warehouse className="text-brand-light-green" />
                        Inventory Gudang
                    </h1>
                    <p className="text-stone-600 text-sm mt-1">
                        Diurutkan berdasarkan terbaru &bull; Pilih kategori dari tab di bawah
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-white bg-brand-light-green hover:bg-brand-light-green/80 rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus size={18} />
                    Tambah Item
                </button>
            </div>

            {/* Category Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* All Stock Card */}
                <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-4 col-span-2 md:col-span-1 flex flex-col gap-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Total Stok</p>
                    <p className="text-2xl font-black text-stone-900">{Number(totalKg).toLocaleString()} <span className="text-xs text-stone-500 font-normal">KG</span></p>
                    <p className="text-xs text-stone-500">{Number(totalSacks).toLocaleString()} Karung</p>
                </div>
                {/* Per-Category Cards */}
                {categoryStats.map(cat => (
                    <div
                        key={cat.code}
                        onClick={() => handleTabChange(cat.code)}
                        className={`bg-stone-200/40 backdrop-blur-sm border rounded-2xl p-4 flex flex-col gap-1 cursor-pointer transition-all ${activeTab === cat.code ? 'border-2 scale-[1.02]' : 'border-stone-300/50 hover:border-stone-500/50'}`}
                        style={{ borderColor: activeTab === cat.code ? cat.color_hex : undefined }}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cat.color_hex }}>{cat.name}</span>
                            <span style={{ color: cat.color_hex, opacity: 0.7 }}>{ICON_MAP[cat.icon] || <Package size={16} />}</span>
                        </div>
                        <p className="text-2xl font-black text-stone-900">{Number(cat.total_remaining_kg).toLocaleString()} <span className="text-xs text-stone-500 font-normal">KG</span></p>
                        <p className="text-xs text-stone-500">{Number(cat.item_count).toLocaleString()} Item</p>
                    </div>
                ))}
            </div>

            {/* Category Tabs */}
            <div className="flex items-center flex-wrap gap-2 mb-4 pb-1">
                <button
                    onClick={() => handleTabChange('ALL')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'ALL' ? 'bg-brand-light-green text-white' : 'bg-stone-200 border border-stone-300 text-stone-600 hover:border-stone-500'}`}
                >
                    Semua
                </button>
                {categoryStats.map(cat => (
                    <button
                        key={cat.code}
                        onClick={() => handleTabChange(cat.code)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === cat.code ? 'text-white' : 'bg-stone-200 border border-stone-300 text-stone-600 hover:border-stone-500'}`}
                        style={activeTab === cat.code ? { backgroundColor: cat.color_hex } : {}}
                    >
                        🏷 {cat.name}
                    </button>
                ))}

                {/* Filters: Titipan / Kepemilikan & Status */}
                <div className="ml-auto flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {/* Titipan Filter */}
                    <div className="flex items-center gap-1.5 bg-stone-200 border border-stone-300 px-3 py-1.5 rounded-lg text-sm">
                        <Tag size={15} className="text-cyan-400" />
                        <select
                            className="bg-transparent text-stone-900 focus:outline-none cursor-pointer text-sm font-medium"
                            value={titipanFilter}
                            onChange={(e) => {
                                setTitipanFilter(e.target.value)
                                setPagination(prev => ({ ...prev, page: 1 }))
                            }}
                        >
                            <option value="" className="bg-stone-200 text-stone-900">Semua Kepemilikan (Semua)</option>
                            <option value="TITIPAN_ALL" className="bg-stone-200 text-cyan-400">🏷 Semua Titipan</option>
                            <option value="TITIPAN_GABAH_BASAH" className="bg-stone-200 text-stone-900">🌾 Titipan: Gabah Basah</option>
                            <option value="TITIPAN_GABAH_KERING" className="bg-stone-200 text-stone-900">🌾 Titipan: Gabah Kering</option>
                            <option value="TITIPAN_BERAS" className="bg-stone-200 text-stone-900">🍚 Titipan: Beras</option>
                            <option value="TITIPAN_TURUNAN" className="bg-stone-200 text-stone-900">📦 Titipan: Turunan / Limbah</option>
                            <option value="REGULER" className="bg-stone-200 text-purple-400">🏢 Stok Pribadi (Non-Titipan)</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <select
                        className="px-3 py-2 bg-stone-200 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:border-brand-light-green cursor-pointer font-medium"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value)
                            setPagination(prev => ({ ...prev, page: 1 }))
                        }}
                    >
                        <option value="">Semua Status</option>
                        <option value="AVAILABLE">Tersedia</option>
                        <option value="RESERVED">Direservasi</option>
                        <option value="DEPLETED">Habis</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-stone-200 border border-stone-300 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="spinner"></div>
                    </div>
                ) : items.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <table ref={tableCardsRef} className="table-cards w-full md:min-w-[800px]">
                                <thead>
                                    <tr className="text-xs text-stone-500 uppercase bg-stone-100/50">
                                        <th className="px-6 py-4 text-left font-semibold">#</th>
                                        <th className="px-6 py-4 text-left font-semibold">Kategori</th>
                                        <th className="px-6 py-4 text-left font-semibold">Jenis</th>
                                        <th className="px-6 py-4 text-left font-semibold">Tanggal Masuk</th>
                                        <th className="px-6 py-4 text-left font-semibold">Sumber</th>
                                        <th className="px-6 py-4 text-left font-semibold">Lokasi</th>
                                        <th className="px-6 py-4 text-left font-semibold">Sisa Stok</th>
                                        <th className="px-6 py-4 text-left font-semibold">Status</th>
                                        <th className="px-6 py-4 text-left font-semibold">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-300">
                                    {items.map((item, index) => (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-stone-300/50 transition-colors cursor-pointer"
                                            onClick={() => {
                                                if (item.source_type === 'batch_pribadi') navigate(`/batches/${item.id}`)
                                                else navigate(`/inventory/${item.id}`)
                                            }}
                                        >
                                            <td className="px-6 py-4 text-stone-500 text-sm" onClick={(e) => e.stopPropagation()}>
                                                {((pagination.page - 1) * 20) + index + 1}
                                            </td>
                                            <td className="px-6 py-4 align-top">
                                                <div className="flex gap-1 flex-wrap max-w-[200px]">
                                                    {(() => {
                                                        const tags = [];
                                                        if (item.category_name) {
                                                            let catName = item.category_name;
                                                            if (item.product_category_code === 'GABAH_KERING') {
                                                                catName = 'Gabah Kering';
                                                            } else if (item.product_category_code === 'GABAH_BASAH') {
                                                                catName = 'Gabah Basah';
                                                            } else if (['TURUNAN', 'LIMBAH', 'BERAS'].includes(item.product_category_code || '')) {
                                                                if (item.notes && item.notes.startsWith('[')) {
                                                                    const match = item.notes.match(/^\[(.*?)\]/);
                                                                    if (match && match[1]) {
                                                                        catName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
                                                                    }
                                                                }
                                                            }
                                                            tags.push({ name: catName, color: item.category_color || '#9CA3AF' });
                                                        }

                                                        if (item.is_titipan) {
                                                            tags.push({ name: 'Titipan', color: '#06B6D4' });
                                                        } else {
                                                            tags.push({ name: 'Pribadi', color: '#8B5CF6' });
                                                        }


                                                        if (tags.length === 0) {
                                                            return <span className="text-stone-500 text-xs">-</span>;
                                                        }

                                                        return tags.map((tag, i) => (
                                                            <span
                                                                key={i}
                                                                className="text-[10px] font-bold px-2 py-1 rounded-md border"
                                                                style={{
                                                                    color: tag.color,
                                                                    backgroundColor: tag.color + '18',
                                                                    borderColor: tag.color + '40'
                                                                }}
                                                            >
                                                                {tag.name}
                                                            </span>
                                                        ));
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {(item.jenis_gabah || item.jenisGabah) ? (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                        {item.jenis_gabah || item.jenisGabah}
                                                    </span>
                                                ) : (
                                                    <span className="text-stone-500 text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-stone-500" />
                                                    <span className="text-sm">{formatDateShort(item.created_at || item.entry_date)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <span className="text-xs px-2 py-0.5 bg-stone-300 rounded">
                                                        {item.source_type === 'batch' ? 'Batch' : 'Pengeringan'}
                                                    </span>
                                                    {item.batch_date && (
                                                        <p className="text-xs text-stone-500 mt-0.5">{formatDateShort(item.batch_date)}</p>
                                                    )}
                                                    {item.drying_name && (
                                                        <p className="text-xs text-stone-500 mt-0.5">{item.drying_name}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {item.area ? (
                                                    <div className="flex items-center gap-1">
                                                        <MapPin size={12} className="text-stone-500" />
                                                        <span className="text-sm">{item.area}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-stone-500 text-sm">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-medium">{Number(item.available_weight_kg ?? item.remaining_weight_kg).toLocaleString()} kg</p>
                                                    {item.initial_batch_weight_kg && item.initial_batch_weight_kg !== (item.available_weight_kg ?? item.remaining_weight_kg) && (
                                                        <p className="text-xs text-stone-500 line-through" title="Berat Awal Belanja">
                                                            {Number(item.initial_batch_weight_kg).toLocaleString()} kg
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-stone-500">{item.remaining_sacks} karung</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusClasses(item.status)}`}>
                                                    {STATUS_LABELS[item.status]}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (item.source_type === 'batch_pribadi') navigate(`/batches/${item.id}`)
                                                            else navigate(`/inventory/${item.id}`)
                                                        }}
                                                        className="px-3 py-1.5 bg-stone-300 hover:bg-stone-400 rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        Detail
                                                    </button>
                                                    {item.source_type !== 'batch_pribadi' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                                            className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-xs font-medium transition-colors"
                                                        >
                                                            Hapus
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between p-4 border-t border-stone-300">
                                <p className="text-sm text-stone-600">
                                    {pagination.total} item total
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                        disabled={pagination.page <= 1}
                                        className="px-3 py-1.5 bg-stone-300 rounded text-sm disabled:opacity-50"
                                    >
                                        Prev
                                    </button>
                                    <span className="text-sm">
                                        {pagination.page} / {pagination.totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                        disabled={pagination.page >= pagination.totalPages}
                                        className="px-3 py-1.5 bg-stone-300 rounded text-sm disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12">
                        <Warehouse size={48} className="text-stone-400 mx-auto mb-4" />
                        <p className="text-stone-500">Belum ada item inventory</p>
                        {activeTab !== 'ALL' && (
                            <p className="text-stone-400 text-sm mt-1">untuk kategori ini</p>
                        )}
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-4 text-brand-light-green hover:underline text-sm"
                        >
                            Tambah item pertama
                        </button>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => { setShowCreateModal(false); resetForm() }}
                title="Tambah Item Inventory"
                size="lg"
                footer={
                    <>
                        <button
                            onClick={() => { setShowCreateModal(false); resetForm() }}
                            className="px-4 py-2 bg-stone-300 hover:bg-stone-400 rounded-lg text-sm font-medium"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={creating}
                            className={`px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50 ${itemMode === 'titipan' ? 'bg-cyan-500 hover:bg-cyan-600' : 'bg-brand-light-green hover:bg-brand-light-green/80'}`}
                        >
                            {creating ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    {/* Item Type Tab */}
                    <div className="mb-4 p-1 bg-stone-300/50 rounded-xl flex items-center border border-stone-400/50">
                        <button
                            type="button"
                            onClick={() => setItemMode('reguler')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${itemMode === 'reguler'
                                ? 'bg-stone-400 text-stone-900 shadow-sm'
                                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-400/50'
                                }`}
                        >
                            <Package size={15} />
                            Item Reguler
                        </button>
                        <button
                            type="button"
                            onClick={() => setItemMode('titipan')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${itemMode === 'titipan'
                                ? 'bg-cyan-500 text-white shadow-sm'
                                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-400/50'
                                }`}
                        >
                            <Tag size={15} />
                            Gabah Titipan
                        </button>
                    </div>

                    {/* ── GABAH TITIPAN FORM ── */}
                    {itemMode === 'titipan' && (
                        <div className="space-y-4">
                            {/* Basah / Kering sub-type */}
                            <div className="p-1 bg-stone-300/50 rounded-xl flex items-center border border-stone-400/50">
                                <button
                                    type="button"
                                    onClick={() => setTitipanSubtype('basah')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${titipanSubtype === 'basah'
                                        ? 'bg-blue-500/80 text-white shadow-sm'
                                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-400/50'
                                        }`}
                                >
                                    <Droplets size={14} />
                                    Gabah Basah
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTitipanSubtype('kering')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${titipanSubtype === 'kering'
                                        ? 'bg-amber-500/80 text-white shadow-sm'
                                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-400/50'
                                        }`}
                                >
                                    <Wind size={14} />
                                    Gabah Kering
                                </button>
                            </div>

                            {/* Hint for Basah */}
                            {titipanSubtype === 'basah' && (
                                <div className="p-3 bg-blue-100 border border-blue-300 rounded-lg text-xs text-blue-800">
                                    <strong>Gabah Basah</strong> — perlu melalui proses pengeringan terlebih dahulu. Item ini akan muncul sebagai pilihan di Pengeringan Baru.
                                </div>
                            )}
                            {titipanSubtype === 'kering' && (
                                <div className="p-3 bg-amber-100 border border-amber-300 rounded-lg text-xs text-amber-800">
                                    <strong>Gabah Kering</strong> — sudah kering dan siap masuk ke proses penggilingan.
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-1.5">
                                    Nama Pemilik <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                                    placeholder="Contoh: Budi Santoso"
                                    value={titipanPemilik}
                                    onChange={(e) => setTitipanPemilik(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">
                                        Jenis Gabah <span className="text-red-400">*</span>
                                    </label>
                                    <select
                                        className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-cyan-500 appearance-none"
                                        value={titipanJenis}
                                        onChange={(e) => setTitipanJenis(e.target.value)}
                                    >
                                        {['IR64', 'Ciherang', 'Mekongga', 'Inpari', 'Situ Bagendit', 'Rojolele', 'Mentik Wangi', 'Lainnya'].map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">
                                        Berat (kg) <span className="text-red-400">*</span>
                                    </label>
                                    <NumberInput

                                        className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                                        placeholder="0"
                                        value={titipanBerat}
                                        onChange={(e) => setTitipanBerat(e.target.value)}
                                    />
                                </div>
                            </div>

                            {titipanBerat && parseFloat(titipanBerat) > 0 && (
                                <div className="bg-stone-300/30 p-3 rounded-lg flex justify-between items-center text-sm">
                                    <span className="text-stone-600">Total Berat</span>
                                    <span className="font-bold text-lg text-cyan-400">{Number(parseFloat(titipanBerat)).toLocaleString()} kg</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── ITEM REGULER FORM ── */}
                    {itemMode === 'reguler' && (
                        <>
                            {/* Category Selection */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Kategori Barang <span className="text-red-400">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {categoryStats
                                        .filter(cat => !['GABAH', 'GABAH_BASAH', 'TITIPAN', 'GABAH_TITIPAN'].includes(cat.code))
                                        .map(cat => {
                                            const isBeras = cat.code === 'BERAS';
                                            const isGabah = cat.code.includes('GABAH');
                                            const isDisabled = isBeras || isGabah;
                                            return (
                                                <button
                                                    key={cat.code}
                                                    type="button"
                                                    disabled={isDisabled}
                                                    onClick={() => setNewItem(p => ({ ...p, productCategoryCode: cat.code }))}
                                                    className={`p-3 rounded-xl border text-left transition-all 
                                                    ${newItem.productCategoryCode === cat.code ? 'border-2' : 'border-stone-400 bg-stone-300/50'}
                                                    ${isDisabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                                                `}
                                                    style={newItem.productCategoryCode === cat.code ? { borderColor: cat.color_hex, backgroundColor: cat.color_hex + '18' } : {}}
                                                >
                                                    <p className="text-xs font-bold" style={{ color: newItem.productCategoryCode === cat.code ? cat.color_hex : undefined }}>{cat.name}</p>
                                                    {isBeras && <p className="text-[10px] text-red-400 mt-1">Otomatis dari Penggilingan</p>}
                                                    {isGabah && <p className="text-[10px] text-red-400 mt-1">Otomatis dari Pembelian/Pengeringan</p>}
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>

                            {newItem.productCategoryCode.includes('GABAH') && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium mb-2">
                                        Jenis Gabah <span className="text-red-400">*</span>
                                    </label>
                                    <select
                                        className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green appearance-none"
                                        value={newItem.jenisGabah}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, jenisGabah: e.target.value }))}
                                    >
                                        {JENIS_GABAH_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Lokasi/Area</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                                        placeholder="Contoh: Gudang A"
                                        value={newItem.area}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, area: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Tanda Identifikasi</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                                        placeholder="Contoh: Karung Biru"
                                        value={newItem.tanda}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, tanda: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">Kualitas</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                                    placeholder="Contoh: Premium"
                                    value={newItem.kualitas}
                                    onChange={(e) => setNewItem(prev => ({ ...prev, kualitas: e.target.value }))}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Jumlah Karung <span className="text-red-400">*</span>
                                    </label>
                                    <NumberInput

                                        className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                                        placeholder="0"
                                        value={newItem.totalSackCount}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, totalSackCount: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Berat per Karung (kg) <span className="text-red-400">*</span>
                                    </label>
                                    <NumberInput

                                        className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                                        placeholder="0"
                                        value={newItem.sackWeight}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, sackWeight: e.target.value }))}
                                    />
                                </div>
                                {newItem.productCategoryCode === 'BERAS' && (
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium mb-2 text-brand-light-green">
                                            Ukuran Packaging Beras (kg)
                                        </label>
                                        <NumberInput

                                            className="w-full px-3 py-2 bg-stone-300 border border-brand-light-green/50 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                                            placeholder="Misal: 5, 10, 25, 50"
                                            value={newItem.packagingSizeKg}
                                            onChange={(e) => setNewItem(prev => ({
                                                ...prev,
                                                packagingSizeKg: e.target.value,
                                                sackWeight: e.target.value
                                            }))}
                                        />
                                        <p className="text-xs text-stone-600 mt-1">Isi jika ini barang dengan packaging standar. Berat per karung akan otomatis disesuaikan.</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-stone-300/30 p-3 rounded-lg flex justify-between items-center text-sm">
                                <span className="text-stone-600">Total Berat</span>
                                <span className="font-bold text-lg text-brand-light-green">{totalWeight.toLocaleString()} kg</span>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Catatan</label>
                                <textarea
                                    className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                                    placeholder="Catatan tambahan..."
                                    rows={2}
                                    value={newItem.notes}
                                    onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    )
}
