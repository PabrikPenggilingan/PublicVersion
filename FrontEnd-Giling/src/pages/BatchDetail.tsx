import toast from 'react-hot-toast'
import PhotoStrip, { photoUrl } from '@/components/PhotoStrip'
import { NumberInput } from '@/components/ui/NumberInput'
import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { batchesAPI, purchasesAPI, batchLinksAPI, type BatchDebt } from '@/api/client'
import Modal from '@/components/ui/Modal'
import PaymentBadge from '@/components/payments/PaymentBadge'
import AddPaymentModal from '@/components/payments/AddPaymentModal'
import { ArrowLeft, Plus, Edit, Trash2, Calendar, MapPin, User, Link2, Image, Camera, AlertTriangle, Eye, X, GalleryHorizontal, FileText, AlertCircle, Warehouse, ChevronLeft, Package, Check, Loader2, Wallet, RefreshCw } from 'lucide-react'
import { formatDateShort, formatCurrency, getStatusClasses, translateStatus } from '@/utils/helpers'
import { confirmDialog } from '@/utils/confirmDialog'
import { compressImage } from '@/utils/imageCompression'
import type { Batch, Purchase, PurchaseFormData } from '@/types'

interface BatchCompletion {
    id: string
    struk_photo_path: string
    lapangan_photo_path: string
    total_tonnage: number
    total_entries: number
    completed_at: string
}

interface PurchasePhoto {
    id: string
    file_path: string
    file_name: string
}

interface PurchaseWithPhotos extends Omit<Purchase, 'filled_by'> {
    photo_count?: number
    admin_notes?: string | null
    filled_by?: string | null
    /** stored file paths (API) or photo rows */
    photos?: (string | PurchasePhoto)[]
}

interface ExtendedBatch extends Batch {
    is_active?: boolean
}

/* Unused constants commented out
const _JENIS_GABAH_OPTIONS = [
    'IR64', 'Ciherang', 'Mekongga', 'Inpari',
    'Situ Bagendit', 'Rojolele', 'Mentik Wangi', 'Lainnya'
]

const _KONDISI_GABAH_OPTIONS = [
    { value: 'kering', label: 'Kering' },
    { value: 'basah', label: 'Basah' },
]
*/

const initialFormData: PurchaseFormData = {
    nama: '',
    tanggalBelanja: new Date().toISOString().split('T')[0],
    calo: '',
    lokasiBelanja: '',
    beratGabahKg: '',
    hargaPerKg: '',
    jenisGabah: '',
    kadarAir: '',
    kadarHampa: '',
    kualitasGabah: 'biasa',
    kondisiGabah: 'kering',
}

