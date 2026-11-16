import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formsAPI } from '@/api/client'
import type { Purchase } from '@/types'
import { formatDateShort, formatCurrency } from '@/utils/helpers'
import {
    ChevronLeft,
    Package,
    Calendar
} from 'lucide-react'

export default function MySubmissions() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [submissions, setSubmissions] = useState<Purchase[]>([])

    useEffect(() => {
        loadSubmissions()
    }, [])

    const loadSubmissions = async () => {
        try {
            setLoading(true)
            const res = await formsAPI.getMySubmissions({ limit: 50 })
            setSubmissions(res.data || [])
        } catch (error) {
            console.error('Failed to load submissions:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-stone-100">
            {/* Header */}
            <div className="sticky top-0 bg-stone-200 border-b border-stone-300 px-4 py-4 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-1">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="font-bold text-lg">Riwayat Pengisian</h1>
                        <p className="text-xs text-stone-600">
                            {submissions.length} form yang sudah diisi
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-10 h-10 border-4 border-brand-light-green border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : submissions.length > 0 ? (
                    <div className="space-y-3">
                        {submissions.map((sub) => (
                            <div
                                key={sub.id}
                                className="p-4 bg-stone-200 border border-stone-300 rounded-xl"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <p className="font-medium">{sub.calo}</p>
                                        <p className="text-sm text-stone-600">{sub.lokasi_belanja}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-medium
                                        ${sub.kualitas_gabah === 'sangat_bagus' ? 'bg-brand-light-green/20 text-brand-light-green' :
                                            sub.kualitas_gabah === 'bagus' ? 'bg-brand-light-green/20 text-brand-light-green' :
                                                sub.kualitas_gabah === 'biasa' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-red-500/20 text-red-400'}`}
                                    >
                                        {sub.kualitas_gabah}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="flex items-center gap-2 text-stone-600">
                                        <Package className="w-4 h-4" />
                                        <span>{sub.berat_gabah_kg} kg</span>
                                    </div>
                                    <div className="text-right text-brand-light-green font-medium">
                                        {formatCurrency(sub.total_harga)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2 text-xs text-stone-500">
                                    <Calendar className="w-3 h-3" />
                                    <span>{formatDateShort(sub.created_at)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Package className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                        <p className="text-stone-600">Belum ada form yang diisi</p>
                    </div>
                )}
            </div>
        </div>
    )
}
