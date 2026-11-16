import toast from 'react-hot-toast'
import { NumberInput } from '@/components/ui/NumberInput'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { inventoryAPI } from '@/api/client'
import Modal from '@/components/ui/Modal'
import {
    ArrowLeft, Warehouse, Package, MapPin, Tag, Plus,
    Clock
} from 'lucide-react'
import { formatDateShort } from '@/utils/helpers'

interface Sack {
    id: string
    sack_number: number
    weight_kg: number
    is_taken: boolean
    taken_at?: string
    taken_for?: 'process' | 'sale'
}

interface Transaction {
    id: string
    transaction_type: 'IN' | 'OUT' | 'ADJUST'
    weight_kg: number
    sack_count: number
    reference_type?: string
    notes?: string
    created_by_name?: string
    created_at: string
}

interface InventoryItem {
    id: string
    source_type: 'batch' | 'drying' | 'manual' | 'process'
    product_category_code?: string
    batch_id?: string
    initial_batch_weight_kg?: number
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
    total_sacks: number
    remaining_sacks: number
    status: 'AVAILABLE' | 'RESERVED' | 'DEPLETED' | 'PAYMENT_PROCESSING' | string
    is_titipan?: boolean
    entry_date: string
    notes?: string
    sacks?: Sack[]
    transactions?: Transaction[]
}

const STATUS_COLORS: Record<string, string> = {
    'AVAILABLE': 'bg-brand-light-green/30 text-brand-light-green',
    'RESERVED': 'bg-amber-500/30 text-amber-500',
    'DEPLETED': 'bg-slate-500/30 text-slate-500',
    'PAYMENT_PROCESSING': 'bg-blue-500/30 text-blue-500',
}

const STATUS_LABELS: Record<string, string> = {
    'AVAILABLE': 'Tersedia',
    'RESERVED': 'Direservasi',
    'DEPLETED': 'Habis',
    'PAYMENT_PROCESSING': 'Dalam Proses Pembayaran',
}