export default function BatchDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [batch, setBatch] = useState<ExtendedBatch | null>(null)
    const [purchases, setPurchases] = useState<PurchaseWithPhotos[]>([])
    const [loading, setLoading] = useState(true)
    const [showPurchaseModal, setShowPurchaseModal] = useState(false)
    const [editingPurchase, setEditingPurchase] = useState<PurchaseWithPhotos | null>(null)
    const [saving, setSaving] = useState(false)
    const [purchaseForm, setPurchaseForm] = useState<PurchaseFormData>(initialFormData)
    const [adminNotes, setAdminNotes] = useState('')
    const [completion, setCompletion] = useState<BatchCompletion | null>(null)
    const [showPhotoModal, setShowPhotoModal] = useState(false)
    const [showAllPhotosModal, setShowAllPhotosModal] = useState(false)

    // Admin notes viewer
    const [showNotesModal, setShowNotesModal] = useState(false)
    const [viewingNotes, setViewingNotes] = useState<PurchaseWithPhotos | null>(null)

    // Admin photo upload
    const [adminPhotos, setAdminPhotos] = useState<File[]>([])
    const [adminPhotoPreview, setAdminPhotoPreview] = useState<string[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [gettingLocation, setGettingLocation] = useState(false)

    // Transfer to inventory
    const [showTransferModal, setShowTransferModal] = useState(false)
    const [transferTonnage, setTransferTonnage] = useState('')
    const [transferring, setTransferring] = useState(false)

    // Purchase debt (Hutang Pembelian) — paid in installments, never blocks drying/inventory
    const [debt, setDebt] = useState<BatchDebt | null>(null)
    const [debtLoading, setDebtLoading] = useState(false)
    const [debtError, setDebtError] = useState('')
    const [showPaymentModal, setShowPaymentModal] = useState(false)

    useEffect(() => {
        if (id) loadData()
    }, [id])

    const loadData = async () => {
        if (!id) return
        try {
            setLoading(true)
            const [batchRes, purchasesRes] = await Promise.all([
                batchesAPI.getById(id),
                purchasesAPI.getByBatchId(id),
            ])
            setBatch(batchRes.data)
            setPurchases(purchasesRes.data || [])
            loadDebt()

            // Try to load completion data
            try {
                const completionRes = await batchesAPI.getCompletion(id);
                setCompletion(completionRes.data);
            } catch {
                // No completion yet
            }
        } catch (error) {
            console.error('Failed to load batch:', error)
        } finally {
            setLoading(false)
        }
    }

    // Loaded separately so a debt failure doesn't break the rest of the page
    const loadDebt = async () => {
        if (!id) return
        try {
            setDebtLoading(true)
            setDebtError('')
            const res = await batchesAPI.getDebt(id)
            setDebt(res.data)
        } catch (error) {
            console.error('Failed to load batch debt:', error)
            setDebtError(error instanceof Error ? error.message : 'Gagal memuat data hutang')
        } finally {
            setDebtLoading(false)
        }
    }

    const resetForm = () => {
        setPurchaseForm(initialFormData)
        setEditingPurchase(null)
        setAdminNotes('')
        adminPhotoPreview.forEach(url => URL.revokeObjectURL(url))
        setAdminPhotos([])
        setAdminPhotoPreview([])
    }

    // Admin manual input uses the exact same form as the shareable link
    // (entry → bukti struk/lapangan → logistik & transport). Reuses the batch's active
    // PURCHASE link so links already shared with employees keep working.
    const [openingForm, setOpeningForm] = useState(false)
    const openManualForm = async () => {
        if (!id) return
        if (purchases.length >= 8) {
            toast.error('⚠️ Tidak dapat menambah pembelian! Batch ini sudah memiliki 8 entri (maksimal).')
            return
        }
        if (completion) {
            toast.error('Batch sudah diselesaikan, pembelian tidak bisa ditambah lagi.')
            return
        }
        try {
            setOpeningForm(true)
            const res = await batchLinksAPI.getByBatch(id)
            const now = Date.now()
            let link = (res.data || []).find(l =>
                l.form_type === 'PURCHASE' && l.is_active && (!l.expires_at || new Date(l.expires_at).getTime() > now)
            )
            if (!link) {
                const created = await batchLinksAPI.create(id, { formType: 'PURCHASE' })
                link = created.data
            }
            navigate(`/form/batch/${link.link_code}`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal membuka form input')
        } finally {
            setOpeningForm(false)
        }
    }

    const openEditModal = (purchase: PurchaseWithPhotos) => {
        setEditingPurchase(purchase)
        setPurchaseForm({
            nama: purchase.nama || '',
            tanggalBelanja: purchase.tanggal_belanja?.split('T')[0] || '',
            calo: purchase.calo || '',
            lokasiBelanja: purchase.lokasi_belanja || '',
            beratGabahKg: String(purchase.berat_gabah_kg || ''),
            hargaPerKg: String(purchase.harga_per_kg || ''),
            totalDibayar: purchase.total_dibayar != null && Number(purchase.total_dibayar) !== Number(purchase.total_harga)
                ? String(Math.round(Number(purchase.total_dibayar)))
                : '',
            jenisGabah: purchase.jenis_gabah || '',
            kadarAir: String(purchase.kadar_air || ''),
            kadarHampa: String(purchase.kadar_hampa || ''),
            kualitasGabah: purchase.kualitas_gabah || 'biasa',
        })
        setAdminNotes(purchase.admin_notes || '')
        setShowPurchaseModal(true)
    }

    const openNotesModal = (purchase: PurchaseWithPhotos) => {
        setViewingNotes(purchase)
        setShowNotesModal(true)
    }

    const handleAdminPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        const compressed = await Promise.all(files.map(f => compressImage(f)))
        const newPhotos = [...adminPhotos, ...compressed].slice(0, 3)
        setAdminPhotos(newPhotos)

        const previews = newPhotos.map(file => URL.createObjectURL(file))
        adminPhotoPreview.forEach(url => URL.revokeObjectURL(url))
        setAdminPhotoPreview(previews)
    }

    const removeAdminPhoto = (index: number) => {
        const newPhotos = adminPhotos.filter((_, i) => i !== index)
        setAdminPhotos(newPhotos)

        URL.revokeObjectURL(adminPhotoPreview[index])
        const newPreviews = adminPhotoPreview.filter((_, i) => i !== index)
        setAdminPhotoPreview(newPreviews)
    }

    const handleGetLocation = () => {
        setGettingLocation(true)
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setPurchaseForm(prev => ({
                        ...prev,
                        koordinat: `${position.coords.latitude}, ${position.coords.longitude}`
                    } as any))
                    setGettingLocation(false)
                },
                (error) => {
                    console.error('Error getting location:', error)
                    toast.error('Gagal mendapatkan lokasi. Pastikan GPS aktif dan izin diberikan.')
                    setGettingLocation(false)
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            )
        } else {
            toast.error('Geolokasi tidak didukung di perangkat ini')
            setGettingLocation(false)
        }
    }

    const handleSavePurchase = async () => {
        if (!id) return

        // Validate admin notes for new purchases (Removed: now optional)

        // Validate photos for new purchases (Removed: now optional)

        const berat = parseFloat(purchaseForm.beratGabahKg as string)
        const harga = parseFloat(purchaseForm.hargaPerKg as string)

        if (isNaN(berat) || berat <= 0) {
            toast.error('Berat gabah tidak valid.')
            return
        }
        if (isNaN(harga) || harga <= 0) {
            toast.error('Harga per kg tidak valid.')
            return
        }
        // Harga sampai tempat: empty = same as the goods value
        const totalDibayar = purchaseForm.totalDibayar ? parseFloat(purchaseForm.totalDibayar) : berat * harga
        if (totalDibayar < berat * harga) {
            toast.error('Total dibayar tidak boleh lebih kecil dari nilai gabah (harga × berat).')
            return
        }

        try {
            setSaving(true)
            const data = {
                ...purchaseForm,
                nama: purchaseForm.calo, // map combined field to nama
                beratGabahKg: berat,
                hargaPerKg: harga,
                totalHarga: berat * harga,
                totalDibayar,
                // Provide defaults since they are removed from UI
                jenisGabah: undefined,
                kualitasGabah: 'biasa',
                kondisiGabah: 'kering',
                kadarAir: null,
                kadarHampa: null,
                adminNotes: adminNotes || undefined,
            }

            if (editingPurchase) {
                await purchasesAPI.update(editingPurchase.id, data)
            } else {
                const response = await purchasesAPI.create(id, data)
                const newPurchaseId = response.data.id

                // Upload photos locally
                for (const photo of adminPhotos) {
                    await purchasesAPI.uploadPhoto(newPurchaseId, photo)
                }
            }

            setShowPurchaseModal(false)
            resetForm()
            loadData()
        } catch (error) {
            console.error('Failed to save purchase:', error)
            toast.error(error instanceof Error ? error.message : 'Gagal menyimpan')
        } finally {
            setSaving(false)
        }
    }

    const handleDeletePurchase = async (purchaseId: string) => {
        if (!await confirmDialog('Yakin ingin menghapus pembelian ini?')) return

        try {
            await purchasesAPI.delete(purchaseId)
            loadData()
        } catch (error) {
            console.error('Failed to delete purchase:', error)
            toast.error(error instanceof Error ? error.message : 'Gagal menghapus')
        }
    }

    const handleTransferToInventory = async () => {
        if (!id || !batch) return
        if (!transferTonnage) {
            toast.error('Masukkan jumlah berat yang akan ditransfer.')
            return
        }

        try {
            setTransferring(true)
            const tonnage = parseFloat(transferTonnage)
            // Call the new API we just added
            const { inventoryAPI } = await import('@/api/client')
            await inventoryAPI.createFromBatch(id, { tonnageKg: tonnage })

            setShowTransferModal(false)
            setTransferTonnage('')
            loadData() // Reload to update remaining_kg
            toast.success('Berhasil mentransfer gabah ke Gudang Inventory.')
        } catch (error) {
            console.error('Failed to transfer to inventory:', error)
            toast.error(error instanceof Error ? error.message : 'Gagal mentransfer ke gudang')
        } finally {
            setTransferring(false)
        }
    }

    // Calculate total photos properly
    const totalPhotos = purchases.reduce((sum, p) => sum + (parseInt(String(p.photo_count)) || 0), 0)

    // Calculate total estimasi
    const totalEstimasi = parseFloat(purchaseForm.beratGabahKg || '0') * parseFloat(purchaseForm.hargaPerKg || '0')
    const totalDibayarForm = purchaseForm.totalDibayar ? parseFloat(purchaseForm.totalDibayar) : totalEstimasi
    const selisihTransportForm = totalDibayarForm - totalEstimasi

    // Is batch active
    const isActive = batch?.is_active !== false

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="spinner"></div>
                <p className="text-stone-600">Memuat data...</p>
            </div>
        )
    }

    if (!batch) {
        return <div className="text-center py-12 text-stone-600">Batch tidak ditemukan</div>
    }

    return (
        <div>
            {/* Back Button */}
            <Link to="/batches" className="inline-flex items-center gap-2 text-stone-600 hover:text-brand-light-green text-sm mb-4 transition-colors">
                <ArrowLeft size={18} />
                Kembali ke Daftar Batch
            </Link>

            {/* Inactive Warning Banner */}
            {!isActive && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                    <AlertCircle size={24} className="text-red-400 flex-shrink-0" />
                    <div>
                        <p className="font-medium text-red-400">Batch Tidak Aktif</p>
                        <p className="text-sm text-stone-600">Batch ini sudah ditutup dan tidak dapat diubah. Aktifkan kembali batch untuk melakukan perubahan.</p>
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <Link
                        to="/batches"
                        className="w-10 h-10 bg-stone-200 hover:bg-stone-300 border border-stone-300 rounded-lg flex items-center justify-center transition-colors shrink-0"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl sm:text-2xl font-bold">Detail Batch Belanja</h1>
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClasses(batch.status)}`}>
                                {batch.status}
                            </span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-stone-600 mt-1">
                            <Calendar size={14} />
                            {formatDateShort(batch.batch_date)}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* View All Entry Photos Button */}
                    {purchases.length > 0 && (
                        <button
                            onClick={() => setShowAllPhotosModal(true)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-brand-light-green/20 hover:bg-brand-light-green/30 border border-brand-light-green/30 text-brand-light-green rounded-lg text-xs sm:text-sm font-medium transition-colors"
                        >
                            <GalleryHorizontal size={18} />
                            Lihat Semua Foto
                        </button>
                    )}
                    {completion && (
                        <button
                            onClick={() => setShowPhotoModal(true)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-brand-light-green/20 hover:bg-brand-light-green/30 border border-brand-light-green/30 text-brand-light-green rounded-lg text-xs sm:text-sm font-medium transition-colors"
                        >
                            <Eye size={18} />
                            Bukti Selesai
                        </button>
                    )}
                    <Link
                        to={`/batches/${id}/links`}
                        className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-stone-300 hover:bg-stone-400 border border-stone-400 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                    >
                        <Link2 size={18} />
                        Kelola Link Form
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
                <div className="bg-stone-200 border border-stone-300 rounded-xl p-4 sm:p-6">
                    <div className="text-stone-600 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Total Gabah</div>
                    <div className="text-lg sm:text-2xl font-bold">{Number(batch.total_qty_kg || 0).toLocaleString()} kg</div>
                </div>
                <div className="bg-stone-200 border border-stone-300 rounded-xl p-4 sm:p-6">
                    <div className="text-stone-600 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Sisa Tersedia</div>
                    <div className="text-lg sm:text-2xl font-bold">{Number(batch.remaining_kg || 0).toLocaleString()} kg</div>
                </div>
                <div className="bg-stone-200 border border-stone-300 rounded-xl p-4 sm:p-6">
                    <div className="text-stone-600 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Jumlah Pembelian</div>
                    <div className="text-lg sm:text-2xl font-bold">{purchases.length} / 8</div>
                </div>
                <div className="bg-stone-200 border border-stone-300 rounded-xl p-4 sm:p-6">
                    <div className="text-stone-600 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Total Foto</div>
                    <div className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                        <Camera size={20} className="text-brand-light-green" />
                        {totalPhotos}
                    </div>
                </div>
            </div>


            {/* Purchases Section */}
            <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <h2 className="text-lg font-semibold">Daftar Pembelian</h2>
                    {isActive && batch.status === 'OPEN' && !completion && (
                        <>
                            {purchases.length >= 8 ? (
                                <span className="text-sm text-amber-400 font-medium bg-amber-400/10 px-3 py-1 rounded-lg border border-amber-400/20">
                                    Maksimal 8 Pembelian Tercapai
                                </span>
                            ) : (
                                <button
                                    onClick={openManualForm}
                                    disabled={openingForm}
                                    className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-brand-light-green hover:bg-brand-light-green/80 text-white rounded-lg text-sm font-medium transition-colors w-fit disabled:opacity-50"
                                >
                                    {openingForm ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    Input Manual
                                </button>
                            )}
                        </>
                    )}
                </div>

                <div className="bg-stone-200 border border-stone-300 rounded-xl overflow-hidden">
                    {purchases.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px]">
                                <thead>
                                    <tr className="text-xs text-stone-500 uppercase bg-stone-100/50">
                                        <th className="px-4 py-3 text-left font-semibold">Petani</th>
                                        <th className="px-4 py-3 text-left font-semibold">Petani / Pemasok</th>
                                        <th className="px-4 py-3 text-left font-semibold">Lokasi</th>
                                        <th className="px-4 py-3 text-left font-semibold">Berat</th>
                                        <th className="px-4 py-3 text-left font-semibold">Harga/kg</th>
                                        <th className="px-4 py-3 text-left font-semibold">Total</th>
                                        <th className="px-4 py-3 text-left font-semibold">Foto</th>
                                        <th className="px-4 py-3 text-left font-semibold">Kualitas</th>
                                        <th className="px-4 py-3 text-left font-semibold">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-300">
                                    {purchases.map((purchase) => {
                                        const isAdminInput = !!purchase.admin_notes
                                        return (
                                            <tr
                                                key={purchase.id}
                                                className={`transition-colors ${isAdminInput
                                                    ? 'bg-yellow-500/10 hover:bg-yellow-500/15 border-l-4 border-l-yellow-500'
                                                    : 'hover:bg-stone-300/50'}`}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <User size={14} className="text-stone-500" />
                                                        <div>
                                                            {purchase.nama}
                                                            {isAdminInput && (
                                                                <button
                                                                    onClick={() => openNotesModal(purchase)}
                                                                    className="ml-2 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded font-medium hover:bg-yellow-500/30 inline-flex items-center gap-1"
                                                                >
                                                                    <FileText size={10} />
                                                                    MANUAL
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">{purchase.calo}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1 max-w-[150px]">
                                                        <MapPin size={14} className="text-stone-500 flex-shrink-0" />
                                                        <span className="truncate">{purchase.lokasi_belanja}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">{Number(purchase.berat_gabah_kg).toLocaleString()} kg</td>
                                                <td className="px-4 py-3">{formatCurrency(purchase.harga_per_kg)}</td>
                                                <td className="px-4 py-3 font-medium">
                                                    {formatCurrency(purchase.total_harga)}
                                                    {purchase.total_dibayar != null && Number(purchase.total_dibayar) !== Number(purchase.total_harga) && (
                                                        <div className="text-[11px] font-normal text-stone-500">
                                                            Dibayar {formatCurrency(purchase.total_dibayar)} (sampai tempat)
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1">
                                                        <Image size={14} className="text-brand-light-green" />
                                                        <span className="text-sm">{parseInt(String(purchase.photo_count)) || 0}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusClasses(purchase.kualitas_gabah)}`}>
                                                        {translateStatus(purchase.kualitas_gabah)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {isActive && !completion ? (
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => openEditModal(purchase)} className="p-1.5 rounded text-stone-600 hover:bg-stone-300 hover:text-stone-900 transition-colors">
                                                                <Edit size={14} />
                                                            </button>
                                                            <button onClick={() => handleDeletePurchase(purchase.id)} className="p-1.5 rounded text-stone-600 hover:bg-red-500/20 hover:text-red-400 transition-colors">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-stone-500">{completion ? 'Terkunci' : 'Nonaktif'}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12">
                            <h3 className="font-semibold mb-2">Belum Ada Pembelian</h3>
                            <p className="text-stone-600 text-sm mb-4">Bagikan link form ke employee atau tambah manual.</p>
                            {isActive && batch.status === 'OPEN' && !completion && (
                                <button onClick={openManualForm} disabled={openingForm} className="inline-flex items-center gap-2 px-4 py-2 bg-brand-light-green hover:bg-brand-light-green/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                                    {openingForm ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    Tambah Manual
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Purchase Debt Section (Hutang Pembelian) */}
            <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Wallet size={18} className="text-amber-400" />
                            Hutang Pembelian
                        </h2>
                        {debt && <PaymentBadge status={debt.status} />}
                    </div>
                    {debt && debt.remaining > 0 && isActive && (
                        <button
                            onClick={() => setShowPaymentModal(true)}
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-brand-light-green hover:bg-brand-light-green text-white rounded-lg text-sm font-medium transition-colors w-fit"
                        >
                            <Plus size={16} />
                            Bayar Hutang
                        </button>
                    )}
                </div>

                {debtLoading && !debt ? (
                    <div className="bg-stone-200 border border-stone-300 rounded-xl flex items-center justify-center gap-2 py-10 text-stone-600 text-sm">
                        <Loader2 size={18} className="animate-spin" />
                        Memuat data hutang...
                    </div>
                ) : debtError && !debt ? (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm text-red-400">
                            <AlertCircle size={18} className="flex-shrink-0" />
                            {debtError}
                        </div>
                        <button
                            onClick={loadDebt}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-300 hover:bg-stone-400 rounded-lg text-xs font-medium transition-colors"
                        >
                            <RefreshCw size={14} />
                            Coba Lagi
                        </button>
                    </div>
                ) : debt && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
                            <div className="bg-stone-200 border border-stone-300 rounded-xl p-4 sm:p-6">
                                <div className="text-stone-600 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Total Hutang</div>
                                <div className="text-lg sm:text-2xl font-bold">{formatCurrency(debt.totalOwed)}</div>
                            </div>
                            <div className="bg-stone-200 border border-stone-300 rounded-xl p-4 sm:p-6">
                                <div className="text-stone-600 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Sudah Dibayar</div>
                                <div className="text-lg sm:text-2xl font-bold text-brand-light-green">{formatCurrency(debt.totalPaid)}</div>
                            </div>
                            <div className="bg-stone-200 border border-stone-300 rounded-xl p-4 sm:p-6">
                                <div className="text-stone-600 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Sisa Hutang</div>
                                <div className={`text-lg sm:text-2xl font-bold ${debt.remaining > 0 ? 'text-red-400' : 'text-brand-light-green'}`}>{formatCurrency(debt.remaining)}</div>
                            </div>
                        </div>

                        <div className="bg-stone-200 border border-stone-300 rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[700px]">
                                    <thead>
                                        <tr className="text-xs text-stone-500 uppercase bg-stone-100/50">
                                            <th className="px-4 py-3 text-left font-semibold">Tanggal</th>
                                            <th className="px-4 py-3 text-left font-semibold">Jumlah</th>
                                            <th className="px-4 py-3 text-left font-semibold">Metode</th>
                                            <th className="px-4 py-3 text-left font-semibold">Referensi</th>
                                            <th className="px-4 py-3 text-left font-semibold">Catatan</th>
                                            <th className="px-4 py-3 text-left font-semibold">Status Finance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-300">
                                        {debt.payments.length > 0 ? debt.payments.map((payment) => (
                                            <tr key={`${payment.source}-${payment.id}`} className="hover:bg-stone-300/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium">{formatDateShort(payment.payment_date)}</div>
                                                    {payment.created_by_name && (
                                                        <div className="text-[10px] text-stone-500 uppercase tracking-widest">Oleh {payment.created_by_name}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-brand-light-green">{formatCurrency(Number(payment.amount))}</td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 bg-brand-light-green/10 text-brand-light-green text-[10px] font-bold rounded uppercase tracking-wider border border-brand-light-green/20">
                                                        {payment.payment_method}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-stone-600">{payment.reference_no || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-stone-600 max-w-[200px] truncate" title={payment.notes || ''}>{payment.notes || '-'}</td>
                                                <td className="px-4 py-3">
                                                    {payment.approval_status === 'APPROVED' ? (
                                                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-brand-light-green/10 text-brand-light-green">Disetujui</span>
                                                    ) : payment.approval_status === 'PENDING' ? (
                                                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">Menunggu Approval</span>
                                                    ) : (
                                                        <span className="text-xs text-stone-500">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500 italic">
                                                    Belum ada pembayaran hutang.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Admin Notes Modal */}
            <Modal
                isOpen={showNotesModal}
                onClose={() => { setShowNotesModal(false); setViewingNotes(null); }}
                title="Catatan Admin"
                size="default"
            >
                {viewingNotes && (
                    <div className="space-y-4">
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText size={18} className="text-yellow-400" />
                                <span className="font-medium text-yellow-400">Input Manual oleh Admin</span>
                            </div>
                            <p className="text-sm text-stone-700">
                                Entry ini diinput secara manual melalui dashboard admin, bukan melalui form employee.
                            </p>
                        </div>

                        <div>
                            <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">Entry</p>
                            <p className="font-medium">{viewingNotes.nama} • {viewingNotes.calo}</p>
                            <p className="text-sm text-stone-600">{viewingNotes.lokasi_belanja}</p>
                        </div>

                        <div>
                            <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">Catatan Admin</p>
                            <div className="p-3 bg-stone-300 rounded-lg text-sm">
                                {viewingNotes.admin_notes || 'Tidak ada catatan'}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Bukti Selesai Photo Modal - LARGER */}
            <Modal
                isOpen={showPhotoModal}
                onClose={() => setShowPhotoModal(false)}
                title="Bukti Selesai Batch"
                size="xl"
            >
                {completion && (
                    <div className="space-y-6">
                        <div>
                            <p className="text-sm text-stone-600 mb-3 font-medium">Foto Struk / Kwitansi</p>
                            <img
                                src={photoUrl(completion.struk_photo_path) || ''}
                                alt="Struk"
                                className="w-full max-h-[500px] object-contain rounded-lg border border-stone-400 bg-stone-100"
                            />
                        </div>
                        <div>
                            <p className="text-sm text-stone-600 mb-3 font-medium">Foto Bukti Lapangan</p>
                            <img
                                src={photoUrl(completion.lapangan_photo_path) || ''}
                                alt="Lapangan"
                                className="w-full max-h-[500px] object-contain rounded-lg border border-stone-400 bg-stone-100"
                            />
                        </div>
                        <p className="text-center text-xs text-stone-500">
                            Diselesaikan pada {formatDateShort(completion.completed_at)}
                        </p>
                    </div>
                )}
            </Modal>

            {/* All Entry Photos Modal */}
            <Modal
                isOpen={showAllPhotosModal}
                onClose={() => setShowAllPhotosModal(false)}
                title="Foto Semua Entry Pembelian"
                size="xl"
            >
                <div className="space-y-6 max-h-[70vh] overflow-y-auto">
                    {purchases.map((entry, idx) => (
                        <div key={entry.id} className={`border rounded-xl p-4 ${entry.admin_notes ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-stone-300'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="font-medium flex items-center gap-2">
                                        #{idx + 1} - {entry.calo}
                                        {entry.admin_notes && (
                                            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded font-medium">
                                                MANUAL
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-stone-600">{entry.lokasi_belanja} • {Number(entry.berat_gabah_kg).toLocaleString()} kg</p>
                                </div>
                                <span className="text-xs text-stone-500">{parseInt(String(entry.photo_count)) || 0} foto</span>
                            </div>
                            <PhotoStrip
                                paths={entry.photos?.map(ph => typeof ph === 'string' ? ph : ph.file_path)}
                                label=""
                                size="w-24 h-24 sm:w-28 sm:h-28"
                                emptyText="Tidak ada foto"
                            />
                        </div>
                    ))}
                    {purchases.length === 0 && (
                        <p className="text-center text-stone-600 py-8">Belum ada entry pembelian</p>
                    )}
                </div>
            </Modal>

            {/* Purchase Modal - Full Screen Overlay */}
            {showPurchaseModal && (
                <div className="fixed inset-0 z-[100] bg-stone-100 overflow-y-auto animate-in slide-in-from-bottom-4 duration-200">
                    {/* Header */}
                    <div className="sticky top-0 bg-stone-200 border-b border-stone-300 px-4 py-4 z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <button onClick={() => { setShowPurchaseModal(false); resetForm(); }} className="p-1">
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <div>
                                <h1 className="font-bold text-lg">{editingPurchase ? 'Edit Pembelian' : 'Tambah Pembelian (Admin)'}</h1>
                                <p className="text-xs text-stone-600">
                                    Batch: {formatDateShort(batch.batch_date)} • Entry {editingPurchase ? 'Edit' : `${purchases.length + 1}/8`}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-stone-600">
                            <Package className="w-4 h-4" />
                            <span>Pengisi: Admin</span>
                        </div>
                    </div>

                    <form id="purchase-form" onSubmit={(e) => { e.preventDefault(); handleSavePurchase(); }} className="p-4 pb-32 space-y-5">
                        {/* Admin Warning */}
                        {!editingPurchase && (
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-2">
                                <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <p className="text-yellow-400 font-medium">Input Manual oleh Admin</p>
                                    <p className="text-stone-600 mt-1">Normalnya, pembelian diinput oleh employee melalui link form. Input manual harus disertai catatan alasan dan foto gabah.</p>
                                </div>
                            </div>
                        )}

                        {/* Foto Gabah (for new entries) */}
                        {!editingPurchase && (
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Foto Gabah <span className="text-stone-600 font-normal">(Opsional, 1-3 foto)</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {adminPhotoPreview.map((url, idx) => (
                                        <div key={idx} className="relative w-24 h-24">
                                            <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover rounded-xl" />
                                            <button
                                                type="button"
                                                onClick={() => removeAdminPhoto(idx)}
                                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {adminPhotos.length < 3 && (
                                        <label className="w-24 h-24 bg-stone-200 border-2 border-dashed border-stone-400 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-brand-light-green transition-colors">
                                            <Camera size={24} className="text-stone-500 mb-1" />
                                            <span className="text-xs text-stone-500">{adminPhotos.length}/3</span>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                className="hidden"
                                                onChange={handleAdminPhotoSelect}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Nama Petani/Pemasok */}
                        <div>
                            <label className="block text-sm font-bold text-stone-700 mb-2">
                                Nama Petani / Pemasok <span className="text-stone-600 font-normal">(Opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={purchaseForm.calo}
                                onChange={(e) => setPurchaseForm(prev => ({ ...prev, calo: e.target.value }))}
                                placeholder="Masukkan nama petani atau calo"
                                className="w-full px-4 py-4 bg-stone-200 border border-stone-400 rounded-xl focus:outline-none focus:border-brand-light-green text-base"
                            />
                        </div>

                        {/* Alamat Sawah */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Alamat/Lokasi Sawah <span className="text-stone-600 font-normal">(Opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={purchaseForm.lokasiBelanja}
                                onChange={(e) => setPurchaseForm(prev => ({ ...prev, lokasiBelanja: e.target.value }))}
                                placeholder="Desa, Kecamatan"
                                className="w-full px-4 py-4 bg-stone-200 border border-stone-400 rounded-xl focus:outline-none focus:border-brand-light-green text-base"
                            />
                        </div>

                        {/* GPS Koordinat */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Koordinat GPS <span className="text-stone-500">(opsional)</span>
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={(purchaseForm as any).koordinat || ''}
                                    onChange={(e) => setPurchaseForm(prev => ({ ...prev, koordinat: e.target.value }) as any)}
                                    placeholder="-6.xxx, 106.xxx"
                                    className="flex-1 px-4 py-4 bg-stone-200 border border-stone-400 rounded-xl focus:outline-none focus:border-brand-light-green text-base"
                                    readOnly
                                />
                                <button
                                    type="button"
                                    onClick={handleGetLocation}
                                    disabled={gettingLocation}
                                    className="px-4 py-4 bg-stone-300 hover:bg-stone-400 border border-stone-400 rounded-xl transition-colors flex items-center gap-2"
                                >
                                    {gettingLocation ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <MapPin className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Harga & Berat - INTEGER ONLY */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Harga/Kg (Rp) <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={purchaseForm.hargaPerKg}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9]/g, '')
                                        setPurchaseForm(prev => ({ ...prev, hargaPerKg: val }))
                                    }}
                                    placeholder="5000"
                                    className="w-full px-4 py-4 bg-stone-200 border border-stone-400 rounded-xl focus:outline-none focus:border-brand-light-green text-base"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Berat (kg) <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={purchaseForm.beratGabahKg}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9.]/g, '')
                                        setPurchaseForm(prev => ({ ...prev, beratGabahKg: val }))
                                    }}
                                    placeholder="100"
                                    className="w-full px-4 py-4 bg-stone-200 border border-stone-400 rounded-xl focus:outline-none focus:border-brand-light-green text-base"
                                    required
                                />
                            </div>
                        </div>

                        {/* Nilai Gabah (auto) + Total Dibayar / Harga Sampai Tempat (editable) */}
                        {totalEstimasi > 0 && (
                            <div className="p-4 bg-brand-light-green/10 border border-brand-light-green/30 rounded-xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-stone-600">Nilai Gabah (Harga × Berat)</p>
                                    <p className="text-base font-bold text-stone-900">Rp {totalEstimasi.toLocaleString('id-ID')}</p>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium">Total Dibayar (Harga Sampai Tempat)</label>
                                        {purchaseForm.totalDibayar && (
                                            <button
                                                type="button"
                                                onClick={() => setPurchaseForm(prev => ({ ...prev, totalDibayar: '' }))}
                                                className="text-xs font-medium text-brand-light-green hover:underline"
                                            >
                                                Samakan dengan nilai gabah
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={totalDibayarForm ? totalDibayarForm.toLocaleString('id-ID') : ''}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '')
                                            setPurchaseForm(prev => ({ ...prev, totalDibayar: val }))
                                        }}
                                        placeholder={totalEstimasi.toLocaleString('id-ID')}
                                        className="w-full px-4 py-4 bg-white border border-stone-400 rounded-xl focus:outline-none focus:border-brand-light-green text-base font-bold text-brand-light-green"
                                    />
                                    <p className="text-xs text-stone-600 mt-1">
                                        Uang yang benar-benar dibayar ke penjual, termasuk transport jika sudah termasuk.
                                    </p>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-brand-light-green/30">
                                    <p className="text-sm text-stone-600">Selisih (biaya transport)</p>
                                    <p className={`text-base font-bold ${selisihTransportForm < 0 ? 'text-red-500' : 'text-stone-900'}`}>
                                        Rp {selisihTransportForm.toLocaleString('id-ID')}
                                    </p>
                                </div>
                            </div>
                        )}


                        {/* Admin Notes */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Catatan Admin <span className="text-stone-500 font-normal">(Opsional)</span>
                                {editingPurchase && editingPurchase.admin_notes && <span className="text-stone-500 ml-1">(sebelumnya tersimpan)</span>}
                            </label>
                            <textarea
                                className={`w-full px-4 py-4 bg-stone-200 border rounded-xl text-base focus:outline-none border-stone-400 focus:border-brand-light-green`}
                                placeholder="Opsional: Jelaskan alasan input manual atau keterangan tambahan."
                                rows={3}
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                            />
                        </div>
                    </form>

                    {/* Sticky Submit Button */}
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-stone-200 border-t border-stone-300 z-10">
                        <div className="max-w-lg mx-auto">
                            <button
                                type="button"
                                onClick={handleSavePurchase}
                                disabled={saving}
                                className="w-full py-4 bg-gradient-to-r text-white from-brand-light-green to-brand-light-green hover:from-brand-light-green hover:to-brand-light-green rounded-xl font-bold text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? (
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
                            {!editingPurchase && (
                                <p className="text-center text-xs text-stone-500 mt-2">
                                    ⚠️ Pastikan foto sudah diupload (min. 1 foto)
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Pay Debt Modal (shared with Sales) */}
            {showPaymentModal && debt && id && (
                <AddPaymentModal
                    onClose={() => setShowPaymentModal(false)}
                    submit={(data) => batchesAPI.createPayment(id, data)}
                    refresh={loadData}
                    maxAmount={debt.remaining}
                    title="Bayar Hutang Pembelian"
                    remainingLabel="sisa hutang"
                    showNotes
                />
            )}

            {/* Transfer to Inventory Modal */}
            <Modal
                isOpen={showTransferModal}
                onClose={() => { setShowTransferModal(false); setTransferTonnage(''); }}
                title="Transfer ke Gudang Inventory"
                size="default"
                footer={
                    <>
                        <button onClick={() => setShowTransferModal(false)} className="px-4 py-2 bg-stone-300 hover:bg-stone-400 rounded-lg text-sm font-medium transition-colors">
                            Batal
                        </button>
                        <button onClick={handleTransferToInventory} disabled={transferring} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-900 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                            {transferring ? 'Mentransfer...' : 'Transfer Sekarang'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                        <Warehouse size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-amber-400">Transfer Langsung</p>
                            <p className="text-sm text-stone-700">
                                Pindahkan gabah ini langsung ke gudang utama tanpa melewati proses pengeringan. Gabah yang sudah ditransfer dapat langsung dipilih untuk digiling.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Berat Tersedia (Sisa Batch)</label>
                        <div className="p-3 bg-stone-300 border border-stone-400 rounded-lg font-mono text-lg text-stone-700">
                            {Number(batch?.remaining_kg || 0).toLocaleString()} kg
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Berat yang ingin ditransfer (kg) *</label>
                        <NumberInput

                            min="1"
                            max={batch?.remaining_kg || 0}
                            step="0.01"
                            className="w-full px-3 py-2 bg-stone-200 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                            placeholder="Contoh: 1500"
                            value={transferTonnage}
                            onChange={(e) => setTransferTonnage(e.target.value)}
                            autoFocus
                        />
                        <p className="mt-1.5 text-xs text-stone-500">
                            Masukkan jumlah gabah yang ingin ditransfer ke gudang. Anda bisa mentransfer sebagian atau seluruh sisa batch.
                        </p>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
