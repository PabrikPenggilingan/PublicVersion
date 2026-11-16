import { useState, useEffect, useCallback } from 'react'
import { adminMonitoringAPI } from '@/api/client'
import {
    Server, Database, HardDrive, Cpu, Users, Activity,
    RefreshCw, AlertCircle, CheckCircle, Clock, BarChart2,
    FileText, Zap, MemoryStick, Globe, TrendingUp, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Helper utils ─────────────────────────────────────────────────────────────

function formatBytes(bytes: number | string, decimals = 2): string {
    const b = Number(bytes || 0)
    if (b === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(b) / Math.log(k))
    return `${parseFloat((b / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

function formatNumber(n: number | string): string {
    return Number(n || 0).toLocaleString('id-ID')
}

function timeAgo(dateStr?: string | null): string {
    if (!dateStr) return '—'
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'Baru saja'
    if (m < 60) return `${m} menit lalu`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} jam lalu`
    return `${Math.floor(h / 24)} hari lalu`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
    icon: Icon, title, value, sub, color = 'primary', loading = false
}: {
    icon: React.ElementType
    title: string
    value: string | number | null
    sub?: string
    color?: 'primary' | 'emerald' | 'amber' | 'blue' | 'rose'
    loading?: boolean
}) {
    const colorMap = {
        primary: 'text-brand-light-green bg-brand-light-green/10',
        emerald:  'text-brand-light-green bg-brand-light-green/10',
        amber:    'text-amber-400 bg-amber-500/10',
        blue:     'text-blue-400 bg-blue-500/10',
        rose:     'text-rose-400 bg-rose-500/10',
    }

    return (
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 flex items-start gap-4">
            <div className={`p-3 rounded-lg ${colorMap[color]} flex-shrink-0`}>
                <Icon size={20} className={colorMap[color].split(' ')[0]} />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-dark-400 font-medium uppercase tracking-wider mb-1">{title}</p>
                {loading ? (
                    <div className="h-6 w-24 bg-dark-700 rounded animate-pulse" />
                ) : (
                    <p className="text-xl font-bold text-white truncate">{value ?? '—'}</p>
                )}
                {sub && <p className="text-xs text-dark-500 mt-1 truncate">{sub}</p>}
            </div>
        </div>
    )
}

function SectionHeader({ title, icon: Icon }: { title: string, icon: React.ElementType }) {
    return (
        <div className="flex items-center gap-2 mb-4">
            <Icon size={18} className="text-brand-light-green" />
            <h2 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">{title}</h2>
        </div>
    )
}

