import toast from 'react-hot-toast'
import { NumberInput } from '@/components/ui/NumberInput'
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { dryingFormsAPI } from '@/api/client'
import { Sun, Camera, Check, Clock, ArrowRight, X, AlertCircle, Scale, Package, ToggleLeft, ToggleRight, Minus, Plus } from 'lucide-react'
import { compressImage } from '@/utils/imageCompression'

interface FormInfo {
    linkCode: string
    employeeName: string
    dryingId: string
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
    totalTonnage: number
    batches: Array<{ batch_date: string; tonnage_kg: number }>
    sessions: Array<{
        session_type: 'START' | 'END';
        pic: string;
        moisture_content?: number;
        tonnage_kg?: number;
        session_date?: string;
        session_time?: string;
        people_involved?: string;
    }>
}



interface SessionForm {
    peopleCount: string
    peopleNames: string
    sessionDate: string
    sessionTime: string
    moistureContent: string
    tonnageKg: string
}

interface Summary {
    startPic: string
    endPic: string
    startPeopleInvolved: string
    endPeopleInvolved: string
    startSessionDate: string
    startSessionTime: string
    endSessionDate: string
    endSessionTime: string
    duration: string
    durationMs: number
    totalTonnage: number
    moistureBefore?: number
    moistureAfter?: number
    moistureDifference?: string
    tonnageBefore?: number
    tonnageAfter?: number
}

const getInitialForm = (): SessionForm => ({
    peopleCount: '1',
    peopleNames: '',
    sessionDate: new Date().toISOString().split('T')[0],
    sessionTime: new Date().toTimeString().slice(0, 5),
    moistureContent: '',
    tonnageKg: ''
})

