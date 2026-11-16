import { useState, useEffect } from 'react'
import { useTableCards } from '@/utils/useTableCards'
import { getCleanErrorMessage } from '@/errors'
import { useNavigate } from 'react-router-dom'
import {
    Plus, Search, ShoppingCart, Filter, Calendar,
    ChevronRight, AlertCircle,
    Clock,
    FileText, Download, TrendingUp
} from 'lucide-react'
import { salesV2API } from '@/api/client'
import { SaleV2 } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { cn } from '@/utils/helpers'

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-stone-300 text-stone-700 border-stone-400',
    CONFIRMED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    PARTIAL_DELIVERED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    COMPLETED: 'bg-brand-light-green/10 text-brand-light-green border-brand-light-green/20',
    VOID: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const PAYMENT_COLORS: Record<string, string> = {
    UNPAID: 'bg-red-500/10 text-red-400',
    PARTIAL: 'bg-amber-500/10 text-amber-400',
    PAID: 'bg-brand-light-green/10 text-brand-light-green',
}

export default function SalesList() {
    const tableCardsRef = useTableCards()

    const navigate = useNavigate()
    const [sales, setSales] = useState<SaleV2[]>([])
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)

    useEffect(() => {
        fetchData()
        fetchStats()
    }, [page, statusFilter])

    const fetchData = async () => {
        try {
            setLoading(true)
            const res = await salesV2API.getAll({
                page,
                limit: 10,
                status: statusFilter === 'all' ? undefined : statusFilter
            })
            setSales(res.data)
            setTotal(res.pagination?.total || 0)
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal memuat data penjualan')
        } finally {
            setLoading(false)
        }
    }

    const fetchStats = async () => {
        try {
            const res = await salesV2API.getStats()
            setStats(res.data)
        } catch (err) { }
    }

    const handleCreateSale = async () => {
        try {
            const res = await salesV2API.create({
                saleDate: new Date().toISOString()
            })
            toast.success('Draft nota baru dibuat')
            navigate(`/sales/${res.data.id}`)
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal membuat nota')
        }
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-200 p-6 rounded-2xl border border-stone-300 shadow-xl relative overflow-hidden">
                {/* Decorative background */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-light-green/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

                <div>
                    <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-3">
                        <ShoppingCart className="text-brand-light-green" />
                        Penjualan Produk
                    </h1>
                    <p className="text-stone-600 mt-1">Kelola nota penjualan, pengiriman barang, dan pembayaran piutang</p>
                </div>
                <Button
                    onClick={handleCreateSale}
                    className="bg-brand-light-green hover:bg-brand-light-green text-white gap-2 px-6 shadow-lg shadow-brand-light-green/20 relative z-10"
                >
                    <Plus size={18} />
                    Buat Nota Penjualan
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Aktif / Outstanding"
                    value={stats?.total_active || 0}
                    subValue={`Total Rp ${Math.max(0, parseFloat(stats?.total_outstanding || "0")).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon={<Clock className="text-amber-400" />}
                    color="amber"
                />
                <StatCard
                    label="Belum Lunas"
                    value={stats?.unpaid_count || 0}
                    icon={<AlertCircle className="text-red-400" />}
                    color="red"
                />
                <StatCard
                    label="Pendapatan (Bulan Ini)"
                    value={`Rp ${parseFloat(stats?.this_month_revenue || "0").toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon={<TrendingUp className="text-brand-light-green" />}
                    color="emerald"
                />
                <StatCard
                    label="Total Nota"
                    value={total}
                    icon={<FileText className="text-blue-400" />}
                    color="blue"
                />
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
                    <Input
                        placeholder="Cari nomor nota atau nama pelanggan..."
                        className="pl-10 h-11"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        className="bg-stone-200 border-stone-300 text-stone-900 rounded-lg px-4 py-2 text-sm focus:ring-brand-light-green h-11"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Semua Status</option>
                        <option value="DRAFT">Draft</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="PARTIAL_DELIVERED">Partial Delivery</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="VOID">Void</option>
                    </select>
                    <Button variant="outline" className="border-stone-300 hover:bg-stone-300 h-11 px-3">
                        <Filter size={18} />
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-stone-200 border border-stone-300 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table ref={tableCardsRef} className="table-cards w-full text-left text-sm">
                        <thead className="bg-stone-100/50 text-stone-600 text-[10px] uppercase tracking-widest font-bold">
                            <tr>
                                <th className="px-6 py-4">No. Nota / Tanggal</th>
                                <th className="px-6 py-4">Pelanggan</th>
                                <th className="px-6 py-4">Total Tagihan</th>
                                <th className="px-6 py-4">Sisa Bayar</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Pembayaran</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-300">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-6 py-4 h-16 bg-stone-200/50" />
                                    </tr>
                                ))
                            ) : sales.length > 0 ? (
                                sales.map((sale) => (
                                    <tr
                                        key={sale.id}
                                        className="hover:bg-stone-300/30 transition-colors group cursor-pointer"
                                        onClick={() => navigate(`/sales/${sale.id}`)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-stone-900 group-hover:text-brand-light-green transition-colors">
                                                {sale.sale_no || <span className="text-stone-500 italic">DRAFT</span>}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-0.5">
                                                <Calendar size={12} />
                                                {format(new Date(sale.sale_date), 'dd MMM yyyy', { locale: id })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-stone-800">{sale.customer_name || '-'}</div>
                                            <div className="text-[10px] px-1.5 py-0.5 bg-stone-300 text-stone-600 rounded inline-block mt-1">
                                                {sale.tier_name || 'Umum'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-medium text-stone-900">
                                            Rp {parseFloat(sale.total_amount.toString()).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 font-mono">
                                            <span className={Math.max(0, parseFloat(sale.outstanding.toString())) > 0 ? 'text-red-400' : 'text-brand-light-green'}>
                                                Rp {Math.max(0, parseFloat(sale.outstanding.toString())).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                'px-2 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider',
                                                STATUS_COLORS[sale.status]
                                            )}>
                                                {sale.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                'px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider',
                                                PAYMENT_COLORS[sale.payment_status]
                                            )}>
                                                {sale.payment_status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                    <Download size={14} />
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                    <ChevronRight size={18} className="text-brand-light-green" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center text-stone-500 italic">
                                        <div className="flex flex-col items-center gap-3">
                                            <ShoppingCart size={48} className="text-stone-300" />
                                            <p>Tidak ada data penjualan ditemukan</p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-2 border-stone-300"
                                                onClick={handleCreateSale}
                                            >
                                                Buat Nota Sekarang
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {total > 10 && (
                    <div className="px-6 py-4 bg-stone-100/30 border-t border-stone-300 flex items-center justify-between">
                        <span className="text-xs text-stone-500">
                            Menampilkan {(page - 1) * 10 + 1} - {Math.min(page * 10, total)} dari {total} nota
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                                className="h-8 px-3 text-xs"
                            >
                                Sebelumnya
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page * 10 >= total}
                                onClick={() => setPage(page + 1)}
                                className="h-8 px-3 text-xs"
                            >
                                Berikutnya
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function StatCard({ label, value, subValue, icon, color }: { label: string, value: any, subValue?: string, icon: React.ReactNode, color: string }) {
    const colors: Record<string, string> = {
        amber: 'from-amber-500/10 to-transparent border-amber-500/20 shadow-amber-900/5',
        red: 'from-red-500/10 to-transparent border-red-500/20 shadow-red-900/5',
        emerald: 'from-brand-light-green/10 to-transparent border-brand-light-green/20 shadow-brand-light-green/5',
        blue: 'from-blue-500/10 to-transparent border-blue-500/20 shadow-blue-900/5',
    }

    return (
        <div className={cn(
            "bg-stone-200 border rounded-2xl p-5 shadow-lg bg-gradient-to-br",
            colors[color]
        )}>
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-stone-100/50 flex items-center justify-center shadow-inner">
                    {icon}
                </div>
                <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{label}</span>
            </div>
            <div className="text-xl font-black text-stone-900">{value}</div>
            {subValue && <div className="text-[10px] text-stone-500 mt-1 font-medium">{subValue}</div>}
        </div>
    )
}
