import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { batchesAPI, processesAPI, dashboardAPI } from '@/api/client'
import { Package, Factory, TrendingUp, Boxes } from 'lucide-react'

interface Stats {
    totalBatches: number
    openBatches: number
    totalProcesses: number
    inProgressProcesses: number
}

interface TimelineData {
    batchId: string
    batchName: string
    totalQtyKg: number
    phases: {
        belanja: boolean
        pengeringan: boolean
        gudang_gabah: boolean
        penggilingan: boolean
        gudang_beras: boolean
        penjualan: boolean
    }
    amounts: {
        pengeringan_kg: number
        gudang_gabah_kg: number
        penggilingan_kg: number
        gudang_beras_kg: number
        penjualan_kg: number
    }
    isCompleted: boolean
}

export default function Dashboard() {
    const [stats, setStats] = useState<Stats>({
        totalBatches: 0,
        openBatches: 0,
        totalProcesses: 0,
        inProgressProcesses: 0,
    })
    const [timelineData, setTimelineData] = useState<TimelineData[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadDashboardData()
    }, [])

    const loadDashboardData = async () => {
        try {
            const [batchesRes, openBatchesRes, processesRes, inProgressRes, timelineRes] = await Promise.all([
                batchesAPI.getAll({ limit: 5 }),
                batchesAPI.getAll({ status: 'OPEN', limit: 5 }),
                processesAPI.getAll({ limit: 5 }),
                processesAPI.getAll({ status: 'IN_PROGRESS', limit: 5 }),
                dashboardAPI.getTimeline()
            ])

            setStats({
                totalBatches: batchesRes.pagination?.total || batchesRes.data?.length || 0,
                openBatches: openBatchesRes.pagination?.total || openBatchesRes.data?.length || 0,
                totalProcesses: processesRes.pagination?.total || processesRes.data?.length || 0,
                inProgressProcesses: inProgressRes.pagination?.total || inProgressRes.data?.length || 0,
            })

            setTimelineData(timelineRes.data || [])
        } catch (error) {
            console.error('Failed to load dashboard:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="spinner"></div>
                <p className="text-stone-600">Memuat data...</p>
            </div>
        )
    }

    const statCards = [
        { label: 'Total Batch', value: stats.totalBatches, icon: Package, color: '#3b82f6' },
        { label: 'Batch Terbuka', value: stats.openBatches, icon: Boxes, color: '#5BA12E' },
        { label: 'Total Proses', value: stats.totalProcesses, icon: Factory, color: '#f59e0b' },
        { label: 'Sedang Proses', value: stats.inProgressProcesses, icon: TrendingUp, color: '#f43f5e' },
    ]

    return (
        <div>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                {statCards.map((stat) => (
                    <div
                        key={stat.label}
                        className={`relative bg-gradient-to-br from-stone-200 to-stone-300 border border-stone-300 rounded-xl p-6 overflow-hidden`}
                    >
                        <div className="w-4 h-4 md:w-12 md:h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${stat.color}33`, color: stat.color }}>
                            <stat.icon size={24} />
                        </div>
                        <div className="text-2xl md:text-3xl font-bold mb-1">{stat.value}</div>
                        <div className="text-stone-600 text-sm">{stat.label}</div>
                        <div className="absolute top-0 right-0 w-20 h-20 md:w-24 md:h-24 rounded-bl-full" style={{ backgroundColor: `${stat.color}0D` }}></div>
                    </div>
                ))}
            </div>

            {/* Timeline View */}
            <div className="bg-stone-200 border border-stone-300 rounded-xl overflow-hidden mb-8">
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-300">
                    <h2 className="text-lg font-semibold">Status Batch Aktif</h2>
                </div>
                <div className="p-4 md:p-6 md:overflow-x-auto">
                    {timelineData.length > 0 ? (
                        <div className="flex flex-col gap-6 md:gap-8 md:min-w-[800px]">
                            {timelineData.map((batch) => (
                                <div key={batch.batchId} className="flex flex-col gap-2">
                                    <Link to={`/batches/${batch.batchId}`} className="font-semibold text-brand-light-green hover:underline">
                                        {batch.batchName} ({Number(batch.totalQtyKg).toLocaleString()} kg)
                                    </Link>

                                    <div className="relative flex items-start justify-between mt-2 md:pl-4 md:pr-12">
                                        {/* Connecting Line */}
                                        <div className="absolute left-[8.33%] right-[8.33%] md:left-12 md:right-20 h-1 bg-stone-400 top-[12px] -translate-y-1/2 z-0 rounded-full"></div>

                                        {/* Phases */}
                                        <TimelineNode label="Belanja" short="Beli" isActive={batch.phases.belanja} />
                                        <TimelineNode label="Pengeringan" short="Jemur" isActive={batch.phases.pengeringan} />
                                        <TimelineNode
                                            label="Gudang"
                                            isActive={batch.phases.gudang_gabah}
                                            amountText={batch.amounts.gudang_gabah_kg > 0 ? `${batch.amounts.gudang_gabah_kg.toLocaleString()} kg` : undefined}
                                        />
                                        <TimelineNode
                                            label="Penggilingan"
                                            short="Giling"
                                            isActive={batch.phases.penggilingan}
                                            amountText={batch.amounts.penggilingan_kg > 0 ? `${batch.amounts.penggilingan_kg.toLocaleString()} kg` : undefined}
                                        />

                                        <TimelineNode
                                            label="Gudang"
                                            isActive={batch.phases.gudang_beras}
                                            amountText={batch.phases.gudang_beras || batch.phases.penjualan ? `${batch.amounts.gudang_beras_kg.toLocaleString()} kg` : undefined}
                                        />

                                        <TimelineNode
                                            label="Penjualan"
                                            short="Jual"
                                            isActive={batch.phases.penjualan}
                                            amountText={batch.phases.gudang_beras || batch.phases.penjualan ? `${batch.amounts.penjualan_kg.toLocaleString()} kg` : undefined}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center text-stone-600">
                            Tidak ada batch aktif saat ini.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function TimelineNode({ label, short, isActive, amountText }: { label: string, short?: string, isActive: boolean, amountText?: string }) {
    return (
        <div className="relative z-10 flex flex-col items-center gap-2 group flex-1 min-w-0 md:flex-none md:w-24">
            <div
                className={`w-6 h-6 rounded-full flex items-center justify-center border-4 transition-all duration-300
                    ${isActive
                        ? 'bg-brand-light-green border-brand-dark-green shadow-lg shadow-brand-light-green/50 scale-125'
                        : 'bg-stone-500 border-stone-200'
                    }
                `}
            >
            </div>
            <div className="text-center">
                <span className={`text-[10px] md:text-xs font-medium ${isActive ? 'text-stone-900' : 'text-stone-600'}`}>
                    <span className="md:hidden">{short || label}</span>
                    <span className="hidden md:inline">{label}</span>
                </span>
                {amountText && (
                    <div className="text-[9px] md:text-[10px] text-stone-600 mt-0.5 whitespace-nowrap">
                        {amountText}
                    </div>
                )}
            </div>
        </div>
    )
}
