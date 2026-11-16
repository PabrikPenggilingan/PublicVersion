import { useState, useEffect } from 'react'
import { getCleanErrorMessage } from '@/errors'
import { financeAPI, batchesAPI } from '@/api/client'
import {
    Wallet,
    ArrowDownRight,
    ArrowUpRight,
    ArrowRight,
    AlertCircle,
    FileText,
    Landmark,
    Clock,
    Package,
    Calendar,
    RefreshCw,
    Layers,
    Search,
    TrendingUp,
    TrendingDown
} from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

type PeriodPreset = 'today' | '7days' | 'month' | 'custom'

const COA_CATEGORY_THEME: Record<string, { bg: string, text: string, border: string, badge: string, label: string }> = {
    ASSET: {
        bg: 'from-brand-light-green/25 via-white to-white',
        text: 'text-brand-light-green',
        border: 'border-brand-light-green/30 hover:border-brand-light-green/40',
        badge: 'bg-brand-light-green/10 text-brand-light-green border-brand-light-green/20',
        label: 'Aset'
    },
    LIABILITY: {
        bg: 'from-rose-950/25 via-white to-white',
        text: 'text-rose-400',
        border: 'border-rose-900/30 hover:border-rose-500/40',
        badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        label: 'Kewajiban'
    },
    EQUITY: {
        bg: 'from-indigo-950/25 via-white to-white',
        text: 'text-indigo-400',
        border: 'border-indigo-900/30 hover:border-indigo-500/40',
        badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        label: 'Ekuitas'
    },
    REVENUE: {
        bg: 'from-sky-950/25 via-white to-white',
        text: 'text-sky-400',
        border: 'border-sky-900/30 hover:border-sky-500/40',
        badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        label: 'Pendapatan'
    },
    EXPENSE: {
        bg: 'from-amber-950/25 via-white to-white',
        text: 'text-amber-400',
        border: 'border-amber-900/30 hover:border-amber-500/40',
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        label: 'Beban / HPP'
    }
}

