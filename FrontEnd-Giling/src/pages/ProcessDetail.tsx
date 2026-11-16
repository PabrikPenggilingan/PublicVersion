import toast from 'react-hot-toast'
import PhotoStrip from '@/components/PhotoStrip'
import { NumberInput } from '@/components/ui/NumberInput'
import { getCleanErrorMessage } from '@/errors'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { processesAPI, inventoryAPI } from '@/api/client'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import {
    ArrowLeft, Trash2, Package, CheckCircle,
    XCircle, Wheat, TrendingUp, Calculator, Plus, AlertTriangle,
    Link as LinkIcon, Copy, Clock, Check,
    Activity, Scale, Warehouse, Zap, Users
} from 'lucide-react'
import { formatDateShort, getStatusClasses, translateStatus } from '@/utils/helpers'
import { confirmDialog } from '@/utils/confirmDialog'

// ── Types ──────────────────────────────────────────────────────
interface Process {
    id: string
    status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
    process_date: string
    end_date?: string
    notes?: string
    inventory_item_id?: string
    gabah_total_kg?: number
    gabah_reserved_kg?: number
    gabah_initial_weight?: number
    total_input_kg?: number
    gabah_used_kg?: number
    gabah_price_per_kg?: number
    gabah_area?: string
    gabah_name?: string
    gabah_tanda?: string
    gabah_batch_date?: string
    gabah_drying_name?: string
    sekam_kg?: number
    sekam_notes?: string
    rendemen_pct?: number
    hpp_per_kg?: number
    costs?: ProcessCost[]
    batches?: any[]
}

interface ProcessCost {
    id: string
    cost_type: string
    description?: string
    amount: number
    created_by_name?: string
    created_at: string
}

interface PackagingRow {
    size_kg: number | 'custom'
    custom_size?: string
    sack_count: string
}

const COST_TYPE_LABELS: Record<string, string> = {
    GILING: 'Biaya Giling',
    PACKAGING: 'Packaging/Karung',
    UTILITY: 'Utilitas',
    LABOR: 'Buruh/Tenaga',
    KONSUMSI: 'Biaya Konsumsi',
    OTHER: 'Lainnya'
}

const STANDARD_SIZES = [10, 25, 50]