function GaugeBar({ label, value, unit = '%', color = 'emerald' }: {
    label: string; value: number | null; unit?: string; color?: string
}) {
    const pct = Math.min(Math.max(Number(value || 0), 0), 100)
    const barColor = pct > 80 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : `bg-${color}-500`

    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-dark-300">{label}</span>
                <span className="font-mono text-white">{value !== null ? `${pct}${unit}` : '—'}</span>
            </div>
            <div className="h-2 rounded-full bg-dark-700">
                <div
                    className={`h-2 rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

function UnavailableBadge({ reason }: { reason?: string }) {
    return (
        <div className="flex items-center gap-2 text-sm text-dark-400 bg-dark-900/50 rounded-lg p-3 border border-dark-700">
            <AlertCircle size={15} className="text-amber-400 flex-shrink-0" />
            <span>{reason || 'Data tidak tersedia'}</span>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'users' | 'database' | 'storage' | 'computing'

export default function SystemMonitoring() {
    const [activeTab, setActiveTab]           = useState<TabId>('overview')
    const [overview, setOverview]             = useState<any>(null)
    const [users, setUsers]                   = useState<any[]>([])
    const [dbStats, setDbStats]               = useState<any>(null)
    const [storageStats, setStorageStats]     = useState<any>(null)
    const [computing, setComputing]           = useState<any>(null)
    const [loadingStates, setLoadingStates]   = useState<Record<string, boolean>>({})
    const [lastRefresh, setLastRefresh]       = useState<Date | null>(null)
    const [selectedUser, setSelectedUser]     = useState<any>(null)
    const [gcpWindow, setGcpWindow]           = useState<number>(60)
    const [gcpService, setGcpService]         = useState<string>('gabah-api')

    const setLoading = (key: string, val: boolean) =>
        setLoadingStates(prev => ({ ...prev, [key]: val }))

    const fetchOverview = useCallback(async () => {
        setLoading('overview', true)
        try {
            const res = await adminMonitoringAPI.getOverview()
            if (res.success) setOverview(res.data)
        } catch (err: any) {
            toast.error('Gagal memuat overview: ' + err.message)
        } finally {
            setLoading('overview', false)
        }
    }, [])

    const fetchUsers = useCallback(async () => {
        setLoading('users', true)
        try {
            const res = await adminMonitoringAPI.getUsers()
            if (res.success) setUsers(res.data)
        } catch (err: any) {
            toast.error('Gagal memuat user stats: ' + err.message)
        } finally {
            setLoading('users', false)
        }
    }, [])

    const fetchDatabase = useCallback(async () => {
        setLoading('database', true)
        try {
            const res = await adminMonitoringAPI.getDatabaseStats()
            if (res.success) setDbStats(res.data)
        } catch (err: any) {
            toast.error('Gagal memuat database stats: ' + err.message)
        } finally {
            setLoading('database', false)
        }
    }, [])

    const fetchStorage = useCallback(async () => {
        setLoading('storage', true)
        try {
            const res = await adminMonitoringAPI.getStorageStats()
            if (res.success) setStorageStats(res.data)
        } catch (err: any) {
            toast.error('Gagal memuat storage stats: ' + err.message)
        } finally {
            setLoading('storage', false)
        }
    }, [])

    const fetchComputing = useCallback(async (window = gcpWindow, service = gcpService) => {
        setLoading('computing', true)
        try {
            const res = await adminMonitoringAPI.getComputingMetrics(window, service)
            if (res.success) {
                setComputing(res.data)
                if (res.data?.service) setGcpService(res.data.service)
            }
        } catch (err: any) {
            toast.error('Gagal memuat GCP metrics: ' + err.message)
        } finally {
            setLoading('computing', false)
        }
    }, [gcpWindow, gcpService])

    const fetchAll = useCallback(async () => {
        await Promise.allSettled([fetchOverview(), fetchUsers(), fetchDatabase(), fetchStorage(), fetchComputing()])
        setLastRefresh(new Date())
    }, [fetchOverview, fetchUsers, fetchDatabase, fetchStorage, fetchComputing])

    useEffect(() => { fetchAll() }, [])

    const handleRefresh = async () => {
        await adminMonitoringAPI.invalidateCache()
        await fetchAll()
        toast.success('Cache di-refresh, data diperbarui')
    }

    const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
        { id: 'overview',   label: 'Overview',   icon: Activity  },
        { id: 'users',      label: 'Pengguna',   icon: Users     },
        { id: 'database',   label: 'Database',   icon: Database  },
        { id: 'storage',    label: 'Storage',    icon: HardDrive },
        { id: 'computing',  label: 'Computing',  icon: Cpu       },
    ]

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">

            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Server size={22} className="text-brand-light-green" />
                        System Monitoring
                    </h1>
                    <p className="text-sm text-dark-400 mt-0.5">
                        Platform health — DB, Storage, GCP Cloud Run
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastRefresh && (
                        <span className="text-xs text-dark-500 flex items-center gap-1">
                            <Clock size={11} /> Updated {timeAgo(lastRefresh.toISOString())}
                        </span>
                    )}
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-600 text-dark-200 rounded-lg text-sm hover:bg-dark-700 transition-colors"
                    >
                        <RefreshCw size={14} className="text-brand-light-green" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1 bg-dark-800 border border-dark-700 rounded-xl p-1 w-fit overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'bg-brand-light-green text-white shadow'
                                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/50'
                        }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ══════════════════════════════════════════════ TAB: OVERVIEW ══════ */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Top stat cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            icon={Users} title="Total Pengguna"
                            value={overview?.users?.total ?? null}
                            sub={overview?.users?.by_role
                                ? Object.entries(overview.users.by_role).map(([r, c]) => `${c} ${r}`).join(', ')
                                : undefined}
                            color="primary"
                            loading={loadingStates.overview}
                        />
                        <StatCard
                            icon={Database} title="Database Size"
                            value={overview?.database?.size_pretty ?? null}
                            sub={`${overview?.database?.active_connections ?? '—'} koneksi aktif`}
                            color="blue"
                            loading={loadingStates.overview}
                        />
                        <StatCard
                            icon={HardDrive} title="Total Storage"
                            value={overview?.storage?.total_size_mb ? `${overview.storage.total_size_mb} MB` : null}
                            sub={overview?.storage?.source === 'supabase_storage' ? 'Dari Supabase bucket' : 'Estimasi dari DB metadata'}
                            color="emerald"
                            loading={loadingStates.overview}
                        />
                        <StatCard
                            icon={Cpu} title="Cloud Run"
                            value={
                                overview?.computing?.available === false
                                    ? 'Tidak terkonfigurasi'
                                    : overview?.computing?.cpu_percent
                                        ? `CPU ${overview.computing.cpu_percent}%`
                                        : null
                            }
                            sub={
                                overview?.computing?.memory_percent
                                    ? `Memory ${overview.computing.memory_percent}%`
                                    : overview?.computing?.reason
                            }
                            color={overview?.computing?.available === false ? 'amber' : 'rose'}
                            loading={loadingStates.overview}
                        />
                    </div>

                    {/* Quick user list */}
                    <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                        <SectionHeader title="Ringkasan Pengguna" icon={Users} />
                        {loadingStates.users ? (
                            <div className="space-y-2">
                                {[1,2,3].map(i => (
                                    <div key={i} className="h-12 bg-dark-700 rounded-lg animate-pulse" />
                                ))}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-dark-400 text-xs uppercase tracking-wider border-b border-dark-700">
                                            <th className="text-left pb-3 pr-4">User</th>
                                            <th className="text-left pb-3 pr-4">Role</th>
                                            <th className="text-right pb-3 pr-4">Transaksi</th>
                                            <th className="text-right pb-3 pr-4">File</th>
                                            <th className="text-right pb-3 pr-4">Storage</th>
                                            <th className="text-right pb-3">Terakhir Aktif</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-dark-700/50">
                                        {users.map((u: any) => (
                                            <tr key={u.id} className="hover:bg-dark-700/30 transition-colors">
                                                <td className="py-3 pr-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-white">{u.username}</span>
                                                        {u.is_super_admin && (
                                                            <span className="text-[10px] bg-brand-light-green/20 text-brand-light-green px-1.5 py-0.5 rounded font-medium">SA</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <span className="text-xs bg-dark-700 text-dark-300 px-2 py-0.5 rounded capitalize">{u.role}</span>
                                                </td>
                                                <td className="py-3 pr-4 text-right font-mono text-dark-200 text-xs">
                                                    {formatNumber((Number(u.batch_count||0)) + (Number(u.purchase_count||0)) + (Number(u.sale_count||0)))}
                                                </td>
                                                <td className="py-3 pr-4 text-right text-dark-300 text-xs">
                                                    {formatNumber(u.file_count)}
                                                </td>
                                                <td className="py-3 pr-4 text-right text-dark-300 text-xs">
                                                    {u.total_file_size_bytes ? formatBytes(u.total_file_size_bytes) : '—'}
                                                </td>
                                                <td className="py-3 text-right text-dark-400 text-xs">
                                                    {timeAgo(u.last_activity_at)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════ TAB: USERS ═════════ */}
            {activeTab === 'users' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* User list */}
                    <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-dark-700">
                            <SectionHeader title="Pengguna" icon={Users} />
                        </div>
                        <div className="divide-y divide-dark-700/50">
                            {loadingStates.users ? (
                                <div className="p-4 space-y-2">
                                    {[1,2,3].map(i => <div key={i} className="h-14 bg-dark-700 rounded animate-pulse"/>)}
                                </div>
                            ) : users.map((u: any) => (
                                <button
                                    key={u.id}
                                    onClick={() => setSelectedUser(selectedUser?.id === u.id ? null : u)}
                                    className={`w-full text-left p-4 flex items-center justify-between transition-colors ${
                                        selectedUser?.id === u.id
                                            ? 'bg-brand-light-green/10 text-brand-light-green'
                                            : 'hover:bg-dark-700/40 text-dark-200'
                                    }`}
                                >
                                    <div>
                                        <div className="font-medium flex items-center gap-2">
                                            {u.username}
                                            {u.is_super_admin && (
                                                <span className="text-[9px] bg-brand-light-green/20 text-brand-light-green px-1 py-0.5 rounded">SUPER</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-dark-500 mt-0.5 capitalize">{u.role} · {timeAgo(u.last_activity_at)}</div>
                                    </div>
                                    <ChevronRight size={14} className="text-dark-500" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* User detail */}
                    <div className="lg:col-span-2 bg-dark-800 border border-dark-700 rounded-xl p-5 space-y-5">
                        {!selectedUser ? (
                            <div className="flex flex-col items-center justify-center h-48 text-dark-500">
                                <Users size={32} className="mb-2 opacity-30" />
                                <p className="text-sm">Pilih pengguna untuk lihat detail</p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <h3 className="text-base font-semibold text-white">{selectedUser.username}</h3>
                                    <p className="text-xs text-dark-400 capitalize">{selectedUser.role} · Bergabung {timeAgo(selectedUser.account_created_at)}</p>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { label: 'Batch', val: selectedUser.batch_count },
                                        { label: 'Pembelian', val: selectedUser.purchase_count },
                                        { label: 'Penjualan', val: selectedUser.sale_count },
                                        { label: 'Aksi (30h)', val: selectedUser.action_count_30d },
                                    ].map(item => (
                                        <div key={item.label} className="bg-dark-900 rounded-lg p-3 text-center">
                                            <div className="text-lg font-bold text-white">{formatNumber(item.val)}</div>
                                            <div className="text-xs text-dark-400 mt-0.5">{item.label}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-dark-900 rounded-lg p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-dark-400 mb-1">Total Upload File</p>
                                        <p className="font-semibold text-white">{formatNumber(selectedUser.file_count)} file</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-dark-400 mb-1">Total Storage Digunakan</p>
                                        <p className="font-semibold text-brand-light-green">
                                            {selectedUser.total_file_size_bytes
                                                ? formatBytes(selectedUser.total_file_size_bytes)
                                                : '—'}
                                        </p>
                                    </div>
                                </div>

                                {selectedUser.weeklyTrend && selectedUser.weeklyTrend.length > 0 && (
                                    <div>
                                        <p className="text-xs text-dark-400 mb-3 uppercase tracking-wider">Aktivitas Mingguan (8 Minggu)</p>
                                        <div className="flex items-end gap-1 h-16">
                                            {selectedUser.weeklyTrend.map((w: any, i: number) => {
                                                const maxVal = Math.max(...selectedUser.weeklyTrend.map((x: any) => Number(x.action_count)))
                                                const pct = maxVal > 0 ? (Number(w.action_count) / maxVal) * 100 : 0
                                                return (
                                                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                                        <div className="relative flex-1 w-full flex items-end">
                                                            <div
                                                                className="w-full bg-brand-light-green/60 hover:bg-brand-light-green rounded-sm transition-all"
                                                                style={{ height: `${Math.max(pct, 4)}%` }}
                                                                title={`${w.action_count} aksi`}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════ TAB: DATABASE ══════ */}
            {activeTab === 'database' && (
                <div className="space-y-5">
                    {/* DB Overview */}
                    {dbStats?.overview && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <StatCard icon={Database} title="DB Size" value={dbStats.overview.db_size_pretty} color="blue" />
                            <StatCard icon={Activity} title="Koneksi Aktif" value={dbStats.overview.active_connections} color="emerald" />
                            <StatCard icon={Server}   title="Total Koneksi" value={dbStats.overview.total_connections} color="primary" />
                            <StatCard icon={Database} title="Database" value={dbStats.overview.db_name} color="amber" />
                        </div>
                    )}

                    {/* Row counts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                            <SectionHeader title="Jumlah Baris per Tabel Kritis" icon={BarChart2} />
                            {loadingStates.database ? (
                                <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-6 bg-dark-700 rounded animate-pulse"/>)}</div>
                            ) : (
                                <div className="space-y-2">
                                    {(dbStats?.rowCounts || []).map((row: any) => {
                                        const maxRows = Math.max(...(dbStats?.rowCounts || []).map((r: any) => Number(r.row_count)))
                                        const pct = maxRows > 0 ? (Number(row.row_count) / maxRows) * 100 : 0
                                        return (
                                            <div key={row.table_name}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-dark-300 font-mono">{row.table_name}</span>
                                                    <span className="text-white font-mono">{formatNumber(row.row_count)}</span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-dark-700">
                                                    <div className="h-1.5 rounded-full bg-blue-500/70 transition-all" style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Table sizes */}
                        <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                            <SectionHeader title="Ukuran Tabel Terbesar" icon={Database} />
                            {loadingStates.database ? (
                                <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-6 bg-dark-700 rounded animate-pulse"/>)}</div>
                            ) : (
                                <div className="space-y-2">
                                    {(dbStats?.tableSizes || []).slice(0, 10).map((row: any) => (
                                        <div key={`${row.schema}.${row.table_name}`} className="flex items-center justify-between py-1.5 border-b border-dark-700/50 last:border-0">
                                            <div>
                                                <span className="text-xs font-mono text-dark-300">{row.schema}.</span>
                                                <span className="text-xs font-mono text-white">{row.table_name}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-mono text-brand-light-green">{row.size_pretty}</div>
                                                <div className="text-[10px] text-dark-500">idx: {row.index_size_pretty}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Growth trend */}
                    {dbStats?.growthTrend && dbStats.growthTrend.length > 0 && (
                        <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                            <SectionHeader title="Tren Data Entry (12 Minggu)" icon={TrendingUp} />
                            <div className="flex items-end gap-1 h-24">
                                {dbStats.growthTrend.map((w: any, i: number) => {
                                    const maxVal = Math.max(...dbStats.growthTrend.map((x: any) => Number(x.new_purchases)))
                                    const pct = maxVal > 0 ? (Number(w.new_purchases) / maxVal) * 100 : 0
                                    const date = new Date(w.week_start).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${date}: ${w.new_purchases} pembelian`}>
                                            <div className="relative flex-1 w-full flex items-end">
                                                <div
                                                    className="w-full bg-blue-500/50 hover:bg-blue-500 rounded-sm transition-all"
                                                    style={{ height: `${Math.max(pct, 3)}%` }}
                                                />
                                            </div>
                                            {i % 3 === 0 && (
                                                <span className="text-[9px] text-dark-500 truncate w-full text-center">
                                                    {date}
                                                </span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════ TAB: STORAGE ═══════ */}
            {activeTab === 'storage' && (
                <div className="space-y-5">
                    {storageStats && (
                        <>
                            {/* Source badge */}
                            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                                storageStats.source === 'supabase_storage'
                                    ? 'bg-brand-light-green/10 border-brand-light-green/30 text-brand-light-green'
                                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            }`}>
                                {storageStats.source === 'supabase_storage'
                                    ? <CheckCircle size={13} />
                                    : <AlertCircle size={13} />}
                                {storageStats.source === 'supabase_storage'
                                    ? 'Data dari Supabase Storage bucket (akurat)'
                                    : `${storageStats.note || 'Estimasi dari tabel trx.files'}`}
                            </div>

                            {/* Summary cards */}
                            {storageStats.summary && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <StatCard icon={FileText} title="Total File" value={formatNumber(storageStats.summary.total_file_count)} color="primary" />
                                    <StatCard icon={HardDrive} title="Total Size" value={`${storageStats.summary.total_size_mb} MB`} color="emerald" />
                                    <StatCard icon={HardDrive} title="Total Size (GB)" value={`${storageStats.summary.total_size_gb} GB`} color="blue" />
                                    <StatCard icon={Zap} title="Source" value={storageStats.source === 'supabase_storage' ? 'Live Bucket' : 'DB Metadata'} color="amber" />
                                </div>
                            )}

                            {/* By folder / type */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                                    <SectionHeader title="Breakdown per Tipe/Folder" icon={HardDrive} />
                                    <div className="space-y-3">
                                        {(storageStats.byFolder || storageStats.byFileType || []).map((item: any) => {
                                            const label = item.folder || item.file_type
                                            const bytes = Number(item.total_bytes || 0)
                                            const allItems = storageStats.byFolder || storageStats.byFileType || []
                                            const maxBytes = Math.max(...allItems.map((x: any) => Number(x.total_bytes || 0)))
                                            const pct = maxBytes > 0 ? (bytes / maxBytes) * 100 : 0
                                            return (
                                                <div key={label}>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="text-dark-300 capitalize">{label || '(lainnya)'}</span>
                                                        <span className="text-white font-mono">{formatBytes(bytes)} · {formatNumber(item.file_count)} file</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-dark-700">
                                                        <div className="h-2 rounded-full bg-brand-light-green/70 transition-all" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* By user */}
                                <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                                    <SectionHeader title="Storage per Pengguna" icon={Users} />
                                    <div className="space-y-2">
                                        {(storageStats.byUser || []).map((u: any) => (
                                            <div key={u.username} className="flex items-center justify-between py-1.5 border-b border-dark-700/40 last:border-0">
                                                <div>
                                                    <span className="text-sm text-white">{u.username}</span>
                                                    <span className="text-xs text-dark-500 ml-2 capitalize">{u.role}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-brand-light-green font-mono">{formatBytes(u.total_bytes)}</div>
                                                    <div className="text-[10px] text-dark-500">{formatNumber(u.file_count)} file</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Top files */}
                            {(storageStats.topFiles || []).length > 0 && (
                                <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                                    <SectionHeader title="File Terbesar (Top 10)" icon={FileText} />
                                    <div className="space-y-1">
                                        {storageStats.topFiles.map((f: any, i: number) => (
                                            <div key={f.id || f.name || i} className="flex items-center justify-between py-2 border-b border-dark-700/40 last:border-0">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-xs text-dark-500 w-5 text-right">{i + 1}.</span>
                                                    <span className="text-xs text-dark-300 truncate font-mono">{f.name || f.original_name}</span>
                                                </div>
                                                <span className="text-xs text-brand-light-green font-mono flex-shrink-0 ml-3">
                                                    {formatBytes(f.size_bytes)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {!storageStats && loadingStates.storage && (
                        <div className="flex justify-center py-16">
                            <div className="spinner" />
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════ TAB: COMPUTING ═════ */}
            {activeTab === 'computing' && (
                <div className="space-y-5">
                    {/* Environment and Window selector */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        {/* Environment / Service selector */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-dark-400">Environment:</span>
                            {(computing?.availableServices || ['gabah-api', 'gabah-api-staging']).map((srv: string) => (
                                <button
                                    key={srv}
                                    onClick={() => { setGcpService(srv); fetchComputing(gcpWindow, srv) }}
                                    className={`px-3 py-1.5 text-xs rounded-lg border font-mono transition-all ${
                                        (computing?.service || gcpService) === srv
                                            ? 'bg-brand-light-green border-brand-light-green text-white'
                                            : 'border-dark-600 text-dark-400 hover:border-dark-500 hover:text-dark-200'
                                    }`}
                                >
                                    {srv === 'gabah-api' ? 'Production (gabah-api)' : srv === 'gabah-api-staging' ? 'Staging (gabah-api-staging)' : srv}
                                </button>
                            ))}
                        </div>

                        {/* Window selector */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-dark-400">Rentang waktu:</span>
                            {[30, 60, 180, 360, 1440].map(w => (
                                <button
                                    key={w}
                                    onClick={() => { setGcpWindow(w); fetchComputing(w, gcpService) }}
                                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                                        gcpWindow === w
                                            ? 'bg-brand-light-green border-brand-light-green text-white'
                                            : 'border-dark-600 text-dark-400 hover:border-dark-500 hover:text-dark-200'
                                    }`}
                                >
                                    {w < 60 ? `${w}m` : `${w/60}h`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {computing?.available === false ? (
                        <UnavailableBadge reason={computing.reason} />
                    ) : computing ? (
                        <>
                            {/* Service info */}
                            <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Globe size={18} className="text-brand-light-green" />
                                    <div>
                                        <span className="text-sm text-white font-medium">{computing.service}</span>
                                        <span className="text-xs text-dark-400 ml-3">{computing.region}</span>
                                        <span className="text-xs text-dark-500 ml-3">Window: {computing.windowMinutes}m</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-brand-light-green bg-brand-light-green/10 border border-brand-light-green/30 px-2.5 py-1 rounded-full">
                                    <span className="w-2 h-2 rounded-full bg-brand-light-green animate-pulse" />
                                    <span>GCP Connected</span>
                                </div>
                            </div>

                            {/* Summary gauges */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 space-y-4">
                                    <SectionHeader title="Utilisasi Terkini" icon={Cpu} />
                                    <GaugeBar label="CPU Utilization" value={computing.summary?.cpu_percent_latest} />
                                    <GaugeBar label="Memory Utilization" value={computing.summary?.memory_percent_latest} color="blue" />
                                </div>

                                <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                                    <SectionHeader title="Ringkasan Request" icon={Zap} />
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { label: 'Total Requests', val: formatNumber(computing.summary?.request_count_total) },
                                            { label: 'Active Instances', val: computing.summary?.active_instances ?? '0' },
                                            { label: 'P99 Latency', val: computing.summary?.p99_latency_ms ? `${Number(computing.summary.p99_latency_ms).toFixed(0)} ms` : '—' },
                                        ].map(item => (
                                            <div key={item.label} className="bg-dark-900 rounded-lg p-3">
                                                <div className="text-lg font-bold text-white">{item.val}</div>
                                                <div className="text-xs text-dark-400 mt-0.5">{item.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Time series charts */}
                            {computing.timeSeries?.cpu && computing.timeSeries.cpu.length > 0 ? (
                                <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                                    <SectionHeader title="CPU Utilization (Time Series)" icon={MemoryStick} />
                                    <div className="flex items-end gap-0.5 h-20">
                                        {computing.timeSeries.cpu.map((pt: any, i: number) => {
                                            const maxVal = Math.max(...computing.timeSeries.cpu.map((x: any) => x.value))
                                            const pct = maxVal > 0 ? (pt.value / maxVal) * 100 : 0
                                            const time = new Date(pt.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                            return (
                                                <div key={i} className="flex-1 flex items-end h-full group" title={`${time}: ${pt.value.toFixed(1)}%`}>
                                                    <div
                                                        className="w-full bg-rose-500/50 hover:bg-rose-500 rounded-sm transition-all"
                                                        style={{ height: `${Math.max(pct, 2)}%` }}
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div className="flex justify-between text-[10px] text-dark-500 mt-1">
                                        <span>{computing.timeSeries.cpu[0] ? new Date(computing.timeSeries.cpu[0].timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                        <span>Sekarang</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-dark-900/40 rounded-xl p-6 border border-dark-700/60 text-center space-y-2">
                                    <AlertCircle size={22} className="text-amber-400 mx-auto" />
                                    <p className="text-sm font-medium text-white">
                                        Service sedang idle (0 instance aktif dalam {gcpWindow < 60 ? `${gcpWindow} menit` : `${gcpWindow/60} jam`} terakhir)
                                    </p>
                                    <p className="text-xs text-dark-400 max-w-lg mx-auto">
                                        Cloud Run otomatis scale-down ke 0 instance saat tidak ada traffic. Metrik CPU/Memory hanya dicatat ketika ada request yang memicu container berjalan. Coba pilih rentang waktu lebih panjang (misal: 6h atau 24h) atau ganti ke Environment Staging di atas.
                                    </p>
                                </div>
                            )}
                        </>
                    ) : loadingStates.computing ? (
                        <div className="flex justify-center py-16"><div className="spinner" /></div>
                    ) : (
                        <UnavailableBadge reason="Klik Refresh untuk memuat data GCP." />
                    )}
                </div>
            )}
        </div>
    )
}
