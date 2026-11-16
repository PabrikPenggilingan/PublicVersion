import { useState, useEffect, useCallback } from 'react'
import { getCleanErrorMessage } from '@/errors'
import { BrainCircuit, Calendar, Clock, Trash2, Eye, AlertCircle, Sparkles, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { aiAnalysisAPI, type AIAnalysisReport } from '@/api/client'
import toast from 'react-hot-toast'
import { confirmDialog } from '@/utils/confirmDialog'

type Tab = 'buat' | 'riwayat'

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
    pending: { label: 'Sedang diproses', classes: 'bg-amber-500/20 text-amber-400' },
    processing: { label: 'Sedang diproses', classes: 'bg-amber-500/20 text-amber-500' },
    completed: { label: 'Tersedia', classes: 'bg-brand-light-green/20 text-brand-light-green' },
    failed: { label: 'Gagal', classes: 'bg-red-500/20 text-red-400' },
}

function formatPeriod(from: string, to: string): string {
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
    const f = new Date(from).toLocaleDateString('id-ID', opts)
    const t = new Date(to).toLocaleDateString('id-ID', opts)
    return `${f} – ${t}`
}

// ── Sub-components ──────────────────────────────────────────────────────────

function BuatTab({ onSuccess }: { onSuccess: () => void }) {
    const today = new Date().toISOString().split('T')[0]
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    const [fromDate, setFromDate] = useState(firstOfMonth)
    const [toDate, setToDate] = useState(today)
    const [loading, setLoading] = useState(false)

    const handleCreate = async () => {
        if (!fromDate || !toDate) {
            toast.error('Harap isi kedua tanggal.')
            return
        }
        if (new Date(fromDate) >= new Date(toDate)) {
            toast.error('"Dari Tanggal" harus lebih awal dari "Sampai Tanggal".')
            return
        }
        try {
            setLoading(true)
            await aiAnalysisAPI.create({ fromDate, toDate })
            toast.success('Analisis AI sedang diproses! Cek tab Riwayat.')
            onSuccess()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal membuat analisis.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-lg">
            {/* Section heading */}
            <h2 className="text-base font-semibold text-stone-700 mb-6">Pilih rentang waktu</h2>

            <div className="space-y-5">
                {/* From date */}
                <div>
                    <label htmlFor="ai-from-date" className="block text-sm font-medium text-stone-700 mb-2">
                        Dari Tanggal:
                    </label>
                    <input
                        id="ai-from-date"
                        type="date"
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        max={toDate}
                        className="w-64 px-4 py-2.5 bg-brand-light-green/20 border border-brand-light-green/40 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-light-green/50 transition-all text-sm [color-scheme:dark]"
                    />
                </div>

                {/* To date */}
                <div>
                    <label htmlFor="ai-to-date" className="block text-sm font-medium text-stone-700 mb-2">
                        Sampai Tanggal:
                    </label>
                    <input
                        id="ai-to-date"
                        type="date"
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                        min={fromDate}
                        max={today}
                        className="w-64 px-4 py-2.5 bg-brand-light-green/20 border border-brand-light-green/40 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-light-green/50 transition-all text-sm [color-scheme:dark]"
                    />
                </div>

                {/* Submit */}
                <button
                    id="ai-create-btn"
                    onClick={handleCreate}
                    disabled={loading}
                    className="inline-flex text-white items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-light-green to-brand-light-green hover:from-brand-light-green hover:to-brand-light-green text-stone-900 font-medium rounded-lg transition-all shadow-lg shadow-brand-light-green/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                    {loading ? (
                        <><Loader2 size={16} className="animate-spin" /> Memproses...</>
                    ) : (
                        <><Sparkles size={16} /> Buat</>
                    )}
                </button>
            </div>

            {/* Tip */}
            <div className="mt-10 flex items-start gap-2 text-sm text-stone-600">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-brand-light-green" />
                <p>
                    <span className="font-semibold text-stone-700">Tip:</span>{' '}
                    Gunakan rentang waktu satu bulan untuk menghasilkan analisis AI yang paling akurat dan komprehensif.
                </p>
            </div>
        </div>
    )
}

interface RiwayatTabProps {
    reports: AIAnalysisReport[]
    loading: boolean
    pagination: { page: number; total: number; totalPages: number }
    onPageChange: (page: number) => void
    onDelete: (id: string) => void
    onView: (report: AIAnalysisReport) => void
}