export default function ProcessDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()
    // Admin/owner can finish the milling directly (input admin); others wait for the field report
    const canFinishDirectly = user?.role === 'admin' || user?.role === 'owner'
    const [process, setProcess] = useState<Process | null>(null)
    const [inventoryItems, setInventoryItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [_activeTab, setActiveTab] = useState<'gabah' | 'outputs' | 'hpp' | 'sessions'>('gabah')
    const [millingLink, setMillingLink] = useState<any>(null)
    const [millingSummary, setMillingSummary] = useState<any>(null)
    const [_loadingSummary, _setLoadingSummary] = useState(false)

    // Complete Modal state
    const [showCompleteModal, setShowCompleteModal] = useState(false)
    const [completing, setCompleting] = useState(false)
    const [berasRows, setBerasRows] = useState<PackagingRow[]>([{ size_kg: 50, sack_count: '' }])
    const [dedakKg, setDedakKg] = useState('')
    const [dedakSacks, setDedakSacks] = useState('')
    const [menirKg, setMenirKg] = useState('')
    const [menirSacks, setMenirSacks] = useState('')
    const [brokenKg, setBrokenKg] = useState('')
    const [brokenSacks, setBrokenSacks] = useState('')
    const [sekamKg, setSekamKg] = useState('')
    const [sekamNotes, setSekamNotes] = useState('')
    const [_completeNotes, setCompleteNotes] = useState('')
    const [wasteKg, setWasteKg] = useState('')
    const [wasteReason, setWasteReason] = useState('')
    const [isCompleteModalEditMode, setIsCompleteModalEditMode] = useState(false)
    const [completeEditReason, setCompleteEditReason] = useState('')
    const [backupFormState, setBackupFormState] = useState<any>(null)

    // Cancel Modal
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [cancelReason, setCancelReason] = useState('')
    const [cancelling, setCancelling] = useState(false)

    // HPP Cost Modal
    const [showCostModal, setShowCostModal] = useState(false)
    const [newCost, setNewCost] = useState({ costType: '', description: '', amount: '' })
    const [addingCost, setAddingCost] = useState(false)
    const [sackCount, setSackCount] = useState('')
    const [pricePerSack, setPricePerSack] = useState('')

    useEffect(() => {
        if (id && id !== 'new') {
            loadData()
        } else if (id === 'new') {
            loadNewProcessData()
        }
    }, [id])

    const loadNewProcessData = async () => {
        const searchParams = new URLSearchParams(window.location.search)
        const inventoryId = searchParams.get('inventoryId')
        const weightKg = searchParams.get('weightKg')

        if (inventoryId) {
            try {
                setLoading(true)
                const res = await inventoryAPI.getById(inventoryId)
                const gabahItem = res.data as any

                // Mock a process object for the creation UI
                setProcess({
                    id: 'new',
                    status: 'IN_PROGRESS',
                    process_date: new Date().toISOString().split('T')[0],
                    inventory_item_id: inventoryId,
                    gabah_reserved_kg: weightKg ? parseFloat(weightKg) : gabahItem.remaining_weight_kg,
                    gabah_name: (gabahItem.area || 'Gabah') + (gabahItem.tanda ? ` - ${gabahItem.tanda}` : ''),
                    gabah_area: gabahItem.area,
                    gabah_tanda: gabahItem.tanda,
                    gabah_remaining_kg: gabahItem.remaining_weight_kg,
                    gabah_price_per_kg: gabahItem.avg_price_per_kg
                } as any)
            } catch (err) {
                console.error('Failed to load inventory for new process:', err)
                toast.error('Gagal memuat data inventory')
            } finally {
                setLoading(false)
            }
        } else {
            setLoading(false)
            setProcess(null)
        }
    }

    const loadData = async () => {
        if (!id || id === 'new') return
        try {
            setLoading(true)
            const [processRes, inventoryRes] = await Promise.all([
                processesAPI.getById(id),
                inventoryAPI.getAll({ processId: id })
            ])
            setProcess(processRes.data as Process)
            setInventoryItems((inventoryRes.data as any[]) || [])

            // Load milling link & summary
            try {
                const [linkRes, summaryRes] = await Promise.all([
                    processesAPI.generateMillingLink(id),
                    processesAPI.getMillingSummary(id)
                ])
                setMillingLink(linkRes.data)
                setMillingSummary(summaryRes.data)
            } catch (e) {
                console.error('Failed to load milling data:', e)
            }
        } catch (e) {
            console.error('Failed to load process:', e)
        } finally {
            setLoading(false)
        }
    }

    // ── Live render calculations ──
    const totalBerasKg = berasRows.reduce((sum, r) => {
        const size = r.size_kg === 'custom' ? parseFloat(r.custom_size || '0') : r.size_kg
        return sum + (size * (parseInt(r.sack_count) || 0))
    }, 0)
    const gabahReserved = parseFloat(process?.gabah_reserved_kg as any || '0')
    const allOutputKg = totalBerasKg + (parseFloat(dedakKg) || 0) + (parseFloat(menirKg) || 0) + (parseFloat(brokenKg) || 0)
    const rendemenPreview = gabahReserved > 0 ? ((totalBerasKg / gabahReserved) * 100).toFixed(1) : '0'

    // Total karung beras dari laporan akhir operator (sesi END) atau inventoryItems (jika sudah masuk stok)
    const totalBerasSacksFromReport = (() => {
        // 1. Cek dari laporan akhir operator lapangan (sesi END di millingSummary)
        const endSession = millingSummary?.sessions?.find((s: any) => s.session_type === 'END')
        if (endSession && endSession.output_data) {
            try {
                const outputs = typeof endSession.output_data === 'string'
                    ? JSON.parse(endSession.output_data)
                    : endSession.output_data
                if (Array.isArray(outputs)) {
                    const berasOutputs = outputs.filter((o: any) => (o.category || '').toUpperCase() === 'BERAS')
                    const sessionSacks = berasOutputs.reduce((sum: number, o: any) => {
                        const count = parseInt(o.sacks ?? o.sack_count ?? o.total_sacks ?? '0', 10) || 0
                        return sum + count
                    }, 0)
                    if (sessionSacks > 0) return sessionSacks
                }
            } catch (e) {
                console.error('Failed to parse endSession output_data:', e)
            }
        }

        // 2. Fallback jika proses sudah selesai (COMPLETED) dan ada di inventoryItems
        if (inventoryItems && inventoryItems.length > 0) {
            const berasItems = inventoryItems.filter(item => {
                const code = (item.product_category_code || '').toUpperCase()
                const name = (item.category_name || '').toUpperCase()
                const notes = item.notes || ''
                return (code === 'BERAS' || name === 'BERAS') && !notes.includes('[BROKEN]')
            })
            const invSacks = berasItems.reduce((sum: number, item: any) => {
                const count = parseInt(item.total_sacks ?? item.sacks ?? item.sack_count ?? '0', 10) || 0
                return sum + count
            }, 0)
            if (invSacks > 0) return invSacks
        }

        return 0
    })()

    const handleStartNewProcess = async () => {
        if (!process || id !== 'new') return
        try {
            setSaving(true)
            const res = await processesAPI.create({
                inventoryItemId: process.inventory_item_id!,
                gabahReservedKg: process.gabah_reserved_kg!,
                processDate: process.process_date,
                notes: process.notes
            })
            toast.success('Proses giling dimulai')
            navigate(`/processes/${res.data.id}`, { replace: true })
        } catch (err: any) {
            console.error('Failed to start process:', err)
            toast.error(getCleanErrorMessage(err) || 'Gagal memulai proses')
        } finally {
            setSaving(false)
        }
    }

    const handleCompleteProcess = async () => {
        if (!id) return
        try {
            setCompleting(true)

            const totalBerasKg = berasRows.reduce((sum, r) => {
                const size = r.size_kg === 'custom' ? parseFloat(r.custom_size || '0') : (r.size_kg as number)
                return sum + (size * (parseInt(r.sack_count) || 0))
            }, 0)
            const turunanKg = (parseFloat(dedakKg) || 0) + (parseFloat(menirKg) || 0) + (parseFloat(brokenKg) || 0)
            const sKg = parseFloat(sekamKg) || 0
            const wKg = parseFloat(wasteKg) || 0
            const totalAll = totalBerasKg + turunanKg + sKg + wKg
            const gabahReserved = parseFloat(process?.gabah_reserved_kg as any || '0')

            if (totalAll > gabahReserved) {
                toast.error(`Total berat hasil (${totalAll.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg) tidak boleh melebihi input gabah (${gabahReserved.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg)`)
                setCompleting(false)
                return
            }

            const outputs: any[] = []

            // Beras per row (per ukuran packaging)
            for (const row of berasRows) {
                const sacks = parseInt(row.sack_count) || 0
                const size = row.size_kg === 'custom' ? parseFloat(row.custom_size || '0') : row.size_kg
                if (size > 0 && sacks > 0) {
                    outputs.push({
                        category: 'BERAS',
                        weight_kg: size * sacks,
                        sacks,
                        packaging_size_kg: size
                    })
                }
            }

            // Turunan per kg
            if (parseFloat(dedakKg) > 0)
                outputs.push({ category: 'DEDAK', weight_kg: parseFloat(dedakKg), sacks: 0 })
            if (parseFloat(menirKg) > 0)
                outputs.push({ category: 'MENIR', weight_kg: parseFloat(menirKg), sacks: 0 })
            if (parseFloat(brokenKg) > 0)
                outputs.push({ category: 'BROKEN', weight_kg: parseFloat(brokenKg), sacks: 0 })

            if (outputs.length === 0) {
                toast.error('Minimal satu output harus diisi (beras atau turunan)')
                setCompleting(false)
                return
            }

            await processesAPI.complete(id, {
                outputs,
                notes: completeEditReason.trim() ? `[DIEDIT] ${completeEditReason.trim()}` : 'Review finalisasi otomatis',
                sekam_kg: parseFloat(sekamKg) || 0,
                sekam_notes: sekamNotes,
                waste_kg: parseFloat(wasteKg) || 0,
                waste_reason: wasteReason
            })

            setShowCompleteModal(false)
            setActiveTab('outputs')
            loadData()
        } catch (e: any) {
            toast.error(e.message || 'Gagal menyelesaikan proses')
        } finally {
            setCompleting(false)
        }
    }

    const handleCancelProcess = async () => {
        if (!id) return
        try {
            setCancelling(true)
            await processesAPI.cancel(id, cancelReason)
            setShowCancelModal(false)
            loadData()
        } catch (e: any) {
            toast.error(e.message || 'Gagal membatalkan proses')
        } finally {
            setCancelling(false)
        }
    }

    const handleAddCost = async () => {
        if (!id) return
        if (!newCost.costType) { toast.error('Pilih tipe biaya terlebih dahulu'); return }
        if (newCost.costType === 'PACKAGING') {
            const sacks = parseFloat(sackCount)
            const price = parseFloat(pricePerSack)
            if (!sackCount || isNaN(sacks) || sacks <= 0) { toast.error('Jumlah karung harus lebih dari 0'); return }
            if (!pricePerSack || isNaN(price) || price <= 0) { toast.error('Biaya per karung harus lebih dari 0'); return }
        }
        const amount = parseFloat(newCost.amount)
        if (isNaN(amount) || amount <= 0) { toast.error('Nominal harus lebih dari 0'); return }
        try {
            setAddingCost(true)
            await processesAPI.addCost(id, {
                costType: newCost.costType,
                description: newCost.description || (newCost.costType === 'PACKAGING' && sackCount && pricePerSack ? `${sackCount} karung @ Rp ${Number(pricePerSack).toLocaleString('id-ID')}` : undefined),
                amount
            })
            setNewCost({ costType: '', description: '', amount: '' })
            setSackCount('')
            setPricePerSack('')
            setShowCostModal(false)
            loadData()
        } catch (e: any) {
            toast.error(e.message || 'Gagal menambah biaya')
        } finally {
            setAddingCost(false)
        }
    }

    const handleDeleteCost = async (costId: string) => {
        if (!id || !await confirmDialog('Hapus biaya ini?')) return
        try {
            await processesAPI.deleteCost(id, costId)
            loadData()
        } catch (e: any) {
            toast.error(e.message || 'Gagal menghapus biaya')
        }
    }

    const handleOpenCostModal = () => {
        setNewCost({ costType: '', description: '', amount: '' })
        setSackCount('')
        setPricePerSack('')
        setShowCostModal(true)
    }

    const handleSelectCostType = (typeId: string) => {
        if (typeId === 'PACKAGING') {
            let sacksToUse = sackCount
            // On trigger, otomatis isi jumlah karung jika ada karung beras dari laporan akhir / inventory
            if (totalBerasSacksFromReport > 0) {
                sacksToUse = String(totalBerasSacksFromReport)
                setSackCount(sacksToUse)
            }
            const sacks = parseFloat(sacksToUse) || 0
            const price = parseFloat(pricePerSack) || 0
            const total = (sacks * price) > 0 ? String(sacks * price) : ''
            setNewCost(prev => ({
                ...prev,
                costType: typeId,
                amount: total
            }))
        } else {
            setNewCost(prev => ({
                ...prev,
                costType: typeId,
                amount: prev.costType === 'PACKAGING' ? '' : prev.amount
            }))
        }
    }

    const addBerasRow = () => setBerasRows(prev => [...prev, { size_kg: 25, sack_count: '' }])
    const removeBerasRow = (i: number) => setBerasRows(prev => prev.filter((_, idx) => idx !== i))

    const handleCopyLink = () => {
        if (!millingLink) return
        const url = `${window.location.origin}/milling-form/${millingLink.link_code}`
        navigator.clipboard.writeText(url)
        toast.success('Link berhasil disalin!')
    }

    const openCompleteModal = () => {
        const endSession = millingSummary?.sessions?.find((s: any) => s.session_type === 'END')
        if (endSession && endSession.output_data) {
            try {
                const outputs = typeof endSession.output_data === 'string'
                    ? JSON.parse(endSession.output_data)
                    : endSession.output_data;

                const beras = outputs.filter((o: any) => o.category === 'BERAS')
                const dedak = outputs.find((o: any) => o.category === 'DEDAK')
                const menir = outputs.find((o: any) => o.category === 'MENIR')
                const broken = outputs.find((o: any) => o.category === 'BROKEN')
                const sekam = outputs.find((o: any) => o.category === 'SEKAM')

                let newBerasRows = berasRows;
                if (beras.length > 0) {
                    newBerasRows = beras.map((b: any) => ({
                        size_kg: STANDARD_SIZES.includes(b.packaging_size_kg) ? b.packaging_size_kg : 'custom',
                        custom_size: STANDARD_SIZES.includes(b.packaging_size_kg) ? '' : String(b.packaging_size_kg),
                        sack_count: String(b.sacks)
                    }));
                    setBerasRows(newBerasRows)
                }
                const dKg = dedak ? String(dedak.weight_kg) : ''
                const dSacks = dedak ? String(dedak.sacks) : ''
                const mKg = menir ? String(menir.weight_kg) : ''
                const mSacks = menir ? String(menir.sacks) : ''
                const bKg = broken ? String(broken.weight_kg) : ''
                const bSacks = broken ? String(broken.sacks) : ''
                const sKg = sekam ? String(sekam.weight_kg) : ''
                const sNotes = sekam ? (sekam.notes || '') : ''

                if (dedak) { setDedakKg(dKg); setDedakSacks(dSacks); }
                if (menir) { setMenirKg(mKg); setMenirSacks(mSacks); }
                if (broken) { setBrokenKg(bKg); setBrokenSacks(bSacks); }
                if (sekam) { setSekamKg(sKg); setSekamNotes(sNotes); }
                setCompleteNotes(endSession.notes || '')

                setBackupFormState({
                    berasRows: JSON.parse(JSON.stringify(newBerasRows)),
                    dedakKg: dKg, dedakSacks: dSacks,
                    menirKg: mKg, menirSacks: mSacks,
                    brokenKg: bKg, brokenSacks: bSacks,
                    sekamKg: sKg, sekamNotes: sNotes,
                    wasteKg: '', wasteReason: '',
                    completeEditReason: ''
                })
            } catch (e) {
                console.error('Failed to parse output_data', e)
            }
        } else {
            setBackupFormState({
                berasRows: JSON.parse(JSON.stringify(berasRows)),
                dedakKg, dedakSacks, menirKg, menirSacks, brokenKg, brokenSacks,
                sekamKg, sekamNotes, wasteKg, wasteReason, completeEditReason: ''
            })
        }
        setIsCompleteModalEditMode(false)
        setCompleteEditReason('')
        setShowCompleteModal(true)
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="spinner" /><p className="text-stone-600">Memuat data...</p>
        </div>
    )
    if (!process) return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-red-400">Proses tidak ditemukan</p>
            <button type="button" onClick={() => navigate('/processes')} className="flex items-center gap-2 text-brand-light-green hover:underline">
                <ArrowLeft size={16} />
                <span>Kembali ke Daftar Proses</span>
            </button>
        </div>
    )

    const totalOutputInventoryKg = inventoryItems.reduce((acc, i) => acc + Number(i.total_weight_kg || 0), 0)
    const totalCosts = (process.costs || []).reduce((s, c) => s + Number(c.amount), 0)
    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <button
                    type="button"
                    onClick={() => navigate('/processes')}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-stone-300 rounded-lg transition-colors w-fit text-stone-600 hover:text-stone-900"
                >
                    <ArrowLeft size={20} />
                    <span className="text-sm font-medium">Kembali ke Daftar Proses</span>
                </button>
                <div className="flex-1">
                    <h1 className="text-xl md:text-2xl font-bold flex items-center gap-3">
                        <Wheat className="text-brand-light-green" size={24} />
                        Proses Giling {process.gabah_name || 'Gabah'}
                    </h1>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-stone-600 text-sm">
                            Dimulai {formatDateShort(process.process_date)}
                        </span>
                        <span className="text-stone-400">•</span>
                        <span className="text-sm px-2 py-0.5 bg-stone-300 rounded text-stone-700">
                            {process.gabah_area || 'Area tidak tercatat'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {id === 'new' ? (
                        <button
                            onClick={handleStartNewProcess}
                            disabled={saving}
                            className="px-4 py-2 bg-brand-light-green hover:bg-brand-light-green/80 text-stone-900 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-brand-light-green/20 flex items-center gap-2"
                        >
                            {saving ? <div className="spinner-xs" /> : <CheckCircle size={18} />}
                            Konfirmasi & Mulai Giling
                        </button>
                    ) : (
                        <>
                            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${getStatusClasses(process.status, 'milling')}`}>
                                {translateStatus(process.status, 'milling')}
                            </span>
                            {process.status === 'IN_PROGRESS' && (
                                <div className="flex gap-2">
                                    <button onClick={() => setShowCancelModal(true)}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors">
                                        <XCircle size={14} /> Batalkan
                                    </button>
                                    {(() => {
                                        const hasEnded = !!millingSummary?.sessions?.some((s: any) => s.session_type === 'END')
                                        const canFinish = hasEnded || canFinishDirectly
                                        return (
                                            <button
                                                onClick={openCompleteModal}
                                                disabled={!canFinish}
                                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-lg ${canFinish
                                                    ? 'bg-brand-light-green hover:bg-brand-light-green/80 text-white shadow-brand-light-green/20'
                                                    : 'bg-stone-300 text-stone-500 cursor-not-allowed opacity-60'
                                                    }`}
                                                title={!canFinish ? "Menunggu laporan selesai dari operator lapangan" : hasEnded ? "Input Manual Hasil Giling" : "Input admin: langsung isi hasil giling tanpa menunggu laporan operator"}
                                            >
                                                <CheckCircle size={14} /> Selesai Giling
                                            </button>
                                        )
                                    })()}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
                {/* Gabah Input */}
                <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-5 shadow-lg group hover:border-amber-500/30 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-5 h-5 md:w-10 md:h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                            <Wheat size={20} />
                        </div>
                        <span className="text-[10px] ml-4 md:ml-0 font-bold text-stone-500 uppercase tracking-widest text-right leading-tight">Input Gabah<br className="md:hidden" /> (Kering)</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <p className="text-xl md:text-3xl font-black text-stone-900">{Number(process.gabah_reserved_kg || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <span className="text-xs text-stone-500 font-medium">KG</span>
                    </div>
                    <div className="mt-2 space-y-1">
                        <span className="text-[10px] text-stone-500 font-bold truncate block">{process.gabah_tanda || 'Tanpa Tanda'}</span>
                        {process.gabah_initial_weight && (
                            <span className="text-[10px] text-amber-400/80 font-bold block">
                                Berat Awal (Belanja): {Number(process.gabah_initial_weight).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
                            </span>
                        )}
                    </div>
                </div>

                {/* Total Output */}
                <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-5 shadow-lg group hover:border-brand-light-green/30 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-5 h-5 md:w-10 md:h-10 bg-brand-light-green/10 rounded-xl flex items-center justify-center text-brand-light-green group-hover:scale-110 transition-transform">
                            <Package size={20} />
                        </div>
                        <span className="text-[10px] ml-4 md:ml-0 font-bold text-stone-500 uppercase tracking-widest text-right">Total Output</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <p className="text-xl md:text-3xl font-black text-brand-light-green">{Number(totalOutputInventoryKg || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <span className="text-xs text-stone-500 font-medium">KG</span>
                    </div>
                </div>

                {/* Rendemen */}
                <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-5 shadow-lg group hover:border-blue-500/30 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-5 h-5 md:w-10 md:h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                            <TrendingUp size={20} />
                        </div>
                        <span className="text-[10px] ml-4 md:ml-0 font-bold text-stone-500 uppercase tracking-widest text-right leading-tight">Rendemen<br className="hidden md:block" /> Beras</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <p className="text-xl md:text-3xl font-black text-stone-900">{process.rendemen_pct || '--'}</p>
                        <span className="text-xs text-stone-500 font-medium">%</span>
                    </div>
                </div>

                {/* HPP Display Removed per user request */}

                {/* Shrinkage */}
                <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-5 shadow-lg group hover:border-rose-500/30 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-5 h-5 md:w-10 md:h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                            <Scale size={20} />
                        </div>
                        <span className="text-[10px] ml-4 md:ml-0 font-bold text-stone-500 uppercase tracking-widest text-right">Penyusutan</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <p className="text-xl md:text-3xl font-black text-rose-400">
                            {process.status === 'COMPLETED' ? Number(Number(process.gabah_reserved_kg || 0) - totalOutputInventoryKg).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}
                        </p>
                        <span className="text-xs text-stone-500 font-medium">KG</span>
                    </div>
                </div>
            </div>

            {/* Dashboard Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Column: Flow & Details (8 cols) */}
                <div className="lg:col-span-8 space-y-6">

                    {/* Visual Workflow */}
                    <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-[10px] font-bold text-stone-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Activity size={14} className="text-blue-400" />
                            Alur Penggilingan
                        </h3>

                        <div className="relative grid grid-cols-2 gap-y-8 gap-x-2 md:flex md:flex-row md:justify-between md:items-center md:gap-4 px-2 md:px-4">
                            {/* Connector Line (Desktop) */}
                            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-stone-300 -translate-y-1/2 z-0"></div>

                            {/* Step 1: Reservasi */}
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-12 h-12 bg-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3 border-[3px] border-amber-500">
                                    <Wheat size={20} className="text-amber-500" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-bold text-stone-900">Reservasi</p>
                                    <p className="text-[10px] text-stone-500">{Number(process.gabah_reserved_kg || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG</p>
                                </div>
                            </div>

                            {/* Step 2: Sesi Lapangan */}
                            {(() => {
                                const hasStarted = millingSummary?.sessions.some((s: any) => s.session_type === 'START')
                                return (
                                    <div className="relative z-10 flex flex-col items-center">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg mb-3 border-[3px] transition-all ${hasStarted ? 'bg-blue-500 shadow-blue-500/20 border-stone-900' : 'bg-stone-300 text-stone-500'}`}>
                                            <Clock size={20} className={hasStarted ? 'text-stone-900' : 'text-stone-500'} />
                                        </div>
                                        <div className="text-center">
                                            <p className={`text-xs font-bold ${hasStarted ? 'text-stone-900' : 'text-stone-500'}`}>Giling Dimulai</p>
                                            <p className="text-[10px] text-stone-500">{hasStarted ? 'Dalam Proses' : 'Menunggu'}</p>
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* Step 3: Laporan Selesai */}
                            {(() => {
                                const hasEnded = millingSummary?.sessions.some((s: any) => s.session_type === 'END')
                                return (
                                    <div className="relative z-10 flex flex-col items-center">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg mb-3 border-[3px] transition-all ${hasEnded ? 'bg-brand-light-green shadow-brand-light-green/20 border-brand-dark-green' : 'bg-stone-300 text-stone-500'}`}>
                                            <Check size={20} className={hasEnded ? 'text-brand-dark-green' : 'text-stone-500'} />
                                        </div>
                                        <div className="text-center">
                                            <p className={`text-xs font-bold ${hasEnded ? 'text-stone-900' : 'text-stone-500'}`}>Laporan Akhir</p>
                                            <p className="text-[10px] text-stone-500">{hasEnded ? 'Sudah Dikirim' : 'Belum Ada'}</p>
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* Step 4: Finalisasi */}
                            <div className="relative z-10 flex flex-col items-center">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg mb-3 border-[3px] transition-all ${process.status === 'COMPLETED' ? 'bg-indigo-500 shadow-indigo-500/20 border-[#4338ca]' : 'bg-stone-300 text-stone-500'}`}>
                                    <Package size={20} className={process.status === 'COMPLETED' ? 'text-[#4338ca]' : 'text-stone-500'} />
                                </div>
                                <div className="text-center">
                                    <p className={`text-xs font-bold ${process.status === 'COMPLETED' ? 'text-stone-900' : 'text-stone-500'}`}>Masuk Stok</p>
                                    <p className="text-[10px] text-stone-500">{process.status === 'COMPLETED' ? 'Selesai' : 'Pending'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Output Inventory Section */}
                    <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-6 border-b border-stone-300/50 flex items-center justify-between">
                            <h3 className="text-[10px] font-bold text-stone-600 uppercase tracking-widest flex items-center gap-2">
                                <Package size={14} className="text-brand-light-green" />
                                Hasil Produksi Beras & Turunan
                            </h3>
                            {process.status === 'COMPLETED' && process.rendemen_pct && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                    <TrendingUp size={12} /> Rendemen: {process.rendemen_pct}%
                                </span>
                            )}
                        </div>
                        {inventoryItems.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[600px] text-sm">
                                    <thead>
                                        <tr className="text-[10px] text-stone-500 uppercase tracking-widest bg-stone-100/50">
                                            <th className="px-6 py-3 text-left font-bold">Kategori</th>
                                            <th className="px-6 py-3 text-left font-bold">Kemasan</th>
                                            <th className="px-6 py-3 text-right font-bold">Berat Total</th>
                                            <th className="px-6 py-3 text-right font-bold">Sisa Stok</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-300/50 text-stone-800">
                                        {inventoryItems.map(item => (
                                            <tr key={item.id} className="hover:bg-stone-300/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="text-[10px] font-bold px-2 py-1 rounded-md border"
                                                        style={{ color: item.category_color || '#9CA3AF', backgroundColor: (item.category_color || '#9CA3AF') + '10', borderColor: (item.category_color || '#9CA3AF') + '30' }}>
                                                        {item.category_name || item.product_category_code}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-stone-600">
                                                    {item.packaging_size_kg ? `${item.packaging_size_kg} kg${item.total_sacks ? ` (${item.total_sacks} karung)` : ''}` : `${item.total_sacks} karung`}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-stone-900">{Number(item.total_weight_kg || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</td>
                                                <td className="px-6 py-4 text-right">{Number(item.remaining_weight_kg || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <div className="w-12 h-12 bg-stone-300/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <Package size={20} className="text-stone-500" />
                                </div>
                                <p className="text-stone-500 text-sm">Belum ada hasil produksi tercatat.</p>
                            </div>
                        )}
                    </div>

                    {/* Costs Section */}
                    <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-6 border-b border-stone-300/50 flex items-center justify-between">
                            <h3 className="text-[10px] font-bold text-stone-600 uppercase tracking-widest flex items-center gap-2">
                                <Calculator size={14} className="text-brand-light-green" />
                                Rincian Biaya Tambahan
                            </h3>
                            {process.status !== 'CANCELLED' && (
                                <button onClick={handleOpenCostModal}
                                    className="px-3 py-1 bg-brand-light-green/10 text-brand-light-green hover:bg-brand-light-green/20 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">
                                    + Tambah Biaya
                                </button>
                            )}
                        </div>
                        <div className="p-0">
                            {(process.costs || []).length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[600px] text-sm">
                                        <thead>
                                            <tr className="text-[10px] text-stone-500 uppercase tracking-widest bg-stone-100/50">
                                                <th className="px-6 py-3 text-left font-bold">Tipe</th>
                                                <th className="px-6 py-3 text-left font-bold">Keterangan</th>
                                                <th className="px-6 py-3 text-right font-bold">Nominal</th>
                                                <th className="px-6 py-3 text-center font-bold">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-300/50">
                                            {(process.costs || []).map(cost => (
                                                <tr key={cost.id} className="hover:bg-stone-300/30 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-stone-800">{COST_TYPE_LABELS[cost.cost_type] || cost.cost_type}</td>
                                                    <td className="px-6 py-4 text-stone-600">{cost.description || '-'}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-stone-900">Rp {Number(cost.amount).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button onClick={() => handleDeleteCost(cost.id)}
                                                            className="p-1.5 text-stone-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-brand-light-green/5">
                                                <td colSpan={2} className="px-6 py-4 text-[10px] font-black text-brand-light-green uppercase tracking-[0.2em]">Total Biaya Overhead</td>
                                                <td className="px-6 py-4 text-right font-black text-brand-light-green text-lg">Rp {totalCosts.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-stone-500 text-sm">Belum ada biaya tambahan</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Links & Source (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Milling Link Card */}
                    <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl shadow-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-stone-300/50 flex justify-between items-center bg-stone-300/20">
                            <h3 className="text-xs font-bold text-stone-600 uppercase tracking-widest flex items-center gap-2">
                                <LinkIcon size={14} className="text-stone-500" />
                                Shareable Links
                            </h3>
                            <span className="text-[10px] font-bold text-stone-500 bg-stone-100/50 px-2 py-0.5 rounded-full">{millingLink ? '1' : '0'}</span>
                        </div>
                        <div className="p-4">
                            {id === 'new' ? (
                                <div className="text-center py-6">
                                    <AlertTriangle size={32} className="mx-auto text-amber-500/50 mb-3" />
                                    <p className="text-xs text-stone-500 font-medium">Link form akan tersedia setelah Anda mengonfirmasi pembuatan proses.</p>
                                </div>
                            ) : millingLink ? (
                                <div className="bg-stone-100/40 border border-stone-300/50 rounded-xl p-3 group">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-[10px] font-black text-amber-500 tracking-wider font-mono">{millingLink.link_code}</p>
                                        <div className="flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-light-green animate-pulse"></div>
                                            <span className="text-[10px] font-bold text-brand-light-green uppercase tracking-wider">Aktif</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCopyLink}
                                            className="flex-1 h-8 bg-stone-300 hover:bg-stone-400 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2"
                                        >
                                            <Copy size={12} />
                                            Salin Link
                                        </button>
                                        <a
                                            href={`/milling-form/${millingLink.link_code}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-10 h-8 bg-stone-300 hover:bg-indigo-500/20 hover:text-indigo-400 rounded-lg flex items-center justify-center"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="animate-pulse flex flex-col gap-3">
                                    <div className="h-20 bg-stone-300/50 rounded-xl"></div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Source Info Card */}
                    <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-[10px] font-bold text-stone-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Warehouse size={14} className="text-amber-400" />
                            Sumber Gabah
                        </h3>
                        {process.inventory_item_id ? (
                            <div className="space-y-4">
                                <div className="p-3 bg-stone-100/50 rounded-xl border border-stone-300">
                                    <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1">Batch Asal</p>
                                    <p className="text-sm font-bold text-stone-900">{process.gabah_batch_date ? `Batch ${formatDateShort(process.gabah_batch_date)}` : 'Manual'}</p>
                                </div>
                                <div className="p-3 bg-stone-100/50 rounded-xl border border-stone-300">
                                    <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1">Lokasi Penyimpanan</p>
                                    <p className="text-sm font-bold text-stone-900">{process.gabah_area || '-'} • {process.gabah_tanda || '-'}</p>
                                </div>
                                <div className="p-3 bg-stone-100/50 rounded-xl border border-stone-300">
                                    <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1">Harga Pokok Gabah</p>
                                    <p className="text-sm font-bold text-stone-900">Rp {Number(process.gabah_price_per_kg || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / KG</p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-stone-500 text-xs">Informasi sumber tidak tersedia</div>
                        )}
                    </div>

                    {/* Activity Feed (Quick view of sessions) */}
                    <div className="bg-stone-200/40 backdrop-blur-sm border border-stone-300/50 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-[10px] font-bold text-stone-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Activity size={14} className="text-rose-400" />
                            Aktivitas Terakhir
                        </h3>
                        {id === 'new' ? (
                            <p className="text-[10px] text-stone-500 italic text-center py-4">Proses baru belum memiliki riwayat aktivitas.</p>
                        ) : (
                            <div className="space-y-4">
                                {millingSummary?.sessions.slice(0, 3).map((session: any) => (
                                    <div key={session.id} className="flex gap-3 relative pb-4 last:pb-0">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-2 h-2 rounded-full mt-1.5 ${session.session_type === 'START' ? 'bg-blue-500' :
                                                session.session_type === 'END' ? 'bg-brand-light-green' : 'bg-amber-500'
                                                }`}></div>
                                            <div className="w-0.5 flex-1 bg-stone-300 my-1"></div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-stone-900">{session.session_type} oleh {session.pic}</p>
                                            <p className="text-[10px] text-stone-500">{formatDateShort(session.session_date)} • {session.session_time.substring(0, 5)}</p>
                                            <div className="mt-1.5">
                                                <PhotoStrip paths={session.photos} label="" size="w-12 h-12" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!millingSummary || millingSummary.sessions.length === 0) && (
                                    <p className="text-xs text-stone-500 text-center py-4">Belum ada aktivitas</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Finalization Banner if needed */}
            {process.status === 'IN_PROGRESS' && millingSummary?.sessions.some((s: any) => s.session_type === 'END') && (
                <div className="mt-8 bg-brand-light-green/10 border border-brand-light-green/20 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
                    <div className="flex items-center gap-4 text-center md:text-left">
                        <div className="w-16 h-16 bg-brand-light-green/20 rounded-full flex items-center justify-center">
                            <CheckCircle className="text-brand-light-green" size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-brand-light-green">Siap untuk Finalisasi</h3>
                            <p className="text-sm text-stone-600">Operator lapangan telah mengirim laporan akhir. Tinjau dan masukkan ke inventory.</p>
                        </div>
                    </div>
                    <button onClick={openCompleteModal}
                        className="px-8 py-4 bg-brand-light-green hover:bg-brand-light-green/80 text-white rounded-2xl font-black text-lg shadow-lg shadow-brand-light-green/20 transition-all hover:scale-105">
                        FINALSASI SEKARANG
                    </button>
                </div>
            )}

            {/* ─── Modal: Selesai Penggilingan ─────────────────────── */}
            <Modal isOpen={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="Selesai Penggilingan" size="lg"
                footer={<>
                    {isCompleteModalEditMode ? (
                        <button onClick={() => {
                            if (backupFormState) {
                                setBerasRows(backupFormState.berasRows)
                                setDedakKg(backupFormState.dedakKg)
                                setDedakSacks(backupFormState.dedakSacks)
                                setMenirKg(backupFormState.menirKg)
                                setMenirSacks(backupFormState.menirSacks)
                                setBrokenKg(backupFormState.brokenKg)
                                setBrokenSacks(backupFormState.brokenSacks)
                                setSekamKg(backupFormState.sekamKg)
                                setSekamNotes(backupFormState.sekamNotes)
                                setWasteKg(backupFormState.wasteKg)
                                setWasteReason(backupFormState.wasteReason)
                                setCompleteEditReason(backupFormState.completeEditReason || '')
                            }
                            setIsCompleteModalEditMode(false)
                        }} className="px-4 py-2 bg-stone-300 hover:bg-stone-400 rounded-lg text-sm font-medium text-stone-900">Batal</button>
                    ) : (
                        <button onClick={() => setShowCompleteModal(false)} className="px-4 py-2 bg-stone-300 hover:bg-stone-400 rounded-lg text-sm font-medium text-stone-900">Batal</button>
                    )}
                    {isCompleteModalEditMode ? (
                        <button
                            onClick={() => {
                                if (!completeEditReason.trim()) {
                                    toast.error('Catatan / Alasan Perubahan wajib diisi!')
                                    return
                                }
                                setBackupFormState({
                                    berasRows: JSON.parse(JSON.stringify(berasRows)),
                                    dedakKg, dedakSacks, menirKg, menirSacks, brokenKg, brokenSacks,
                                    sekamKg, sekamNotes, wasteKg, wasteReason, completeEditReason
                                })
                                toast.success('Perubahan disimpan sementara. Klik Simpan & Selesaikan untuk finalisasi.')
                                setIsCompleteModalEditMode(false)
                            }}
                            disabled={!completeEditReason.trim()}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white    rounded-lg text-sm font-medium disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20"
                        >
                            Simpan Perubahan
                        </button>
                    ) : (
                        <button
                            onClick={handleCompleteProcess}
                            disabled={completing}
                            className="px-4 py-2 bg-brand-light-green hover:bg-brand-light-green/80 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors shadow-lg shadow-brand-light-green/20"
                        >
                            {completing ? 'Menyimpan...' : 'Simpan & Selesaikan'}
                        </button>
                    )}
                </>}>
                <div className="space-y-5">
                    {/* Rendemen Preview */}
                    <div className="flex items-center justify-between bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-3">
                        <span className="text-sm text-amber-600">Preview Rendemen Beras</span>
                        <span className="font-black text-xl text-amber-600">{rendemenPreview}%</span>
                    </div>

                    {/* Gabah reserved info */}
                    <div className="text-sm text-stone-600 bg-stone-300/30 rounded-lg px-4 py-2">
                        Gabah direservasi: <strong className="text-stone-900">{Number(process.gabah_reserved_kg || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</strong>
                        {allOutputKg > 0 && ` • Total output: ${allOutputKg.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`}
                        {allOutputKg > gabahReserved && <span className="text-red-400 ml-2">⚠ Output melebihi gabah!</span>}
                    </div>

                    {/* BERAS — per ukuran packaging */}
                    <div className="space-y-3 border border-stone-400 rounded-xl p-4">
                        <div className="flex items-center justify-between border-b border-stone-400 pb-2">
                            <h3 className="font-semibold">🌾 Beras (per ukuran packaging)</h3>
                            {isCompleteModalEditMode && (
                                <button onClick={addBerasRow} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-stone-300 hover:bg-stone-400 rounded text-stone-700">
                                    <Plus size={12} /> Tambah Ukuran
                                </button>
                            )}
                        </div>
                        {berasRows.map((row, i) => (
                            <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                                <select
                                    disabled={!isCompleteModalEditMode}
                                    className="px-2 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green w-full sm:w-28 disabled:opacity-75"
                                    value={row.size_kg}
                                    onChange={e => setBerasRows(prev => prev.map((r, idx) => idx === i ? { ...r, size_kg: e.target.value === 'custom' ? 'custom' : Number(e.target.value) } : r))}>
                                    {STANDARD_SIZES.map(s => <option key={s} value={s}>{s} kg</option>)}
                                    <option value="custom">Custom</option>
                                </select>
                                {row.size_kg === 'custom' && (
                                    <NumberInput  min="0" placeholder="kg" disabled={!isCompleteModalEditMode} className="w-full sm:w-20 px-2 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green disabled:opacity-75"
                                        value={row.custom_size || ''}
                                        onWheel={e => e.currentTarget.blur()}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val.includes('-')) return;
                                            setBerasRows(prev => prev.map((r, idx) => idx === i ? { ...r, custom_size: val } : r))
                                        }} />
                                )}
                                <NumberInput  min="0" placeholder="Jumlah karung" disabled={!isCompleteModalEditMode} className="flex-1 w-full sm:w-auto px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green disabled:opacity-75"
                                    value={row.sack_count}
                                    onWheel={e => e.currentTarget.blur()}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val.includes('-')) return;
                                        setBerasRows(prev => prev.map((r, idx) => idx === i ? { ...r, sack_count: val } : r))
                                    }} />
                                <span className="text-xs text-stone-500 whitespace-nowrap">
                                    = {((row.size_kg === 'custom' ? parseFloat(row.custom_size || '0') : row.size_kg) * (parseInt(row.sack_count) || 0)).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                                </span>
                                {isCompleteModalEditMode && berasRows.length > 1 && (
                                    <button onClick={() => removeBerasRow(i)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                                )}
                            </div>
                        ))}
                        <p className="text-right text-sm font-bold text-brand-light-green">Total: {totalBerasKg.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</p>
                    </div>

                    {/* Turunan */}
                    <div className="space-y-3 border border-stone-400 rounded-xl p-4">
                        <h3 className="font-semibold border-b border-stone-400 pb-2">📦 Turunan (Dedak, Menir, Broken)</h3>
                        {[
                            { label: 'Dedak', kg: dedakKg, setKg: setDedakKg },
                            { label: 'Menir', kg: menirKg, setKg: setMenirKg },
                            { label: 'Beras Patah (Broken)', kg: brokenKg, setKg: setBrokenKg },
                        ].map(({ label, kg, setKg }) => (
                            <div key={label} className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 items-center">
                                <label className="text-sm text-stone-700">{label}</label>
                                <div className="relative">
                                    <NumberInput  min="0" placeholder="0" disabled={!isCompleteModalEditMode} className="w-full px-3 py-2 pr-8 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-brand-light-green disabled:opacity-75"
                                        value={kg || ''} onWheel={e => e.currentTarget.blur()} onChange={e => {
                                            const val = e.target.value;
                                            if (val.includes('-')) return;
                                            setKg(val);
                                        }} />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-600 pointer-events-none">kg</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Sekam */}
                    <div className="space-y-2 border border-yellow-700/30 rounded-xl p-4 bg-yellow-900/10">
                        <h3 className="font-semibold text-amber-500">🌾 Sekam (Limbah — dicatat saja)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="relative">
                                <NumberInput  min="0" placeholder="0" disabled={!isCompleteModalEditMode} className="w-full px-3 py-2 pr-8 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-yellow-500 disabled:opacity-75"
                                    value={sekamKg || ''} onWheel={e => e.currentTarget.blur()} onChange={e => {
                                        const val = e.target.value;
                                        if (val.includes('-')) return;
                                        setSekamKg(val);
                                    }} />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-600 pointer-events-none">kg</span>
                            </div>
                            <input type="text" placeholder="Dikirim ke mana? (opsional)" disabled={!isCompleteModalEditMode} className="px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-yellow-500 disabled:opacity-75"
                                value={sekamNotes} onChange={e => setSekamNotes(e.target.value)} />
                        </div>
                    </div>

                    {/* Waste (Limbah/Bocor) */}
                    <div className="space-y-2 border border-rose-700/30 rounded-xl p-4 bg-rose-900/10">
                        <h3 className="font-semibold text-rose-400">🚨 Limbah (Gabah Bocor/Tumpah/Rusak)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <NumberInput  min="0" placeholder="Berat limbah (kg)" disabled={!isCompleteModalEditMode} className="px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-rose-500 disabled:opacity-75"
                                value={wasteKg} onWheel={e => e.currentTarget.blur()} onChange={e => {
                                    const val = e.target.value;
                                    if (val.includes('-')) return;
                                    setWasteKg(val);
                                }} />
                            <input type="text" placeholder="Alasan? (Misal: Karung bocor)" disabled={!isCompleteModalEditMode} className="px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-rose-500 disabled:opacity-75"
                                value={wasteReason} onChange={e => setWasteReason(e.target.value)} />
                        </div>
                    </div>

                    {/* Edit Mode Toggle / Reason */}
                    {!isCompleteModalEditMode ? (
                        <div className="pt-2 space-y-3">
                            {completeEditReason.trim() && (
                                <div className="bg-amber-500/15 border border-amber-500/40 p-3 rounded-xl flex items-center justify-between text-xs text-amber-300">
                                    <span>⚠️ Data telah diubah dari laporan operator: "{completeEditReason}"</span>
                                </div>
                            )}
                            <button onClick={() => setIsCompleteModalEditMode(true)} className="w-full py-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
                                <span>✏️</span> {completeEditReason.trim() ? 'Edit Kembali Data Finalisasi' : 'Edit Data Finalisasi'}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-red-500/15 backdrop-blur-md border border-red-500/40 p-5 rounded-2xl shadow-xl shadow-red-500/10 space-y-3 relative overflow-hidden group animate-in fade-in zoom-in-95 duration-200">
                            <label className="block text-sm font-bold text-red-400">
                                Catatan / Alasan Perubahan <span className="text-red-500">*</span>
                            </label>
                            <textarea className="w-full px-3 py-2 bg-stone-200/80 border border-red-500/30 rounded-lg text-sm focus:outline-none focus:border-red-500 text-stone-900 placeholder-red-300/40" rows={2}
                                value={completeEditReason} onChange={e => setCompleteEditReason(e.target.value)} placeholder="Wajib diisi menjelaskan alasan perubahan data dari operator..." required />
                        </div>
                    )}
                </div>
            </Modal>

            {/* ─── Modal: Batalkan ─────────────────────────────────── */}
            <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)} title="Batalkan Proses"
                footer={<>
                    <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 bg-stone-300 hover:bg-stone-400 rounded-lg text-sm font-medium">Kembali</button>
                    <button onClick={handleCancelProcess} disabled={cancelling} className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium disabled:opacity-50">
                        {cancelling ? 'Membatalkan...' : 'Ya, Batalkan'}
                    </button>
                </>}>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 rounded-lg p-3">
                        <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
                        <p className="text-sm text-red-300">Membatalkan proses akan mengembalikan stok gabah ke status <strong>AVAILABLE</strong></p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Alasan Pembatalan (Opsional)</label>
                        <textarea className="w-full px-3 py-2 bg-stone-300 border border-stone-400 rounded-lg text-sm focus:outline-none focus:border-red-500" rows={3}
                            value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Misal: Mesin rusak, ada batch prioritas, dll..." />
                    </div>
                </div>
            </Modal>

            {/* ─── Modal: Tambah Biaya HPP ─────────────────────────── */}
            <Modal isOpen={showCostModal} onClose={() => { setShowCostModal(false); setNewCost({ costType: '', description: '', amount: '' }); setSackCount(''); setPricePerSack('') }} title="Tambah Biaya Produksi"
                size="default"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <button onClick={() => { setShowCostModal(false); setNewCost({ costType: '', description: '', amount: '' }); setSackCount(''); setPricePerSack('') }} className="px-6 py-2.5 rounded-xl text-stone-600 font-bold hover:bg-stone-300 transition-all">Batal</button>
                        <button onClick={handleAddCost} disabled={addingCost} className="px-8 py-2.5 bg-brand-light-green hover:bg-brand-light-green/80 text-white rounded-xl font-bold shadow-lg shadow-brand-light-green/20 transition-all disabled:opacity-50">
                            {addingCost ? 'Menyimpan...' : 'Simpan Biaya'}
                        </button>
                    </div>
                }>
                <div className="space-y-6 py-2">
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 block">Tipe Biaya</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'PACKAGING', label: 'Packaging/Karung', icon: <Package size={16} /> },
                                { id: 'UTILITY', label: 'Utilitas', icon: <Zap size={16} /> },
                                { id: 'LABOR', label: 'Buruh/Tenaga', icon: <Users size={16} /> },
                                { id: 'KONSUMSI', label: 'Biaya Konsumsi', icon: <Activity size={16} /> },
                                { id: 'OTHER', label: 'Lainnya', icon: <Calculator size={16} /> }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => handleSelectCostType(t.id)}
                                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${newCost.costType === t.id ? 'border-brand-light-green bg-brand-light-green/10 text-brand-light-green' : 'border-stone-300 bg-stone-200/50 text-stone-600 hover:border-stone-400'}`}
                                >
                                    {t.icon}
                                    <span className="text-sm font-bold text-left">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {newCost.costType === 'PACKAGING' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                {/* Field 1: Jumlah Karung (50% width) */}
                                <div>
                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 block truncate">
                                        Jumlah Karung <span className="text-red-500">*</span>
                                    </label>
                                    <NumberInput

                                        min="1"
                                        placeholder="0"
                                        className="w-full bg-stone-100 border-2 border-stone-300 rounded-2xl px-4 py-4 text-xl font-black text-stone-900 focus:border-brand-light-green transition-all outline-none"
                                        value={sackCount}
                                        onChange={e => {
                                            const val = e.target.value
                                            setSackCount(val)
                                            const total = (parseFloat(val) || 0) * (parseFloat(pricePerSack) || 0)
                                            setNewCost(p => ({ ...p, amount: total > 0 ? String(total) : '' }))
                                        }}
                                    />
                                    {totalBerasSacksFromReport > 0 && (
                                        sackCount === String(totalBerasSacksFromReport) ? (
                                            <span className="text-[10px] text-brand-light-green font-semibold mt-1.5 flex items-center gap-1">
                                                <Check size={12} className="text-brand-light-green shrink-0" />
                                                <span>Diisi otomatis dari laporan akhir ({totalBerasSacksFromReport} karung beras)</span>
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSackCount(String(totalBerasSacksFromReport))
                                                    const total = totalBerasSacksFromReport * (parseFloat(pricePerSack) || 0)
                                                    setNewCost(p => ({ ...p, amount: total > 0 ? String(total) : '' }))
                                                }}
                                                className="text-[10px] text-brand-light-green hover:underline mt-1.5 flex items-center gap-1 font-medium text-left"
                                            >
                                                <span>Gunakan data laporan ({totalBerasSacksFromReport} karung beras)</span>
                                            </button>
                                        )
                                    )}
                                </div>

                                {/* Field 2: Biaya per Karung (50% width) */}
                                <div>
                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 block truncate">
                                        Biaya / Karung <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative group">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-brand-light-green">Rp</span>
                                        <NumberInput

                                            min="0"
                                            placeholder="0"
                                            className="w-full bg-stone-100 border-2 border-stone-300 rounded-2xl pl-12 pr-4 py-4 text-xl font-black text-stone-900 focus:border-brand-light-green transition-all outline-none"
                                            value={pricePerSack}
                                            onChange={e => {
                                                const val = e.target.value
                                                setPricePerSack(val)
                                                const total = (parseFloat(sackCount) || 0) * (parseFloat(val) || 0)
                                                setNewCost(p => ({ ...p, amount: total > 0 ? String(total) : '' }))
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Field 3: Total Biaya (100% width, di bawah) */}
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 block">
                                    Total Biaya (Otomatis)
                                </label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-brand-light-green group-focus-within:scale-110 transition-transform">Rp</span>
                                    <input
                                        type="text"
                                        readOnly
                                        tabIndex={-1}
                                        placeholder="0"
                                        className="w-full bg-stone-200/80 border-2 border-stone-300 rounded-2xl pl-12 pr-4 py-4 text-2xl font-black text-stone-800 cursor-not-allowed outline-none select-none"
                                        value={newCost.amount ? Number(newCost.amount).toLocaleString('id-ID') : '0'}
                                    />
                                </div>
                                <p className="text-[11px] text-stone-500 mt-1.5 italic">
                                    Total Biaya dihitung otomatis: Jumlah Karung × Biaya per Karung
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 block">Nominal (IDR) <span className="text-red-500">*</span></label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-brand-light-green group-focus-within:scale-110 transition-transform">Rp</span>
                                <NumberInput  placeholder="0" className="w-full bg-stone-100 border-2 border-stone-300 rounded-2xl pl-12 pr-4 py-4 text-2xl font-black text-stone-900 focus:border-brand-light-green transition-all outline-none"
                                    value={newCost.amount} onChange={e => setNewCost(p => ({ ...p, amount: e.target.value }))} />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 block">Keterangan (Opsional)</label>
                        <textarea rows={3} className="w-full bg-stone-100 border-2 border-stone-300 rounded-2xl px-4 py-3 text-sm text-stone-900 focus:border-brand-light-green transition-all outline-none resize-none"
                            placeholder="Contoh: Upah 3 operator atau Beli karung 100pcs..." value={newCost.description} onChange={e => setNewCost(p => ({ ...p, description: e.target.value }))} />
                    </div>
                </div>
            </Modal>
        </div>
    )
}
