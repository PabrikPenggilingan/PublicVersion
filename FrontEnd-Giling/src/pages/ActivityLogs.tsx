import { useState, useEffect } from 'react'
import { logsAPI, type LogEntry, type ActivitySummary } from '@/api/client'
import { formatDateShort } from '@/utils/helpers'
import { Activity, User, Package, Factory, FileText, TrendingUp } from 'lucide-react'

export default function ActivityLogs() {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [summary, setSummary] = useState<ActivitySummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'logs' | 'summary'>('logs')
    const [filters, setFilters] = useState({
        action: '',
        entityType: '',
        page: 1,
    })

    useEffect(() => {
        loadData()
    }, [filters])

    const loadData = async () => {
        try {
            setLoading(true)
            const [logsRes, summaryRes] = await Promise.all([
                logsAPI.getAll({
                    page: filters.page,
                    limit: 20,
                    ...(filters.action && { action: filters.action }),
                    ...(filters.entityType && { entityType: filters.entityType }),
                }),
                logsAPI.getSummary(7),
            ])
            setLogs(logsRes.data || [])
            setSummary(summaryRes.data)
        } catch (error) {
            console.error('Failed to load logs:', error)
        } finally {
            setLoading(false)
        }
    }

    const getActionBadge = (action: string) => {
        const classes: Record<string, string> = {
            CREATE: 'bg-brand-light-green/20 text-brand-light-green',
            UPDATE: 'bg-amber-500/20 text-amber-400',
            DELETE: 'bg-red-500/20 text-red-400',
        }
        return classes[action] || 'bg-slate-500/20 text-slate-400'
    }

    const getEntityIcon = (entityType: string) => {
        const icons: Record<string, typeof Package> = {
            batch: Package,
            process: Factory,
            purchase: FileText,
            file: FileText,
        }
        return icons[entityType] || FileText
    }

    if (loading && logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="spinner"></div>
                <p className="text-stone-600">Memuat data...</p>
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Riwayat Aktivitas</h1>
                    <p className="text-stone-600 text-sm mt-1">Pantau semua perubahan data dalam sistem</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-stone-300 mb-6">
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'logs'
                            ? 'border-brand-light-green text-brand-light-green'
                            : 'border-transparent text-stone-600 hover:text-stone-900'
                        }`}
                >
                    Log Aktivitas
                </button>
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'summary'
                            ? 'border-brand-light-green text-brand-light-green'
                            : 'border-transparent text-stone-600 hover:text-stone-900'
                        }`}
                >
                    Ringkasan
                </button>
            </div>

            {/* Logs Tab */}
            {activeTab === 'logs' && (
                <>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 sm:gap-4 mb-6">
                        <select
                            className="px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                            value={filters.action}
                            onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value, page: 1 }))}
                        >
                            <option value="">Semua Aksi</option>
                            <option value="CREATE">Buat</option>
                            <option value="UPDATE">Perbarui</option>
                            <option value="DELETE">Hapus</option>
                        </select>
                        <select
                            className="px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                            value={filters.entityType}
                            onChange={(e) => setFilters((prev) => ({ ...prev, entityType: e.target.value, page: 1 }))}
                        >
                            <option value="">Semua Entitas</option>
                            <option value="batch">Batch</option>
                            <option value="purchase">Pembelian</option>
                            <option value="process">Proses</option>
                            <option value="file">File</option>
                        </select>
                    </div>

                    {/* Logs List */}
                    <div className="bg-stone-200 border border-stone-300 rounded-xl overflow-hidden">
                        {logs.length > 0 ? (
                            <div className="divide-y divide-stone-300">
                                {logs.map((log) => {
                                    const EntityIcon = getEntityIcon(log.entity_type)
                                    return (
                                        <div key={log.id} className="p-4 hover:bg-stone-300/50 transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 bg-stone-300 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <EntityIcon size={20} className="text-stone-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getActionBadge(log.action)}`}>
                                                            {log.action}
                                                        </span>
                                                        <span className="text-sm font-medium capitalize">{log.entity_type}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-stone-600">
                                                        <span className="inline-flex items-center gap-1">
                                                            <User size={12} />
                                                            {log.username || 'System'}
                                                        </span>
                                                        <span>{formatDateShort(log.created_at)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Activity className="text-stone-500 mb-4" size={48} />
                                <h3 className="font-semibold mb-2">Belum Ada Aktivitas</h3>
                                <p className="text-stone-600 text-sm">Aktivitas akan tercatat saat ada perubahan data.</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Summary Tab */}
            {activeTab === 'summary' && summary && (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {summary.byAction.map((item) => (
                            <div key={item.action} className="bg-stone-200 border border-stone-300 rounded-xl p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getActionBadge(item.action)}`}>
                                        <TrendingUp size={20} />
                                    </div>
                                    <span className="text-lg font-bold">{item.count}</span>
                                </div>
                                <p className="text-stone-600 text-sm">{item.action} (7 hari)</p>
                            </div>
                        ))}
                    </div>

                    {/* By Entity Type */}
                    <div className="bg-stone-200 border border-stone-300 rounded-xl p-6">
                        <h3 className="font-semibold mb-4">Aktivitas per Entitas</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {summary.byEntityType.map((item) => {
                                const Icon = getEntityIcon(item.entity_type)
                                return (
                                    <div key={item.entity_type} className="text-center p-4 bg-stone-300 rounded-lg">
                                        <Icon size={24} className="text-brand-light-green mx-auto mb-2" />
                                        <p className="text-2xl font-bold">{item.count}</p>
                                        <p className="text-xs text-stone-600 capitalize">{item.entity_type}</p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
