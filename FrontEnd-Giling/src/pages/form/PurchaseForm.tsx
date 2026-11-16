import { useState, useEffect, useRef } from 'react'
import { NumberInput } from '@/components/ui/NumberInput'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { formsAPI, type FormInfo, type PurchaseFormData, type BatchSummary } from '@/api/client'
import { compressImage } from '@/utils/imageCompression'
import { confirmDialog } from '@/utils/confirmDialog'
import {
    MapPin,
    Package,
    Check,
    AlertCircle,
    ChevronLeft,
    Loader2,
    Camera,
    X,
    Image,
    Plus,
    Upload,
    Truck
} from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { formatDateShort } from '@/utils/helpers'

type FormStep = 'form' | 'summary' | 'upload_bukti' | 'transport'

export default function PurchaseForm() {
    const { linkCode } = useParams<{ linkCode: string }>()
    const navigate = useNavigate()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const [step, setStep] = useState<FormStep>('form')
    const [formInfo, setFormInfo] = useState<FormInfo | null>(null)
    const [summary, setSummary] = useState<BatchSummary | null>(null)

    // Form state (Purchase Phase)
    const [form, setForm] = useState<Omit<PurchaseFormData, 'photos'>>({
        calo: '',
        lokasiBelanja: '',
        koordinat: '',
        hargaPerKg: 0,
        beratGabahKg: 0,
        kualitasGabah: 'biasa'
    })
    const [photos, setPhotos] = useState<File[]>([])
    const [photoPreview, setPhotoPreview] = useState<string[]>([])
    const [editPurchaseId, setEditPurchaseId] = useState<string | null>(null)
    // Harga sampai tempat: null = follow the auto value (harga × berat); a number = edited by the user
    const [totalDibayarInput, setTotalDibayarInput] = useState<number | null>(null)

    // Logistics state (Transport Phase)
    const [logistics, setLogistics] = useState({
        driverName: '',
        crewNames: '',
        origin: '',
        destination: '',
        operationalCost: '',
        durationHours: ''
    })

    // Bukti upload state
    // true once the user types their own Biaya Operasional; until then it follows the Selisih
    const [costEdited, setCostEdited] = useState(false)

    const [strukPhoto, setStrukPhoto] = useState<File | null>(null)
    const [lapanganPhoto, setLapanganPhoto] = useState<File | null>(null)
    const [strukPreview, setStrukPreview] = useState<string>('')
    const [lapanganPreview, setLapanganPreview] = useState<string>('')

    // GPS state
    const [gettingLocation, setGettingLocation] = useState(false)
    const [showConfirmModal, setShowConfirmModal] = useState(false)

    useEffect(() => {
        loadFormInfo()
    }, [linkCode])

    const loadFormInfo = async () => {
        if (!linkCode) return
        try {
            setLoading(true)
            setError('')
            const res = await formsAPI.getInfo(linkCode)
            setFormInfo(res.data)

            // If batch has entries, show summary first
            if (res.data.purchaseCount > 0) {
                await loadSummary()
                setStep('summary')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load form')
        } finally {
            setLoading(false)
        }
    }

    const loadSummary = async () => {
        if (!linkCode) return
        try {
            const res = await formsAPI.getSummary(linkCode)
            setSummary(res.data)
        } catch (err) {
            console.error('Failed to load summary:', err)
        }
    }

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation not supported by browser')
            return
        }

        setGettingLocation(true)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = `${position.coords.latitude},${position.coords.longitude}`
                setForm(prev => ({ ...prev, koordinat: coords }))
                setGettingLocation(false)
            },
            (err) => {
                console.error('GPS error:', err)
                setError('Failed to get location. Please enable GPS.')
                setGettingLocation(false)
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        // Compress images client-side before storing
        const compressedFiles = await Promise.all(
            files.map(file => compressImage(file))
        )

        // Limit to 3 photos total
        const newPhotos = [...photos, ...compressedFiles].slice(0, 3)
        setPhotos(newPhotos)

        // Generate previews
        const previews = newPhotos.map(file => URL.createObjectURL(file))
        photoPreview.forEach(url => URL.revokeObjectURL(url))
        setPhotoPreview(previews)

        if (e.target) {
            e.target.value = ''
        }
    }

    const removePhoto = (index: number) => {
        const newPhotos = photos.filter((_, i) => i !== index)
        setPhotos(newPhotos)

        URL.revokeObjectURL(photoPreview[index])
        const newPreviews = photoPreview.filter((_, i) => i !== index)
        setPhotoPreview(newPreviews)
    }

    // Handle integer-only input
    const handleIntegerInput = (e: React.ChangeEvent<HTMLInputElement>, field: 'hargaPerKg' | 'beratGabahKg') => {
        const value = e.target.value.replace(/[^0-9]/g, '') // Remove non-digits
        const numValue = parseInt(value) || 0
        setForm(prev => ({ ...prev, [field]: numValue }))
    }

    // Goods value (auto) vs amount actually paid (harga sampai tempat, editable)
    const nilaiGabah = (form.hargaPerKg || 0) * (form.beratGabahKg || 0)
    const totalDibayar = totalDibayarInput ?? nilaiGabah
    const selisihTransport = totalDibayar - nilaiGabah

    const handleTotalDibayarInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/[^0-9]/g, '')
        setTotalDibayarInput(digits === '' ? null : parseInt(digits))
    }

    const handleSubmitPurchase = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!linkCode) return

        if (summary?.completion) {
            setError('Pembelian sudah dikunci karena batch telah diselesaikan.')
            return
        }

        // Validate required fields - only harga and berat are mandatory
        if (!form.hargaPerKg || !form.beratGabahKg) {
            setError('Harga per kg dan berat gabah wajib diisi')
            return
        }
        if (totalDibayar < nilaiGabah) {
            setError('Total dibayar tidak boleh lebih kecil dari nilai gabah (harga × berat)')
            return
        }

        setSubmitting(true)
        setError('')

        try {
            if (editPurchaseId) {
                await formsAPI.updatePurchase(linkCode, editPurchaseId, { ...form, totalDibayar })
            } else {
                await formsAPI.submitPurchase(linkCode, { ...form, totalDibayar, photos })
            }

            // Clear form and photos
            setForm({
                calo: '',
                lokasiBelanja: '',
                koordinat: '',
                hargaPerKg: 0,
                beratGabahKg: 0,
                kualitasGabah: 'biasa'
            })
            setTotalDibayarInput(null)
            setPhotos([])
            photoPreview.forEach(url => URL.revokeObjectURL(url))
            setPhotoPreview([])
            setEditPurchaseId(null)

            // Load summary and go to summary page
            await loadSummary()
            setStep('summary')
            setSuccessMessage(editPurchaseId ? 'Data berhasil diupdate!' : 'Data berhasil disimpan!')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit')
        } finally {
            setSubmitting(false)
        }
    }

    const handleFileSelect = async (type: 'struk' | 'lapangan', file: File) => {
        const compressed = await compressImage(file)
        if (type === 'struk') {
            if (strukPreview) URL.revokeObjectURL(strukPreview)
            setStrukPhoto(compressed)
            setStrukPreview(URL.createObjectURL(compressed))
        } else {
            if (lapanganPreview) URL.revokeObjectURL(lapanganPreview)
            setLapanganPhoto(compressed)
            setLapanganPreview(URL.createObjectURL(compressed))
        }
    }

    const handleEditEntry = (entry: any) => {
        setForm({
            calo: entry.calo || '',
            lokasiBelanja: entry.lokasi_belanja || '',
            koordinat: entry.koordinat || '',
            hargaPerKg: entry.harga_per_kg,
            beratGabahKg: entry.berat_gabah_kg,
            kadarAir: entry.kadar_air || '',
            kadarHampa: entry.kadar_hampa || '',
            kualitasGabah: entry.kualitas_gabah || 'biasa',
            kondisiGabah: entry.kondisi_gabah || 'kering'
        })
        const paid = entry.total_dibayar != null ? Number(entry.total_dibayar) : null
        setTotalDibayarInput(paid != null && paid !== Number(entry.total_harga) ? paid : null)
        setEditPurchaseId(entry.id)
        setStep('form')
    }

    const handleDeleteEntry = async (id: string) => {
        if (!await confirmDialog('Hapus pembelian ini?')) return
        if (!linkCode) return

        try {
            await formsAPI.deletePurchase(linkCode, id)
            await loadSummary()
            setSuccessMessage('Pembelian berhasil dihapus')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal menghapus')
        }
    }

    // Open the Logistik step with Biaya Operasional pre-filled from the harga sampai tempat difference.
    // The field stays editable; an amount the user already typed is never overwritten.
    const openTransportStep = () => {
        // Re-sync with the latest Selisih every time (entries may have been added/edited since),
        // unless the user already typed their own amount
        if (!costEdited) {
            const suggested = Math.round(summary?.suggestedTransportCost || 0)
            setLogistics(prev => ({ ...prev, operationalCost: suggested > 0 ? String(suggested) : '' }))
        }
        setStep('transport')
    }

    const handleSimpanFoto = () => {
        setStep('summary')
        setSuccessMessage('Foto berhasil disimpan sementara. Lanjut ke Logistik jika sudah selesai.')
    }

    const handleCompleteBatch = async () => {
        if (!linkCode) return

        setShowConfirmModal(false)
        setSubmitting(true)
        setError('')

        try {
            await formsAPI.completeBatch(linkCode, strukPhoto, lapanganPhoto, logistics)

            // Batch creator / super admin goes straight to Batch Detail to manage the purchase debt
            if (summary?.canViewBatch && formInfo?.batchId) {
                toast.success('Batch berhasil diselesaikan! Hutang pembelian dapat dibayar di Detail Batch.')
                navigate(`/batches/${formInfo.batchId}`)
                return
            }

            await loadSummary()
            setSuccessMessage('Batch berhasil diselesaikan!')
            setStep('summary')
            // Clear bukti photos
            if (strukPreview) URL.revokeObjectURL(strukPreview)
            if (lapanganPreview) URL.revokeObjectURL(lapanganPreview)
            setStrukPhoto(null)
            setLapanganPhoto(null)
            setStrukPreview('')
            setLapanganPreview('')
            // Clear logistics
            setCostEdited(false)
            setLogistics({
                driverName: '',
                crewNames: '',
                origin: '',
                destination: '',
                operationalCost: '',
                durationHours: ''
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload bukti')
        } finally {
            setSubmitting(false)
        }
    }

    // Loading state
    if (loading) {
        return (
            <div className="w-full overflow-x-hidden max-w-md mx-auto min-h-screen bg-stone-100 flex items-center justify-center p-4 sm:shadow-2xl relative">
                <div className="fixed top-4 right-4 z-[60]">

                </div>
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-brand-light-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-stone-600">Memuat form...</p>
                </div>
            </div>
        )
    }

    // Error state (invalid link)
    if (error && !formInfo) {
        return (
            <div className="w-full overflow-x-hidden max-w-md mx-auto min-h-screen bg-stone-100 flex items-center justify-center p-4 sm:shadow-2xl relative">
                <div className="fixed top-4 right-4 z-[60]">

                </div>
                <div className="text-center max-w-sm">
                    <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h1 className="text-xl font-bold mb-2">Link Tidak Valid</h1>
                    <p className="text-stone-600 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-3 bg-brand-light-green rounded-lg font-medium"
                    >
                        Kembali
                    </button>
                </div>
            </div>
        )
    }

    // UPLOAD BUKTI step - upload struk dan lapangan
    if (step === 'upload_bukti') {
        return (
            <div className="w-full overflow-x-hidden max-w-md mx-auto min-h-screen bg-stone-100 sm:shadow-2xl relative">
                <div className="fixed top-4 right-4 z-[60]">

                </div>
                {/* Header */}
                <div className="sticky top-0 bg-stone-200 border-b border-stone-300 px-3 py-3 z-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep('summary')} className="p-1">
                            <ChevronLeft className="w-6 h-6 text-stone-900" />
                        </button>
                        <div>
                            <h1 className="font-bold text-base text-stone-900">Upload Bukti Foto</h1>
                            <p className="text-xs text-stone-600">
                                Total: {summary?.totalTonnage.toLocaleString() || 0} kg dari {summary?.totalEntries || 0} entry
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-3 pb-32 space-y-4 text-stone-900">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="bg-brand-light-green/10 border border-brand-light-green/30 rounded-xl p-4">
                        <p className="text-sm text-stone-700">
                            Upload foto struk/kwitansi (wajib) dan foto bukti lapangan (opsional).
                        </p>
                    </div>

                    {/* Struk Photo */}
                    <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-2">
                            Foto Struk/Kwitansi <span className="text-red-400">*</span>
                        </label>
                        {strukPreview ? (
                            <div className="relative">
                                <img src={strukPreview} alt="Struk" className="w-full h-48 object-cover rounded-xl" />
                                <button
                                    onClick={() => { setStrukPhoto(null); URL.revokeObjectURL(strukPreview); setStrukPreview('') }}
                                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-stone-900 rounded-full flex items-center justify-center shadow-lg"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center h-48 bg-stone-200 border-2 border-dashed border-stone-400 rounded-xl cursor-pointer hover:border-brand-light-green transition-colors">
                                <Upload className="w-10 h-10 text-stone-500 mb-2" />
                                <span className="text-xs text-stone-600">Tap untuk upload foto struk</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleFileSelect('struk', e.target.files[0])}
                                />
                            </label>
                        )}
                    </div>

                    {/* Lapangan Photo */}
                    <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-2">
                            Foto Bukti Lapangan <span className="text-stone-600 font-normal">(Opsional)</span>
                        </label>
                        {lapanganPreview ? (
                            <div className="relative">
                                <img src={lapanganPreview} alt="Lapangan" className="w-full h-48 object-cover rounded-xl" />
                                <button
                                    onClick={() => { setLapanganPhoto(null); URL.revokeObjectURL(lapanganPreview); setLapanganPreview('') }}
                                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-stone-900 rounded-full flex items-center justify-center shadow-lg"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center h-48 bg-stone-200 border-2 border-dashed border-stone-400 rounded-xl cursor-pointer hover:border-brand-light-green transition-colors">
                                <Camera className="w-10 h-10 text-stone-500 mb-2" />
                                <span className="text-xs text-stone-600">Tap untuk upload foto lapangan</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleFileSelect('lapangan', e.target.files[0])}
                                />
                            </label>
                        )}
                    </div>
                </div>

                {/* Submit Button */}
                <div className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 p-3 bg-stone-200 border-t border-stone-300 z-20">
                    <button
                        onClick={handleSimpanFoto}
                        className="w-full py-3 bg-gradient-to-r from-brand-light-green to-brand-light-green hover:from-brand-light-green hover:to-brand-light-green rounded-xl font-bold text-base text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Check className="w-5 h-5" />
                        Simpan Pilihan Foto
                    </button>
                </div>
            </div>
        )
    }

    // TRANSPORT (Logistik Phase 2) step
    if (step === 'transport') {
        return (
            <div className="w-full overflow-x-hidden max-w-md mx-auto min-h-screen bg-stone-100 text-stone-900 sm:shadow-2xl relative">
                <div className="fixed top-4 right-4 z-[60]">

                </div>
                <div className="bg-stone-200 border-b border-stone-300 p-6 sticky top-0 z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <button onClick={() => setStep('summary')} className="p-2 bg-stone-300 hover:bg-stone-400 rounded-xl transition-colors">
                            <ChevronLeft className="w-5 h-5 text-stone-900" />
                        </button>
                        <div>
                            <h1 className="font-bold text-base">Logistik & Transport</h1>
                            <p className="text-xs text-stone-600">Penyelesaian Batch Pembelian</p>
                        </div>
                    </div>
                    {/* Status Stepper */}
                    <div className="flex items-center justify-between px-4 mt-6">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 bg-brand-light-green border-brand-light-green text-stone-900">
                                <Check size={20} />
                            </div>
                            <span className="text-xs font-bold text-stone-900">BELANJA</span>
                        </div>
                        <div className="flex-1 h-0.5 mx-2 bg-brand-light-green"></div>
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-brand-light-green text-brand-light-green bg-brand-light-green/10">
                                2
                            </div>
                            <span className="text-xs font-bold text-brand-light-green">LOGISTIK</span>
                        </div>
                    </div>
                </div>

                <div className="p-3 pb-32 max-w-2xl mx-auto space-y-4">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-3">
                            <AlertCircle className="shrink-0" size={20} />
                            <p>{error}</p>
                        </div>
                    )}
                    {summary && (summary.totalDibayar || 0) > 0 && (
                        <div className="bg-brand-light-green/10 border border-brand-light-green/30 rounded-2xl p-4 space-y-2 text-sm">
                            <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">Harga Sampai Tempat</p>
                            <div className="flex justify-between">
                                <span className="text-stone-600">Total Dibayar</span>
                                <span className="font-semibold">Rp {(summary.totalDibayar || 0).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-600">Nilai Gabah (Harga × Berat)</span>
                                <span className="font-semibold">− Rp {(summary.totalNilaiGabah || 0).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-brand-light-green/30">
                                <span className="font-semibold text-stone-700">Selisih (Biaya Transport)</span>
                                <span className="font-bold text-brand-light-green">Rp {(summary.suggestedTransportCost || 0).toLocaleString('id-ID')}</span>
                            </div>
                            {String(Math.round(summary.suggestedTransportCost || 0)) !== logistics.operationalCost && (
                                <button
                                    type="button"
                                    onClick={() => { setCostEdited(false); setLogistics(prev => ({ ...prev, operationalCost: String(Math.round(summary.suggestedTransportCost || 0)) })) }}
                                    className="text-xs font-medium text-brand-light-green hover:underline"
                                >
                                    Pakai selisih sebagai Biaya Operasional
                                </button>
                            )}
                        </div>
                    )}

                    <div className="bg-stone-100 border border-stone-200 rounded-3xl p-6 shadow-xl space-y-6">
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
                            <Truck className="text-brand-light-green" />
                            Detail Transportasi
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-stone-600 mb-1.5">
                                    Nama Supir <span className="text-stone-500 font-normal">(Opsional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={logistics.driverName}
                                    onChange={(e) => setLogistics(prev => ({ ...prev, driverName: e.target.value }))}
                                    className="w-full px-3 py-3 bg-stone-200 border border-stone-300 rounded-2xl focus:outline-none focus:border-brand-light-green text-sm transition-colors"
                                    placeholder="Contoh: Suparman"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-stone-600 mb-1.5">
                                    Nama Kru/Kuli <span className="text-stone-500 font-normal">(Opsional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={logistics.crewNames}
                                    onChange={(e) => setLogistics(prev => ({ ...prev, crewNames: e.target.value }))}
                                    className="w-full px-3 py-3 bg-stone-200 border border-stone-300 rounded-2xl focus:outline-none focus:border-brand-light-green text-sm transition-colors"
                                    placeholder="Misal: Ujang, Asep"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-stone-600 mb-1.5">
                                    Titik Asal <span className="text-stone-500 font-normal">(Opsional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={logistics.origin}
                                    onChange={(e) => setLogistics(prev => ({ ...prev, origin: e.target.value }))}
                                    className="w-full px-3 py-3 bg-stone-200 border border-stone-300 rounded-2xl focus:outline-none focus:border-brand-light-green text-sm transition-colors"
                                    placeholder="Dari mana..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-stone-600 mb-1.5">
                                    Titik Tujuan <span className="text-stone-500 font-normal">(Opsional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={logistics.destination}
                                    onChange={(e) => setLogistics(prev => ({ ...prev, destination: e.target.value }))}
                                    className="w-full px-3 py-3 bg-stone-200 border border-stone-300 rounded-2xl focus:outline-none focus:border-brand-light-green text-sm transition-colors"
                                    placeholder="Ke mana..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-stone-600 mb-1.5">
                                    Biaya Operasional (Rp) <span className="text-stone-500 font-normal">(Otomatis dari selisih, bisa diubah)</span>
                                </label>
                                <NumberInput
 min="0" required
                                    value={logistics.operationalCost}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={(e) => { setCostEdited(true); setLogistics(prev => ({ ...prev, operationalCost: e.target.value })) }}
                                    className="w-full px-3 py-3 bg-stone-200 border border-stone-300 rounded-2xl focus:outline-none focus:border-brand-light-green text-sm transition-colors"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-stone-600 mb-1.5">
                                    Durasi (Jam) <span className="text-stone-500 font-normal">(Opsional)</span>
                                </label>
                                <NumberInput
 min="0" step="0.5"
                                    value={logistics.durationHours}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={(e) => setLogistics(prev => ({ ...prev, durationHours: e.target.value }))}
                                    className="w-full px-3 py-3 bg-stone-200 border border-stone-300 rounded-2xl focus:outline-none focus:border-brand-light-green text-sm transition-colors"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="button"
                                onClick={() => {
                                    if (logistics.operationalCost !== '' && parseFloat(logistics.operationalCost) < 0) {
                                        setError('Biaya operasional tidak boleh negatif');
                                        return;
                                    }
                                    if (!strukPhoto) {
                                        setError('Foto struk/kwitansi wajib diupload. Kembali ke ringkasan, lalu pilih "Upload Bukti Struk & Lapangan".');
                                        return;
                                    }
                                    setError('');
                                    setShowConfirmModal(true);
                                }}
                                className="w-full py-3 bg-gradient-to-r from-brand-light-green to-brand-light-green hover:from-brand-light-green hover:to-brand-light-green rounded-xl font-bold text-base text-white shadow-lg shadow-brand-light-green/20 flex items-center justify-center gap-2 transition-all"
                            >
                                <Check size={20} /> Kumpulkan
                            </button>
                        </div>
                    </div>
                </div>

                <Modal
                    isOpen={showConfirmModal}
                    onClose={() => setShowConfirmModal(false)}
                    title="Apakah kamu yakin?"
                    footer={
                        <div className='mb-4 flex justify-end gap-4'>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleCompleteBatch}
                                disabled={submitting}
                                className="px-4 py-2 bg-brand-light-green hover:bg-brand-light-green/80 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                {submitting ? 'Memproses...' : 'Kumpulkan'}
                            </button>
                        </div>
                    }
                >
                    <div className="text-stone-700">
                        Setelah mengumpulkan, data tidak bisa diubah lagi.
                    </div>
                </Modal>
            </div>
        )
    }

    // SUMMARY step - shows all entries and allows adding more
    if (step === 'summary' && summary) {
        const canAddMore = summary.totalEntries < summary.maxPurchases
        const hasBuktiUploaded = !!summary.completion

        return (
            <div className="w-full overflow-x-hidden max-w-md mx-auto min-h-screen bg-stone-100 text-stone-900 sm:shadow-2xl relative">
                <div className="fixed top-4 right-4 z-[60]">

                </div>
                {/* Header */}
                <div className="sticky top-0 bg-stone-200 border-b border-stone-300 px-3 py-3 z-10 flex items-center justify-between">
                    <div>
                        <h1 className="font-bold text-base">Summary Batch</h1>
                        <p className="text-xs text-stone-600">
                            Batch: {formatDateShort(summary.batchDate)} • {summary.totalEntries}/{summary.maxPurchases} entry
                        </p>
                    </div>
                    {!hasBuktiUploaded && (
                        <button
                            disabled={summary.totalEntries === 0}
                            onClick={openTransportStep}
                            className={`px-4 py-2 rounded-lg font-bold text-sm text-white bg-gradient-to-r from-brand-light-green to-brand-light-green transition-all ${summary.totalEntries === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:from-brand-light-green hover:to-brand-light-green'
                                }`}
                        >
                            Selanjutnya
                        </button>
                    )}
                </div>

                {/* Status Stepper */}
                <div className="flex items-center justify-between px-4 mt-6 bg-stone-100">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-brand-light-green text-brand-light-green bg-brand-light-green/10">
                            1
                        </div>
                        <span className="text-xs font-bold text-brand-light-green">BATCH PEMBELIAN</span>
                    </div>
                    <div className="flex-1 h-0.5 mx-2 bg-stone-300"></div>
                    <div className="flex flex-col items-center gap-2 opacity-50">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-stone-300 text-stone-500 bg-stone-200">
                            2
                        </div>
                        <span className="text-xs font-bold text-stone-600">LOGISTIK</span>
                    </div>
                </div>

                <div className="p-3 pb-40 space-y-3">
                    {/* Success message */}
                    {successMessage && (
                        <div className="bg-brand-light-green/10 border border-brand-light-green/30 rounded-xl p-4 flex items-center gap-3">
                            <Check size={20} className="text-brand-light-green" />
                            <div>
                                <p className="font-medium text-brand-light-green">{successMessage}</p>
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-stone-200 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-brand-light-green">{summary.totalEntries}</p>
                            <p className="text-xs text-stone-600">Entry</p>
                        </div>
                        <div className="bg-stone-200 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-brand-light-green">{summary.totalTonnage.toLocaleString()}</p>
                            <p className="text-xs text-stone-600">Kg Total</p>
                        </div>
                        <div className="bg-stone-200 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-yellow-400">{summary.totalPhotos}</p>
                            <p className="text-xs text-stone-600">Foto</p>
                        </div>
                    </div>

                    {/* Entries List */}
                    <div className="space-y-3">
                        <h2 className="font-medium text-stone-700">Daftar Pembelian Anda</h2>
                        {summary.entries.map((entry) => (
                            <div key={entry.id} className="bg-stone-200 rounded-xl p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <p className="font-medium">{entry.calo || '(Tanpa Nama)'}</p>
                                        <p className="text-xs text-stone-600">{entry.lokasi_belanja || '(Tanpa Lokasi)'}</p>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-stone-600">
                                        <Image size={12} />
                                        {entry.photo_count} foto
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-stone-600">{entry.jenis_gabah}</span>
                                    <span className="font-bold text-brand-light-green">
                                        {Number(entry.berat_gabah_kg).toLocaleString()} kg
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs mt-1 text-stone-600">
                                    <span>Rp {Number(entry.total_harga).toLocaleString('id-ID')}</span>
                                    {entry.total_dibayar != null && Number(entry.total_dibayar) !== Number(entry.total_harga) && (
                                        <span>Dibayar Rp {Number(entry.total_dibayar).toLocaleString('id-ID')} (sampai tempat)</span>
                                    )}
                                </div>
                                {!hasBuktiUploaded && (
                                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-stone-300">
                                        <button
                                            onClick={() => handleEditEntry(entry)}
                                            className="px-3 py-1.5 text-xs font-medium text-brand-light-green bg-brand-light-green/10 hover:bg-brand-light-green/20 rounded-lg transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteEntry(entry.id)}
                                            className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                                        >
                                            Hapus
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {summary.entries.length === 0 && (
                        <div className="text-center py-10 text-stone-600">
                            <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                            <p>Belum ada pembelian tercatat</p>
                        </div>
                    )}
                </div>

                {/* Bottom Actions */}
                <div className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 p-3 bg-stone-200 border-t border-stone-300 space-y-2 z-20">
                    {canAddMore && !hasBuktiUploaded && (
                        <button
                            onClick={() => { setTotalDibayarInput(null); setStep('form'); setSuccessMessage(''); }}
                            className="w-full py-3 bg-gradient-to-r from-brand-light-green to-brand-light-green rounded-xl font-bold flex items-center justify-center gap-2 text-base text-white"
                        >
                            <Plus size={18} />
                            Tambah Pembelian ({summary.totalEntries}/{summary.maxPurchases})
                        </button>
                    )}

                    {!hasBuktiUploaded && (
                        <button
                            onClick={() => { setStep('upload_bukti'); setSuccessMessage(''); }}
                            className="w-full py-3 bg-stone-300 hover:bg-stone-400 rounded-xl font-medium flex items-center justify-center gap-2 text-stone-900"
                        >
                            <Upload size={18} />
                            {(strukPhoto || lapanganPhoto) ? 'Ubah Bukti Struk & Lapangan' : 'Upload Bukti Struk & Lapangan (Struk wajib)'}
                        </button>
                    )}

                    {!canAddMore && !hasBuktiUploaded && (
                        <div className="text-center text-yellow-400 py-2 bg-yellow-500/10 rounded-xl">
                            ⚠️ Kuota maksimal tercapai ({summary.maxPurchases} entry)
                        </div>
                    )}

                    {hasBuktiUploaded && (
                        <div className="text-center text-brand-light-green py-3 bg-brand-light-green/10 rounded-xl border border-brand-light-green/30">
                            ✅ Batch Pembelian Selesai
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // FORM step (Phase 1) - Single Purchase Entry
    return (
        <div className="w-full overflow-x-hidden max-w-md mx-auto min-h-screen bg-stone-100 text-stone-900 sm:shadow-2xl relative">
            <div className="fixed top-4 right-4 z-[60]">

            </div>
            {/* Header */}
            <div className="sticky top-0 bg-stone-200 border-b border-stone-300 px-3 py-3 z-10">
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => summary ? setStep('summary') : navigate(-1)} className="p-1">
                        <ChevronLeft className="w-6 h-6 text-stone-900" />
                    </button>
                    <div>
                        <h1 className="font-bold text-base">Form Pembelian Gabah</h1>
                        <p className="text-xs text-stone-600">
                            Batch: {formInfo && formatDateShort(formInfo.batchDate)} • Entry {(formInfo?.purchaseCount || 0) + 1}/{formInfo?.maxPurchases || 8}
                        </p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitPurchase} className="p-3 pb-32 space-y-3">
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Photo Upload */}
                <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        Foto Gabah <span className="text-stone-600 font-normal">(Opsional, 1-3 foto)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {photoPreview.map((url, idx) => (
                            <div key={idx} className="relative w-16 h-16">
                                <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover rounded-lg" />
                                <button
                                    type="button"
                                    onClick={() => removePhoto(idx)}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-stone-900"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                        {photos.length < 3 && (
                            <label className="w-16 h-16 bg-stone-200 border-2 border-dashed border-stone-400 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-light-green transition-colors">
                                <Camera size={24} className="text-stone-500 mb-1" />
                                <span className="text-xs text-stone-500">{photos.length}/3</span>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={handlePhotoSelect}
                                />
                            </label>
                        )}
                    </div>
                </div>

                {/* Nama Petani/Pemasok */}
                <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        Nama Petani / Pemasok <span className="text-stone-600 font-normal">(Opsional)</span>
                    </label>
                    <input
                        type="text"
                        value={form.calo}
                        onChange={(e) => setForm(prev => ({ ...prev, calo: e.target.value }))}
                        placeholder="Masukkan nama petani atau pemasok"
                        className="w-full px-3 py-3 bg-stone-200 border border-stone-400 rounded-xl focus:outline-none focus:border-brand-light-green text-sm"
                    />
                </div>

                {/* Alamat Sawah */}
                <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        Alamat/Lokasi Sawah <span className="text-stone-600 font-normal">(Opsional)</span>
                    </label>
                    <input
                        type="text"
                        value={form.lokasiBelanja}
                        onChange={(e) => setForm(prev => ({ ...prev, lokasiBelanja: e.target.value }))}
                        placeholder="Desa, Kecamatan"
                        className="w-full px-3 py-3 bg-stone-200 border border-stone-400 rounded-xl focus:outline-none focus:border-brand-light-green text-sm"
                    />
                </div>

                {/* GPS Koordinat */}
                <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        Koordinat GPS <span className="text-stone-500">(opsional)</span>
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={form.koordinat}
                            onChange={(e) => setForm(prev => ({ ...prev, koordinat: e.target.value }))}
                            placeholder="-6.xxx, 106.xxx"
                            className="flex-1 px-3 py-3 bg-stone-200 border border-stone-400 rounded-xl focus:outline-none focus:border-brand-light-green text-sm"
                            readOnly
                        />
                        <button
                            type="button"
                            onClick={handleGetLocation}
                            disabled={gettingLocation}
                            className="px-3 py-3 bg-stone-300 hover:bg-stone-400 border border-stone-400 rounded-xl transition-colors flex items-center gap-2"
                        >
                            {gettingLocation ? (
                                <Loader2 className="w-5 h-5 animate-spin text-stone-900" />
                            ) : (
                                <MapPin className="w-5 h-5 text-stone-900" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Harga & Berat - INTEGER ONLY */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                            Harga/Kg (Rp) <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={form.hargaPerKg || ''}
                            onChange={(e) => handleIntegerInput(e, 'hargaPerKg')}
                            placeholder="5000"
                            className="w-full px-3 py-3 bg-stone-200 border border-stone-400 rounded-xl focus:outline-none focus:border-brand-light-green text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                            Berat (kg) <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={form.beratGabahKg || ''}
                            onChange={(e) => handleIntegerInput(e, 'beratGabahKg')}
                            placeholder="100"
                            className="w-full px-3 py-3 bg-stone-200 border border-stone-400 rounded-xl focus:outline-none focus:border-brand-light-green text-sm"
                            required
                        />
                    </div>
                </div>

                {/* Nilai Gabah (auto) + Total Dibayar / Harga Sampai Tempat (editable) */}
                {nilaiGabah > 0 && (
                    <div className="p-4 bg-brand-light-green/10 border border-brand-light-green/30 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-stone-600">Nilai Gabah (Harga × Berat)</p>
                            <p className="text-sm font-bold text-stone-900">Rp {nilaiGabah.toLocaleString('id-ID')}</p>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-semibold text-stone-700">
                                    Total Dibayar (Harga Sampai Tempat)
                                </label>
                                {totalDibayarInput !== null && (
                                    <button
                                        type="button"
                                        onClick={() => setTotalDibayarInput(null)}
                                        className="text-[11px] font-medium text-brand-light-green hover:underline"
                                    >
                                        Samakan dengan nilai gabah
                                    </button>
                                )}
                            </div>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={totalDibayar ? totalDibayar.toLocaleString('id-ID') : ''}
                                onChange={handleTotalDibayarInput}
                                placeholder={nilaiGabah.toLocaleString('id-ID')}
                                className="w-full px-3 py-3 bg-white border border-stone-400 rounded-xl focus:outline-none focus:border-brand-light-green text-base font-bold text-brand-light-green"
                            />
                            <p className="text-[11px] text-stone-600 mt-1">
                                Isi jumlah uang yang benar-benar dibayar ke penjual, termasuk transport jika sudah termasuk.
                            </p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-brand-light-green/30">
                            <p className="text-xs text-stone-600">Selisih (dihitung sebagai biaya transport)</p>
                            <p className={`text-sm font-bold ${selisihTransport < 0 ? 'text-red-500' : 'text-stone-900'}`}>
                                Rp {selisihTransport.toLocaleString('id-ID')}
                            </p>
                        </div>
                    </div>
                )}
            </form>

            {/* Sticky Submit Button */}
            <div className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 p-3 bg-stone-200 border-t border-stone-300 z-20">
                <div className="w-full">
                    <button
                        type="button"
                        onClick={handleSubmitPurchase}
                        disabled={submitting}
                        className="w-full py-3 bg-gradient-to-r from-brand-light-green to-brand-light-green hover:from-brand-light-green hover:to-brand-light-green rounded-xl font-bold text-base text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Menyimpan...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                Simpan Pembelian
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