export default function InventoryDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [item, setItem] = useState<InventoryItem | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    // Add sacks modal
    const [showAddSacksModal, setShowAddSacksModal] = useState(false)
    const [addSackData, setAddSackData] = useState({ count: '', weight: '' })

    // Take sacks
    const [takeCount, setTakeCount] = useState('')

    // Return Titipan
    const [showReturnModal, setShowReturnModal] = useState(false)
    const [returning, setReturning] = useState(false)
    const [feeAmount, setFeeAmount] = useState('')
    const [feeNotes, setFeeNotes] = useState('')

    useEffect(() => {
        if (id) loadData()
    }, [id])

    const loadData = async () => {
        try {
            setLoading(true)
            const response = await inventoryAPI.getById(id!)
            setItem(response.data as InventoryItem)
        } catch (err) {
            console.error('Failed to load:', err)
            setError('Gagal memuat data')
        } finally {
            setLoading(false)
        }
    }

    const handleAddSacks = async () => {
        const count = parseInt(addSackData.count)
        const weight = parseFloat(addSackData.weight)

        if (!count || count <= 0) {
            toast.error('Jumlah karung harus diisi')
            return
        }
        if (!weight || weight <= 0) {
            toast.error('Berat per karung harus diisi')
            return
        }

        const newSacks = Array(count).fill({ weightKg: weight })

        try {
            setSaving(true)
            await inventoryAPI.addSacks(id!, newSacks)
            setShowAddSacksModal(false)
            setAddSackData({ count: '', weight: '' })
            await loadData()
        } catch (err) {
            console.error('Failed to add sacks:', err)
            toast.error(err instanceof Error ? err.message : 'Gagal menambah karung')
        } finally {
            setSaving(false)
        }
    }

    const handleTakeStock = async (takenFor: 'process' | 'sale') => {
        const countOrWeight = parseFloat(takeCount)
        if (!countOrWeight || countOrWeight <= 0) {
            toast.error('Masukkan jumlah yang valid')
            return
        }

        const isBeras = item?.product_category_code === 'BERAS'

        try {
            setSaving(true)
            if (isBeras) {
                // Take by sacks for BERAS
                const available = item?.sacks?.filter(s => !s.is_taken) || []
                if (countOrWeight > available.length) {
                    toast.error(`Jumlah karung melebihi stok tersedia (${available.length})`)
                    return
                }
                const sortedAvailable = [...available].sort((a, b) => a.sack_number - b.sack_number)
                const selectedIds = sortedAvailable.slice(0, countOrWeight).map(s => s.id)
                await inventoryAPI.takeSacks(id!, selectedIds, takenFor)
            } else {
                // Take by weight for GABAH, DEDAK, dll
                if (countOrWeight > (item?.remaining_weight_kg || 0)) {
                    toast.error(`Jumlah berat melebihi stok tersedia (${item?.remaining_weight_kg} kg)`)
                    return
                }
                await inventoryAPI.takeWeight(id!, countOrWeight, takenFor)
            }

            setTakeCount('')
            await loadData()
        } catch (err) {
            console.error('Failed to take stock:', err)
            toast.error(err instanceof Error ? err.message : 'Gagal mengambil stok')
        } finally {
            setSaving(false)
        }
    }

    const handleReturnToPenitip = async () => {
        try {
            setReturning(true)
            await inventoryAPI.returnToPenitip(id!, {
                feeAmount: parseFloat(feeAmount) || 0,
                feeNotes
            })
            toast.success('Status berhasil diubah ke Dalam Proses Pembayaran')
            setShowReturnModal(false)
            await loadData()
        } catch (err) {
            console.error('Failed to return titipan:', err)
            toast.error(err instanceof Error ? err.message : 'Gagal mengubah status')
        } finally {
            setReturning(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="spinner"></div>
            </div>
        )
    }

    if (error || !item) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <p className="text-red-400 mb-4">{error || 'Data tidak ditemukan'}</p>
                <button onClick={() => navigate('/inventory')} className="text-brand-light-green hover:underline">
                    Kembali ke daftar
                </button>
            </div>
        )
    }

    const takenSacks = item.sacks?.filter(s => s.is_taken) || []
    const nextSackNumber = item.sacks && item.sacks.length > 0
        ? Math.max(...item.sacks.map(s => s.sack_number)) + 1
        : 1

    const isBeras = item.product_category_code === 'BERAS'
    const isGabah = item.product_category_code === 'GABAH'

    const estimatedTakeWeight = isBeras && parseInt(takeCount) > 0 && item.remaining_sacks > 0
        ? (item.remaining_weight_kg / item.remaining_sacks) * parseInt(takeCount)
        : 0

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/inventory')}
                    className="p-2 hover:bg-stone-300 rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl md:text-2xl font-bold flex items-center gap-3">
                        <Warehouse className="text-brand-light-green" size={24} />
                        Detail Inventory
                    </h1>
                    <p className="text-stone-600 text-sm mt-1">
                        Masuk {formatDateShort(item.entry_date)}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[item.status] || 'bg-stone-400'}`}>
                        {STATUS_LABELS[item.status] || item.status}
                    </span>
                    {item.is_titipan && item.status === 'AVAILABLE' && (
                        <button
                            onClick={() => setShowReturnModal(true)}
                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-stone-900 rounded-lg text-sm font-medium transition-colors"
                        >
                            Kembalikan ke Penitip
                        </button>
                    )}
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-stone-200 border border-stone-300 rounded-xl p-4">
                    <p className="text-stone-500 text-xs mb-1">Sisa Berat</p>
                    <p className="text-2xl font-bold">{Number(item.remaining_weight_kg).toLocaleString()} kg</p>
                    {item.initial_batch_weight_kg && item.initial_batch_weight_kg !== item.remaining_weight_kg && (
                        <p className="text-xs text-stone-500 mt-1 line-through" title="Berat Awal Belanja">
                            {Number(item.initial_batch_weight_kg).toLocaleString()} kg
                        </p>
                    )}
                </div>
                <div className="bg-stone-200 border border-stone-300 rounded-xl p-4">
                    <p className="text-stone-500 text-xs mb-1">Sisa Karung</p>
                    <p className="text-2xl font-bold">{item.remaining_sacks} / {item.total_sacks}</p>
                </div>
                <div className="bg-stone-200 border border-stone-300 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                        <Package size={14} className="text-amber-400" />
                        <p className="text-stone-500 text-xs">Jenis</p>
                    </div>
                    <p className="font-bold text-amber-400 mt-1">{item.jenis_gabah || item.jenisGabah || '-'}</p>
                </div>
                <div className="bg-stone-200 border border-stone-300 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-stone-500" />
                        <p className="text-stone-500 text-xs">Lokasi</p>
                    </div>
                    <p className="font-medium mt-1">{item.area || '-'}</p>
                </div>
                <div className="bg-stone-200 border border-stone-300 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                        <Tag size={14} className="text-stone-500" />
                        <p className="text-stone-500 text-xs">Tanda</p>
                    </div>
                    <p className="font-medium mt-1">{item.tanda || '-'}</p>
                </div>
            </div>

            {/* Sacks Section */}
            <div className="mb-6">
                {/* Available Sacks / Operations */}
                <div className="bg-stone-200 border border-stone-300 rounded-xl max-w-2xl">
                    <div className="flex items-center justify-between p-4 border-b border-stone-300">
                        <h2 className="font-semibold flex items-center gap-2">
                            <Package size={18} className="text-brand-light-green" />
                            Kelola Stok
                        </h2>
                        <button
                            onClick={() => setShowAddSacksModal(true)}
                            disabled={item.is_titipan && item.status === 'PAYMENT_PROCESSING'}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1 ${item.is_titipan && item.status === 'PAYMENT_PROCESSING'
                                ? 'bg-stone-300 text-stone-500 cursor-not-allowed opacity-50'
                                : 'bg-brand-light-green/30 text-brand-light-green hover:bg-brand-light-green/50'
                                }`}
                        >
                            <Plus size={14} />
                            Tambah Stok
                        </button>
                    </div>
                    <div className="p-4">
                        <div className="mb-6 flex gap-8">
                            <div>
                                <h3 className="text-sm font-medium text-stone-600 mb-1">Stok Tersedia</h3>
                                <div className="flex items-end gap-2 text-3xl font-bold">
                                    {item.remaining_sacks}
                                    <span className="text-base font-normal text-stone-500 mb-1">karung</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-stone-600 mb-1">Karung Keluar</h3>
                                <div className="flex items-end gap-2 text-3xl font-bold text-stone-700">
                                    {takenSacks.length}
                                    <span className="text-base font-normal text-stone-500 mb-1">karung</span>
                                </div>
                            </div>
                        </div>

                        {item.remaining_weight_kg > 0 ? (
                            <div className="bg-stone-300/30 rounded-xl p-4">
                                <label className="block text-sm font-medium mb-2">
                                    {isBeras ? 'Ambil Karung' : 'Ambil Berat (kg)'}
                                </label>
                                <div className="flex flex-col gap-3">
                                    <div className="flex gap-3">
                                        <NumberInput

                                            className="flex-1 px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                                            placeholder={isBeras ? 'Jumlah karung...' : 'Jumlah berat (kg)...'}
                                            value={takeCount}
                                            onChange={(e) => setTakeCount(e.target.value)}
                                            max={isBeras ? item.remaining_sacks : item.remaining_weight_kg}
                                            step={isBeras ? '1' : '0.01'}
                                        />
                                        {isBeras && (
                                            <div className="flex-1 flex items-center px-3 bg-stone-300/50 rounded-lg border border-transparent">
                                                <span className="text-sm text-stone-600 font-medium">
                                                    ~{isNaN(estimatedTakeWeight) ? 0 : Math.round(estimatedTakeWeight).toLocaleString()} kg
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        {isGabah && (
                                            <button
                                                onClick={() => navigate(`/processes/new?inventoryId=${item.id}&weightKg=${takeCount}`)}
                                                className="flex-1 px-3 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg text-sm font-medium transition-colors border border-blue-500/30"
                                            >
                                                Proses Giling
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleTakeStock('sale')}
                                            disabled={saving || !takeCount}
                                            className="flex-1 px-3 py-2 bg-brand-light-green/20 text-brand-light-green hover:bg-brand-light-green/30 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-brand-light-green/30"
                                        >
                                            Untuk Jual
                                        </button>
                                    </div>
                                    <p className="text-xs text-stone-500 italic">
                                        *Untuk koreksi/penjualan
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 bg-stone-300/30 rounded-xl border border-stone-400/50">
                                <p className="text-stone-600 text-sm font-medium">Stok sudah habis</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Transactions */}
            <div className="bg-stone-200 border border-stone-300 rounded-xl">
                <div className="p-4 border-b border-stone-300">
                    <h2 className="font-semibold flex items-center gap-2">
                        <Clock size={18} className="text-amber-400" />
                        Riwayat Transaksi
                    </h2>
                </div>
                <div className="p-4">
                    {item.transactions && item.transactions.length > 0 ? (
                        <div className="space-y-2">
                            {item.transactions.map(tx => (
                                <div
                                    key={tx.id}
                                    className="flex items-center justify-between p-3 bg-stone-300/30 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${tx.transaction_type === 'IN'
                                            ? 'bg-brand-light-green/20 text-brand-light-green'
                                            : tx.transaction_type === 'OUT'
                                                ? 'bg-red-500/20 text-red-400'
                                                : 'bg-amber-500/20 text-amber-400'
                                            }`}>
                                            {tx.transaction_type}
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium">
                                                {tx.transaction_type === 'IN' ? '+' : '-'}{Number(tx.weight_kg).toLocaleString()} kg
                                            </p>
                                            {tx.notes && <p className="text-xs text-stone-500">{tx.notes}</p>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-stone-500">{formatDateShort(tx.created_at)}</p>
                                        {tx.created_by_name && (
                                            <p className="text-xs text-stone-500">{tx.created_by_name}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-stone-500 text-sm text-center py-4">Belum ada transaksi</p>
                    )}
                </div>
            </div>

            {/* Add Sacks Modal */}
            <Modal
                isOpen={showAddSacksModal}
                onClose={() => setShowAddSacksModal(false)}
                title="Tambah Stok Karung"
                footer={
                    <>
                        <button
                            onClick={() => setShowAddSacksModal(false)}
                            className="px-4 py-2 bg-stone-300 hover:bg-stone-400 rounded-lg text-sm font-medium"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleAddSacks}
                            disabled={saving}
                            className="px-4 py-2 bg-brand-light-green hover:bg-brand-light-green/80 rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                            {saving ? 'Menyimpan...' : 'Tambah'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="bg-stone-300/30 p-3 rounded-lg text-sm mb-4">
                        <p className="text-stone-600">Karung berikutnya mulai dari nomor:</p>
                        <p className="text-xl font-bold text-brand-light-green">#{nextSackNumber}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Jumlah Karung <span className="text-red-400">*</span>
                            </label>
                            <NumberInput

                                className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                                placeholder="0"
                                value={addSackData.count}
                                onChange={(e) => setAddSackData(prev => ({ ...prev, count: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Berat per Karung (kg) <span className="text-red-400">*</span>
                            </label>
                            <NumberInput

                                className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                                placeholder="0"
                                value={addSackData.weight}
                                onChange={(e) => setAddSackData(prev => ({ ...prev, weight: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="bg-stone-300/30 p-3 rounded-lg flex justify-between items-center text-sm">
                        <span className="text-stone-600">Total Tambahan</span>
                        <span className="font-bold text-lg text-brand-light-green">
                            {((parseInt(addSackData.count) || 0) * (parseFloat(addSackData.weight) || 0)).toLocaleString()} kg
                        </span>
                    </div>
                </div>
            </Modal>

            {/* Return Titipan Confirmation Modal */}
            <Modal
                isOpen={showReturnModal}
                onClose={() => setShowReturnModal(false)}
                title="Kembalikan ke Penitip"
                footer={
                    <>
                        <button
                            onClick={() => setShowReturnModal(false)}
                            className="px-4 py-2 bg-stone-300 hover:bg-stone-400 rounded-lg text-sm font-medium transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleReturnToPenitip}
                            disabled={returning}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {returning ? 'Memproses...' : 'Ya, Lanjutkan'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-stone-700">
                        Anda akan mengembalikan gabah titipan ini ke penitip. Proses pembayaran atau penyelesaian tagihan
                        akan dilanjutkan dan diselesaikan melalui <strong>Finance Center</strong>.
                    </p>
                    <p className="text-sm text-stone-700">
                        Setelah disetujui, status item ini akan berubah menjadi <span className="font-semibold text-blue-400">Dalam Proses Pembayaran </span>
                        dan tidak dapat diproses lebih lanjut di menu logistik/gudang.
                    </p>

                    <div className="pt-4 border-t border-stone-300/50 space-y-4">
                        <div>
                            <label className="block text-xs text-stone-600 mb-1">Biaya Jasa Titipan/Giling (Opsional)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600">Rp</span>
                                <NumberInput

                                    value={feeAmount}
                                    onChange={(e) => setFeeAmount(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-stone-100 border border-stone-300 rounded-lg focus:outline-none focus:border-brand-light-green"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-stone-600 mb-1">Keterangan Biaya (Opsional)</label>
                            <input
                                type="text"
                                value={feeNotes}
                                onChange={(e) => setFeeNotes(e.target.value)}
                                className="w-full px-4 py-2 bg-stone-100 border border-stone-300 rounded-lg focus:outline-none focus:border-brand-light-green"
                                placeholder="Cth: Jasa Pengeringan dan Giling..."
                            />
                        </div>
                    </div>

                    <p className="text-sm font-semibold text-stone-900 mt-4">
                        Apakah Anda yakin ingin melanjutkan?
                    </p>
                </div>
            </Modal>
        </div>
    )
}
