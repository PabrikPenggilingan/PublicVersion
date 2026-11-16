import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { pendataanAPI, type PendataanGabah } from '@/api/client'
import { Database, ArrowLeft, Edit2, Wheat, Droplets, Calendar, Weight, FileText, AlertCircle, Wind } from 'lucide-react'

export default function PendataanDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [pendataan, setPendataan] = useState<PendataanGabah | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        if (id) loadPendataan()
    }, [id])

    const loadPendataan = async () => {
        try {
            setLoading(true)
            const response = await pendataanAPI.getById(id!)
            setPendataan(response.data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal memuat data')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="spinner" />
            </div>
        )
    }

    if (error || !pendataan) {
        return (
            <div className="space-y-4">
                <button onClick={() => navigate('/pendataan')} className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors">
                    <ArrowLeft size={18} /> Kembali
                </button>
                <div className="card p-6 text-center text-red-400 border-red-500/20 bg-red-500/5">{error || 'Data tidak ditemukan'}</div>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20 text-stone-900 relative">
            {/* Background Decoration */}
            <div className="fixed top-0 right-0 -z-10 w-[50vw] h-[50vh] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none"></div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/pendataan')}
                        className="p-2 rounded-xl hover:bg-stone-300 text-stone-600 hover:text-stone-900 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <Database size={24} className="text-stone-900" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold">Detail Pendataan</h1>
                            <p className="text-stone-600 text-xs sm:text-sm">{pendataan.purchase_name || 'Batch Gabah'}</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => navigate(`/pendataan/edit/${id}`)}
                        className="btn btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                    >
                        <Edit2 size={16} /> Edit Data
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Basic Info & Condition */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Varietas Card */}
                    <div className="card p-6 bg-stone-200 border-stone-300 rounded-3xl">
                        <h3 className="text-xs font-bold text-brand-light-green mb-6 flex items-center gap-2 uppercase tracking-widest">
                            <Wheat size={14} /> Varietas
                        </h3>
                        <div className="p-5 bg-stone-100/50 rounded-2xl border border-stone-300/50 text-center">
                            <p className="text-2xl font-black text-stone-900">{pendataan.varietas || '-'}</p>
                        </div>
                    </div>

                    {/* Condition Card */}
                    <div className="card p-6 bg-stone-200 border-stone-300 rounded-3xl">
                        <h3 className="text-xs font-bold text-cyan-400 mb-6 flex items-center gap-2 uppercase tracking-widest">
                            <Wind size={14} /> Kondisi Gabah
                        </h3>
                        <div className="inline-flex w-full items-center justify-center px-4 py-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 mr-3 animate-pulse shadow-[0_0_8px] shadow-cyan-400/50"></span>
                            <p className="font-bold text-lg capitalize text-cyan-400 tracking-wide">{pendataan.kondisi_gabah || '-'}</p>
                        </div>
                    </div>

                    {/* Batch Info Card */}
                    <div className="card p-5 bg-stone-200/50 border border-stone-300/30 rounded-3xl">
                        <h3 className="text-[10px] font-bold text-stone-500 mb-4 flex items-center gap-2 uppercase tracking-widest">
                            <Database size={12} /> Data Batch
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-stone-600 flex items-center gap-2"><Calendar size={14} /> Tanggal</span>
                                <span className="font-bold">{pendataan.tanggal_belanja ? new Date(pendataan.tanggal_belanja).toLocaleDateString('id-ID') : '-'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-stone-600 flex items-center gap-2"><Weight size={14} /> Berat</span>
                                <span className="font-bold text-brand-light-green">{pendataan.berat_gabah_kg ? `${pendataan.berat_gabah_kg.toLocaleString('id-ID')} kg` : '-'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Detailed Quality Stats */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Quality Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Kadar Air */}
                        <div className="card p-6 bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-3xl relative overflow-hidden group">
                            <Droplets size={60} className="absolute right-2 bottom-2 text-blue-400 opacity-5 group-hover:opacity-10 transition-opacity" />
                            <div className="relative z-10">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2 block">Kadar Air</span>
                                <p className="text-4xl sm:text-5xl font-black text-stone-900 tracking-tight">
                                    {pendataan.kadar_air ? `${pendataan.kadar_air}%` : '-'}
                                </p>
                            </div>
                        </div>

                        {/* Kadar Hampa */}
                        <div className="card p-6 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-3xl relative overflow-hidden group">
                            <Wheat size={60} className="absolute right-2 bottom-2 text-amber-400 opacity-5 group-hover:opacity-10 transition-opacity" />
                            <div className="relative z-10">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2 block">Kadar Hampa</span>
                                <p className="text-4xl sm:text-5xl font-black text-stone-900 tracking-tight">
                                    {pendataan.kadar_hampa ? `${pendataan.kadar_hampa}%` : '-'}
                                </p>
                            </div>
                        </div>

                        {/* Butir Rusak */}
                        <div className="card p-6 bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 rounded-3xl relative overflow-hidden group">
                            <AlertCircle size={60} className="absolute right-2 bottom-2 text-red-400 opacity-5 group-hover:opacity-10 transition-opacity" />
                            <div className="relative z-10">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-2 block">Butir Rusak</span>
                                <p className="text-4xl sm:text-5xl font-black text-stone-900 tracking-tight">
                                    {pendataan.butir_rusak ? `${pendataan.butir_rusak}%` : '-'}
                                </p>
                            </div>
                        </div>

                        {/* Benda Asing */}
                        <div className="card p-6 bg-gradient-to-br from-brand-light-green/10 to-transparent border border-brand-light-green/20 rounded-3xl relative overflow-hidden group">
                            <Wind size={60} className="absolute right-2 bottom-2 text-brand-light-green opacity-5 group-hover:opacity-10 transition-opacity" />
                            <div className="relative z-10">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-light-green mb-2 block">Benda Asing</span>
                                <p className="text-4xl sm:text-5xl font-black text-stone-900 tracking-tight">
                                    {pendataan.benda_asing ? `${pendataan.benda_asing}%` : '-'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Notes Card */}
                    <div className="card p-6 bg-stone-200 border-stone-300 rounded-3xl">
                        <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <FileText size={16} /> Catatan Analisis R&D
                        </h3>
                        <div className="text-stone-700 bg-stone-100/40 p-6 rounded-2xl border border-stone-300/30 min-h-[140px] font-medium leading-relaxed">
                            {pendataan.notes || 'Tidak ada catatan analisis tambahan untuk pendataan ini.'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Metadata Footer */}
            <div className="card p-6 bg-stone-100/30 border-stone-200/50 rounded-3xl mt-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    <div className="space-y-1">
                        <p className="text-stone-500 text-[10px] uppercase font-bold tracking-tighter">Operator Analis</p>
                        <p className="text-stone-900 font-bold text-sm">{pendataan.created_by_name || 'System Auto'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-stone-500 text-[10px] uppercase font-bold tracking-tighter">Waktu Audit</p>
                        <p className="text-stone-700 text-xs">
                            {new Date(pendataan.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-stone-500 text-[10px] uppercase font-bold tracking-tighter">Terakhir Diperbarui</p>
                        <p className="text-stone-700 text-xs">
                            {new Date(pendataan.updated_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