function RiwayatTab({ reports, loading, pagination, onPageChange, onDelete, onView }: RiwayatTabProps) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="spinner" />
            </div>
        )
    }

    return (
        <div className="bg-stone-200 border border-stone-300 rounded-xl overflow-hidden">
            {reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <BrainCircuit className="text-stone-500 mb-4" size={48} />
                    <h3 className="font-semibold mb-2 text-stone-900">Belum Ada Riwayat</h3>
                    <p className="text-stone-600 text-sm text-center max-w-xs">
                        Buat analisis AI pertama Anda di tab "Buat Analisis".
                    </p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[500px]">
                            <thead>
                                <tr className="text-xs text-stone-500 uppercase bg-stone-100/50">
                                    <th className="px-6 py-4 text-left font-semibold">Periode</th>
                                    <th className="px-6 py-4 text-left font-semibold">Status</th>
                                    <th className="px-6 py-4 text-left font-semibold">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-300">
                                {reports.map(report => {
                                    const statusCfg = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.pending
                                    const isReady = report.status === 'completed'
                                    const isProcessing = report.status === 'pending' || report.status === 'processing'

                                    return (
                                        <tr
                                            key={report.id}
                                            className="transition-colors hover:bg-stone-300/50"
                                        >
                                            <td className="px-6 py-4 text-sm text-stone-900">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-stone-600 shrink-0" />
                                                    {formatPeriod(report.from_date, report.to_date)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.classes}`}>
                                                    {isProcessing && <Loader2 size={10} className="animate-spin" />}
                                                    {statusCfg.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        id={`ai-view-${report.id}`}
                                                        onClick={() => onView(report)}
                                                        disabled={!isReady}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isReady
                                                            ? 'bg-brand-light-green/20 text-brand-light-green hover:bg-brand-light-green/30'
                                                            : 'bg-stone-300/40 text-stone-400 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        <Eye size={14} />
                                                        Lihat
                                                    </button>
                                                    <button
                                                        id={`ai-delete-${report.id}`}
                                                        onClick={() => onDelete(report.id)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
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
                    <div className="flex items-center justify-between px-6 py-4 border-t border-stone-300">
                        <span className="text-sm text-stone-600">
                            Menampilkan {reports.length} dari {pagination.total} batch
                        </span>
                        <div className="flex gap-2">
                            <button
                                id="ai-prev-page"
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-stone-300 border border-stone-400 rounded-lg disabled:opacity-50 hover:bg-stone-400 transition-colors"
                                disabled={pagination.page === 1}
                                onClick={() => onPageChange(pagination.page - 1)}
                            >
                                <ChevronLeft size={14} />
                                Sebelumnya
                            </button>
                            <button
                                id="ai-next-page"
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-stone-300 border border-stone-400 rounded-lg disabled:opacity-50 hover:bg-stone-400 transition-colors"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => onPageChange(pagination.page + 1)}
                            >
                                Selanjutnya
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

// ── Main Page ────────────────────────────────────────────────────────────────

const DUMMY_REPORTS: AIAnalysisReport[] = [
    {
        id: '4',
        from_date: '2026-06-01',
        to_date: '2026-07-01',
        status: 'processing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: '3',
        from_date: '2026-05-01',
        to_date: '2026-06-01',
        status: 'completed',
        report_content: 'Dummy report content for May - June',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: '2',
        from_date: '2026-04-01',
        to_date: '2026-05-01',
        status: 'completed',
        report_content: 'Dummy report content for April - May',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: '1',
        from_date: '2026-03-01',
        to_date: '2026-04-01',
        status: 'completed',
        report_content: 'Dummy report content for March - April',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }
]

export default function AIAnalysis() {
    const [activeTab, setActiveTab] = useState<Tab>('buat')
    const [reports, setReports] = useState<AIAnalysisReport[]>([])
    const [loadingList, setLoadingList] = useState(false)
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })

    const loadReports = useCallback(async (page = 1) => {
        setLoadingList(true)
        // Simulate API delay
        setTimeout(() => {
            setReports(DUMMY_REPORTS)
            setPagination({
                page,
                total: DUMMY_REPORTS.length,
                totalPages: 1,
            })
            setLoadingList(false)
        }, 500)
    }, [])

    // Load history whenever tab switches to riwayat
    useEffect(() => {
        if (activeTab === 'riwayat') {
            loadReports(1)
        }
    }, [activeTab, loadReports])

    const handleDelete = async (id: string) => {
        if (!await confirmDialog('Yakin ingin menghapus laporan analisis ini?')) return
        setReports(prev => prev.filter(r => r.id !== id))
        toast.success('Laporan dihapus (Mock).')
    }

    const handleView = (_report: AIAnalysisReport) => {
        // Open the PDF in a new tab as requested
        window.open('/contoh_ai-analysis.pdf', '_blank')
    }

    const handleCreateSuccess = () => {
        setActiveTab('riwayat')
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2.5 bg-gradient-to-br from-brand-light-green to-purple-600 rounded-xl shadow-lg shadow-brand-light-green/20">
                            <BrainCircuit size={22} className="text-stone-900" />
                        </div>
                        <h1 className="text-3xl font-bold text-stone-900 tracking-tight">AI Analysis</h1>
                    </div>
                    <p className="text-stone-600 text-sm ml-[52px]">
                        Hasilkan laporan analisis bisnis bulanan secara otomatis menggunakan AI.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-widest">
                    <Clock size={14} />
                    <span>Powered by AI</span>
                </div>
            </div>

            {/* ── Tab Bar ── */}
            <div className="border-b border-stone-300">
                <div className="flex gap-0">
                    {([
                        { key: 'buat' as Tab, label: 'Buat Analisis' },
                        { key: 'riwayat' as Tab, label: 'Riwayat' },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            id={`ai-tab-${tab.key}`}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-5 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${activeTab === tab.key
                                ? 'border-brand-light-green text-brand-light-green bg-brand-light-green/5'
                                : 'border-transparent text-stone-600 hover:text-stone-800 hover:border-stone-400'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tab Content ── */}
            <div>
                {activeTab === 'buat' && (
                    <BuatTab onSuccess={handleCreateSuccess} />
                )}

                {activeTab === 'riwayat' && (
                    <RiwayatTab
                        reports={reports}
                        loading={loadingList}
                        pagination={pagination}
                        onPageChange={page => loadReports(page)}
                        onDelete={handleDelete}
                        onView={handleView}
                    />
                )}
            </div>
        </div>
    )
}