export default function FinanceDashboard() {
    const [stats, setStats] = useState<any>(null)
    const [report, setReport] = useState<any>(null)
    const [balanceSheet, setBalanceSheet] = useState<any>(null)
    const [batchMargins, setBatchMargins] = useState<any[] | null>(null)
    const [recentActivities, setRecentActivities] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [reportLoading, setReportLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Date Range state
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const firstDayStr = format(firstDayOfMonth, 'yyyy-MM-dd')

    const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month')
    const [startDate, setStartDate] = useState(firstDayStr)
    const [endDate, setEndDate] = useState(todayStr)

    // CoA Section filter states
    const [coaCategoryFilter, setCoaCategoryFilter] = useState<'ALL' | 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'>('ALL')
    const [coaSearch, setCoaSearch] = useState('')

    useEffect(() => {
        loadInitialData()
    }, [])

    const loadInitialData = async () => {
        try {
            setLoading(true)
            const [statsRes, reportRes, balanceRes, marginsRes, activitiesRes] = await Promise.all([
                financeAPI.getDashboard(),
                financeAPI.getReport(firstDayStr, todayStr),
                financeAPI.getBalanceSheet(),
                batchesAPI.getAllMarginReports().catch(() => ({ data: [] })),
                financeAPI.getRecentActivity(10).catch(() => ({ data: [] }))
            ])
            setStats(statsRes.data)
            setReport(reportRes.data)
            setBalanceSheet(balanceRes.data)
            setBatchMargins(marginsRes?.data || [])
            setRecentActivities(activitiesRes?.data || [])
        } catch (err: any) {
            setError(err.message)
            toast.error(getCleanErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    const fetchReport = async (start: string, end: string) => {
        try {
            setReportLoading(true)
            const res = await financeAPI.getReport(start, end)
            setReport(res.data)
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err))
        } finally {
            setReportLoading(false)
        }
    }

    const handleSelectPreset = (preset: PeriodPreset) => {
        setPeriodPreset(preset)
        const now = new Date()
        const nowStr = format(now, 'yyyy-MM-dd')

        let start = nowStr
        let end = nowStr

        if (preset === 'today') {
            start = nowStr
            end = nowStr
        } else if (preset === '7days') {
            const d = new Date()
            d.setDate(d.getDate() - 7)
            start = format(d, 'yyyy-MM-dd')
            end = nowStr
        } else if (preset === 'month') {
            const first = new Date(now.getFullYear(), now.getMonth(), 1)
            start = format(first, 'yyyy-MM-dd')
            end = nowStr
        }

        if (preset !== 'custom') {
            setStartDate(start)
            setEndDate(end)
            fetchReport(start, end)
        }
    }

    const handleCustomApply = () => {
        if (!startDate || !endDate) {
            toast.error('Pilih tanggal awal dan akhir')
            return
        }
        if (new Date(startDate) > new Date(endDate)) {
            toast.error('Tanggal awal tidak boleh melebihi tanggal akhir')
            return
        }
        fetchReport(startDate, endDate)
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
    }

    // Batch unit economics: null means not computable yet (no beras milled / sold)
    const formatOptionalCurrency = (amount: number | null) => amount === null ? '—' : formatCurrency(amount)
    const formatKg = (kg: number) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(kg)} kg`

    const getPeriodLabel = () => {
        if (periodPreset === 'today') return 'Hari Ini'
        if (periodPreset === '7days') return '7 Hari Terakhir'
        if (periodPreset === 'month') return 'Bulan Ini'
        return `${format(new Date(startDate), 'd MMM', { locale: id })} - ${format(new Date(endDate), 'd MMM yyyy', { locale: id })}`
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="spinner"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <AlertCircle className="w-12 h-12 text-rose-500" />
                <h2 className="text-xl font-bold text-stone-900">Akses Ditolak</h2>
                <p className="text-stone-600">{error}</p>
                <Link to="/" className="text-brand-light-green hover:text-brand-light-green font-medium">
                    Kembali ke Beranda
                </Link>
            </div>
        )
    }

    if (!stats || !report || !balanceSheet) return null

    // Process all unique Chart of Accounts for section 3
    const allCoaAccounts = (stats?.accounts || [])
        .filter((acc: any, index: number, self: any[]) =>
            index === self.findIndex((t: any) => t.account_code === acc.account_code)
        )
        .sort((a: any, b: any) => (a.account_code || '').localeCompare(b.account_code || ''))

    const filteredCoaAccounts = allCoaAccounts.filter((acc: any) => {
        const matchesCat = coaCategoryFilter === 'ALL' || acc.account_category === coaCategoryFilter
        const q = coaSearch.toLowerCase().trim()
        const matchesSearch = !q ||
            (acc.name && acc.name.toLowerCase().includes(q)) ||
            (acc.account_code && acc.account_code.toLowerCase().includes(q)) ||
            (acc.account_type && acc.account_type.toLowerCase().includes(q)) ||
            (acc.description && acc.description.toLowerCase().includes(q))
        return matchesCat && matchesSearch
    })

    const coaCounts = {
        ALL: allCoaAccounts.length,
        ASSET: allCoaAccounts.filter((a: any) => a.account_category === 'ASSET').length,
        LIABILITY: allCoaAccounts.filter((a: any) => a.account_category === 'LIABILITY').length,
        EQUITY: allCoaAccounts.filter((a: any) => a.account_category === 'EQUITY').length,
        REVENUE: allCoaAccounts.filter((a: any) => a.account_category === 'REVENUE').length,
        EXPENSE: allCoaAccounts.filter((a: any) => a.account_category === 'EXPENSE').length,
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Finance Command Center</h1>
                    <p className="text-stone-600 text-sm">Dashboard pemantauan kas, laba rugi operasional, dan neraca saldo pabrik.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {stats.pendingApprovals > 0 && (
                        <Link
                            to="/finance/approvals"
                            className="group relative bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-900/20 animate-pulse"
                        >
                            <Clock className="w-4 h-4" />
                            {stats.pendingApprovals} Pending Approvals
                        </Link>
                    )}

                    <button
                        onClick={() => {
                            try {
                                financeAPI.downloadReport(startDate, endDate)
                                toast.success('Mengunduh laporan PDF...')
                            } catch (err: any) {
                                toast.error(getCleanErrorMessage(err))
                            }
                        }}
                        className="bg-brand-light-green hover:bg-brand-light-green text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-brand-light-green/20 transition-all active:scale-95"
                    >
                        <FileText className="w-4 h-4" />
                        Unduh PDF ({getPeriodLabel()})
                    </button>
                </div>
            </div>

            {/* 1. Likuiditas Kas Riil & Bank (Cash Basis) */}
            <div className="space-y-4 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pl-1">
                    <div>
                        <h3 className="text-sm font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-brand-light-green" />
                            Likuiditas Kas & Bank (Kas Riil)
                        </h3>
                        <span className="text-xs text-stone-600">Saldo uang nyata yang telah disetujui & siap digunakan</span>
                    </div>
                    {stats.pendingApprovals > 0 && (
                        <Link
                            to="/finance/approvals"
                            className="text-xs text-amber-500 bg-amber-500/30 border border-amber-500/40 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 hover:bg-amber-500/20 transition-colors w-fit"
                        >
                            <Clock className="w-3.5 h-3.5" />
                            {stats.pendingApprovals} transaksi pending approval &rarr;
                        </Link>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {/* Hero Card: Total Likuiditas Kas Siap Pakai */}
                    <div className="bg-gradient-to-br from-brand-light-green/20 via-brand-light-green/15 to-white border border-brand-light-green/30 p-5 rounded-3xl shadow-xl flex flex-col justify-between group hover:border-brand-light-green/50 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2.5 rounded-xl bg-brand-light-green/40 text-brand-light-green group-hover:bg-brand-light-green/20 transition-colors">
                                <Landmark className="w-5 h-5" />
                            </div>
                            <span className="text-[9px] text-brand-light-green uppercase tracking-widest font-bold bg-brand-light-green/60 px-2.5 py-1 rounded-md border border-brand-light-green/20">
                                Total Likuiditas
                            </span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-stone-600 uppercase mb-1 tracking-wider">Total Kas & Bank Siap Pakai</p>
                            <h3 className="text-2xl font-black text-stone-900 tracking-tighter">
                                {formatCurrency(
                                    stats.totalCashLiquidity !== undefined
                                        ? stats.totalCashLiquidity
                                        : (stats.accounts || [])
                                            .filter((acc: any) =>
                                                ['CASH', 'BANK'].includes((acc.account_type || '').toUpperCase()) ||
                                                (acc.account_code && (acc.account_code.startsWith('1-1') || acc.account_code.startsWith('11')))
                                            )
                                            .reduce((sum: number, acc: any) => sum + Number(acc.committed_balance ?? acc.current_balance ?? acc.balance ?? 0), 0)
                                )}
                            </h3>
                            <p className="text-[10px] text-brand-light-green mt-1">Gabungan seluruh kas brankas & rekening aktif</p>
                        </div>
                    </div>

                    {/* Rekening Kas & Bank masing-masing */}
                    {(stats.accounts || [])
                        .filter((acc: any) =>
                            ['CASH', 'BANK'].includes((acc.account_type || '').toUpperCase()) ||
                            (acc.account_code && (acc.account_code.startsWith('1-1') || acc.account_code.startsWith('11')))
                        )
                        .filter((acc: any, index: number, self: any[]) =>
                            index === self.findIndex((t: any) => t.account_code === acc.account_code)
                        )
                        .map((acc: any) => {
                            const isBank = (acc.account_type || '').toUpperCase() === 'BANK' || acc.name.toLowerCase().includes('bank')
                            const iconBg = isBank
                                ? 'bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20'
                                : 'bg-brand-light-green/10 text-brand-light-green group-hover:bg-brand-light-green/20'
                            const IconComponent = isBank ? Landmark : Wallet

                            const committed = Number(acc.committed_balance ?? acc.current_balance ?? acc.balance ?? 0)
                            const pending = acc.pending_balance !== undefined ? Number(acc.pending_balance) : undefined
                            const hasPendingDiff = pending !== undefined && Math.abs(pending - committed) > 0.01

                            return (
                                <div key={acc.id} className="bg-stone-200 border border-stone-300/60 p-5 rounded-3xl flex flex-col justify-between hover:border-stone-400 transition-colors shadow-xl group">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-2.5 rounded-xl ${iconBg} transition-colors`}>
                                            <IconComponent className="w-5 h-5" />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {acc.account_code && (
                                                <span className="text-[10px] font-mono text-stone-600 font-semibold px-2 py-0.5 rounded bg-stone-100/60 border border-white/5">
                                                    {acc.account_code}
                                                </span>
                                            )}
                                            <span className="text-[9px] text-stone-600 uppercase tracking-widest font-bold bg-stone-100/50 px-2.5 py-1 rounded-md border border-white/5">
                                                {acc.account_type || 'KAS'}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-stone-600 uppercase mb-1 tracking-wider">{acc.name}</p>
                                        <span className={`text-2xl font-black tracking-tighter ${committed < 0 ? 'text-rose-400' : 'text-stone-900'}`}>
                                            {formatCurrency(committed)}
                                        </span>
                                        {hasPendingDiff && (
                                            <div className="mt-2 pt-2 border-t border-stone-300/50 flex items-center justify-between text-[11px]">
                                                <span className="text-stone-600 flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-amber-400" />
                                                    Est. Pending:
                                                </span>
                                                <span className={`font-semibold font-mono ${pending! < 0 ? 'text-rose-400' : 'text-amber-300'}`}>
                                                    {formatCurrency(pending!)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                </div>
            </div>

            {/* 2. Posisi Akrual (Hak Tagih, Kewajiban & Stok Operasional) */}
            <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between pl-1">
                    <div>
                        <h3 className="text-sm font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
                            <Package className="w-4 h-4 text-sky-400" />
                            Posisi Akrual (Kewajiban, Tagihan & Nilai Stok)
                        </h3>
                        <span className="text-xs text-stone-600">Posisi keuangan berbasis transaksi operasional pabrik</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Hutang Card */}
                    <Link to="/finance/debt" className="block bg-gradient-to-br from-rose-950/20 to-white border border-rose-900/20 hover:border-rose-500/40 p-5 rounded-3xl shadow-xl transition-all hover:-translate-y-1 group">
                        <div className="flex justify-between items-center mb-5">
                            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20 transition-colors">
                                <ArrowDownRight className="w-5 h-5" />
                            </div>
                            <span className="text-[9px] text-rose-400 uppercase tracking-widest font-bold bg-rose-950/50 px-2.5 py-1 rounded-md border border-rose-500/10">
                                Hutang Usaha (AP)
                            </span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-stone-600 uppercase mb-1 tracking-wider">Total Pembelian Belum Lunas</p>
                            <h3 className="text-2xl font-black text-stone-900 tracking-tighter">{formatCurrency(stats.totalAP)}</h3>
                            <p className="text-[10px] text-stone-500 mt-1">Kewajiban bayar ke supplier/petani</p>
                        </div>
                    </Link>

                    {/* Piutang Card */}
                    <Link to="/sales" className="block bg-gradient-to-br from-brand-light-green/20 to-white border border-brand-light-green/20 hover:border-brand-light-green/40 p-5 rounded-3xl shadow-xl transition-all hover:-translate-y-1 group">
                        <div className="flex justify-between items-center mb-5">
                            <div className="p-2.5 rounded-xl bg-brand-light-green/10 text-brand-light-green group-hover:bg-brand-light-green/20 transition-colors">
                                <ArrowUpRight className="w-5 h-5" />
                            </div>
                            <span className="text-[9px] text-brand-light-green uppercase tracking-widest font-bold bg-brand-light-green/50 px-2.5 py-1 rounded-md border border-brand-light-green/10">
                                Piutang Usaha (AR)
                            </span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-stone-600 uppercase mb-1 tracking-wider">Total Nota Tertagih</p>
                            <h3 className="text-2xl font-black text-stone-900 tracking-tighter">{formatCurrency(stats.totalAR)}</h3>
                            <p className="text-[10px] text-stone-500 mt-1">Hak penagihan penjualan beras</p>
                        </div>
                    </Link>

                    {/* Persediaan Stok Gudang */}
                    <Link to="/inventory" className="block bg-gradient-to-br from-amber-950/20 to-white border border-amber-900/20 hover:border-amber-500/40 p-5 rounded-3xl shadow-xl transition-all hover:-translate-y-1 group">
                        <div className="flex justify-between items-center mb-5">
                            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                                <Package className="w-5 h-5" />
                            </div>
                            <span className="text-[9px] text-amber-400 uppercase tracking-widest font-bold bg-amber-950/50 px-2.5 py-1 rounded-md border border-amber-500/10">
                                Persediaan (Stok)
                            </span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-stone-600 uppercase mb-1 tracking-wider">Nilai Stok Fisik Gudang</p>
                            <h3 className="text-2xl font-black text-stone-900 tracking-tighter">
                                {formatCurrency(balanceSheet?.assets?.inventory || 0)}
                            </h3>
                            <p className="text-[10px] text-stone-500 mt-1">Estimasi nilai gabah & beras gudang</p>
                        </div>
                    </Link>

                    {/* EKUITAS BERSIH */}
                    <div className="bg-gradient-to-br from-indigo-950/20 to-white border border-indigo-900/20 hover:border-indigo-500/40 p-5 rounded-3xl shadow-xl relative overflow-hidden group transition-all">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
                        <div className="flex justify-between items-center mb-5 relative z-10">
                            <div className="p-2.5">
                                <div className="w-3 h-3 rounded-full bg-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.8)] animate-pulse"></div>
                            </div>
                            <span className="text-[9px] text-indigo-400 uppercase tracking-widest font-bold bg-indigo-950/50 px-2.5 py-1 rounded-md border border-indigo-500/10">
                                Net Worth
                            </span>
                        </div>
                        <div className="relative z-10">
                            <p className="text-xs font-bold text-stone-600 uppercase mb-1 tracking-wider">Total Ekuitas Bersih</p>
                            <h3 className={`text-2xl font-black tracking-tighter ${(balanceSheet?.equity || 0) >= 0 ? 'text-stone-900' : 'text-rose-400'}`}>
                                {formatCurrency(balanceSheet?.equity || 0)}
                            </h3>
                            <p className="text-[10px] text-stone-500 mt-1">Total Aset dikurangi Kewajiban</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Rincian Saldo Seluruh Bagan Akun (Chart of Accounts / CoA) */}
            <div className="space-y-4 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-1">
                    <div>
                        <h3 className="text-sm font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
                            <Layers className="w-4 h-4 text-indigo-400" />
                            Rincian Saldo 12 Bagan Akun (Chart of Accounts)
                        </h3>
                        <span className="text-xs text-stone-600">
                            Rincian saldo buku besar komprehensif untuk seluruh aset, liabilitas, modal, pendapatan, dan beban biaya pabrik
                        </span>
                    </div>
                    <Link
                        to="/finance/coa"
                        className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 hover:bg-indigo-500/20 transition-colors w-fit shadow-sm"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Kelola Master CoA &rarr;
                    </Link>
                </div>

                {/* Filter Tabs & Search Bar */}
                <div className="bg-stone-200/90 backdrop-blur-md border border-stone-300/60 p-3 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
                    {/* Category Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {[
                            { id: 'ALL', label: 'Semua Akun', count: coaCounts.ALL },
                            { id: 'ASSET', label: 'Aset', count: coaCounts.ASSET },
                            { id: 'LIABILITY', label: 'Kewajiban', count: coaCounts.LIABILITY },
                            { id: 'EQUITY', label: 'Ekuitas', count: coaCounts.EQUITY },
                            { id: 'REVENUE', label: 'Pendapatan', count: coaCounts.REVENUE },
                            { id: 'EXPENSE', label: 'Beban & HPP', count: coaCounts.EXPENSE },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setCoaCategoryFilter(tab.id as any)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${coaCategoryFilter === tab.id
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'bg-stone-100/70 text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-300/50'
                                    }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${coaCategoryFilter === tab.id
                                    ? 'bg-white/20 text-white'
                                    : 'bg-stone-200 text-stone-600'
                                    }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Quick Search */}
                    <div className="relative min-w-[220px]">
                        <Search className="w-3.5 h-3.5 text-stone-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Cari kode, nama, atau jenis akun..."
                            value={coaSearch}
                            onChange={(e) => setCoaSearch(e.target.value)}
                            className="w-full bg-stone-100 border border-stone-300 text-stone-900 text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500 placeholder-stone-500 transition-colors"
                        />
                    </div>
                </div>

                {/* 12 CoA Grid Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredCoaAccounts.map((acc: any) => {
                        const theme = COA_CATEGORY_THEME[acc.account_category] || COA_CATEGORY_THEME.EXPENSE
                        const committed = Number(acc.committed_balance ?? acc.current_balance ?? acc.balance ?? 0)
                        const pending = acc.pending_balance !== undefined ? Number(acc.pending_balance) : undefined
                        const hasPendingDiff = pending !== undefined && Math.abs(pending - committed) > 0.01

                        return (
                            <div
                                key={acc.id || acc.account_code}
                                className={`bg-gradient-to-br ${theme.bg} border ${theme.border} p-5 rounded-3xl flex flex-col justify-between shadow-xl hover:-translate-y-1 transition-all group`}
                            >
                                <div>
                                    {/* Card Header: Code Badge & Category Badge */}
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-[9px] font-black text-stone-900 px-2.5 py-1 rounded-lg bg-stone-100/90 border border-stone-300 shadow-sm">
                                                {acc.account_code}
                                            </span>
                                            <span className={`text-[7px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-md border ${theme.badge}`}>
                                                {theme.label}
                                            </span>
                                        </div>
                                        <span className="text-[7px] font-mono text-stone-600 uppercase tracking-widest font-bold bg-stone-100/60 px-2 py-1 rounded border border-white/5">
                                            {acc.account_type || 'GENERAL'}
                                        </span>
                                    </div>

                                    {/* Account Name */}
                                    <h4 className="text-sm font-black text-stone-900 group-hover:text-indigo-300 transition-colors line-clamp-1 mb-1" title={acc.name}>
                                        {acc.name}
                                    </h4>

                                    {/* Account Description */}
                                    <p className="text-[11px] text-stone-600 line-clamp-2 min-h-[2rem]">
                                        {acc.description || 'Akun buku besar standar operasional pabrik'}
                                    </p>
                                </div>

                                {/* Card Footer: Balance & Subtext */}
                                <div className="mt-4 pt-3 border-t border-stone-300/60">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">Saldo Buku:</span>
                                        <span className={`text-xl font-black tracking-tight font-mono ${committed < 0 ? 'text-rose-400' : 'text-stone-900'}`}>
                                            {formatCurrency(committed)}
                                        </span>
                                    </div>

                                    {hasPendingDiff && (
                                        <div className="mt-1.5 flex items-center justify-between text-[11px] bg-stone-100/40 px-2 py-1 rounded-lg border border-amber-500/10">
                                            <span className="text-stone-600 flex items-center gap-1 text-[10px]">
                                                <Clock className="w-3 h-3 text-amber-400" />
                                                Est. Pending:
                                            </span>
                                            <span className={`font-semibold font-mono text-xs ${pending! < 0 ? 'text-rose-400' : 'text-amber-300'}`}>
                                                {formatCurrency(pending!)}
                                            </span>
                                        </div>
                                    )}

                                    <div className="mt-3 pt-2 border-t border-stone-300/40 flex items-center justify-between">
                                        <Link
                                            to={`/finance/ledger?search=${encodeURIComponent(acc.account_code || acc.name)}`}
                                            className="text-[11px] font-bold text-stone-600 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                                        >
                                            Buka Buku Besar &rarr;
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {filteredCoaAccounts.length === 0 && (
                        <div className="col-span-full bg-stone-200/40 rounded-3xl p-8 text-center border border-stone-300/40">
                            <p className="text-xs text-stone-600">Tidak ada akun yang sesuai dengan filter atau kata kunci pencarian.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Date Range Selector Bar (Bug D2 Fix) */}
            <div className="bg-stone-200/80 backdrop-blur-md border border-stone-300/60 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-brand-light-green" />
                    <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">Periode Analisis:</span>
                    <span className="text-xs text-stone-700 font-medium px-2 py-0.5 rounded bg-stone-100/80 border border-white/5">
                        {getPeriodLabel()}
                    </span>
                    {reportLoading && <RefreshCw className="w-3.5 h-3.5 text-brand-light-green animate-spin ml-1" />}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-300/60">
                        <button
                            onClick={() => handleSelectPreset('today')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${periodPreset === 'today' ? 'bg-brand-light-green text-white shadow' : 'text-stone-600 hover:text-stone-900'}`}
                        >
                            Hari Ini
                        </button>
                        <button
                            onClick={() => handleSelectPreset('7days')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${periodPreset === '7days' ? 'bg-brand-light-green text-white shadow' : 'text-stone-600 hover:text-stone-900'}`}
                        >
                            7 Hari
                        </button>
                        <button
                            onClick={() => handleSelectPreset('month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${periodPreset === 'month' ? 'bg-brand-light-green text-white shadow' : 'text-stone-600 hover:text-stone-900'}`}
                        >
                            Bulan Ini
                        </button>
                        <button
                            onClick={() => setPeriodPreset('custom')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${periodPreset === 'custom' ? 'bg-brand-light-green text-white shadow' : 'text-stone-600 hover:text-stone-900'}`}
                        >
                            Kustom
                        </button>
                    </div>

                    {periodPreset === 'custom' && (
                        <div className="flex items-center gap-2 animate-in fade-in duration-200">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-stone-100 border border-stone-300 text-stone-900 text-xs px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-brand-light-green"
                            />
                            <span className="text-stone-500 text-xs">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-stone-100 border border-stone-300 text-stone-900 text-xs px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-brand-light-green"
                            />
                            <button
                                onClick={handleCustomApply}
                                className="bg-brand-light-green hover:bg-brand-light-green text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow"
                            >
                                Terapkan
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-8">
                {/* 2. Ringkasan Kinerja & Laba Rugi Operasional Terpadu (Unified P&L) */}
                <div className="bg-gradient-to-br from-brand-light-green/30 via-white to-white border border-stone-300/70 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-2xl space-y-6">
                    {/* Top gradient accent line */}
                    <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-brand-light-green via-sky-500 to-indigo-500"></div>

                    {/* Hero Header: Net Operating Profit + Margin Stats */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-stone-300/60">
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-brand-light-green animate-pulse"></span>
                                <h3 className="text-stone-600 font-bold uppercase tracking-wider text-xs">
                                    Laba Operasional Bersih (Net Operating Profit)
                                </h3>
                                <span className="text-[10px] text-stone-700 font-medium px-2.5 py-0.5 rounded-md bg-stone-100/80 border border-white/5">
                                    {getPeriodLabel()}
                                </span>
                            </div>
                            <p className={`text-4xl md:text-6xl font-black tracking-tighter drop-shadow-md mt-1 ${report.summary.operatingProfit >= 0 ? 'text-brand-light-green' : 'text-rose-400'}`}>
                                {formatCurrency(report.summary.operatingProfit)}
                            </p>
                            <p className="text-xs text-stone-600 mt-2 max-w-xl leading-relaxed">
                                Laba riil aktivitas operasional pabrik: Penjualan Bersih dikurangi HPP Beras Terjual (sudah termasuk transport beli, jemur & giling) dan Beban Operasional (OPEX).
                            </p>
                        </div>

                        {/* Margins highlight widgets */}
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="flex-1 sm:flex-initial bg-stone-100/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-brand-light-green/20 text-left sm:text-right min-w-[150px] shadow-lg">
                                <span className="text-[10px] text-brand-light-green/70 font-bold uppercase tracking-widest block mb-1">Gross Margin</span>
                                <span className="text-2xl md:text-3xl font-black text-stone-900 font-mono">{report.summary.grossMarginPct.toFixed(1)}%</span>
                            </div>
                            <div className="flex-1 sm:flex-initial bg-stone-100/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-sky-500/20 text-left sm:text-right min-w-[150px] shadow-lg">
                                <span className="text-[10px] text-sky-300/70 font-bold uppercase tracking-widest block mb-1">Operating Margin</span>
                                <span className="text-2xl md:text-3xl font-black text-stone-900 font-mono">{report.summary.operatingMarginPct.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown 5 Alur Finansial */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-stone-600 uppercase tracking-widest">
                                Rincian Alur Laba Rugi ({getPeriodLabel()})
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                            {/* 1. Revenue */}
                            <div className="bg-stone-100/60 p-4 rounded-2xl border border-stone-300/60 flex flex-col justify-between hover:border-stone-400 transition-colors">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-stone-600 uppercase font-black tracking-wider">1. Revenue</span>
                                        <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                                            <TrendingUp className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-stone-600 mb-1">Penjualan Bersih</p>
                                </div>
                                <div>
                                    <p className="font-bold text-stone-900 text-xl font-mono">{formatCurrency(report.summary.revenue)}</p>
                                    <p className="text-[10px] text-stone-500 mt-1">{report.summary.saleCount || 0} nota penjualan</p>
                                    {Number(report.summary.serviceRevenue) > 0 && (
                                        <p className="text-[10px] text-stone-400 mt-0.5">Termasuk jasa titipan {formatCurrency(report.summary.serviceRevenue)}</p>
                                    )}
                                </div>
                            </div>

                            {/* 2. HPP / COGS */}
                            <div className="bg-stone-100/60 p-4 rounded-2xl border border-stone-300/60 flex flex-col justify-between hover:border-stone-400 transition-colors">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-stone-600 uppercase font-black tracking-wider">2. HPP / COGS</span>
                                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                                            <Package className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-stone-600 mb-1">Total Modal Beras Terjual</p>
                                </div>
                                <div>
                                    <p className="font-bold text-rose-400 text-xl font-mono">{formatCurrency(report.summary.hpp)}</p>
                                    <p className="text-[10px] text-stone-500 mt-1" title="HPP/kg stok = gabah + transport beli + jemur + giling">Gabah + transport beli + jemur + giling</p>
                                    {Number(report.summary.productionCostsTotal) > 0 && (
                                        <p className="text-[10px] text-stone-400 mt-0.5">Biaya produksi periode ini {formatCurrency(report.summary.productionCostsTotal)} (masuk HPP)</p>
                                    )}
                                </div>
                            </div>

                            {/* 3. Laba Kotor */}
                            <div className="bg-stone-100/60 p-4 rounded-2xl border border-brand-light-green/25 bg-brand-light-green/10 flex flex-col justify-between hover:border-brand-light-green/40 transition-colors">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-brand-light-green uppercase font-black tracking-wider">3. Laba Kotor</span>
                                        <div className="p-1.5 rounded-lg bg-brand-light-green/10 text-brand-light-green">
                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-stone-600 mb-1">Gross Profit (1 - 2)</p>
                                </div>
                                <div>
                                    <p className="font-bold text-brand-light-green text-xl font-mono">{formatCurrency(report.summary.grossProfit)}</p>
                                    <p className="text-[10px] text-stone-500 mt-1">Margin kotor {report.summary.grossMarginPct.toFixed(1)}%</p>
                                </div>
                            </div>

                            {/* 4. Total OPEX */}
                            <div className="bg-stone-100/60 p-4 rounded-2xl border border-stone-300/60 flex flex-col justify-between hover:border-stone-400 transition-colors">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-stone-600 uppercase font-black tracking-wider">4. Total OPEX</span>
                                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                                            <TrendingDown className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-stone-600 mb-1">Beban Penjualan & Umum</p>
                                </div>
                                <div>
                                    <p className="font-bold text-amber-400 text-xl font-mono">{formatCurrency(report.summary.opex)}</p>
                                    <p className="text-[10px] text-stone-500 mt-1">Pengiriman, komisi calo, potongan & overhead</p>
                                </div>
                            </div>

                            {/* 5. Belanja Gabah / Modal Kerja */}
                            <div className="bg-stone-100/60 p-4 rounded-2xl border border-stone-300/60 flex flex-col justify-between hover:border-stone-400 transition-colors">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-stone-600 uppercase font-black tracking-wider">5. Modal Kerja</span>
                                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                                            <Wallet className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-stone-600 mb-1">Belanja Gabah Periode Ini</p>
                                </div>
                                <div>
                                    <p className="font-bold text-sky-400 text-xl font-mono">{formatCurrency(report.summary.procurement || 0)}</p>
                                    <p className="text-[10px] text-stone-500 mt-1">{report.summary.purchaseCount || 0} transaksi pembelian</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Recent Activity (Bug D4 Fix: inklusif PENDING + status badges) */}
                <div className="bg-stone-200 border border-stone-300/60 p-6 md:p-8 rounded-3xl shadow-xl space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-base font-bold text-stone-900 tracking-wide">Aktivitas Keuangan Terbaru</h3>
                            <p className="text-xs text-stone-600 mt-0.5">Transaksi jurnal terbaru termasuk yang masih berstatus pending</p>
                        </div>
                        <Link to="/finance/ledger" className="text-sm text-brand-light-green hover:text-brand-light-green font-bold flex items-center gap-1.5 transition-colors">
                            Buku Besar Lengkap <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {recentActivities.length === 0 ? (
                        <div className="bg-stone-100/50 rounded-2xl p-8 border border-stone-200 text-center">
                            <p className="text-sm text-stone-600">Belum ada aktivitas jurnal keuangan tercatat.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-stone-300/40">
                            {recentActivities.slice(0, 10).map((tx: any) => {
                                const isIn = tx.transaction_type === 'IN'
                                const status = tx.status || 'PENDING'
                                return (
                                    <div key={tx.id} className="py-4 flex items-center justify-between text-sm group hover:bg-white/[0.02] px-4 -mx-4 rounded-xl transition-colors">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-stone-900 leading-none">{tx.description || 'Transaksi Keuangan'}</p>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status === 'APPROVED' ? 'bg-brand-light-green/10 text-brand-light-green border-brand-light-green/20' :
                                                    status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                        'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                    }`}>
                                                    {status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {tx.reference_type && (
                                                    <span className="text-[11px] text-stone-600 font-mono bg-stone-100 px-2 py-0.5 rounded border border-stone-300/50">
                                                        {tx.reference_type}
                                                    </span>
                                                )}
                                                {tx.created_by_name && (
                                                    <span className="text-[11px] text-stone-600">
                                                        oleh <span className="text-stone-700 font-medium">{tx.created_by_name}</span>
                                                    </span>
                                                )}
                                                <span className="text-[11px] text-stone-500 font-medium">
                                                    {tx.transaction_date ? format(new Date(tx.transaction_date), 'd MMM yyyy, HH:mm', { locale: id }) : '-'}
                                                </span>
                                            </div>
                                        </div>
                                        <span className={`text-base font-mono font-bold tracking-tight ${isIn ? 'text-brand-light-green' : 'text-rose-400'}`}>
                                            {isIn ? '+' : '-'}{formatCurrency(Number(tx.amount || 0))}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Batch Margin Analysis */}
            {batchMargins && batchMargins.length > 0 && (
                <div className="bg-stone-100 border border-stone-300/60 rounded-3xl overflow-hidden shadow-2xl relative mt-10">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500"></div>

                    <div className="p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-3">
                                <Package className="text-sky-400" />
                                Summary per Batch
                            </h2>
                            <p className="text-stone-600 mt-1 text-sm font-medium">Laba/Rugi beras per lot: (Revenue/kg − HPP/kg) × kg terjual</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1200px] text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 bg-stone-200/30">
                                    <th className="p-4 pl-8 text-xs font-bold text-stone-600 uppercase tracking-widest">ID Batch</th>
                                    <th className="p-4 text-xs font-bold text-stone-600 uppercase tracking-widest">Tanggal</th>
                                    <th className="p-4 text-xs font-bold text-stone-600 uppercase tracking-widest">Jenis</th>
                                    <th className="p-4 text-xs font-bold text-stone-600 uppercase tracking-widest text-right">Total Biaya</th>
                                    <th className="p-4 text-xs font-bold text-stone-600 uppercase tracking-widest text-right">Beras Diperoleh</th>
                                    <th className="p-4 text-xs font-bold text-stone-600 uppercase tracking-widest text-right">HPP / kg</th>
                                    <th className="p-4 text-xs font-bold text-stone-600 uppercase tracking-widest text-right">Beras Terjual</th>
                                    <th className="p-4 text-xs font-bold text-stone-600 uppercase tracking-widest text-right">Revenue / kg</th>
                                    <th className="p-4 text-xs font-bold text-stone-600 uppercase tracking-widest text-right">Margin / kg</th>
                                    <th className="p-4 pr-8 text-xs font-bold text-stone-600 uppercase tracking-widest text-right">Total Profit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {batchMargins.map((b: any) => (
                                    <tr key={b.batchId} className="hover:bg-stone-200/50 transition-colors">
                                        <td className="p-4 pl-8">
                                            <Link to={`/batches/${b.batchId}`} className="text-sky-400 hover:text-sky-300 font-bold font-mono text-sm">
                                                {b.batchId.split('-')[0]}
                                            </Link>
                                            <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full border ${b.status === 'COMPLETED' ? 'bg-brand-light-green/10 text-brand-light-green border-brand-light-green/20' :
                                                b.status === 'ACTIVE' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                                                    'bg-stone-300 text-stone-700 border-stone-400'
                                                }`}>{b.status}</span>
                                        </td>
                                        <td className="p-4 text-stone-700 text-sm">{format(new Date(b.batchDate), 'dd MMM yyyy', { locale: id })}</td>
                                        <td className="p-4 text-stone-900 text-sm font-medium">{b.jenisGabah}</td>
                                        <td className="p-4 text-right font-bold text-rose-400">{formatCurrency(b.financials.costs.total)}</td>
                                        <td className="p-4 text-right text-stone-900 text-sm font-mono">{formatKg(b.financials.riceObtainedKg)}</td>
                                        <td className="p-4 text-right font-bold text-rose-400">{formatOptionalCurrency(b.financials.unitCost)}</td>
                                        <td className="p-4 text-right text-stone-900 text-sm font-mono">{formatKg(b.financials.riceSoldKg)}</td>
                                        <td className="p-4 text-right font-bold text-brand-light-green">{formatOptionalCurrency(b.financials.unitRevenue)}</td>
                                        <td className={`p-4 text-right font-bold ${b.financials.unitMargin === null ? 'text-stone-500' : b.financials.unitMargin >= 0 ? 'text-brand-light-green' : 'text-rose-400'}`}>
                                            {formatOptionalCurrency(b.financials.unitMargin)}
                                        </td>
                                        <td className="p-4 pr-8 text-right">
                                            {b.financials.totalProfit === null ? (
                                                <span className="text-stone-500 font-bold">—</span>
                                            ) : (
                                                <span className={`px-3 py-1.5 rounded-lg font-black text-sm ${b.financials.totalProfit >= 0 ? 'bg-brand-light-green/10 text-brand-light-green' : 'bg-rose-500/10 text-rose-400'}`}>
                                                    {formatCurrency(b.financials.totalProfit)}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
