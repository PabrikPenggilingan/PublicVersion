import toast from 'react-hot-toast'
import { useTableCards } from '@/utils/useTableCards'
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { dryingAPI, batchesAPI, inventoryAPI } from '@/api/client'
import Modal from '@/components/ui/Modal'
import { Plus, Eye, Trash2, Sun, Calendar, Scale, Package, Tag } from 'lucide-react'
import { formatDateShort, getStatusClasses, translateStatus } from '@/utils/helpers'
import { confirmDialog } from '@/utils/confirmDialog'

interface DryingProcess {
    id: string
    name?: string
    drying_type?: string
    vendor_name?: string
    status: 'PENDING' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED' | 'IN_WAREHOUSE'
    batch_count: number
    total_tonnage: number
    notes?: string
    created_at: string
    /** Tanggal belanja of the linked batch (titipan: date it came in) */
    belanja_date?: string | null
}

const DRYING_TYPES = [
    { value: 'oven_mandiri', label: 'Oven (Mandiri)' },
    { value: 'oven_vendor', label: 'Oven (Vendor)', needsVendor: true },
    { value: 'lantai_mandiri', label: 'Jemur (Mandiri)' },
    { value: 'lantai_vendor', label: 'Jemur (Vendor)', needsVendor: true }
]

const getDryingTypeLabel = (type: string) => {
    return DRYING_TYPES.find(t => t.value === type)?.label || type
}

interface Pagination {
    page: number
    total: number
    totalPages: number
}

interface Batch {
    id: string
    batch_date: string
    status: string
    total_qty_kg: number
    farmers?: string
    jenis_gabah?: string
    areas?: string
}

// Represents a Gabah Titipan Basah inventory item shown in the picker
interface TitipanBasahItem {
    id: string
    titipan_data: { pemilikNama?: string; jenisGabah?: string; beratKg?: number } | null
    total_weight_kg: number
    remaining_weight_kg: number
}

type PickerSelection =
    | { type: 'batch'; id: string }
    | { type: 'titipan'; id: string }
    | null

