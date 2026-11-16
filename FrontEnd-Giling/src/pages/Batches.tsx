import toast from 'react-hot-toast'
import { useTableCards } from '@/utils/useTableCards'
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { batchesAPI } from '@/api/client'
import Modal from '@/components/ui/Modal'
import { Plus, Eye, Trash2, Package, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDateShort, getStatusClasses, translateStatus } from '@/utils/helpers'
import { confirmDialog } from '@/utils/confirmDialog'
import type { Batch } from '@/types'

interface Pagination {
    page: number
    total: number
    totalPages: number
}

const JENIS_GABAH_OPTIONS = [
    'IR64',
    'Ciherang',
    'Mekongga',
    'Inpari',
    'Situ Bagendit',
    'Rojolele',
    'Mentik Wangi',
    'Lainnya'
]

export default function Batches() {
    const tableCardsRef = useTableCards()

    const navigate = useNavigate()
    const [batches, setBatches] = useState<Batch[]>([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, totalPages: 0 })
    const [statusFilter, setStatusFilter] = useState('')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newBatchDate, setNewBatchDate] = useState(new Date().toISOString().split('T')[0])
    const [newJenisGabah, setNewJenisGabah] = useState(JENIS_GABAH_OPTIONS[0])
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        loadBatches()
    }, [pagination.page, statusFilter])

    const loadBatches = async () => {
        try {
            setLoading(true)
            const params: Record<string, string | number> = { page: pagination.page, limit: 10 }
            if (statusFilter) params.status = statusFilter

            const response = await batchesAPI.getAll(params)
            setBatches(response.data || [])
            setPagination(prev => ({
                ...prev,
                total: response.pagination?.total || 0,
                totalPages: response.pagination?.totalPages || 1,
            }))
        } catch (error) {
            console.error('Failed to load batches:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async () => {
        try {
            setCreating(true)
            await batchesAPI.create({ batchDate: newBatchDate, jenisGabah: newJenisGabah })
            setShowCreateModal(false)
            setNewBatchDate(new Date().toISOString().split('T')[0])
            setNewJenisGabah(JENIS_GABAH_OPTIONS[0])
            loadBatches()
        } catch (error) {
            console.error('Failed to create batch:', error)
            toast.error(error instanceof Error ? error.message : 'Gagal membuat batch')
        } finally {
            setCreating(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!await confirmDialog('Yakin ingin menghapus batch ini?')) return

        try {
            await batchesAPI.delete(id)
            loadBatches()
        } catch (error) {
            console.error('Failed to delete batch:', error)
            toast.error(error instanceof Error ? error.message : 'Gagal menghapus batch')
        }
    }

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold">Belanja Gabah</h1>
                    <p className="text-stone-600 text-xs sm:text-sm mt-1">Kelola batch pembelanjaan gabah</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-light-green to-brand-light-green hover:from-brand-light-green hover:to-brand-light-green text-white font-medium rounded-lg transition-all"
                    >
                        <Plus size={18} />
                        Batch Baru
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <span className="text-stone-600 text-sm hidden sm:inline">Status:</span>
                    <select
                        className="px-3 py-2.5 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green min-h-[44px]"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value)
                            setPagination(prev => ({ ...prev, page: 1 }))
                        }}
                    >
                        <option value="">Semua Status</option>
                        <option value="OPEN">Terbuka</option>
                        <option value="CLOSED">Tertutup</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-stone-200 border border-stone-300 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="spinner"></div>
                    </div>
                ) : batches.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <table ref={tableCardsRef} className="table-cards w-full md:min-w-[650px]">
                                <thead>
                                    <tr className="text-xs text-stone-500 uppercase bg-stone-100/50">
                                        <th className="px-6 py-4 text-left font-semibold">Tanggal Batch</th>
                                        <th className="px-6 py-4 text-left font-semibold">Status</th>
                                        <th className="px-6 py-4 text-left font-semibold">Kondisi</th>
                                        <th className="px-6 py-4 text-left font-semibold">Total Gabah (kg)</th>
                                        <th className="px-6 py-4 text-left font-semibold">Sisa (kg)</th>
                                        <th className="px-6 py-4 text-left font-semibold">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-300">
                                    {batches.map((batch) => {
                                        const isActive = (batch as { is_active?: boolean }).is_active !== false
                                        return (
                                            <tr
                                                key={batch.id}
                                                onClick={() => navigate(`/batches/${batch.id}`)}
                                                className={`transition-colors cursor-pointer ${isActive ? 'hover:bg-stone-300/50' : 'bg-red-500/5 opacity-60'}`}
                                            >
                                                <td className="px-6 py-4">{formatDateShort(batch.batch_date)}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusClasses(batch.status)}`}>
                                                        {translateStatus(batch.status)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-brand-light-green/20 text-brand-light-green' : 'bg-red-500/20 text-red-500'}`}>
                                                        {isActive ? 'Aktif' : 'Nonaktif'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">{Number(batch.total_qty_kg || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4">{Number(batch.remaining_kg || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Link
                                                            to={`/batches/${batch.id}`}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-light-green/20 text-brand-light-green hover:bg-brand-light-green/30 rounded-lg text-sm font-medium transition-colors"
                                                        >
                                                            <Eye size={14} />
                                                            Detail
                                                        </Link>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(batch.id) }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-400/[.85] text-red-800 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                            Hapus
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-stone-300">
                            <span className="text-xs sm:text-sm text-stone-600">
                                <span className="hidden sm:inline">Menampilkan </span>
                                {batches.length}
                                <span className="hidden sm:inline"> dari {pagination.total} batch</span>
                                <span className="sm:hidden"> / {pagination.total}</span>
                            </span>
                            <div className="flex gap-1.5">
                                <button
                                    className="w-10 h-10 flex items-center justify-center bg-stone-300 border border-stone-400 rounded-lg disabled:opacity-40 hover:bg-stone-400 transition-colors"
                                    disabled={pagination.page === 1}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                    aria-label="Halaman sebelumnya"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <span className="w-10 h-10 flex items-center justify-center text-sm text-stone-600 font-medium">
                                    {pagination.page}
                                </span>
                                <button
                                    className="w-10 h-10 flex items-center justify-center bg-stone-300 border border-stone-400 rounded-lg disabled:opacity-40 hover:bg-stone-400 transition-colors"
                                    disabled={pagination.page >= pagination.totalPages}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                    aria-label="Halaman selanjutnya"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Package className="text-stone-500 mb-4" size={48} />
                        <h3 className="font-semibold mb-2">Belum Ada Batch</h3>
                        <p className="text-stone-600 text-sm mb-6 max-w-sm text-center">
                            Mulai dengan membuat batch baru untuk mengelola pembelian gabah.
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-light-green hover:bg-brand-light-green/80 text-white font-medium rounded-lg transition-colors"
                        >
                            <Plus size={18} />
                            Buat Batch Pertama
                        </button>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Buat Batch Baru"
                footer={
                    <div className='mb-4 flex justify-end gap-4'>
                        <button
                            onClick={() => setShowCreateModal(false)}
                            className="px-4 py-2 bg-stone-300 hover:bg-stone-400 rounded-lg text-sm font-medium transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={creating}
                            className="px-4 py-2 bg-brand-light-green hover:bg-brand-light-green/80 rounded-lg text-sm font-medium transition-colors text-white disabled:opacity-50"
                        >
                            {creating ? 'Membuat...' : 'Buat Batch'}
                        </button>
                    </div>
                }
            >
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Tanggal Batch</label>
                    <input
                        type="date"
                        className="w-full px-4 py-3 bg-stone-300 border border-stone-400 rounded-lg focus:outline-none focus:border-brand-light-green"
                        value={newBatchDate}
                        onChange={(e) => setNewBatchDate(e.target.value)}
                    />
                    <p className="text-stone-600 text-xs mt-2">Tanggal pembelian gabah</p>
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Jenis Gabah</label>
                    <select
                        className="w-full px-4 py-3 bg-stone-300 border border-stone-400 rounded-lg focus:outline-none focus:border-brand-light-green appearance-none"
                        value={newJenisGabah}
                        onChange={(e) => setNewJenisGabah(e.target.value)}
                        required
                    >
                        {JENIS_GABAH_OPTIONS.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </div>
            </Modal>
        </div>
    )
}
