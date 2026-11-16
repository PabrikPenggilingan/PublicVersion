import toast from 'react-hot-toast'
import PhotoStrip from '@/components/PhotoStrip'
import { NumberInput } from '@/components/ui/NumberInput'
import { getCleanErrorMessage } from '@/errors'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { dryingAPI, inventoryAPI } from '@/api/client'
import Modal from '@/components/ui/Modal'
import {
    ArrowLeft, Sun, Package, Link as LinkIcon, Trash2,
    Copy, Check, ExternalLink, Power, AlertCircle, Warehouse,
    Activity, Settings, User, Users, Zap, Scale, Calculator
} from 'lucide-react'
import { formatDateShort, getStatusClasses, translateStatus } from '@/utils/helpers'
import { confirmDialog } from '@/utils/confirmDialog'


interface DryingProcess {
    id: string
    name?: string
    drying_type?: string
    vendor_name?: string
    status: 'PENDING' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED' | 'IN_WAREHOUSE'
    is_active: boolean
    is_titipan?: boolean
    titipan_data?: any
    notes?: string
    batch_count: number
    total_tonnage: number
    created_at: string
    waste_kg?: number
    waste_reason?: string
    batches?: DryingBatch[]
    sessions?: DryingSession[]
    costs?: any[]
}

const DRYING_TYPE_LABELS: Record<string, string> = {
    'oven_mandiri': 'Oven Mandiri',
    'oven_vendor': 'Oven Vendor',
    'jemur_mandiri': 'Jemur Mandiri',
    'jemur_vendor': 'Jemur Vendor',
}

interface DryingBatch {
    id: string
    batch_id: string
    tonnage_kg: number
    batch_date: string
    batch_status: string
}

interface DryingSession {
    id: string
    session_type: 'START' | 'END'
    pic: string
    people_involved: string
    session_date: string
    session_time: string
    moisture_content?: number
    tonnage_kg?: number
    waste_kg?: number
    waste_reason?: string
    photo_count: number
    photos?: string[]
}

interface DryingLink {
    id: string
    link_code: string
    employee_name: string
    is_active: boolean
    expires_at?: string
    created_at: string
}


