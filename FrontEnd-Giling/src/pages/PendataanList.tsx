import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pendataanAPI, type PendataanGabah } from '@/api/client'
import {
    Database,
    Plus,
    Search,
    Trash2,
    Calendar,
    Weight,
    Wheat,
    Droplets,
    AlertCircle,
    Wind,
    Edit3,
    ChevronRight,
    ArrowUpRight,
    Filter
} from 'lucide-react'
import { confirmDialog } from '@/utils/confirmDialog'

export default function PendataanList() {
    const navigate = useNavigate()
    const [pendataanList, setPendataanList] = useState<PendataanGabah[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        loadPendataan()
    }, [])

    const loadPendataan = async () => {
        try {
            setLoading(true)
            const response = await pendataanAPI.getAll({ limit: 100 })
            setPendataanList(response.data.data || [])
        } catch (err) {
            console.error('Error loading pendataan:', err)
            setError(err instanceof Error ? err.message : 'Gagal memuat data')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation() // Prevent navigation to detail
        if (!await confirmDialog('Yakin ingin menghapus pendataan ini?')) return
        try {
            await pendataanAPI.delete(id)
            loadPendataan()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal menghapus')
        }
    }

    const handleEdit = (e: React.MouseEvent, id: string) => {
        e.stopPropagation() // Prevent navigation to detail
        navigate(`/pendataan/edit/${id}`)
    }

    const filteredList = pendataanList.filter(item =>
    (item.purchase_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.varietas?.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4" />
                <p className="text-stone-600 font-medium animate-pulse">Menyelaraskan data...</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 text-stone-900 pb-24 relative">
            {/* Background Gradient Orbs */}
            <div className="fixed top-20 right-[-10%] w-[40vw] h-[40vw] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none -z-10" />
            <div className="fixed bottom-10 left-[-10%] w-[30vw] h-[30vw] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none -z-10" />

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-cyan-500/20 rotate-3 group-hover:rotate-0 transition-transform">
                            <Database size={28} className="text-stone-900" />
                        </div>
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight">Pendataan Gabah</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="w-2 h-2 rounded-full bg-brand-light-green animate-pulse" />
                                <p className="text-stone-600 text-sm font-medium">Data Kualitas R&D Pasca Panen</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/pendataan/new')}
                        className="group flex items-center gap-3 bg-white hover:bg-cyan-50 text-stone-100 px-6 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-white/5 active:scale-95"
                    >
                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                        <span>Tambah Analisis Baru</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 flex items-center gap-3 animate-shake">
                    <AlertCircle size={20} />
                    <span className="flex-1 font-medium">{error}</span>
                    <button onClick={() => setError('')} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors">
                        <Plus size={16} className="rotate-45" />
                    </button>
                </div>
            )}

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 group-focus-within:text-cyan-500 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Cari batch, varietas, atau kondisi..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-stone-200/50 border border-stone-300/50 rounded-2xl py-4 pl-12 pr-4 text-stone-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all placeholder:text-stone-400 font-medium backdrop-blur-sm"
                    />
                </div>
                <button className="px-6 py-4 bg-stone-200/50 border border-stone-300/50 rounded-2xl text-stone-600 hover:text-stone-900 hover:bg-stone-300/50 transition-all flex items-center justify-center gap-3 font-bold backdrop-blur-sm">
                    <Filter size={18} />
                    <span className="hidden sm:inline">Saring</span>
                </button>
            </div>

            {/* Unified Card List */}
            <div className="space-y-4">
                {filteredList.length === 0 ? (
                    <div className="py-24 text-center rounded-[32px] bg-stone-200/30 border border-dashed border-stone-300 backdrop-blur-sm">
                        <div className="w-20 h-20 bg-stone-300/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Database size={40} className="text-stone-500" />
                        </div>
                        <h3 className="text-xl font-bold text-stone-900 mb-2">Data Tidak Ditemukan</h3>
                        <p className="text-stone-600 max-w-xs mx-auto mb-8 font-medium">
                            {searchTerm ? `Hasil pencarian "${searchTerm}" tidak tersedia dalam arsip.` : 'Mulai rekam data analisis gabah pertama Anda hari ini.'}
                        </p>
                        {!searchTerm && (
                            <button onClick={() => navigate('/pendataan/new')} className="btn btn-primary px-8">
                                Buat Entri Sekarang
                            </button>
                        )}
                    </div>
                ) : (
                    filteredList.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => navigate(`/pendataan/${item.id}`)}
                            className="group relative bg-stone-200/40 hover:bg-stone-200/70 border border-stone-300/50 hover:border-cyan-500/30 rounded-3xl p-6 transition-all duration-300 cursor-pointer backdrop-blur-md overflow-hidden flex flex-col lg:flex-row lg:items-center gap-8 shadow-sm hover:shadow-2xl hover:shadow-cyan-500/5"
                        >
                            {/* Accent Layer */}
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-cyan-500 to-blue-600 transform scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />

                            {/* Batch Info */}
                            <div className="flex-1 min-w-0 lg:w-1/3">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-[10px] font-black text-cyan-400 uppercase tracking-widest italic">
                                        {item.kondisi_gabah || 'Normal'}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-500 uppercase tracking-tight">
                                        <Calendar size={12} />
                                        {item.tanggal_belanja ? new Date(item.tanggal_belanja).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                    </div>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-stone-900 truncate mb-2 group-hover:text-cyan-400 transition-colors tracking-tight">
                                    {item.purchase_name || 'Batch Gabah Unnamed'}
                                </h3>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-stone-600 text-sm font-bold">
                                        <Wheat size={16} className="text-brand-light-green" />
                                        <span>{item.varietas || '-'}</span>
                                    </div>
                                    {item.berat_gabah_kg && (
                                        <div className="flex items-center gap-2 text-stone-600 text-sm font-bold">
                                            <Weight size={16} className="text-blue-500" />
                                            <span>{item.berat_gabah_kg.toLocaleString('id-ID')} kg</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quality Metrics Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-[2]">
                                {[
                                    { label: 'Air', value: item.kadar_air, icon: Droplets, color: 'text-blue-400', bg: 'bg-blue-500/5' },
                                    { label: 'Hampa', value: item.kadar_hampa, icon: Wheat, color: 'text-amber-400', bg: 'bg-amber-500/5' },
                                    { label: 'Rusak', value: item.butir_rusak, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/5' },
                                    { label: 'Asing', value: item.benda_asing, icon: Wind, color: 'text-brand-light-green', bg: 'bg-brand-light-green/5' }
                                ].map((metric, idx) => (
                                    <div key={idx} className={`${metric.bg} border border-stone-300/50 rounded-2xl p-3 text-center group-hover:border-stone-400 transition-colors`}>
                                        <div className="flex items-center justify-center gap-1.5 mb-1">
                                            <metric.icon size={12} className={metric.color} opacity={0.7} />
                                            <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">{metric.label}</span>
                                        </div>
                                        <p className={`text-lg font-black ${metric.value ? 'text-stone-900' : 'text-stone-400'}`}>
                                            {metric.value ? `${metric.value}%` : 'N/A'}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Actions Overlay */}
                            <div className="flex items-center justify-end gap-3 lg:w-48">
                                <button
                                    onClick={(e) => handleEdit(e, item.id)}
                                    className="p-3 bg-stone-100/50 hover:bg-white hover:text-stone-50 border border-stone-300/50 rounded-2xl transition-all duration-300"
                                    title="Edit Analisis"
                                >
                                    <Edit3 size={18} />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(e, item.id)}
                                    className="p-3 bg-stone-100/50 hover:bg-red-500 hover:text-stone-900 border border-stone-300/50 rounded-2xl transition-all duration-300"
                                    title="Hapus Data"
                                >
                                    <Trash2 size={18} />
                                </button>
                                <div className="hidden lg:flex items-center justify-center p-3 text-stone-400 group-hover:text-cyan-500 transition-transform group-hover:translate-x-1">
                                    <ChevronRight size={24} strokeWidth={3} />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination / View More Placeholder */}
            {filteredList.length > 10 && (
                <div className="flex justify-center mt-12">
                    <button className="px-8 py-4 bg-stone-200/50 border border-stone-300/50 rounded-2xl text-stone-700 font-bold hover:text-stone-900 hover:bg-stone-300/50 transition-all flex items-center gap-3">
                        Muat Lebih Banyak Analisis
                        <ArrowUpRight size={18} />
                    </button>
                </div>
            )}
        </div>
    )
}