export default function DryingForm() {
    const { linkCode } = useParams<{ linkCode: string }>()
    // Opened from "Input Admin" in Detail Pengeringan: no approval needed after Selesai
    const [searchParams] = useSearchParams()
    const isAdminInput = searchParams.get('mode') === 'admin'
    const navigate = useNavigate()
    const { user } = useAuth()

    const [formInfo, setFormInfo] = useState<FormInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Current step: 1 = Start, 2 = End, 3 = Summary
    const [currentStep, setCurrentStep] = useState(1)

    // Input mode for berat sebelum

    const [inputMode, setInputMode] = useState<'manual' | 'batch'>('manual')

    // Form states - fresh each time
    const [startForm, setStartForm] = useState<SessionForm>(getInitialForm())
    const [endForm, setEndForm] = useState<SessionForm>(getInitialForm())
    const [startPhotos, setStartPhotos] = useState<File[]>([])
    const [endPhotos, setEndPhotos] = useState<File[]>([])
    const [summary, setSummary] = useState<Summary | null>(null)

    const [submitting, setSubmitting] = useState(false)
    const [submitSuccess, setSubmitSuccess] = useState(false)

    const currentStepRef = useRef(currentStep)
    useEffect(() => {
        currentStepRef.current = currentStep
    }, [currentStep])

    const formInfoRef = useRef(formInfo)
    useEffect(() => {
        formInfoRef.current = formInfo
    }, [formInfo])

    useEffect(() => {
        if (linkCode) {
            loadFormInfo()
            const interval = setInterval(() => {
                loadFormInfo(true)
            }, 5000)
            return () => clearInterval(interval)
        }
    }, [linkCode])



    const loadFormInfo = async (silent = false) => {
        try {
            if (!silent) {
                setLoading(true)
                setError('')
            }
            const response = await dryingFormsAPI.getFormInfo(linkCode!)
            const info = response.data as FormInfo
            const isInitialLoad = !formInfoRef.current
            setFormInfo(info)

            // Determine current step based on existing sessions
            const hasStart = info.sessions?.some(s => s.session_type === 'START')
            const hasEnd = info.sessions?.some(s => s.session_type === 'END')
            const newStep = hasEnd ? 3 : hasStart ? 2 : 1
            const prevStep = currentStepRef.current

            if (isInitialLoad || newStep !== prevStep) {
                if (!isInitialLoad && (prevStep === 3 || prevStep === 2) && newStep === 1) {
                    toast.error('Proses pengeringan ini direject oleh admin. Form direset ke langkah awal.')
                }
                setCurrentStep(newStep)
                if (newStep === 1 && (!isInitialLoad || prevStep !== 1)) {
                    setStartForm(getInitialForm())
                    setStartPhotos([])
                } else if (newStep === 2 && (!isInitialLoad || prevStep !== 2)) {
                    setEndForm(getInitialForm())
                    setEndPhotos([])
                } else if (newStep === 3) {
                    loadSummary()
                }
            }
        } catch (err) {
            console.error('Failed to load form info:', err)
            if (!silent) {
                setError(err instanceof Error ? err.message : 'Gagal memuat form')
            }
        } finally {
            if (!silent) {
                setLoading(false)
            }
        }
    }


    const loadSummary = async () => {
        try {
            const response = await dryingFormsAPI.getSummary(linkCode!)
            setSummary(response.data as Summary)
        } catch (err) {
            console.error('Failed to load summary:', err)
        }
    }


    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, step: 'start' | 'end') => {
        const files = Array.from(e.target.files || [])
        const compressed = await Promise.all(files.map(f => compressImage(f)))
        if (step === 'start') {
            setStartPhotos(prev => [...prev, ...compressed].slice(0, 3))
        } else {
            setEndPhotos(prev => [...prev, ...compressed].slice(0, 3))
        }
        // Reset input
        e.target.value = ''
    }

    const removePhoto = (index: number, step: 'start' | 'end') => {
        if (step === 'start') {
            setStartPhotos(prev => prev.filter((_, i) => i !== index))
        } else {
            setEndPhotos(prev => prev.filter((_, i) => i !== index))
        }
    }
    const handleSubmitStart = async () => {
        try {
            setSubmitting(true)

            // Extract first name for mandatory PIC field
            const names = startForm.peopleNames.split(/[,\n]/).map(n => n.trim()).filter(Boolean)
            const pic = names[0] || 'Unknown'
            const peopleInvolved = `${startForm.peopleCount} orang: ${startForm.peopleNames}`

            await dryingFormsAPI.submitStart(linkCode!, {
                pic,
                peopleInvolved,
                sessionDate: startForm.sessionDate,
                sessionTime: startForm.sessionTime,
                moistureContent: startForm.moistureContent || null,
                tonnageKg: startForm.tonnageKg,
                batchId: null
            }, startPhotos)

            setSubmitSuccess(true)
            setTimeout(async () => {
                setSubmitSuccess(false)
                await loadFormInfo() // Reload to get the new START session data
                setCurrentStep(2)
                // Reset end form for fresh input
                setEndForm(getInitialForm())
                setEndPhotos([])
                setInputMode('manual')
            }, 1500)
        } catch (err) {
            console.error('Failed to submit start:', err)
            toast.error(err instanceof Error ? err.message : 'Gagal submit')
        } finally {
            setSubmitting(false)
        }
    }
    const handleSubmitEnd = async () => {
        // Use tonnage from START session (per user request)
        const startSession = formInfo?.sessions?.find(s => s.session_type === 'START')
        const tonnageKg = startSession?.tonnage_kg?.toString() || formInfo?.totalTonnage?.toString() || '0'

        try {
            setSubmitting(true)

            // Extract first name for mandatory PIC field
            const names = endForm.peopleNames.split(/[,\n]/).map(n => n.trim()).filter(Boolean)
            const pic = names[0] || 'Unknown'
            const peopleInvolved = `${endForm.peopleCount} orang: ${endForm.peopleNames}`

            await dryingFormsAPI.submitEnd(linkCode!, {
                pic,
                peopleInvolved,
                sessionDate: endForm.sessionDate,
                sessionTime: endForm.sessionTime,
                moistureContent: endForm.moistureContent || null,
                tonnageKg: tonnageKg
            }, endPhotos, isAdminInput)

            if (isAdminInput) toast.success('Pengeringan selesai dan langsung disetujui (Input Admin)')
            setSubmitSuccess(true)
            setTimeout(async () => {
                setSubmitSuccess(false)
                setCurrentStep(3)
                await loadSummary()
            }, 1500)
        } catch (err) {
            console.error('Failed to submit end:', err)
            toast.error(err instanceof Error ? err.message : 'Gagal submit')
        } finally {
            setSubmitting(false)
        }
    }

    // Input Mode Toggle Component
    const InputModeToggle = ({ currentMode, onToggle }: { currentMode: 'manual' | 'batch', onToggle: (mode: 'manual' | 'batch') => void }) => (
        <div className="bg-stone-300/50 border border-stone-400 rounded-xl p-3 mb-4">
            <p className="text-xs text-stone-600 mb-2">Sumber Data</p>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => onToggle('manual')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${currentMode === 'manual'
                        ? 'bg-amber-500 text-white'
                        : 'bg-stone-400 text-stone-700 hover:bg-stone-500'
                        }`}
                >
                    {currentMode === 'manual' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    Input Manual
                </button>
                <button
                    type="button"
                    onClick={() => onToggle('batch')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${currentMode === 'batch'
                        ? 'bg-brand-light-green text-white'
                        : 'bg-stone-400 text-stone-700 hover:bg-stone-500'
                        }`}
                >
                    <Package size={16} />
                    Dari Batch
                </button>
            </div>
        </div>
    )



    if (loading) {
        return (
            <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
                <div className="fixed top-4 right-4 z-[60]">
                    
                </div>
                <div className="text-center">
                    <div className="spinner mb-4"></div>
                    <p className="text-stone-600 text-sm">Memuat form...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
                <div className="fixed top-4 right-4 z-[60]">
                    
                </div>
                <div className="text-center max-w-sm w-full">
                    <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="text-red-400" size={32} />
                    </div>
                    <h1 className="text-lg font-bold mb-2">Gagal Memuat</h1>
                    <p className="text-stone-600 text-sm mb-6">{error}</p>
                    <button
                        onClick={() => loadFormInfo()}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 rounded-xl text-sm font-medium transition-colors"
                    >
                        Coba Lagi
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-stone-100 py-6 px-4">
                <div className="fixed top-4 right-4 z-[60]">
                    
                </div>
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Sun size={28} className="text-stone-900" />
                    </div>
                    <h1 className="text-lg font-bold">Form Pengeringan</h1>
                    {isAdminInput && (
                        <span className="inline-block mt-2 text-[11px] font-bold bg-brand-light-green/15 text-brand-light-green border border-brand-light-green/30 px-2.5 py-1 rounded-full">
                            Input Admin — langsung disetujui setelah Selesai
                        </span>
                    )}
                </div>

                {/* Info Card */}
                <div className="bg-stone-200 border border-stone-300 rounded-xl p-4 mb-5">
                    <div className="flex items-center justify-between">
                        <span className="text-stone-600 text-sm">Total dari Batch</span>
                        <span className="font-bold">{Number(formInfo?.totalTonnage || 0).toLocaleString()} kg</span>
                    </div>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-center mb-6">
                    {[1, 2, 3].map(step => (
                        <div key={step} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step < currentStep
                                ? 'bg-brand-light-green text-stone-900'
                                : step === currentStep
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-stone-300 text-stone-500'
                                }`}>
                                {step < currentStep ? <Check size={14} /> : step}
                            </div>
                            {step < 3 && (
                                <div className={`w-8 h-0.5 ${step < currentStep ? 'bg-brand-light-green' : 'bg-stone-300'}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step 1: Start */}
                {currentStep === 1 && (
                    <div className="bg-stone-200 border border-stone-300 rounded-xl p-5">
                        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <Clock className="text-amber-400" size={18} />
                            Mulai Pengeringan
                        </h2>

                        <div className="space-y-4">
                            {/* People Info Section - Redesigned */}
                            <div className="bg-stone-300/30 border border-stone-300 rounded-xl p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-3 ml-1">Informasi Pekerja</p>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div className="md:col-span-5">
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                                            Jumlah Orang <span className="text-stone-600 font-normal">(Opsional)</span>
                                        </label>
                                        <div className="flex items-center bg-stone-200 border border-stone-400 rounded-xl overflow-hidden h-[46px] shadow-inner">
                                            <button
                                                type="button"
                                                onClick={() => setStartForm(prev => ({ ...prev, peopleCount: String(Math.max(1, (parseInt(prev.peopleCount) || 1) - 1)) }))}
                                                className="w-12 shrink-0 h-full flex items-center justify-center hover:bg-stone-300 text-stone-600 active:scale-90 transition-transform"
                                            >
                                                <Minus size={16} />
                                            </button>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                className="min-w-0 flex-1 bg-transparent text-center font-bold text-amber-400 focus:outline-none px-2"
                                                value={startForm.peopleCount}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/[^0-9]/g, '')
                                                    const sanitizedVal = val.length > 1 ? val.replace(/^0+/, '') : val
                                                    setStartForm(prev => ({ ...prev, peopleCount: sanitizedVal }))
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setStartForm(prev => ({ ...prev, peopleCount: String((parseInt(prev.peopleCount) || 0) + 1) }))}
                                                className="w-12 shrink-0 h-full flex items-center justify-center hover:bg-stone-300 text-stone-600 active:scale-90 transition-transform"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="md:col-span-7">
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                                            Daftar Nama <span className="text-stone-600 font-normal">(Opsional)</span>
                                        </label>
                                        <textarea
                                            className="w-full px-4 py-2.5 bg-stone-200 border border-stone-400 rounded-xl text-sm focus:outline-none focus:border-amber-500 shadow-inner min-h-[46px] resize-none"
                                            placeholder="Tulis nama-nama (pisahkan dengan koma atau enter)..."
                                            value={startForm.peopleNames}
                                            onChange={(e) => setStartForm(prev => ({ ...prev, peopleNames: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Tanggal</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-3 bg-stone-300 border border-stone-400 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                                        value={startForm.sessionDate}
                                        onChange={(e) => setStartForm(prev => ({ ...prev, sessionDate: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Jam</label>
                                    <input
                                        type="time"
                                        className="w-full px-3 py-3 bg-stone-300 border border-stone-400 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                                        value={startForm.sessionTime}
                                        onChange={(e) => setStartForm(prev => ({ ...prev, sessionTime: e.target.value }))}
                                    />
                                </div>
                            </div>

                            {/* Input Mode Toggle */}
                            <InputModeToggle
                                currentMode={inputMode}
                                onToggle={(mode) => {
                                    setInputMode(mode)
                                    if (mode === 'manual') {
                                        setStartForm(prev => ({ ...prev, tonnageKg: '' }))
                                    } else if (mode === 'batch') {
                                        setStartForm(prev => ({ ...prev, tonnageKg: String(formInfo?.totalTonnage || '') }))
                                    }
                                }}
                            />

                            <div>
                                <label className="block text-sm font-medium mb-1.5">
                                    Berat Sebelum (kg) <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <Scale size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
                                    <NumberInput

                                        className="w-full pl-10 pr-4 py-3 bg-stone-300 border border-stone-400 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                                        placeholder="Contoh: 5000"
                                        value={startForm.tonnageKg}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        onChange={(e) => setStartForm(prev => ({ ...prev, tonnageKg: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5">
                                    Kadar Air (%) <span className="text-stone-500 text-xs">opsional</span>
                                </label>
                                <NumberInput

                                    step="0.1"
                                    className="w-full px-4 py-3 bg-stone-300 border border-stone-400 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                                    placeholder="Contoh: 18.5"
                                    value={startForm.moistureContent}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={(e) => setStartForm(prev => ({ ...prev, moistureContent: e.target.value }))}
                                />
                            </div>

                            {/* Photos */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5">
                                    Foto <span className="text-stone-600 font-normal">(Opsional)</span>
                                    <span className="text-stone-500 font-normal text-xs ml-1">(1-3)</span>
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {startPhotos.map((photo, index) => (
                                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                                            <img src={URL.createObjectURL(photo)} alt="" className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => removePhoto(index, 'start')}
                                                className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {startPhotos.length < 3 && (
                                        <label className="aspect-square rounded-lg border-2 border-dashed border-stone-400 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 transition-colors">
                                            <Camera size={20} className="text-stone-500 mb-1" />
                                            <span className="text-xs text-stone-500">Foto</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handlePhotoChange(e, 'start')}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={handleSubmitStart}
                                disabled={submitting}
                                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {submitting ? 'Menyimpan...' : submitSuccess ? (
                                    <><Check size={18} /> Berhasil!</>
                                ) : (
                                    <><Sun size={18} /> Mulai Pengeringan</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: End */}
                {currentStep === 2 && (
                    <div className="bg-stone-200 border border-stone-300 rounded-xl p-5">
                        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <Check className="text-brand-light-green" size={18} />
                            Selesai Pengeringan
                        </h2>

                        <div className="space-y-4">
                            {/* People Info Section - Redesigned */}
                            <div className="bg-stone-300/30 border border-stone-300 rounded-xl p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-3 ml-1">Informasi Pekerja</p>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div className="md:col-span-5">
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                                            Jumlah Orang <span className="text-stone-600 font-normal">(Opsional)</span>
                                        </label>
                                        <div className="flex items-center bg-stone-200 border border-stone-400 rounded-xl overflow-hidden h-[46px] shadow-inner">
                                            <button
                                                type="button"
                                                onClick={() => setEndForm(prev => ({ ...prev, peopleCount: String(Math.max(1, (parseInt(prev.peopleCount) || 1) - 1)) }))}
                                                className="w-12 shrink-0 h-full flex items-center justify-center hover:bg-stone-300 text-stone-600 active:scale-90 transition-transform"
                                            >
                                                <Minus size={16} />
                                            </button>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                className="min-w-0 flex-1 bg-transparent text-center font-bold text-amber-400 focus:outline-none px-2"
                                                value={endForm.peopleCount}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/[^0-9]/g, '')
                                                    const sanitizedVal = val.length > 1 ? val.replace(/^0+/, '') : val
                                                    setEndForm(prev => ({ ...prev, peopleCount: sanitizedVal }))
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setEndForm(prev => ({ ...prev, peopleCount: String((parseInt(prev.peopleCount) || 0) + 1) }))}
                                                className="w-12 shrink-0 h-full flex items-center justify-center hover:bg-stone-300 text-stone-600 active:scale-90 transition-transform"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="md:col-span-7">
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-2">
                                            Daftar Nama
                                        </label>
                                        <textarea
                                            className="w-full px-4 py-2.5 bg-stone-200 border border-stone-400 rounded-xl text-sm focus:outline-none focus:border-amber-500 shadow-inner min-h-[46px] resize-none"
                                            placeholder="Tulis nama-nama (pisahkan dengan koma atau enter)..."
                                            value={endForm.peopleNames}
                                            onChange={(e) => setEndForm(prev => ({ ...prev, peopleNames: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Tanggal</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-3 bg-stone-300 border border-stone-400 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                                        value={endForm.sessionDate}
                                        onChange={(e) => setEndForm(prev => ({ ...prev, sessionDate: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Jam</label>
                                    <input
                                        type="time"
                                        className="w-full px-3 py-3 bg-stone-300 border border-stone-400 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                                        value={endForm.sessionTime}
                                        onChange={(e) => setEndForm(prev => ({ ...prev, sessionTime: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="bg-brand-light-green/10 border border-brand-light-green/20 rounded-xl p-4 mb-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Scale size={16} className="text-brand-light-green" />
                                        <span className="text-sm font-medium text-brand-light-green text-xs uppercase tracking-wider">Berat Selesai</span>
                                    </div>
                                    <span className="font-bold text-lg text-brand-light-green">
                                        {Number(formInfo?.sessions?.find(s => s.session_type === 'START')?.tonnage_kg || formInfo?.totalTonnage || 0).toLocaleString()} kg
                                    </span>
                                </div>
                                <p className="text-[10px] text-brand-light-green/60 mt-1 italic">* Menggunakan data berat dari awal pengeringan</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5">
                                    Kadar Air (%) <span className="text-stone-500 text-xs">opsional</span>
                                </label>
                                <NumberInput

                                    step="0.1"
                                    className="w-full px-4 py-3 bg-stone-300 border border-stone-400 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                                    placeholder="Contoh: 14.0"
                                    value={endForm.moistureContent}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={(e) => setEndForm(prev => ({ ...prev, moistureContent: e.target.value }))}
                                />
                                {(() => {
                                    const startSession = formInfo?.sessions?.find(s => s.session_type === 'START')
                                    const startMoisture = startSession?.moisture_content != null ? Number(startSession.moisture_content) : null
                                    const endMoisture = endForm.moistureContent ? parseFloat(endForm.moistureContent) : null
                                    if (startMoisture != null && endMoisture != null && !isNaN(startMoisture) && !isNaN(endMoisture) && endMoisture >= startMoisture) {
                                        return (
                                            <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1 font-medium">
                                                <span>⚠️ Kadar air akhir ({endMoisture}%) harus lebih rendah dari kadar air awal ({startMoisture}%)</span>
                                            </p>
                                        )
                                    }
                                    return null
                                })()}
                            </div>

                            {/* Photos */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5">
                                    Foto <span className="text-stone-600 font-normal">(Opsional)</span>
                                    <span className="text-stone-500 font-normal text-xs ml-1">(1-3)</span>
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {endPhotos.map((photo, index) => (
                                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                                            <img src={URL.createObjectURL(photo)} alt="" className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => removePhoto(index, 'end')}
                                                className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {endPhotos.length < 3 && (
                                        <label className="aspect-square rounded-lg border-2 border-dashed border-stone-400 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 transition-colors">
                                            <Camera size={20} className="text-stone-500 mb-1" />
                                            <span className="text-xs text-stone-500">Foto</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handlePhotoChange(e, 'end')}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={handleSubmitEnd}
                                disabled={submitting}
                                className="w-full py-3.5 bg-gradient-to-r from-brand-light-green to-brand-light-green hover:from-brand-light-green hover:to-brand-light-green text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {submitting ? 'Menyimpan...' : submitSuccess ? (
                                    <><Check size={18} /> Berhasil!</>
                                ) : (
                                    <><Check size={18} /> Selesai</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Summary */}
                {currentStep === 3 && (
                    <div className="bg-stone-200 border border-stone-300 rounded-xl p-5">
                        <div className="text-center mb-5">
                            <div className="w-14 h-14 bg-brand-light-green/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Check className="text-brand-light-green" size={28} />
                            </div>
                            <h2 className="text-base font-semibold">Selesai!</h2>
                            <p className="text-stone-600 text-xs">Ringkasan pengeringan</p>
                        </div>

                        {summary ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* PIC Card */}
                                    <div className="bg-stone-300/50 border border-stone-400 rounded-xl p-4">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-3">Penanggung Jawab</p>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-stone-600">Dimulai Oleh</span>
                                                <span className="text-sm font-semibold text-amber-400">{summary.startPic}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-2 border-t border-stone-400/50">
                                                <span className="text-xs text-stone-600">Selesai Oleh</span>
                                                <span className="text-sm font-semibold text-brand-light-green">{summary.endPic}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Duration Card */}
                                    <div className="bg-stone-300/50 border border-stone-400 rounded-xl p-4">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-3">Waktu & Durasi</p>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-center">
                                                <div className="flex flex-col flex-1">
                                                    <span className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Mulai</span>
                                                    <span className="text-sm font-bold text-stone-900">
                                                        {summary.startSessionTime || formInfo?.sessions?.find(s => s.session_type === 'START')?.session_time?.slice(0, 5) || '--:--'}
                                                    </span>
                                                </div>
                                                <div className="h-8 w-px bg-stone-400 mx-2 opacity-50"></div>
                                                <div className="flex flex-col flex-1">
                                                    <span className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Selesai</span>
                                                    <span className="text-sm font-bold text-stone-900">
                                                        {summary.endSessionTime || formInfo?.sessions?.find(s => s.session_type === 'END')?.session_time?.slice(0, 5) || '--:--'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="pt-3 border-t border-stone-400/50 flex justify-between items-center">
                                                <span className="text-xs text-stone-600">Total Durasi</span>
                                                <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/20">
                                                    <Clock size={12} className="text-amber-500" />
                                                    <span className="text-xs font-bold text-amber-500">
                                                        {(() => {
                                                            if (summary.duration && !summary.duration.includes('NaN')) return summary.duration;

                                                            const start = formInfo?.sessions?.find(s => s.session_type === 'START');
                                                            const end = formInfo?.sessions?.find(s => s.session_type === 'END');

                                                            if (start?.session_date && start?.session_time && end?.session_date && end?.session_time) {
                                                                const startTime = new Date(`${start.session_date.split('T')[0]}T${start.session_time}`);
                                                                const endTime = new Date(`${end.session_date.split('T')[0]}T${end.session_time}`);
                                                                const diff = endTime.getTime() - startTime.getTime();

                                                                if (isNaN(diff) || diff < 0) return '0j 0m';

                                                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                                                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                                return `${hours}j ${minutes}m`;
                                                            }
                                                            return '--:--';
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Moisture Card */}
                                    <div className="bg-stone-300/50 border border-stone-400 rounded-xl p-4">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-3">Kadar Air (KA)</p>
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="text-center">
                                                <span className="block text-[10px] text-stone-500 uppercase mb-1">Awal</span>
                                                <span className="text-lg font-bold text-amber-400">{summary.moistureBefore}%</span>
                                            </div>
                                            <ArrowRight size={16} className="text-stone-400" />
                                            <div className="text-center">
                                                <span className="block text-[10px] text-stone-500 uppercase mb-1">Akhir</span>
                                                <span className="text-lg font-bold text-brand-light-green">{summary.moistureAfter}%</span>
                                            </div>
                                            <div className="ml-auto text-right">
                                                <div className="inline-flex flex-col items-end">
                                                    <span className="text-[9px] text-stone-500 uppercase">Penyusutan</span>
                                                    <span className="text-sm font-bold text-brand-light-green">-{summary.moistureDifference}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tonnage / W2 Calculation Card */}
                                    <div className="bg-brand-light-green/5 border border-brand-light-green/20 rounded-xl p-4">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-light-green/70 mb-3 flex items-center gap-1.5">
                                            <Scale size={12} /> Penyusutan (Shrinkage)
                                        </p>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <span className="block text-[10px] text-stone-500 uppercase mb-1">Penyusutan (%)</span>
                                                    <span className="text-2xl font-black text-brand-light-green">
                                                        {(() => {
                                                            const w1 = Number(summary.tonnageBefore) || 0
                                                            const moistureBefore = summary.moistureBefore;
                                                            const moistureAfter = summary.moistureAfter;

                                                            if (moistureBefore == null || moistureAfter == null || w1 === 0) return '0'

                                                            const x1 = moistureBefore / 100
                                                            const x2 = moistureAfter / 100

                                                            if (x2 >= 1) return '0'

                                                            const w2 = w1 * (1 - x1) / (1 - x2)
                                                            const tonnageDiff = w1 - w2
                                                            const percentShrink = (tonnageDiff / w1) * 100
                                                            return percentShrink.toFixed(1)
                                                        })()} <span className="text-xs font-normal text-stone-500">%</span>
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-[10px] text-stone-500 uppercase mb-1">Susut (KG)</span>
                                                    <span className="text-lg font-bold text-brand-light-green/70">
                                                    {(() => {
                                                        const w1 = Number(summary.tonnageBefore) || 0
                                                        const moistureBefore = summary.moistureBefore;
                                                        const moistureAfter = summary.moistureAfter;

                                                        let w2 = w1;
                                                        if (moistureBefore != null && moistureAfter != null) {
                                                            const x1 = moistureBefore / 100;
                                                            const x2 = moistureAfter / 100;
                                                            if (x2 < 1) {
                                                                w2 = w1 * (1 - x1) / (1 - x2);
                                                            }
                                                        }
                                                        const diff = Math.round(w1 - w2)
                                                        return diff > 0 ? `-${Math.abs(diff).toLocaleString('id-ID')}` : `+${Math.abs(diff).toLocaleString('id-ID')}`
                                                    })()} <span className="text-xs font-normal text-stone-500">kg</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        if (user) {
                                            navigate('/dashboard')
                                        } else {
                                            window.location.reload()
                                        }
                                    }}
                                    className="w-full mt-4 py-3 bg-stone-300 hover:bg-stone-400 border border-stone-400 text-stone-900 font-medium rounded-xl transition-all shadow-lg active:scale-95"
                                >
                                    Kembali ke Dashboard
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <div className="spinner mx-auto"></div>
                                <p className="text-stone-600 text-xs mt-2">Memuat...</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
