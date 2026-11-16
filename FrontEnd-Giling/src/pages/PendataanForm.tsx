import { useState, useEffect } from 'react'
import { NumberInput } from '@/components/ui/NumberInput'
import { useNavigate, useParams } from 'react-router-dom'
import { pendataanAPI, purchasesAPI, batchesAPI } from '@/api/client'
import {
    Database,
    ArrowLeft,
    Save,
    Check,
    ClipboardList,
    Droplets,
    Wheat,
    Calendar,
    Weight,
    Tag,
    FileText,
    Wind,
    Search,
    Loader2,
    AlertCircle,
    X
} from 'lucide-react'

interface PurchaseOption {
    id: string
    nama: string
    tanggal_belanja: string
    berat_gabah_kg: number
    batch_id: string
}

const VARIETAS_OPTIONS = [
    'IR-64',
    'Ciherang',
    'Inpari 32',
    'Inpari 42',
    'Situ Bagendit',
    'Mekongga',
    'Ciliwung',
    'Pandan Wangi',
    'Sintanur',
    'Lainnya'
]

export default function PendataanForm() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const isEdit = !!id

    const [loading, setLoading] = useState(isEdit)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    // Data states
    const [purchases, setPurchases] = useState<PurchaseOption[]>([])
    const [selectedPurchaseId, setSelectedPurchaseId] = useState('')
    const [formData, setFormData] = useState({
        varietas: '',
        kondisiGabah: '',
        kadarAir: '',
        kadarHampa: '',
        butirRusak: '',
        bendaAsing: '',
        notes: ''
    })

    // Filter/Search for Purchases
    const [purchaseSearch, setPurchaseSearch] = useState('')

    useEffect(() => {
        loadInitialData()
    }, [id])

    const loadInitialData = async () => {
        try {
            setLoading(true)

            if (!isEdit) {
                const batchesRes = await batchesAPI.getAll({ limit: 100 })
                const batches = batchesRes.data || []

                const pendataanRes = await pendataanAPI.getAll({ limit: 1000 })
                const usedPurchaseIds = new Set(
                    (pendataanRes.data.data || [])
                        .filter((p: any) => p.butir_rusak !== null || p.benda_asing !== null) // Only consider it 'used' if QC has filled out advanced metrics
                        .map((p: any) => p.purchase_id)
                )

                const allPurchases: PurchaseOption[] = []
                for (const batch of batches) {
                    const pRes = await purchasesAPI.getByBatchId(batch.id, { limit: 100 })
                    const available = (pRes.data || [])
                        .filter((p: any) => !usedPurchaseIds.has(p.id))
                        .map((p: any) => ({
                            id: p.id,
                            nama: p.nama || `Batch ${p.id.slice(0, 8)}`,
                            tanggal_belanja: p.tanggal_belanja,
                            berat_gabah_kg: p.berat_gabah_kg,
                            batch_id: batch.id
                        }))
                    allPurchases.push(...available)
                }
                setPurchases(allPurchases)
            } else {
                const response = await pendataanAPI.getById(id!)
                const data = response.data
                setFormData({
                    varietas: data.varietas || '',
                    kondisiGabah: data.kondisi_gabah || '',
                    kadarAir: data.kadar_air?.toString() || '',
                    kadarHampa: data.kadar_hampa?.toString() || '',
                    butirRusak: data.butir_rusak?.toString() || '',
                    bendaAsing: data.benda_asing?.toString() || '',
                    notes: data.notes || ''
                })
                setSelectedPurchaseId(data.purchase_id)
            }
        } catch (err: any) {
            setError(err.message || 'Gagal memuat data')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedPurchaseId) {
            setError('Pilih Batch Gabah terlebih dahulu')
            return
        }

        setSubmitting(true)
        setError('')
        try {
            const payload = {
                purchaseId: selectedPurchaseId,
                varietas: formData.varietas || undefined,
                kondisiGabah: formData.kondisiGabah || undefined,
                kadarAir: formData.kadarAir ? parseFloat(formData.kadarAir) : undefined,
                kadarHampa: formData.kadarHampa ? parseFloat(formData.kadarHampa) : undefined,
                butirRusak: formData.butirRusak ? parseFloat(formData.butirRusak) : undefined,
                bendaAsing: formData.bendaAsing ? parseFloat(formData.bendaAsing) : undefined,
                notes: formData.notes || undefined
            }

            if (isEdit) {
                await pendataanAPI.update(id!, payload)
            } else {
                await pendataanAPI.create(payload)
            }

            setSuccess(true)
            setTimeout(() => {
                navigate(isEdit ? `/pendataan/${id}` : '/pendataan')
            }, 1500)
        } catch (err: any) {
            setError(err.message || 'Gagal menyimpan data')
        } finally {
            setSubmitting(false)
        }
    }

    const filteredPurchases = purchases.filter(p =>
        p.nama.toLowerCase().includes(purchaseSearch.toLowerCase())
    )

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <Loader2 size={40} className="text-cyan-500 animate-spin mb-4" />
                <p className="text-stone-600 animate-pulse">Memuat formulir...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen pb-24 relative overflow-x-hidden">
            {/* Background Decoration */}
            <div className="fixed top-0 right-0 -z-10 w-[50vw] h-[50vh] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="fixed bottom-0 left-0 -z-10 w-[50vw] h-[50vh] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none"></div>

            {/* Header */}
            <div className="max-w-[1400px] mx-auto px-4 pt-8 pb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors mb-4 group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span>Kembali</span>
                </button>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                                <ClipboardList size={22} className="text-stone-900" />
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                                {isEdit ? 'Perbarui Pendataan' : 'Pendataan Gabah Baru'}
                            </h1>
                        </div>
                        <p className="text-stone-600 text-sm">Lengkapi data analisis kualitas R&D untuk batch gabah.</p>
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-4">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Batch Selection (Only for New) or Summary (for Edit) */}
                    <div className="lg:col-span-4 space-y-6">
                        {!isEdit && (
                            <div className="bg-stone-200/40 border border-stone-300/50 rounded-3xl p-6 backdrop-blur-md">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-sm font-bold text-stone-900 shadow-lg">1</div>
                                        <h2 className="text-lg font-bold text-stone-900">Pilih Batch</h2>
                                    </div>
                                    {selectedPurchaseId && (
                                        <span className="text-[10px] font-bold text-brand-light-green px-2 py-1 bg-brand-light-green/10 rounded-lg flex items-center gap-1">
                                            <Check size={10} /> TERPILIH
                                        </span>
                                    )}
                                </div>

                                <div className="relative mb-6">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Cari nama batch..."
                                        value={purchaseSearch}
                                        onChange={(e) => setPurchaseSearch(e.target.value)}
                                        className="w-full bg-stone-100/50 border border-stone-300 rounded-xl py-3 pl-10 pr-4 text-stone-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all text-sm"
                                    />
                                </div>

                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {filteredPurchases.length === 0 ? (
                                        <div className="py-12 text-center rounded-2xl bg-stone-100/30 border border-dashed border-stone-300">
                                            <Database size={32} className="mx-auto mb-3 text-stone-400" />
                                            <p className="text-xs text-stone-500 px-4">Tidak ada batch gabah tersedia.</p>
                                        </div>
                                    ) : (
                                        filteredPurchases.map((p) => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => setSelectedPurchaseId(p.id)}
                                                className={`w-full group relative flex flex-col p-4 rounded-2xl border transition-all text-left ${selectedPurchaseId === p.id
                                                    ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/5'
                                                    : 'border-stone-300 bg-stone-200/30 hover:border-stone-400 hover:bg-stone-300/30'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <p className={`text-sm font-bold truncate transition-colors ${selectedPurchaseId === p.id ? 'text-cyan-400' : 'text-stone-900'}`}>
                                                        {p.nama}
                                                    </p>
                                                    {selectedPurchaseId === p.id && <Check size={16} className="text-cyan-500 shrink-0" />}
                                                </div>
                                                <div className="flex items-center gap-4 text-[10px] font-medium text-stone-500 mt-1">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar size={12} />
                                                        {new Date(p.tanggal_belanja).toLocaleDateString('id-ID')}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-brand-light-green/80">
                                                        <Weight size={12} />
                                                        {p.berat_gabah_kg.toLocaleString()} kg
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {isEdit && (
                            <div className="bg-stone-200/40 border border-stone-300/50 rounded-3xl p-6 backdrop-blur-md">
                                <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Database size={14} /> Informasi Batch Terpilih
                                </h2>
                                <div className="space-y-4">
                                    <div className="p-4 bg-stone-100/50 rounded-2xl border border-stone-300/50">
                                        <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Nama Batch</p>
                                        <p className="text-stone-900 font-bold">{selectedPurchaseId ? "Menampilkan Data Edit..." : "-"}</p>
                                    </div>
                                    <p className="text-xs text-stone-600 italic font-medium px-2">
                                        Batch tidak dapat diubah saat mode edit.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Form Details */}
                    <div className="lg:col-span-8 space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400 scale-in text-sm">
                                <AlertCircle size={18} />
                                <span className="flex-1 font-medium">{error}</span>
                                <button onClick={() => setError('')}><X size={16} /></button>
                            </div>
                        )}

                        <div className={`bg-stone-200/50 border border-stone-300/50 rounded-3xl p-6 sm:p-8 backdrop-blur-md transition-all duration-500 ${(!isEdit && !selectedPurchaseId) ? 'opacity-30 grayscale pointer-events-none scale-[0.99]' : 'opacity-100'}`}>
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-sm font-bold text-stone-900 shadow-lg shadow-cyan-500/20">
                                    {isEdit ? '✓' : '2'}
                                </div>
                                <h2 className="text-xl font-bold text-stone-900">Analisis Kualitas</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                {/* Varietas Dropdown */}
                                <div className="group space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-stone-600 uppercase tracking-widest group-focus-within:text-cyan-400 transition-colors">
                                        <Tag size={14} /> Varietas Gabah
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={formData.varietas}
                                            onChange={(e) => setFormData({ ...formData, varietas: e.target.value })}
                                            className="w-full bg-stone-100/50 border border-stone-300 rounded-xl p-4 text-stone-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all appearance-none cursor-pointer text-sm"
                                        >
                                            <option value="" disabled className="bg-stone-100">Pilih Varietas</option>
                                            {VARIETAS_OPTIONS.map(opt => (
                                                <option key={opt} value={opt} className="bg-stone-100">{opt}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-stone-500">
                                            <Wind size={16} className="rotate-90" />
                                        </div>
                                    </div>
                                </div>

                                {/* Kondisi Gabah */}
                                <div className="group space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-stone-600 uppercase tracking-widest group-focus-within:text-cyan-400 transition-colors">
                                        <Wind size={14} /> Kondisi Gabah
                                    </label>
                                    <select
                                        value={formData.kondisiGabah}
                                        onChange={(e) => setFormData({ ...formData, kondisiGabah: e.target.value })}
                                        className="w-full bg-stone-100/50 border border-stone-300 rounded-xl p-4 text-stone-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all cursor-pointer text-sm"
                                    >
                                        <option value="" className="bg-stone-100">Pilih Kondisi</option>
                                        <option value="kering" className="bg-stone-100">Kering</option>
                                        <option value="lembab" className="bg-stone-100">Lembab</option>
                                        <option value="basah" className="bg-stone-100">Basah</option>
                                    </select>
                                </div>

                                {/* Main Statistics Grid */}
                                <div className="col-span-full grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                                    {/* Kadar Air */}
                                    <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl group focus-within:border-blue-500/40 transition-all">
                                        <label className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">
                                            <Droplets size={12} /> Air (%)
                                        </label>
                                        <NumberInput

                                            step="0.1"
                                            placeholder="0.0"
                                            value={formData.kadarAir}
                                            onChange={(e) => setFormData({ ...formData, kadarAir: e.target.value })}
                                            className="w-full bg-transparent border-none p-0 text-2xl font-black text-stone-900 focus:outline-none placeholder:text-stone-300"
                                        />
                                    </div>

                                    {/* Kadar Hampa */}
                                    <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl group focus-within:border-amber-500/40 transition-all">
                                        <label className="flex items-center gap-2 text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2">
                                            <Wheat size={12} /> Hampa (%)
                                        </label>
                                        <NumberInput

                                            step="0.1"
                                            placeholder="0.0"
                                            value={formData.kadarHampa}
                                            onChange={(e) => setFormData({ ...formData, kadarHampa: e.target.value })}
                                            className="w-full bg-transparent border-none p-0 text-2xl font-black text-stone-900 focus:outline-none placeholder:text-stone-300"
                                        />
                                    </div>

                                    {/* Butir Rusak */}
                                    <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-2xl group focus-within:border-red-500/40 transition-all">
                                        <label className="flex items-center gap-2 text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">
                                            <AlertCircle size={12} /> Rusak (%)
                                        </label>
                                        <NumberInput

                                            step="0.1"
                                            placeholder="0.0"
                                            value={formData.butirRusak}
                                            onChange={(e) => setFormData({ ...formData, butirRusak: e.target.value })}
                                            className="w-full bg-transparent border-none p-0 text-2xl font-black text-stone-900 focus:outline-none placeholder:text-stone-300"
                                        />
                                    </div>

                                    {/* Benda Asing */}
                                    <div className="bg-brand-light-green/5 border border-brand-light-green/10 p-4 rounded-2xl group focus-within:border-brand-light-green/40 transition-all">
                                        <label className="flex items-center gap-2 text-[10px] font-bold text-brand-light-green uppercase tracking-widest mb-2">
                                            <Wind size={12} /> Benda Asing (%)
                                        </label>
                                        <NumberInput

                                            step="0.1"
                                            placeholder="0.0"
                                            value={formData.bendaAsing}
                                            onChange={(e) => setFormData({ ...formData, bendaAsing: e.target.value })}
                                            className="w-full bg-transparent border-none p-0 text-2xl font-black text-stone-900 focus:outline-none placeholder:text-stone-300"
                                        />
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="col-span-full mt-4 space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-widest">
                                        <FileText size={14} /> Catatan Analisis
                                    </label>
                                    <textarea
                                        rows={4}
                                        placeholder="Tuliskan detail tambahan atau hasil pengamatan R&D lainnya..."
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full bg-stone-100/50 border border-stone-300 rounded-2xl p-4 text-stone-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all resize-none text-sm"
                                    ></textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Bar - Responsive Floating */}
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl bg-stone-200/80 backdrop-blur-xl border border-stone-300/50 p-3 sm:p-4 rounded-3xl z-50 shadow-2xl flex items-center justify-between gap-4 scale-in">
                        <div className="hidden sm:flex items-center gap-3 px-4">
                            <div className={`w-2.5 h-2.5 rounded-full ${submitting ? 'bg-amber-500 animate-pulse' : (selectedPurchaseId ? 'bg-brand-light-green shadow-[0_0_10px] shadow-brand-light-green/50' : 'bg-stone-400')}`}></div>
                            <span className="text-xs font-bold text-stone-900 uppercase tracking-tight">
                                {submitting ? 'Menyimpan...' : (selectedPurchaseId ? 'Siap disimpan' : 'Pilih Batch')}
                            </span>
                        </div>
                        <div className="flex-1 sm:flex-none flex gap-2">
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="px-6 py-3 rounded-2xl bg-stone-300/50 hover:bg-stone-300 text-stone-900 text-sm font-bold transition-all"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || (!isEdit && !selectedPurchaseId)}
                                className="flex-1 sm:flex-none px-8 sm:px-12 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-stone-900 text-sm font-bold shadow-lg shadow-cyan-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <>
                                        <Save size={18} />
                                        <span>{isEdit ? 'Simpan' : 'Selesaikan'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Success Overlay */}
            {success && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-50/90 backdrop-blur-md p-4">
                    <div className="bg-stone-200 border border-brand-light-green/30 p-10 rounded-[2.5rem] text-center shadow-2xl scale-in max-w-sm w-full">
                        <div className="w-24 h-24 bg-brand-light-green rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-brand-light-green/40">
                            <Check size={48} className="text-stone-900" strokeWidth={3} />
                        </div>
                        <h3 className="text-3xl font-black text-stone-900 mb-3">Berhasil!</h3>
                        <p className="text-stone-600 font-medium">Data pendataan gabah telah aman tersimpan di sistem.</p>
                    </div>
                </div>
            )}
        </div>
    )
}