export default function DryingDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()
    const isAdmin = user?.role === 'admin' || user?.role === 'owner'

    const [drying, setDrying] = useState<DryingProcess | null>(null)
    const [links, setLinks] = useState<DryingLink[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Modals
    const [showInventoryModal, setShowInventoryModal] = useState(false)
    const [copiedLink, setCopiedLink] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [inventoryData, setInventoryData] = useState({ area: '', tanda: '', notes: '' })

    // Cost Management
    const [showCostModal, setShowCostModal] = useState(false)
    const [addingCost, setAddingCost] = useState(false)
    const [newCost, setNewCost] = useState({ costType: 'LABOR', description: '', amount: '' })

    useEffect(() => {
        if (id && id !== 'new') {
            loadData()
        } else if (id === 'new') {
            setLoading(false)
        }
    }, [id])

    const loadData = async () => {
        try {
            setLoading(true)
            const [dryingRes, linksRes, costsRes] = await Promise.all([
                dryingAPI.getById(id!),
                dryingAPI.getLinks(id!).catch(() => ({ data: [] })),
                dryingAPI.getCosts(id!).catch(() => ({ data: [] }))
            ])

            const dryingData = dryingRes.data as DryingProcess
            dryingData.costs = costsRes.data || []
            setDrying(dryingData)
            setLinks((linksRes.data || []) as DryingLink[])
        } catch (err) {
            console.error('Failed to load drying data:', err)
            setError('Gagal memuat data pengeringan')
        } finally {
            setLoading(false)
        }
    }

    const handleToggleActive = async () => {
        if (!drying) return
        try {
            await dryingAPI.toggleActive(id!, !drying.is_active)
            await loadData()
        } catch (err) {
            console.error('Failed to toggle active:', err)
            toast.error('Gagal mengubah status')
        }
    }

    const handleApprove = async () => {
        if (!await confirmDialog('Yakin approve pengeringan ini? Berat batch akan dikurangi.')) return
        try {
            setSaving(true)
            await dryingAPI.approve(id!)
            await loadData()
            toast.success('Pengeringan berhasil diapprove')
        } catch (err) {
            console.error('Failed to approve:', err)
            toast.error(err instanceof Error ? err.message : 'Gagal approve')
        } finally {
            setSaving(false)
        }
    }

    const handleReject = async () => {
        if (!await confirmDialog('Yakin reject pengeringan ini? Data sesi pengeringan akan dihapus dan form operator direset ke langkah awal.')) return
        try {
            setSaving(true)
            await dryingAPI.reject(id!)
            await loadData()
            toast.success('Pengeringan berhasil direject dan form operator direset ke langkah awal')
        } catch (err) {
            console.error('Failed to reject:', err)
            toast.error(err instanceof Error ? err.message : 'Gagal reject')
        } finally {
            setSaving(false)
        }
    }



    const handleAddCost = async () => {
        if (!drying || !id) return
        const amount = parseFloat(newCost.amount)
        if (!amount || amount <= 0) {
            toast.error('Nominal harus diisi dengan benar')
            return
        }

        try {
            setAddingCost(true)
            await dryingAPI.addCost(id, {
                costType: newCost.costType,
                description: newCost.description || undefined,
                amount
            })
            setShowCostModal(false)
            setNewCost({ costType: 'LABOR', description: '', amount: '' })
            toast.success('Biaya berhasil ditambahkan')
            loadData()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal menambah biaya')
        } finally {
            setAddingCost(false)
        }
    }

    const handleDeleteCost = async (costId: string) => {
        if (!id || !await confirmDialog('Hapus biaya ini? Transaksi kas terkait juga akan dihapus.')) return
        try {
            await dryingAPI.deleteCost(id, costId)
            toast.success('Biaya berhasil dihapus')
            loadData()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal menghapus biaya')
        }
    }

    const handleCopyToInventory = async () => {
        if (!inventoryData.tanda?.trim()) {
            await confirmDialog('Tanda Identifikasi wajib diisi sebelum memindahkan gabah kering ke gudang.', {
                title: 'Tanda Identifikasi Diperlukan',
                variant: 'warning',
                confirmText: 'Mengerti',
                hideCancel: true
            })
            return
        }

        try {
            setSaving(true)
            const payload = {
                ...inventoryData,
                area: inventoryData.area?.trim() || 'Gudang',
                tanda: inventoryData.tanda.trim(),
            }
            await inventoryAPI.createFromDrying(id!, payload)
            toast.success('Berhasil dipindahkan ke Inventory. Status diubah ke Masuk Gudang.')
            setShowInventoryModal(false)
            await loadData() // Reload to reflect IN_WAREHOUSE status and lock UI
        } catch (err) {
            console.error('Failed to copy to inventory:', err)
            toast.error(err instanceof Error ? err.message : 'Gagal menyalin ke inventory')
        } finally {
            setSaving(false)
        }
    }

    const handleCreateLink = async () => {
        try {
            setSaving(true)
            await dryingAPI.createLink(id!)
            await loadData()
        } catch (err) {
            console.error('Failed to create link:', err)
            toast.error('Gagal membuat link')
        } finally {
            setSaving(false)
        }
    }

    // Input Admin: open the same form in admin mode (reuses an active link, or creates one).
    // Submitting from here skips the approval step; shareable links still need approval.
    const handleAdminInput = async () => {
        try {
            setSaving(true)
            const now = Date.now()
            let link = links.find(l => l.is_active && (!l.expires_at || new Date(l.expires_at).getTime() > now))
            if (!link) {
                const created = await dryingAPI.createLink(id!)
                link = created.data as DryingLink
            }
            if (!link?.link_code) throw new Error('Link form tidak tersedia')
            navigate(`/drying-form/${link.link_code}?mode=admin`)
        } catch (err) {
            console.error('Failed to open admin input:', err)
            toast.error('Gagal membuka form Input Admin')
        } finally {
            setSaving(false)
        }
    }

    const handleToggleLink = async (linkId: string, isActive: boolean) => {
        try {
            await dryingAPI.toggleLink(id!, linkId, isActive)
            await loadData()
        } catch (err) {
            console.error('Failed to toggle link:', err)
        }
    }

    const handleDeleteLink = async (linkId: string) => {
        if (!await confirmDialog('Yakin ingin menghapus link ini?')) return
        try {
            await dryingAPI.deleteLink(id!, linkId)
            await loadData()
        } catch (err) {
            console.error('Failed to delete link:', err)
        }
    }

    const copyLinkToClipboard = async (linkCode: string) => {
        const url = `${window.location.origin}/drying-form/${linkCode}`
        await navigator.clipboard.writeText(url)
        setCopiedLink(linkCode)
        setTimeout(() => setCopiedLink(null), 2000)
    }



    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="spinner"></div>
            </div>
        )
    }

    if (error || !drying) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <p className="text-red-400 mb-4">{error || 'Data tidak ditemukan'}</p>
                <button onClick={() => navigate('/drying')} className="text-brand-light-green hover:underline">
                    Kembali ke daftar
                </button>
            </div>
        )
    }

    const startSession = drying.sessions?.find(s => s.session_type === 'START')
    const endSession = drying.sessions?.find(s => s.session_type === 'END')

    // Calculate shrinkage (penyusutan) using W2 formula if both sessions exist
    const tonnageBefore = startSession?.tonnage_kg ? Number(startSession.tonnage_kg) : null
    let estimatedW2: number | null = null
    let tonnageDiff: number | null = null

    let percentShrink: number | null = null

    if (startSession && endSession) {
        // Base end weight on reported data or fallback to start weight
        estimatedW2 = endSession.tonnage_kg ? Number(endSession.tonnage_kg) : (tonnageBefore || 0)

        if (tonnageBefore !== null) {
            const w1 = tonnageBefore
            const x1 = (Number(startSession.moisture_content) || 0) / 100
            const x2 = (Number(endSession.moisture_content) || 0) / 100

            // Only apply formula if both Moiss exist and x2 < 1 (100%)
            if (x1 > 0 && x2 > 0 && x2 < 1) {
                estimatedW2 = w1 * (1 - x1) / (1 - x2)
            }
            // Fallback estimatedW2 to w1 if it somehow evaluates to 0 or falsy when it shouldn't
            tonnageDiff = Math.round(w1 - (estimatedW2 || w1))
            percentShrink = w1 > 0 ? (tonnageDiff / w1) * 100 : 0
        }
    }

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/drying')}
                    className="p-2 hover:bg-stone-300 rounded-lg transition-colors w-fit"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl md:text-2xl font-bold flex items-center gap-3">
                        <Sun className="text-amber-500" size={24} />
                        {drying.name || 'Pengeringan'}
                    </h1>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-stone-600 text-sm">
                            Dibuat {formatDateShort(drying.created_at)}
                        </span>
                        <span className="text-stone-400">•</span>
                        <span className="text-sm px-2 py-0.5 bg-stone-300 rounded">
                            {DRYING_TYPE_LABELS[drying.drying_type || 'oven_mandiri']}
                        </span>
                        {drying.vendor_name && (
                            <span className="text-sm text-amber-400">{drying.vendor_name}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${getStatusClasses(drying.status)}`}>
                        {translateStatus(drying.status)}
                    </span>
                    {isAdmin && (
                        <button
                            onClick={handleToggleActive}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${drying.is_active
                                ? 'bg-brand-light-green/20 text-brand-light-green hover:bg-brand-light-green/30'
                                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                }`}
                        >
                            <Power size={14} />
                            {drying.is_active ? 'Aktif' : 'Nonaktif'}
                        </button>
                    )}
                </div>
            </div>

            {/* Inactive Warning */}
            {!drying.is_active && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <AlertCircle className="text-red-400 shrink-0" size={20} />
                    <p className="text-red-300 text-sm">
                        Pengeringan ini nonaktif. Employee tidak dapat mengisi form.
                    </p>
                </div>
            )}

            {/* Notes */}
            {drying.notes && (
                <div className="bg-stone-200 border border-stone-300 rounded-xl p-4 mb-6">
                    <p className="text-sm text-stone-700">{drying.notes}</p>
                </div>
            )}

            {/* Gabah Titipan Info */}
            {drying.is_titipan && drying.titipan_data && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 mb-6 shadow-lg shadow-amber-500/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
                            <User size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-amber-400">Gabah Titipan</h2>
                            <p className="text-xs text-amber-500/70">Milik: {drying.titipan_data.pemilikNama || '-'}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-stone-200/50 p-3 rounded-lg border border-stone-300/50">
                            <p className="text-[10px] text-stone-500 uppercase font-bold tracking-wider mb-1">Jenis Gabah</p>
                            <p className="text-sm font-semibold text-stone-800">{drying.titipan_data.jenisGabah || '-'}</p>
                        </div>
                        <div className="bg-stone-200/50 p-3 rounded-lg border border-stone-300/50">
                            <p className="text-[10px] text-stone-500 uppercase font-bold tracking-wider mb-1">Berat Masuk</p>
                            <p className="text-sm font-bold text-amber-500">{Number(drying.titipan_data.beratKg || 0).toLocaleString()} KG</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats */}
            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
                <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-5 shadow-lg group hover:border-blue-500/30 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-5 h-5 md:w-10 md:h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform md:bg-[#3b82f633] md:text-[#1d4ed8]">
                            <Package size={20} />
                        </div>
                        <span className="text-[10px] ml-4 md:ml-0 font-bold text-stone-500 uppercase tracking-widest">Total Batch</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <p className="text-2xl md:text-3xl font-black text-stone-900">{drying.batch_count}</p>
                        <span className="text-xs text-stone-500 font-medium">Barang</span>
                    </div>
                </div>

                <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-5 shadow-lg group hover:border-brand-light-green/30 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-5 h-5 md:w-10 md:h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform md:bg-brand-light-green/20 md:text-brand-light-green">
                            <Scale size={20} />
                        </div>
                        <span className="text-[10px] ml-4 md:ml-0 font-bold text-stone-500 uppercase tracking-widest">Berat Awal</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <p className="text-2xl md:text-3xl font-black text-stone-900">{Number(drying.total_tonnage || 0).toLocaleString()}</p>
                        <span className="text-xs text-stone-500 font-medium">KG</span>
                    </div>
                </div>

                <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-5 shadow-lg group hover:border-amber-500/30 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-5 h-5 md:w-10 md:h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform md:bg-[#f59e0b33] md:text-[#b45309]">
                            <Zap size={20} />
                        </div>
                        <span className="text-[10px] ml-4 md:ml-0 font-bold text-stone-500 uppercase tracking-widest text-right leading-tight">Penurunan<br />Kadar Air</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-1.5">
                        <p className="text-3xl font-black text-stone-900">
                            {startSession?.moisture_content && endSession?.moisture_content
                                ? Math.max(0, Number(startSession.moisture_content) - Number(endSession.moisture_content)).toFixed(2)
                                : '--'}
                        </p>
                        <span className="text-xs text-stone-500 font-medium">%</span>
                    </div>
                    <div className="flex items-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            {startSession?.moisture_content || '--'}% ➔ {endSession?.moisture_content || '--'}%
                        </span>
                    </div>
                </div>

                <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-5 shadow-lg group hover:border-indigo-500/30 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-5 h-5 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 md:bg-[#6366f133] md:text-[#4338ca]">
                            <Scale size={20} />
                        </div>
                        <span className="text-[10px] ml-4 md:ml-0 font-bold text-stone-500 uppercase tracking-widest text-right leading-tight">Penyusutan<br />(Shrinkage)</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-1.5">
                        <p className="text-3xl font-black text-stone-900">
                            {percentShrink !== null ? percentShrink.toFixed(1) : '--'}
                        </p>
                        <span className="text-xs text-stone-500 font-medium">%</span>
                    </div>
                    <div className="flex items-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${tonnageDiff && tonnageDiff > 0 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-brand-light-green/10 text-brand-light-green border border-brand-light-green/20'}`}>
                            {tonnageDiff !== null ? (tonnageDiff > 0 ? '-' : '+') + Math.abs(tonnageDiff).toLocaleString() + ' KG' : '--'}
                        </span>
                    </div>
                </div>

                <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-5 shadow-lg group hover:border-rose-500/30 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-5 h-5 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 md:bg-[#f43f5e33] md:text-[#be123c]">
                            <Trash2 size={20} />
                        </div>
                        <span className="text-[10px] ml-4 md:ml-0 font-bold text-stone-500 uppercase tracking-widest">Limbah (Waste)</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-1.5">
                        <p className="text-3xl font-black text-rose-400">
                            {endSession ? Number(endSession.waste_kg || 0).toLocaleString() : '--'}
                        </p>
                        <span className="text-xs text-stone-500 font-medium">KG</span>
                    </div>
                    <div className="flex items-center">
                        <span className="text-[10px] text-stone-500 font-medium truncate max-w-full">
                            {endSession?.waste_reason || 'Tidak ada limbah tercatat'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Dashboard Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Column: Flow & Details (8 cols) */}
                <div className="lg:col-span-8 space-y-6">

                    {/* Visual Workflow */}
                    <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-xs font-bold text-stone-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Activity size={14} className="text-blue-400" />
                            Alur Pengeringan
                        </h3>

                        <div className="relative grid grid-cols-2 gap-y-8 gap-x-2 md:flex md:flex-row md:justify-between md:items-center md:gap-4 px-2 md:px-4">
                            {/* Connector Line (Desktop) */}
                            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-stone-300 -translate-y-1/2 z-0"></div>

                            {/* Step 1: Batches */}
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-12 h-12 bg-brand-light-green rounded-2xl flex items-center justify-center shadow-lg shadow-brand-light-green/20 mb-3 border-[3px] border-brand-dark-green">
                                    <Package size={20} className="text-brand-dark-green" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-bold text-stone-900">Batch Terpilih</p>
                                    <p className="text-[10px] text-stone-500">{drying.batch_count} Items</p>
                                </div>
                            </div>

                            {/* Step 2: Mulai */}
                            <div className="relative z-10 flex flex-col items-center">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg mb-3 transition-all ${startSession ? 'bg-[#fcd34d] shadow-[#f59e0b]/20 border-[3px] border-[#f59e0b]' : 'bg-stone-300 text-stone-500 border-[3px] border-stone-400'}`}>
                                    <Zap size={20} className={startSession ? 'text-[#f59e0b]' : 'text-stone-500'} />
                                </div>
                                <div className="text-center">
                                    <p className={`text-xs font-bold ${startSession ? 'text-stone-900' : 'text-stone-500'}`}>Mulai</p>
                                    <p className="text-[10px] text-stone-500">{startSession ? formatDateShort(startSession.session_date) : 'Belum Selesai'}</p>
                                </div>
                            </div>

                            {/* Step 3: Selesai */}
                            <div className="relative z-10 flex flex-col items-center">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg mb-3 transition-all ${endSession ? 'bg-brand-light-green shadow-brand-light-green/20 border-[3px] border-brand-dark-green' : 'bg-stone-300 text-stone-500 border-[3px] border-stone-400'}`}>
                                    <Check size={20} className={endSession ? 'text-brand-dark-green' : 'text-stone-500'} />
                                </div>
                                <div className="text-center">
                                    <p className={`text-xs font-bold ${endSession ? 'text-stone-900' : 'text-stone-500'}`}>Selesai</p>
                                    <p className="text-[10px] text-stone-500">{endSession ? formatDateShort(endSession.session_date) : 'Menunggu'}</p>
                                </div>
                            </div>

                            {/* Step 4: Status Akhir */}
                            <div className="relative z-10 flex flex-col items-center">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg mb-3 border-[3px] transition-all ${
                                    drying.status === 'IN_WAREHOUSE' 
                                        ? 'bg-indigo-500 shadow-indigo-500/20 border-[#4338ca]' 
                                        : drying.status === 'COMPLETED' 
                                        ? 'bg-brand-light-green shadow-brand-light-green/20 border-brand-dark-green' 
                                        : 'bg-stone-300 text-stone-500 border-stone-100'
                                }`}>
                                    <Warehouse 
                                        size={20} 
                                        className={
                                            drying.status === 'IN_WAREHOUSE' 
                                                ? 'text-[#4338ca]' 
                                                : drying.status === 'COMPLETED' 
                                                ? 'text-brand-dark-green' 
                                                : 'text-stone-500'
                                        } 
                                    />
                                </div>
                                <div className="text-center">
                                    <p className={`text-xs font-bold ${drying.status === 'IN_WAREHOUSE' || drying.status === 'COMPLETED' ? 'text-stone-900' : 'text-stone-500'}`}>{drying.status === 'IN_WAREHOUSE' ? 'Masuk Gudang' : drying.status === 'COMPLETED' ? 'Disetujui' : 'Giling / Simpan'}</p>
                                    <p className="text-[10px] text-stone-500">{drying.status === 'IN_WAREHOUSE' ? 'Stored' : drying.status === 'COMPLETED' ? 'Approved' : 'Pending'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Biaya Produksi */}
                    <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-6 border-b border-stone-300/50 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-stone-600 uppercase tracking-widest flex items-center gap-2">
                                <Calculator size={14} className="text-brand-light-green" />
                                Biaya Operasional Penjemuran
                            </h3>
                            {isAdmin && (
                                <button
                                    onClick={() => setShowCostModal(true)}
                                    disabled={drying.status === 'IN_WAREHOUSE'}
                                    className="px-3 py-1 bg-brand-light-green/10 text-brand-light-green hover:bg-brand-light-green/20 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    + Tambah Biaya
                                </button>
                            )}
                        </div>
                        <div className="p-0">
                            {drying.costs && drying.costs.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-[10px] text-stone-500 uppercase tracking-widest bg-stone-100/50">
                                            <th className="px-6 py-3 text-left font-bold">Tipe</th>
                                            <th className="px-6 py-3 text-left font-bold">Keterangan</th>
                                            <th className="px-6 py-3 text-right font-bold">Nominal</th>
                                            <th className="px-6 py-3 text-center font-bold">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-300/50">
                                        {drying.costs.map((cost: any) => (
                                            <tr key={cost.id} className="hover:bg-stone-300/30 transition-colors group">
                                                <td className="px-6 py-4 font-medium text-stone-800">
                                                    {cost.cost_type === 'LABOR' ? 'Buruh' :
                                                        cost.cost_type === 'FUEL' ? 'Solar/BBM' :
                                                            cost.cost_type === 'TRANSPORT' ? 'Transport' :
                                                                cost.cost_type === 'OVEN_FUEL' ? 'Bahan Bakar Pengeringan' :
                                                                    cost.cost_type === 'OVEN_OPERATOR' ? 'Biaya Operator Oven' :
                                                                        'Lainnya'}
                                                </td>
                                                <td className="px-6 py-4 text-stone-600">{cost.description || '-'}</td>
                                                <td className="px-6 py-4 text-right font-bold text-black">
                                                    Rp {Number(cost.amount).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleDeleteCost(cost.id)}
                                                            disabled={drying.status === 'IN_WAREHOUSE'}
                                                            className="p-1.5 text-stone-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all disabled:opacity-50"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-brand-light-green/5">
                                            <td colSpan={2} className="px-6 py-4 text-[10px] font-black text-brand-light-green uppercase tracking-[0.2em]">Total Biaya Overhead</td>
                                            <td className="px-6 py-4 text-right font-black text-brand-light-green text-lg">
                                                Rp {drying.costs.reduce((sum: number, c: any) => sum + Number(c.amount), 0).toLocaleString()}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-8 text-center">
                                    <div className="w-12 h-12 bg-stone-300/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                        <Calculator size={20} className="text-stone-500" />
                                    </div>
                                    <p className="text-stone-500 text-sm">Belum ada biaya operasional tercatat.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sessions History */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Start Session Card */}
                        <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl overflow-hidden shadow-xl">
                            <div className="px-5 py-4 border-b border-stone-300/50 flex justify-between items-center bg-amber-500/5">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                        <Zap size={16} />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-widest text-[#d97706]">Data Mulai</span>
                                </div>
                                {startSession && <span className="text-[10px] bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>}
                            </div>
                            <div className="p-5">
                                {startSession ? (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-stone-300/50 rounded-lg text-stone-600">
                                                <User size={14} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-stone-500 uppercase font-bold tracking-tighter">PIC Utama</p>
                                                <p className="text-sm font-semibold text-stone-800">{startSession.pic}</p>
                                            </div>
                                        </div>

                                        {startSession.people_involved && (
                                            <div className="bg-stone-100/50 rounded-xl p-3 border border-stone-300/30">
                                                <p className="text-[10px] text-stone-500 uppercase font-bold mb-1">Tim Terlibat</p>
                                                <p className="text-xs text-stone-600 italic whitespace-pre-line leading-relaxed">{startSession.people_involved}</p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-stone-300/30 p-2.5 rounded-xl">
                                                <p className="text-[10px] text-stone-500 uppercase font-bold mb-0.5">Waktu</p>
                                                <p className="text-xs text-stone-700">{formatDateShort(startSession.session_date)} {startSession.session_time}</p>
                                            </div>
                                            <div className="bg-stone-300/30 p-2.5 rounded-xl">
                                                <p className="text-[10px] text-stone-500 uppercase font-bold mb-0.5">Kadar Air</p>
                                                <p className="text-xs font-bold text-amber-500">{startSession.moisture_content}%</p>
                                            </div>
                                        </div>
                                        <PhotoStrip paths={startSession.photos} label="Foto Bukti" size="w-16 h-16" />
                                    </div>
                                ) : (
                                    <div className="py-8 text-center">
                                        <p className="text-xs text-stone-500 italic">Data belum tersedia</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* End Session Card */}
                        <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl overflow-hidden shadow-xl">
                            <div className="px-5 py-4 border-b border-stone-300/50 flex justify-between items-center bg-brand-light-green/5">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-brand-light-green/10 flex items-center justify-center text-brand-light-green">
                                        <Check size={16} />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-widest text-stone-800">Data Selesai</span>
                                </div>
                                {endSession && <span className="text-[10px] bg-brand-light-green/20 text-brand-light-green px-2 py-0.5 rounded-full font-bold">COMPLETED</span>}
                            </div>
                            <div className="p-5">
                                {endSession ? (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-stone-300/50 rounded-lg text-stone-600">
                                                <User size={14} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-stone-500 uppercase font-bold tracking-tighter">PIC Utama</p>
                                                <p className="text-sm font-semibold text-stone-800">{endSession.pic}</p>
                                            </div>
                                        </div>

                                        {endSession.people_involved && (
                                            <div className="bg-stone-100/50 rounded-xl p-3 border border-stone-300/30">
                                                <p className="text-[10px] text-stone-500 uppercase font-bold mb-1">Tim Terlibat</p>
                                                <p className="text-xs text-stone-600 italic whitespace-pre-line leading-relaxed">{endSession.people_involved}</p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-stone-300/30 p-2.5 rounded-xl">
                                                <p className="text-[10px] text-stone-500 uppercase font-bold mb-0.5">Waktu</p>
                                                <p className="text-xs text-stone-700">{formatDateShort(endSession.session_date)} {endSession.session_time}</p>
                                            </div>
                                            <div className="bg-stone-300/30 p-2.5 rounded-xl">
                                                <p className="text-[10px] text-stone-500 uppercase font-bold mb-0.5">Kadar Air</p>
                                                <p className="text-xs font-bold text-brand-light-green">{endSession.moisture_content}%</p>
                                            </div>
                                        </div>
                                        <PhotoStrip paths={endSession.photos} label="Foto Bukti" size="w-16 h-16" />
                                    </div>
                                ) : (
                                    <div className="py-8 text-center">
                                        <p className="text-xs text-stone-500 italic">Menunggu sesi mulai selesai...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Actions & Links (4 cols) */}
                <div className="lg:col-span-4 space-y-6">

                    {/* Action Center */}
                    {isAdmin && (
                        <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl shadow-xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-stone-300/50 bg-stone-300/20">
                                <h3 className="text-xs font-bold text-stone-600 uppercase tracking-widest flex items-center gap-2">
                                    <Settings size={14} className="text-stone-500" />
                                    Action Center
                                </h3>
                            </div>
                            <div className="p-5 space-y-3">


                                {['PENDING', 'IN_PROGRESS'].includes(drying.status) && (
                                    <button
                                        onClick={handleAdminInput}
                                        disabled={saving}
                                        className="w-full h-11 bg-brand-light-green hover:bg-brand-light-green/80 text-white rounded-xl text-xs font-black flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-brand-light-green/20 disabled:opacity-50"
                                        title="Isi data pengeringan sendiri. Setelah Selesai langsung disetujui tanpa approval."
                                    >
                                        <Check size={16} /> Input Admin (tanpa approval)
                                    </button>
                                )}

                                <button
                                    onClick={handleCreateLink}
                                    disabled={drying.status === 'IN_WAREHOUSE'}
                                    className="w-full h-11 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <LinkIcon size={16} /> Generate Share Link
                                </button>

                                {(drying.status === 'PENDING_APPROVAL' || (drying.status === 'IN_PROGRESS' && drying.sessions && drying.sessions.length > 0)) && (
                                    <div className={`grid ${drying.status === 'PENDING_APPROVAL' ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mt-4 pt-4 border-t border-stone-300/50`}>
                                        <button
                                            onClick={handleReject}
                                            className="h-11 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-bold transition-all"
                                        >
                                            {drying.status === 'IN_PROGRESS' ? 'Reset Sesi ke Langkah 1' : 'Reject & Reset'}
                                        </button>
                                        {drying.status === 'PENDING_APPROVAL' && (
                                            <button
                                                onClick={handleApprove}
                                                className="h-11 bg-brand-light-green hover:bg-brand-light-green/80 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-brand-light-green/20 transition-all"
                                            >
                                                Approve
                                            </button>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={handleToggleActive}
                                    disabled={drying.status === 'IN_WAREHOUSE'}
                                    className={`w-full h-11 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold flex items-center justify-center gap-3 mt-2 transition-all ${drying.is_active ? 'border border-red-500/30 text-red-500 hover:bg-red-500/5' : 'bg-brand-light-green/10 text-brand-light-green border border-brand-light-green/30 hover:bg-brand-light-green/20'}`}
                                >
                                    <Power size={16} /> {drying.is_active ? 'Deactivate Process' : 'Activate Process'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Links Card */}
                    {isAdmin && (
                        <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl shadow-xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-stone-300/50 flex justify-between items-center bg-stone-300/20">
                                <h3 className="text-xs font-bold text-stone-600 uppercase tracking-widest flex items-center gap-2">
                                    <LinkIcon size={14} className="text-stone-500" />
                                    Shareable Links
                                </h3>
                                <span className="text-[10px] font-bold text-stone-500 bg-stone-100/50 px-2 py-0.5 rounded-full">{links.length}</span>
                            </div>
                            <div className="p-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {links.length > 0 ? (
                                    <div className="space-y-3">
                                        {links.map((link) => (
                                            <div key={link.id} className="bg-stone-100/40 border border-stone-300/50 rounded-xl p-3 group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-[10px] font-black text-amber-500 tracking-wider font-mono">{link.link_code}</p>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleToggleLink(link.id, !link.is_active)}
                                                            disabled={drying.status === 'IN_WAREHOUSE'}
                                                            className={`p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed ${link.is_active ? 'text-brand-light-green hover:bg-brand-light-green/10' : 'text-stone-500 hover:bg-stone-400'}`}
                                                            title={link.is_active ? 'Deactivate' : 'Activate'}
                                                        >
                                                            <Power size={12} />
                                                        </button>
                                                        <button onClick={() => handleDeleteLink(link.id)} disabled={drying.status === 'IN_WAREHOUSE'} className="p-1 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed" title="Hapus"><Trash2 size={12} /></button>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => copyLinkToClipboard(link.link_code)}
                                                        className="flex-1 h-8 bg-stone-300 hover:bg-stone-400 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2"
                                                    >
                                                        {copiedLink === link.link_code ? <Check size={12} className="text-brand-light-green" /> : <Copy size={12} />}
                                                        {copiedLink === link.link_code ? 'Copied' : 'Copy'}
                                                    </button>
                                                    <a
                                                        href={`/drying-form/${link.link_code}`}
                                                        target="_blank"
                                                        className="w-10 h-8 bg-stone-300 hover:bg-indigo-500/20 hover:text-indigo-400 rounded-lg flex items-center justify-center"
                                                    >
                                                        <ExternalLink size={12} />
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-[11px] text-stone-500 italic">Belum ada link yang dibuat</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Admin Approval Section - Below Link Form */}
            {isAdmin && drying.status === 'PENDING_APPROVAL' && (
                <div className="mt-6 bg-purple-500/10 border border-purple-500/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="text-purple-400" size={20} />
                        <h2 className="font-semibold text-purple-300">Menunggu Persetujuan Admin</h2>
                    </div>
                    <p className="text-purple-400/70 text-sm mb-4">
                        Employee sudah menyelesaikan pengeringan di lapangan. Approve untuk mengurangi berat batch sebesar berat awal pengeringan.
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleReject}
                            disabled={saving}
                            className="px-5 py-2.5 bg-stone-300 hover:bg-stone-400 text-stone-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            Reject
                        </button>
                        <button
                            onClick={handleApprove}
                            disabled={saving}
                            className="px-5 py-2.5 bg-brand-light-green hover:bg-brand-light-green/80 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            <Check size={16} />
                            {saving ? 'Memproses...' : 'Approve & Kurangi Berat'}
                        </button>
                    </div>
                </div>
            )}

            {/* Completed -> Move to Inventory Action */}
            {isAdmin && (drying.status === 'COMPLETED' || drying.status === 'IN_WAREHOUSE') && (
                <div className="mt-6 bg-brand-light-green/10 border border-brand-light-green/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <Warehouse className="text-brand-light-green" size={24} />
                        <h2 className="font-semibold text-brand-light-green">{drying.status === 'IN_WAREHOUSE' ? 'Telah Masuk Gudang' : 'Pengeringan Selesai'}</h2>
                    </div>
                    <p className="text-brand-light-green/70 text-sm mb-4">
                        {drying.status === 'IN_WAREHOUSE' ? 'Item ini sudah berhasil dipindahkan ke inventory.' : 'Pengeringan sudah selesai dan disetujui. Pindahkan batch ke inventory untuk diproses giling atau dijual.'}
                    </p>
                    <button
                        onClick={() => {
                            const hasBatches = drying.is_titipan || (drying.batches?.length ?? 0) > 0
                            if (!hasBatches) {
                                toast.error('Pengeringan ini tidak memiliki batch gabah. Batch gabah dipilih saat membuat proses pengeringan baru.');
                                return;
                            }
                            setShowInventoryModal(true);
                        }}
                        disabled={drying.status === 'IN_WAREHOUSE'}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${drying.status === 'IN_WAREHOUSE' ? 'bg-indigo-500/50 text-white cursor-not-allowed border border-indigo-500/30' : (!drying.is_titipan && (drying.batches?.length ?? 0) === 0)
                            ? 'bg-stone-300 text-stone-500 cursor-not-allowed border border-stone-400'
                            : 'bg-brand-light-green hover:bg-brand-light-green/80 text-white shadow-lg shadow-brand-light-green/20'
                            }`}
                    >
                        <Warehouse size={16} />
                        {drying.status === 'IN_WAREHOUSE' ? 'Sudah Masuk Inventory' : 'Pindahkan ke Inventory'}
                        {(!drying.is_titipan && (drying.batches?.length ?? 0) === 0) && drying.status !== 'IN_WAREHOUSE' && (
                            <span className="ml-2 bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded border border-red-500/30">
                                Batch Kosong
                            </span>
                        )}
                    </button>
                    {(!drying.is_titipan && (drying.batches?.length ?? 0) === 0) && drying.status !== 'IN_WAREHOUSE' && (
                        <p className="mt-3 text-xs text-amber-400 flex items-center gap-2 italic">
                            <AlertCircle size={12} />
                            Tidak ada batch gabah yang terhubung ke proses pengeringan ini.
                        </p>
                    )}
                </div>
            )}

            {/* Inventory Modal */}
            <Modal
                isOpen={showInventoryModal}
                onClose={() => setShowInventoryModal(false)}
                title="Pindahkan ke Inventory"
                footer={
                    <>
                        <button
                            onClick={() => setShowInventoryModal(false)}
                            className="px-4 py-2 bg-stone-300 hover:bg-stone-400 rounded-lg text-sm font-medium"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleCopyToInventory}
                            disabled={saving}
                            className="px-4 py-2 text-white bg-brand-light-green hover:bg-brand-light-green/80 rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                            {saving ? 'Memproses...' : 'Proses'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Lokasi/Area <span className="text-stone-500 font-normal">(opsional)</span></label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                            placeholder="Default: Gudang"
                            value={inventoryData.area}
                            onChange={e => setInventoryData(p => ({ ...p, area: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Tanda Identifikasi <span className="text-red-400">*</span></label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                            placeholder="Contoh: Karung Merah"
                            value={inventoryData.tanda}
                            onChange={e => setInventoryData(p => ({ ...p, tanda: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Catatan <span className="text-stone-500 font-normal">(opsional)</span></label>
                        <textarea
                            className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green"
                            placeholder="Catatan tambahan..."
                            rows={3}
                            value={inventoryData.notes}
                            onChange={e => setInventoryData(p => ({ ...p, notes: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>



            {/* Modal: Tambah Biaya */}
            <Modal
                isOpen={showCostModal}
                onClose={() => setShowCostModal(false)}
                title="Tambah Biaya Operasional"
                size="default"
                footer={
                    <div className='mb-4 flex justify-end gap-4'>
                        <button onClick={() => setShowCostModal(false)} className="px-6 py-2.5 rounded-xl text-stone-600 font-bold hover:bg-stone-300 transition-all">Batal</button>
                        <button
                            onClick={handleAddCost}
                            disabled={addingCost}
                            className="px-8 py-2.5 bg-brand-light-green hover:bg-brand-light-green/80 text-white rounded-xl font-bold shadow-lg shadow-brand-light-green/20 transition-all disabled:opacity-50"
                        >
                            {addingCost ? 'Menyimpan...' : 'Simpan Biaya'}
                        </button>
                    </div>
                }
            >
                <div className="space-y-6 py-2">
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 block">Tipe Biaya</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'LABOR', label: 'Buruh', icon: <Users size={16} /> },
                                { id: 'FUEL', label: 'BBM/Solar', icon: <Zap size={16} /> },
                                ...(drying?.drying_type === 'oven_mandiri' || drying?.drying_type === 'oven_vendor' ? [
                                    { id: 'OVEN_FUEL', label: 'Bahan Bakar Pengeringan', icon: <Zap size={16} /> },
                                    { id: 'OVEN_OPERATOR', label: 'Biaya Operator Oven', icon: <Users size={16} /> }
                                ] : []),
                                { id: 'OTHER', label: 'Lainnya', icon: <Calculator size={16} /> }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setNewCost(prev => ({ ...prev, costType: t.id }))}
                                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${newCost.costType === t.id ? 'border-brand-light-green bg-brand-light-green/10 text-brand-light-green' : 'border-stone-300 bg-stone-200/50 text-stone-600 hover:border-stone-400'}`}
                                >
                                    {t.icon}
                                    <span className="text-sm font-bold text-left">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 block">Nominal (IDR)</label>
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-brand-light-green group-focus-within:scale-110 transition-transform">Rp</span>
                            <NumberInput

                                placeholder="0"
                                className="w-full bg-stone-100 border-2 border-stone-300 rounded-2xl pl-12 pr-4 py-4 text-2xl font-black text-stone-900 focus:border-brand-light-green transition-all outline-none"
                                value={newCost.amount}
                                onChange={e => setNewCost(prev => ({ ...prev, amount: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 block">Keterangan (Opsional)</label>
                        <textarea
                            rows={3}
                            placeholder="Contoh: Upah jemur 2 hari atau Beli solar 10 liter..."
                            className="w-full bg-stone-100 border-2 border-stone-300 rounded-2xl px-4 py-3 text-sm text-stone-900 focus:border-brand-light-green transition-all outline-none resize-none"
                            value={newCost.description}
                            onChange={e => setNewCost(prev => ({ ...prev, description: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    )
}