export default function DryingList() {
    const tableCardsRef = useTableCards()

    const navigate = useNavigate()
    const [dryings, setDryings] = useState<DryingProcess[]>([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, totalPages: 0 })
    const [statusFilter, setStatusFilter] = useState('')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [creating, setCreating] = useState(false)
    const [newName, setNewName] = useState('')
    const [newNotes, setNewNotes] = useState('')
    const [newDryingType, setNewDryingType] = useState('oven_mandiri')
    const [newVendorName, setNewVendorName] = useState('')

    // Gabah selection
    const [availableBatches, setAvailableBatches] = useState<Batch[]>([])
    const [titipanBasahItems, setTitipanBasahItems] = useState<TitipanBasahItem[]>([])
    const [showGabahModal, setShowGabahModal] = useState(false)
    const [selection, setSelection] = useState<PickerSelection>(null)
    const [loadingBatches, setLoadingBatches] = useState(false)

    useEffect(() => {
        loadDryings()
    }, [pagination.page, statusFilter])

    const loadAvailableBatches = async () => {
        try {
            setLoadingBatches(true)
            const [batchRes, titipanRes] = await Promise.all([
                batchesAPI.getAll({ availableForDrying: 'true', limit: 100 }),
                inventoryAPI.getAvailableTitipanBasah()
            ])
            setAvailableBatches((batchRes.data || []) as Batch[])
            setTitipanBasahItems((titipanRes.data || []) as TitipanBasahItem[])
        } catch (e) {
            console.error('Failed to load batches', e)
        } finally {
            setLoadingBatches(false)
        }
    }

    const loadDryings = async () => {
        try {
            setLoading(true)
            const params: Record<string, string | number> = { page: pagination.page, limit: 10 }
            if (statusFilter) params.status = statusFilter

            const response = await dryingAPI.getAll(params)
            setDryings((response.data || []) as DryingProcess[])
            setPagination(prev => ({
                ...prev,
                total: response.pagination?.total || 0,
                totalPages: response.pagination?.totalPages || 1,
            }))
        } catch (error) {
            console.error('Failed to load drying processes:', error)
        } finally {
            setLoading(false)
        }
    }

    const resetCreateForm = () => {
        setNewName('')
        setNewNotes('')
        setNewDryingType('oven_mandiri')
        setNewVendorName('')
        setSelection(null)
    }

    // Default name follows the purchase: "Pengeringan Belanja 16 Agt 2026 · 10.000 kg"
    const defaultDryingName = () => {
        if (selection?.type === 'batch') {
            const b = availableBatches.find(b => b.id === selection.id)
            if (b) return `Pengeringan Belanja ${formatDateShort(b.batch_date)} · ${Number(b.total_qty_kg || 0).toLocaleString('id-ID')} kg`
        }
        return 'Pengeringan Gabah'
    }

    const handleCreate = async () => {
        const needsVendor = DRYING_TYPES.find(t => t.value === newDryingType)?.needsVendor
        if (needsVendor && !newVendorName.trim()) {
            toast.error('Nama vendor harus diisi untuk tipe vendor')
            return
        }
        if (!selection) {
            toast.error('Pilih gabah terlebih dahulu')
            return
        }

        // Validate gabah type vs drying type
        if (selection.type === 'batch' && newDryingType.includes('vendor')) {
            toast.error('Gabah Pribadi hanya bisa menggunakan Oven/Jemur Mandiri')
            return
        }
        if (selection.type === 'titipan' && !newDryingType.includes('vendor')) {
            toast.error('Gabah Titipan hanya bisa menggunakan Oven/Jemur Vendor')
            return
        }

        try {
            setCreating(true)
            const payload: Parameters<typeof dryingAPI.create>[0] = {
                name: newName.trim() || defaultDryingName(),
                notes: newNotes,
                dryingType: newDryingType,
                vendorName: needsVendor ? newVendorName : undefined,
                batchIds: (selection?.type === 'batch') ? [selection.id] : undefined,
                titipanInventoryId: (selection?.type === 'titipan') ? selection.id : undefined,
            }

            const response = await dryingAPI.create(payload)
            setShowCreateModal(false)
            resetCreateForm()
            const createdId = (response.data as { id: string })?.id
            if (createdId) {
                navigate(`/drying/${createdId}`)
            } else {
                loadDryings()
            }
        } catch (error) {
            console.error('Failed to create drying process:', error)
            toast.error(error instanceof Error ? error.message : 'Gagal membuat proses pengeringan')
        } finally {
            setCreating(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!await confirmDialog('Yakin ingin menghapus proses pengeringan ini?')) return

        try {
            await dryingAPI.delete(id)
            loadDryings()
        } catch (error) {
            console.error('Failed to delete drying:', error)
            toast.error(error instanceof Error ? error.message : 'Gagal menghapus')
        }
    }

    // Label for the selected gabah in the create form
    const selectedLabel = (() => {
        if (!selection) return null
        if (selection.type === 'batch') {
            const b = availableBatches.find(b => b.id === selection.id)
            if (!b) return null
            const nameAddon = b.farmers ? b.farmers : (b.jenis_gabah || '')
            return `Batch ${formatDateShort(b.batch_date)} ${nameAddon ? `· ${nameAddon}` : ''} · ${Number(b.total_qty_kg).toLocaleString()} kg`
        }
        if (selection.type === 'titipan') {
            const t = titipanBasahItems.find(t => t.id === selection.id)
            if (!t) return null
            const td = t.titipan_data
            return `🏷 Gabah Titipan — ${td?.pemilikNama || '-'} · ${Number(t.remaining_weight_kg).toLocaleString()} kg`
        }
        return null
    })()

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Pengeringan</h1>
                    <p className="text-stone-600 text-sm mt-1">Kelola proses pengeringan gabah</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setShowCreateModal(true)
                            loadAvailableBatches()
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-all"
                    >
                        <Plus size={16} />
                        Pengeringan Baru
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <span className="text-stone-600 text-sm">Status:</span>
                    <select
                        className="px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value)
                            setPagination(prev => ({ ...prev, page: 1 }))
                        }}
                    >
                        <option value="">Semua</option>
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">Berlangsung</option>
                        <option value="COMPLETED">Sudah Disetujui</option>
                        <option value="IN_WAREHOUSE">Masuk Gudang</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-stone-200 border border-stone-300 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="spinner"></div>
                    </div>
                ) : dryings.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <table ref={tableCardsRef} className="table-cards w-full md:min-w-[650px]">
                                <thead>
                                    <tr className="text-xs text-stone-500 uppercase bg-stone-100/50">
                                        <th className="px-6 py-4 text-left font-semibold">Nama</th>
                                        <th className="px-6 py-4 text-left font-semibold">Tipe</th>
                                        <th className="px-6 py-4 text-left font-semibold">Status</th>
                                        <th className="px-6 py-4 text-left font-semibold">Batch</th>
                                        <th className="px-6 py-4 text-left font-semibold">Total Berat</th>
                                        <th className="px-6 py-4 text-left font-semibold">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-300">
                                    {dryings.map((drying) => (
                                        <tr
                                            key={drying.id}
                                            className="hover:bg-stone-300/80 cursor-pointer transition-all group"
                                            onClick={() => navigate(`/drying/${drying.id}`)}
                                        >
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-medium transition-colors">{drying.name || 'Tanpa Nama'}</p>
                                                    <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                                                        <Calendar size={12} />
                                                        {drying.belanja_date
                                                            ? `Belanja ${formatDateShort(drying.belanja_date)}`
                                                            : formatDateShort(drying.created_at)}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <span className="text-sm">{getDryingTypeLabel(drying.drying_type || 'oven_mandiri')}</span>
                                                    {drying.vendor_name && (
                                                        <p className="text-xs text-stone-500">{drying.vendor_name}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center text-center px-2.5 py-0.5 rounded-full text-[10px] font-medium leading-tight whitespace-nowrap ${getStatusClasses(drying.status)}`}>
                                                    {translateStatus(drying.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Sun size={14} className="text-amber-500/70" />
                                                    <span className="text-sm">{drying.batch_count} Batch</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Scale size={14} className="text-stone-600" />
                                                    <span className="text-sm font-medium">{Number(drying.total_tonnage || 0).toLocaleString()} kg</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <Link
                                                        to={`/drying/${drying.id}`}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/[.85] text-amber-800 hover:bg-amber-500 rounded-lg text-sm font-medium transition-colors"
                                                    >
                                                        <Eye size={14} />
                                                        Detail
                                                    </Link>
                                                    {drying.status !== 'IN_WAREHOUSE' && (
                                                        <button
                                                            onClick={() => handleDelete(drying.id)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-400/[.85] text-red-800 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors"
                                                        >
                                                            <Trash2 size={14} />
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
                        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-300">
                            <span className="text-sm text-stone-600">
                                Menampilkan {dryings.length} dari {pagination.total} proses
                            </span>
                            <div className="flex gap-2">
                                <button
                                    className="px-3 py-1.5 text-sm bg-stone-900 border border-stone-800 hover:bg-stone-800 rounded-lg disabled:opacity-50 text-white"
                                    disabled={pagination.page === 1}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                >
                                    Sebelumnya
                                </button>
                                <button
                                    className="px-3 py-1.5 text-sm bg-stone-900 border border-stone-800 hover:bg-stone-800 rounded-lg disabled:opacity-50 text-white"
                                    disabled={pagination.page >= pagination.totalPages}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                >
                                    Selanjutnya
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Sun className="text-amber-500/50 mb-4" size={48} />
                        <h3 className="font-semibold mb-2">Belum Ada Proses Pengeringan</h3>
                        <p className="text-stone-600 text-sm mb-6 max-w-sm text-center">
                            Mulai dengan membuat proses pengeringan baru.
                        </p>
                        <button
                            onClick={() => {
                                setShowCreateModal(true)
                                loadAvailableBatches()
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#f59e0b] hover:bg-[#d97706] text-white font-medium rounded-lg transition-colors"
                        >
                            <Plus size={16} />
                            Buat Pengeringan
                        </button>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => { setShowCreateModal(false); resetCreateForm() }}
                title="Buat Proses Pengeringan Baru"
                footer={
                    <>
                        <button
                            onClick={() => { setShowCreateModal(false); resetCreateForm() }}
                            className="px-4 py-2 bg-stone-300 hover:bg-stone-400 rounded-lg text-sm font-medium transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={creating}
                            className="px-4 py-2 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 text-white"
                        >
                            {creating ? 'Membuat...' : 'Buat'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Nama Pengeringan <span className="text-stone-500">(opsional)</span>
                        </label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                            placeholder={`Default: ${defaultDryingName()}`}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Gabah <span className="text-red-400">*</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowGabahModal(true)}
                            className="w-full h-11 bg-stone-300 hover:bg-stone-400 border border-stone-400 rounded-xl text-xs font-bold flex items-center justify-center gap-3 transition-all active:scale-95"
                        >
                            <Package size={16} />
                            {selectedLabel ? selectedLabel : 'Pilih Gabah'}
                        </button>
                        {selection && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelection(null)
                                    setNewDryingType('oven_mandiri')
                                }}
                                className="mt-1 text-xs text-stone-500 hover:text-red-400 transition-colors"
                            >
                                × Batalkan pilihan
                            </button>
                        )}
                    </div>
                    {selection && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Tipe Pengeringan <span className="text-red-400">*</span>
                                </label>
                                <select
                                    className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                                    value={newDryingType}
                                    onChange={(e) => setNewDryingType(e.target.value)}
                                >
                                    {DRYING_TYPES
                                        .filter(t => {
                                            if (selection?.type === 'batch') return !t.value.includes('vendor')
                                            if (selection?.type === 'titipan') return t.value.includes('vendor')
                                            return true
                                        })
                                        .map(type => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            {DRYING_TYPES.find(t => t.value === newDryingType)?.needsVendor && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Nama Vendor <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                                        placeholder="Nama vendor pengeringan"
                                        value={newVendorName}
                                        onChange={(e) => setNewVendorName(e.target.value)}
                                    />
                                </div>
                            )}
                        </>
                    )}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Catatan <span className="text-stone-500">(opsional)</span>
                        </label>
                        <textarea
                            className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                            placeholder="Catatan untuk proses pengeringan ini..."
                            rows={2}
                            value={newNotes}
                            onChange={(e) => setNewNotes(e.target.value)}
                        />
                    </div>
                    <p className="text-xs text-stone-500">
                        Setelah dibuat, Anda dapat menambahkan batch dan membuat link form untuk employee.
                    </p>
                </div>
            </Modal>

            {/* Gabah Selection Modal */}
            <Modal
                isOpen={showGabahModal}
                onClose={() => setShowGabahModal(false)}
                title="Pilih Gabah"
                size="lg"
                footer={
                    <div className='mb-4 flex justify-end gap-4'>
                        <button
                            onClick={() => setShowGabahModal(false)}
                            className="px-4 py-2 bg-stone-300 hover:bg-stone-400 rounded-lg text-sm font-medium transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={() => {
                                setShowGabahModal(false)
                                // Auto-switch drying type if invalid for the new selection
                                if (selection?.type === 'batch' && newDryingType.includes('vendor')) {
                                    setNewDryingType('oven_mandiri')
                                } else if (selection?.type === 'titipan' && !newDryingType.includes('vendor')) {
                                    setNewDryingType('oven_vendor')
                                }
                            }}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Pilih
                        </button>
                    </div>
                }
            >
                <div className="space-y-4 max-h-96 overflow-y-auto">
                    {loadingBatches ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="spinner" />
                        </div>
                    ) : (
                        <>
                            {/* Regular Batches */}
                            {availableBatches.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">Batch Reguler</p>
                                    <div className="space-y-2">
                                        {availableBatches.map(batch => (
                                            <label
                                                key={batch.id}
                                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selection?.type === 'batch' && selection.id === batch.id
                                                    ? 'bg-blue-500/20 border-blue-500/50'
                                                    : 'bg-stone-300/50 border-stone-400 hover:border-stone-500'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="radio"
                                                        name="gabah-picker"
                                                        checked={selection?.type === 'batch' && selection.id === batch.id}
                                                        onChange={() => setSelection({ type: 'batch', id: batch.id })}
                                                        className="w-4 h-4"
                                                    />
                                                    <div>
                                                        <p className="font-medium text-sm">
                                                            Batch {formatDateShort(batch.batch_date)}
                                                            {batch.jenis_gabah ? ` — ${batch.jenis_gabah}` : ''}
                                                        </p>
                                                        {batch.farmers && (
                                                            <p className="text-[11px] text-stone-600 mt-0.5 truncate max-w-[200px]" title={batch.farmers}>
                                                                👤 {batch.farmers}
                                                            </p>
                                                        )}
                                                        {batch.areas && (
                                                            <p className="text-[11px] text-stone-600 mt-0.5 truncate max-w-[200px]" title={batch.areas}>
                                                                📍 {batch.areas}
                                                            </p>
                                                        )}
                                                        <p className="text-xs text-stone-500 mt-1">
                                                            {Number(batch.total_qty_kg || 0).toLocaleString()} kg
                                                        </p>
                                                    </div>
                                                </div>
                                                {selection?.type === 'batch' && selection.id === batch.id && (
                                                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">Dipilih</span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Gabah Titipan Basah */}
                            {titipanBasahItems.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-cyan-500/80 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <Tag size={11} />
                                        Gabah Titipan (Belum Dikeringkan)
                                    </p>
                                    <div className="space-y-2">
                                        {titipanBasahItems.map(item => {
                                            const td = item.titipan_data
                                            const isSelected = selection?.type === 'titipan' && selection.id === item.id
                                            return (
                                                <label
                                                    key={item.id}
                                                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${isSelected
                                                        ? 'bg-cyan-500/15 border-cyan-500/50'
                                                        : 'bg-stone-300/50 border-stone-400 hover:border-cyan-500/30'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="radio"
                                                            name="gabah-picker"
                                                            checked={isSelected}
                                                            onChange={() => setSelection({ type: 'titipan', id: item.id })}
                                                            className="w-4 h-4"
                                                        />
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-medium text-sm">{td?.pemilikNama || 'Pemilik tidak diketahui'}</p>
                                                                <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-bold border border-cyan-500/30">
                                                                    🏷 TITIPAN
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-stone-500">
                                                                {td?.jenisGabah || '-'} · {Number(item.remaining_weight_kg || 0).toLocaleString()} kg tersisa
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {isSelected && (
                                                        <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-bold">Dipilih</span>
                                                    )}
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {availableBatches.length === 0 && titipanBasahItems.length === 0 && (
                                <p className="text-stone-500 text-sm text-center py-8">Tidak ada gabah tersedia</p>
                            )}
                        </>
                    )}
                </div>
            </Modal>
        </div>
    )
}
