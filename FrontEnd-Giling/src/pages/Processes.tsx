import toast from 'react-hot-toast'
import { useTableCards } from '@/utils/useTableCards'
import { NumberInput } from '@/components/ui/NumberInput'
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { processesAPI, inventoryAPI, batchesAPI } from '@/api/client'
import Modal from '@/components/ui/Modal'
import { Plus, Eye, Trash2, Factory, Wheat, TrendingUp, Tag } from 'lucide-react'
import { format } from 'date-fns'
import { formatDateShort, getStatusClasses, translateStatus } from '@/utils/helpers'
import { confirmDialog } from '@/utils/confirmDialog'
import type { Process } from '@/types'

interface Pagination {
    page: number
    total: number
    totalPages: number
}

// Tanggal belanja of a stock item (batch date; titipan uses its entry date), as yyyy-MM-dd
const belanjaDateOf = (item: any): string | null => {
    const raw = item?.batch_date || item?.entry_date || item?.created_at
    if (!raw) return null
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : format(d, 'yyyy-MM-dd')
}

export default function Processes() {
    const tableCardsRef = useTableCards()

    const navigate = useNavigate()
    const [processes, setProcesses] = useState<Process[]>([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, totalPages: 0 })
    const [statusFilter, setStatusFilter] = useState('')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newProcessDate, setNewProcessDate] = useState(new Date().toISOString().split('T')[0])
    const [notes, setNotes] = useState('')
    const [creating, setCreating] = useState(false)

    // Gabah inventory picker
    const [gabahItems, setGabahItems] = useState<any[]>([])
    const [selectedGabahId, setSelectedGabahId] = useState('')
    const [gabahReservedKg, setGabahReservedKg] = useState('')
    const [loadingGabah, setLoadingGabah] = useState(false)
    const [showGabahModal, setShowGabahModal] = useState(false)
    // Batch belanja yang belum masuk gudang (masih OPEN, belum dijemur): bisa langsung digiling,
    // stoknya dipindahkan ke gudang otomatis saat proses dibuat
    const [batchOptions, setBatchOptions] = useState<any[]>([])
    const [selectedBatchId, setSelectedBatchId] = useState('')
    // Batch yang gabahnya sedang/sudah di pengeringan tapi belum dipindahkan ke gudang
    const [dryingBatches, setDryingBatches] = useState<any[]>([])
    // Pengeringan yang sudah Disetujui: langsung dipilih, dipindah ke gudang otomatis saat proses dibuat
    const [selectedDrying, setSelectedDrying] = useState<{ batchId: string; dryingId: string } | null>(null)

    const getGabahDisplay = (id: string) => {
        const item = gabahItems.find(i => i.id === id)
        if (!item) return 'Pilih Gabah'
        const dateStr = (item.batch_date || item.entry_date || item.created_at) ? ` · ${formatDateShort(item.batch_date || item.entry_date || item.created_at)}` : ''
        if (item.is_titipan) {
            return `Titipan - ${item.titipan_data?.pemilikNama || '-'} • Sisa: ${Number(item.remaining_weight_kg).toLocaleString()} kg${item.initial_batch_weight_kg ? ` (Awal: ${Number(item.initial_batch_weight_kg).toLocaleString()} kg)` : ''}${dateStr}`
        }
        return `${item.area || item.category_name || 'Gabah Pribadi'}${item.tanda ? ` - ${item.tanda}` : ''} • Sisa: ${Number(item.remaining_weight_kg).toLocaleString()} kg${item.initial_batch_weight_kg ? ` (Awal: ${Number(item.initial_batch_weight_kg).toLocaleString()} kg)` : ''}${dateStr}`
    }

    useEffect(() => {
        loadProcesses()
    }, [pagination.page, statusFilter])

    const loadProcesses = async () => {
        try {
            setLoading(true)
            const params: Record<string, string | number> = { page: pagination.page, limit: 10 }
            if (statusFilter) params.status = statusFilter

            const response = await processesAPI.getAll(params)
            setProcesses(response.data || [])
            setPagination(prev => ({
                ...prev,
                total: response.pagination?.total || 0,
                totalPages: response.pagination?.totalPages || 1,
            }))
        } catch (error) {
            console.error('Failed to load processes:', error)
        } finally {
            setLoading(false)
        }
    }

    const openCreateModal = async () => {
        setShowCreateModal(true)
        try {
            setLoadingGabah(true)
            const res = await inventoryAPI.getAll({ categoryCode: 'GABAH,GABAH_BASAH,GABAH_KERING', status: 'AVAILABLE', limit: 100 })
            const validGabah = (res.data as any[] || []).filter(item => {
                const hasStock = Number(item.remaining_weight_kg) > 0;
                const isTitipanBasah = item.is_titipan && item.titipan_subtype === 'basah';
                return hasStock && !isTitipanBasah;
            });
            setGabahItems(validGabah)
            try {
                const bRes = await batchesAPI.getAll({ status: 'OPEN', limit: 100 } as any)
                const open = ((bRes.data as any[]) || []).filter(b => Number(b.remaining_kg ?? b.total_qty_kg ?? 0) > 0)
                setBatchOptions(open.filter(b => !b.drying))
                setDryingBatches(open.filter(b => b.drying && b.drying.status !== 'IN_WAREHOUSE'))
            } catch (e) {
                console.error('Failed to load batches:', e)
                setBatchOptions([])
                setDryingBatches([])
            }
        } catch (e) {
            console.error('Failed to load gabah:', e)
        } finally {
            setLoadingGabah(false)
        }
    }

    const selectDrying = (b: any) => {
        setSelectedGabahId('')
        setSelectedBatchId('')
        setSelectedDrying({ batchId: b.id, dryingId: b.drying.id })
        setGabahReservedKg('') // kosong = semua hasil jemur (berat dihitung saat masuk gudang)
        const belanja = belanjaDateOf(b)
        if (belanja) setNewProcessDate(belanja)
        setShowGabahModal(false)
    }

    const selectBatch = (b: any) => {
        setSelectedDrying(null)
        setSelectedGabahId('')
        setSelectedBatchId(b.id)
        setGabahReservedKg(String(Number(b.remaining_kg ?? b.total_qty_kg ?? 0)))
        const belanja = belanjaDateOf(b)
        if (belanja) setNewProcessDate(belanja)
        setShowGabahModal(false)
    }

    const selectGabah = (item: any) => {
        setSelectedDrying(null)
        setSelectedBatchId('')
        setSelectedGabahId(item.id)
        setGabahReservedKg(String(item.remaining_weight_kg))
        const belanja = belanjaDateOf(item)
        if (belanja) setNewProcessDate(belanja)
        setShowGabahModal(false)
    }

    const handleCreate = async () => {
        if (!selectedGabahId && !selectedBatchId && !selectedDrying) { toast.error('Pilih item gabah terlebih dahulu'); return }
        let reserved = parseFloat(gabahReservedKg)
        if (!selectedDrying && (!reserved || reserved <= 0)) { toast.error('Masukkan jumlah gabah yang akan digiling'); return }

        try {
            setCreating(true)
            let inventoryItemId = selectedGabahId
            if (selectedDrying) {
                // Hasil jemur → gudang (berat & HPP/kg dihitung otomatis, termasuk biaya jemur), lalu digiling
                const moved = await inventoryAPI.createFromDrying(selectedDrying.dryingId, {
                    notes: 'Masuk gudang otomatis untuk proses giling',
                })
                const items = ((moved.data as any[]) || [])
                const item = items.find(i => i.batch_id === selectedDrying.batchId) || items[0]
                if (!item?.id) throw new Error('Gagal memindahkan hasil pengeringan ke gudang')
                const available = Number(item.remaining_weight_kg || 0)
                if (!reserved || reserved <= 0) reserved = available
                if (reserved > available) {
                    toast.error(`Hasil jemur sudah masuk gudang (${available.toLocaleString('id-ID')} kg). Kurangi jumlah giling lalu pilih dari Stok Gudang.`)
                    setShowCreateModal(false)
                    return
                }
                inventoryItemId = item.id
            } else if (selectedBatchId) {
                const batch = batchOptions.find(b => b.id === selectedBatchId)
                const available = Number(batch?.remaining_kg ?? batch?.total_qty_kg ?? 0)
                if (reserved > available) { toast.error(`Maksimal ${available.toLocaleString('id-ID')} kg dari batch ini`); return }
                const moved = await inventoryAPI.createFromBatch(selectedBatchId, {
                    tonnageKg: reserved,
                    notes: 'Masuk gudang otomatis untuk proses giling',
                })
                inventoryItemId = (moved.data as any)?.id
                if (!inventoryItemId) throw new Error('Gagal memindahkan batch ke gudang')
            }
            await processesAPI.create({
                inventoryItemId,
                gabahReservedKg: reserved,
                processDate: newProcessDate,
                notes: notes || undefined,
            })
            setShowCreateModal(false)
            setSelectedGabahId('')
            setSelectedBatchId('')
            setSelectedDrying(null)
            setGabahReservedKg('')
            setNewProcessDate(new Date().toISOString().split('T')[0])
            setNotes('')
            loadProcesses()
        } catch (error) {
            console.error('Failed to create process:', error)
            toast.error(error instanceof Error ? error.message : 'Gagal membuat proses')
        } finally {
            setCreating(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!await confirmDialog('Yakin ingin menghapus proses ini?')) return

        try {
            await processesAPI.delete(id)
            loadProcesses()
        } catch (error) {
            console.error('Failed to delete process:', error)
            toast.error(error instanceof Error ? error.message : 'Gagal menghapus proses')
        }
    }

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold">Proses Giling</h1>
                    <p className="text-stone-600 text-xs sm:text-sm mt-1">Kelola proses penggilingan gabah</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openCreateModal}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-light-green to-brand-light-green hover:from-brand-light-green hover:to-brand-light-green text-white font-medium rounded-lg transition-all"
                    >
                        <Plus size={18} />
                        Proses Baru
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
                        <option value="IN_PROGRESS">Sedang Proses</option>
                        <option value="COMPLETED">Selesai</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-stone-200 border border-stone-300 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="spinner"></div>
                    </div>
                ) : processes.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <table ref={tableCardsRef} className="table-cards w-full md:min-w-[650px]">
                                <thead>
                                    <tr className="text-xs text-stone-500 uppercase bg-stone-100/50">
                                        <th className="px-6 py-4 text-left font-semibold">Tanggal Proses</th>
                                        <th className="px-6 py-4 text-left font-semibold">Status</th>
                                        <th className="px-6 py-4 text-left font-semibold">Total Input (kg)</th>
                                        <th className="px-6 py-4 text-left font-semibold">Catatan</th>
                                        <th className="px-6 py-4 text-left font-semibold">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-300">
                                    {processes.map((process) => (
                                        <tr
                                            key={process.id}
                                            className="hover:bg-stone-300/80 cursor-pointer transition-colors"
                                            onClick={() => navigate(`/processes/${process.id}`)}
                                        >
                                            <td className="px-6 py-4">{formatDateShort(process.process_date)}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusClasses(process.status, 'milling')}`}>
                                                    {translateStatus(process.status, 'milling')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">{Number(process.gabah_reserved_kg || process.total_input_kg || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className="truncate max-w-[200px] block text-stone-600 text-sm">
                                                    {Number(process.gabah_reserved_kg || 0) > 0
                                                        ? `${Number(process.gabah_reserved_kg).toLocaleString()} kg gabah`
                                                        : (process.notes || '-')}
                                                </span>
                                                {process.rendemen_pct && (
                                                    <span className="inline-flex items-center gap-1 text-xs text-amber-400 mt-0.5">
                                                        <TrendingUp size={10} /> Rendemen: {process.rendemen_pct}%
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <Link
                                                        to={`/processes/${process.id}`}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-light-green/20 text-brand-light-green hover:bg-brand-light-green/30 rounded-lg text-sm font-medium transition-colors"
                                                    >
                                                        <Eye size={14} />
                                                        Detail
                                                    </Link>
                                                    {process.status !== 'IN_WAREHOUSE' && process.status !== 'COMPLETED' && (
                                                        <button
                                                            onClick={() => handleDelete(process.id)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
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
                                Menampilkan {processes.length} dari {pagination.total} proses
                            </span>
                            <div className="flex gap-2">
                                <button
                                    className="px-3 py-1.5 text-sm bg-stone-300 border border-stone-400 rounded-lg disabled:opacity-50"
                                    disabled={pagination.page === 1}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                >
                                    Sebelumnya
                                </button>
                                <button
                                    className="px-3 py-1.5 text-sm bg-stone-300 border border-stone-400 rounded-lg disabled:opacity-50"
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
                        <Factory className="text-stone-500 mb-4" size={48} />
                        <h3 className="font-semibold mb-2">Belum Ada Proses</h3>
                        <p className="text-stone-600 text-sm mb-6 max-w-sm text-center">
                            Mulai dengan membuat proses penggilingan baru.
                        </p>
                        <button
                            onClick={openCreateModal}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-light-green hover:bg-brand-light-green/80 text-stone-900 font-medium rounded-lg transition-colors"
                        >
                            <Plus size={18} />
                            Buat Proses Pertama
                        </button>
                    </div>
                )}
            </div>

            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Buat Proses Giling Baru"
                footer={
                    <>
                        <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-stone-300 hover:bg-stone-400 rounded-lg text-sm font-medium transition-colors">Batal</button>
                        <button onClick={handleCreate} disabled={creating || (!selectedGabahId && !selectedBatchId && !selectedDrying) || (!selectedDrying && !gabahReservedKg)}
                            className="px-4 py-2 bg-brand-light-green text-white   hover:bg-brand-light-green/80 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                            {creating ? 'Membuat...' : 'Mulai Proses'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    {/* Tanggal */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Tanggal Proses <span className="text-red-500">*</span></label>
                        <input type="date" className="w-full px-4 py-3 bg-stone-300 border border-stone-400 rounded-lg focus:outline-none focus:border-brand-light-green"
                            value={newProcessDate} onChange={e => setNewProcessDate(e.target.value)} />
                        <p className="text-xs text-stone-500 mt-1">Otomatis mengikuti tanggal belanja gabah yang dipilih (bisa diubah).</p>
                    </div>

                    {/* Pilih Gabah dari Inventory */}
                    <div>
                        <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                            <Wheat size={14} className="text-amber-400" /> Pilih Gabah dari Inventory <span className="text-red-500">*</span>
                        </label>
                        {loadingGabah ? (
                            <div className="text-sm text-stone-500 py-3">Memuat stok gabah...</div>
                        ) : gabahItems.length === 0 && batchOptions.length === 0 && dryingBatches.length === 0 ? (
                            <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3 text-sm text-amber-300">
                                ⚠ Tidak ada gabah yang bisa digiling: tidak ada stok gabah di gudang, tidak ada batch belanja yang belum dijemur, dan tidak ada batch di pengeringan.
                            </div>
                        ) : (
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setShowGabahModal(true)}
                                    className="w-full h-11 bg-stone-300 hover:bg-stone-400 border border-stone-400 rounded-xl text-xs font-bold flex items-center justify-center gap-3 transition-all active:scale-95"
                                >
                                    <Wheat size={16} />
                                    {selectedGabahId
                                        ? getGabahDisplay(selectedGabahId)
                                        : selectedDrying
                                            ? (() => { const b = dryingBatches.find(x => x.id === selectedDrying.batchId); return b ? `Hasil jemur · Belanja ${formatDateShort(b.batch_date)} · ${Number(b.total_qty_kg || 0).toLocaleString('id-ID')} kg (masuk gudang otomatis)` : 'Hasil pengeringan' })()
                                        : selectedBatchId
                                            ? (() => { const b = batchOptions.find(x => x.id === selectedBatchId); return b ? `Batch belanja ${formatDateShort(b.batch_date)} · ${Number(b.remaining_kg ?? b.total_qty_kg ?? 0).toLocaleString('id-ID')} kg (masuk gudang otomatis)` : 'Batch belanja' })()
                                            : '-- Pilih stok gabah --'}
                                </button>
                                {(selectedGabahId || selectedBatchId || selectedDrying) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedGabahId('')
                                            setSelectedBatchId('')
                                            setSelectedDrying(null)
                                            setGabahReservedKg('')
                                        }}
                                        className="mt-2 text-xs text-stone-500 hover:text-red-400 transition-colors"
                                    >
                                        × Batalkan pilihan
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Jumlah Gabah yang akan digiling */}
                    {(selectedGabahId || selectedBatchId || selectedDrying) && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Jumlah Gabah yang Akan Digiling (kg) <span className="text-red-500">*</span>
                            </label>
                            <NumberInput  className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                                placeholder="0" value={gabahReservedKg} onChange={e => setGabahReservedKg(e.target.value)}
                                max={gabahItems.find(i => i.id === selectedGabahId)?.remaining_weight_kg} />
                            <p className="text-xs text-stone-500 mt-1">
                                {selectedDrying ? 'Kosongkan untuk menggiling semua hasil jemur (berat dihitung otomatis dari kadar air).' : <>Maks: {Number(selectedBatchId
                                    ? (batchOptions.find(b => b.id === selectedBatchId)?.remaining_kg ?? batchOptions.find(b => b.id === selectedBatchId)?.total_qty_kg ?? 0)
                                    : (gabahItems.find(i => i.id === selectedGabahId)?.remaining_weight_kg || 0)).toLocaleString()} kg</>}
                            </p>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Catatan (Opsional)</label>
                        <textarea rows={2} className="w-full px-4 py-3 bg-stone-300 border border-stone-400 rounded-lg focus:outline-none focus:border-brand-light-green resize-none"
                            placeholder="Catatan untuk proses ini..." value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                </div>
            </Modal>

            {/* Gabah Selection Modal */}
            <Modal
                isOpen={showGabahModal}
                onClose={() => setShowGabahModal(false)}
                title="Pilih Gabah untuk Digiling"
                size="lg"
                footer={
                    <>
                        <button
                            onClick={() => setShowGabahModal(false)}
                            className="px-4 py-2 bg-stone-300 hover:bg-stone-400 rounded-lg text-sm font-medium transition-colors"
                        >
                            Tutup
                        </button>
                    </>
                }
            >
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {(() => {
                        const reguler = gabahItems.filter(i => !i.is_titipan)
                        const titipan = gabahItems.filter(i => i.is_titipan)

                        return (
                            <>
                                {/* Gabah Pribadi/Reguler */}
                                {reguler.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            Gabah Pribadi
                                        </p>
                                        <div className="space-y-2">
                                            {reguler.map(item => (
                                                <label
                                                    key={item.id}
                                                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedGabahId === item.id
                                                        ? 'bg-blue-500/20 border-blue-500/50'
                                                        : 'bg-stone-300/50 border-stone-400 hover:border-stone-500'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="radio"
                                                            name="gabah-milling-picker"
                                                            checked={selectedGabahId === item.id}
                                                            onChange={() => selectGabah(item)}
                                                            className="w-4 h-4"
                                                        />
                                                        <div>
                                                            <p className="font-medium text-sm">{item.area || 'Gabah Pribadi'}</p>
                                                            <p className="text-xs text-stone-500">
                                                                {(item.batch_date || item.entry_date || item.created_at) && `Belanja ${formatDateShort(item.batch_date || item.entry_date || item.created_at)}`}
                                                                {item.initial_batch_weight_kg ? ` · ${Number(item.initial_batch_weight_kg).toLocaleString()} kg` : ''}
                                                                {` · sisa ${Number(item.remaining_weight_kg).toLocaleString()} kg`}
                                                                {item.tanda ? ` · ${item.tanda}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {selectedGabahId === item.id && (
                                                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">Dipilih</span>
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Gabah Titipan */}
                                {titipan.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-xs font-semibold text-cyan-500/80 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <Tag size={11} /> Gabah Titipan (Sudah Kering)
                                        </p>
                                        <div className="space-y-2">
                                            {titipan.map(item => {
                                                const td = item.titipan_data
                                                return (
                                                    <label
                                                        key={item.id}
                                                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedGabahId === item.id
                                                            ? 'bg-cyan-500/15 border-cyan-500/50'
                                                            : 'bg-stone-300/50 border-stone-400 hover:border-cyan-500/30'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="radio"
                                                                name="gabah-milling-picker"
                                                                checked={selectedGabahId === item.id}
                                                                onChange={() => selectGabah(item)}
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
                                                                    {(item.batch_date || item.entry_date || item.created_at) && `Masuk ${formatDateShort(item.batch_date || item.entry_date || item.created_at)} · `}
                                                                    {td?.jenisGabah || '-'}
                                                                    {item.initial_batch_weight_kg ? ` · ${Number(item.initial_batch_weight_kg).toLocaleString()} kg` : ''}
                                                                    {` · sisa ${Number(item.remaining_weight_kg).toLocaleString()} kg`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {selectedGabahId === item.id && (
                                                            <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-bold">Dipilih</span>
                                                        )}
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Batch belanja yang belum masuk gudang */}
                                {batchOptions.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest mb-1">
                                            Batch Belanja (belum masuk gudang)
                                        </p>
                                        <p className="text-[11px] text-stone-500 mb-2">Jumlah yang digiling otomatis dipindahkan ke gudang saat proses dibuat.</p>
                                        <div className="space-y-2">
                                            {batchOptions.map(b => (
                                                <label
                                                    key={b.id}
                                                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedBatchId === b.id
                                                        ? 'bg-amber-500/15 border-amber-500/50'
                                                        : 'bg-stone-300/50 border-stone-400 hover:border-amber-500/40'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="radio"
                                                            name="gabah-milling-picker"
                                                            checked={selectedBatchId === b.id}
                                                            onChange={() => selectBatch(b)}
                                                            className="w-4 h-4"
                                                        />
                                                        <div>
                                                            <p className="font-medium text-sm">{b.farmers || b.jenis_gabah || 'Batch Belanja'}</p>
                                                            <p className="text-xs text-stone-500">
                                                                {`Belanja ${formatDateShort(b.batch_date)}`}
                                                                {` · ${Number(b.total_qty_kg || 0).toLocaleString()} kg`}
                                                                {` · sisa ${Number(b.remaining_kg ?? b.total_qty_kg ?? 0).toLocaleString()} kg`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {selectedBatchId === b.id && (
                                                        <span className="text-[10px] bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded-full font-bold">Dipilih</span>
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Batch di pengeringan yang belum masuk gudang: tidak bisa langsung digiling */}
                                {dryingBatches.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-xs font-semibold text-sky-700 uppercase tracking-widest mb-1">
                                            Hasil Pengeringan (belum masuk gudang)
                                        </p>
                                        <p className="text-[11px] text-stone-500 mb-2">
                                            Yang sudah disetujui bisa langsung dipilih (otomatis masuk gudang). Yang lain perlu diselesaikan/disetujui dulu di halaman pengeringan.
                                        </p>
                                        <div className="space-y-2">
                                            {dryingBatches.map(b => {
                                                const st = b.drying?.status
                                                const label = st === 'COMPLETED' ? 'Disetujui — belum dipindah ke gudang'
                                                    : st === 'PENDING_APPROVAL' ? 'Menunggu persetujuan'
                                                    : st === 'IN_PROGRESS' ? 'Sedang dijemur'
                                                    : 'Belum mulai dijemur'
                                                if (st === 'COMPLETED') {
                                                    return (
                                                        <label
                                                            key={b.id}
                                                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedDrying?.batchId === b.id
                                                                ? 'bg-sky-500/15 border-sky-500/50'
                                                                : 'bg-stone-300/50 border-stone-400 hover:border-sky-500/40'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <input
                                                                    type="radio"
                                                                    name="gabah-milling-picker"
                                                                    checked={selectedDrying?.batchId === b.id}
                                                                    onChange={() => selectDrying(b)}
                                                                    className="w-4 h-4"
                                                                />
                                                                <div>
                                                                    <p className="font-medium text-sm">{b.farmers || b.jenis_gabah || 'Batch Belanja'}</p>
                                                                    <p className="text-xs text-stone-500">
                                                                        {`Belanja ${formatDateShort(b.batch_date)} · ${Number(b.total_qty_kg || 0).toLocaleString()} kg`}
                                                                    </p>
                                                                    <p className="text-[11px] font-semibold text-sky-700">Sudah dijemur & disetujui — siap digiling (masuk gudang otomatis)</p>
                                                                </div>
                                                            </div>
                                                            {selectedDrying?.batchId === b.id && (
                                                                <span className="text-[10px] bg-sky-500/20 text-sky-700 px-2 py-0.5 rounded-full font-bold">Dipilih</span>
                                                            )}
                                                        </label>
                                                    )
                                                }
                                                return (
                                                    <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-stone-300 bg-stone-200/60">
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-sm truncate">{b.farmers || b.jenis_gabah || 'Batch Belanja'}</p>
                                                            <p className="text-xs text-stone-500">
                                                                {`Belanja ${formatDateShort(b.batch_date)} · ${Number(b.total_qty_kg || 0).toLocaleString()} kg`}
                                                            </p>
                                                            <p className="text-[11px] font-semibold text-sky-700">{label}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setShowGabahModal(false); setShowCreateModal(false); navigate(`/drying/${b.drying.id}`) }}
                                                            className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-700 text-white"
                                                        >
                                                            Buka Pengeringan
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {reguler.length === 0 && titipan.length === 0 && batchOptions.length === 0 && dryingBatches.length === 0 && (
                                    <p className="text-stone-500 text-sm text-center py-8">Tidak ada gabah tersedia</p>
                                )}
                            </>
                        )
                    })()}
                </div>
            </Modal>
        </div>
    )
}
