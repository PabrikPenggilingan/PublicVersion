import toast from 'react-hot-toast'
import { NumberInput } from '@/components/ui/NumberInput'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Camera, CheckCircle2, Factory, Wheat, Users, Clock, AlertTriangle, Plus, Trash2, Check, Scale } from 'lucide-react'
import { compressImage } from '@/utils/imageCompression'


const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface OutputRow {
    id: string
    category: string
    sacks: string
    packSize: string
    notes: string
}

export default function MillingForm() {
    const { code } = useParams()
    const [info, setInfo] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [showWarningModal, setShowWarningModal] = useState(false)

    // Form State
    const [pic, setPic] = useState('')
    const [crewNames, setCrewNames] = useState('')
    const [notes, setNotes] = useState('')
    const [photos, setPhotos] = useState<File[]>([])
    const [previews, setPreviews] = useState<string[]>([])

    // QC State (for END)
    const [moisture, setMoisture] = useState('')
    const [hardness, setHardness] = useState('Sedang')
    const [brokenRatio, setBrokenRatio] = useState('')

    // Outputs State (for END)
    const [outputs, setOutputs] = useState<OutputRow[]>([
        { id: Math.random().toString(), category: 'BERAS', sacks: '', packSize: '50', notes: '' }
    ])

    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        loadInfo()
    }, [code])

    const loadInfo = async () => {
        try {
            setLoading(true)
            const response = await fetch(`${API_BASE}/milling-forms/${code}`)
            const result = await response.json()
            if (response.ok) {
                setInfo(result.data)
            } else {
                throw new Error(result.message || 'Gagal memuat form')
            }
        } catch (e: any) {
            setError(e.message || 'Gagal memuat form. Link mungkin kadaluarsa.')
        } finally {
            setLoading(false)
        }
    }

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files)
            if (photos.length + newFiles.length > 3) {
                toast.error('Maksimal 3 foto')
                return
            }
            const compressed = await Promise.all(newFiles.map(f => compressImage(f)))
            setPhotos(prev => [...prev, ...compressed])
            const newPreviews = compressed.map(f => URL.createObjectURL(f))
            setPreviews(prev => [...prev, ...newPreviews])
        }
    }

    const removePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index))
        setPreviews(prev => prev.filter((_, i) => i !== index))
    }

    const addOutput = () => {
        setOutputs(prev => [...prev, { id: Math.random().toString(), category: 'BERAS', sacks: '', packSize: '50', notes: '' }])
    }

    const removeOutput = (id: string) => {
        if (outputs.length > 1) {
            setOutputs(prev => prev.filter(o => o.id !== id))
        }
    }

    const updateOutput = (id: string, field: keyof OutputRow, value: string) => {
        setOutputs(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))
    }

    const handleSubmit = async (type: 'START' | 'END' | 'PAUSE', bypassWarning = false) => {

        if (type === 'END') {
            if (outputs.some(o => !o.sacks)) return toast.error('Jumlah karung wajib diisi')
            if (outputs.some(o => parseFloat(o.sacks) < 0)) return toast.error('Jumlah karung tidak boleh negatif')
            if (moisture && parseFloat(moisture) < 0) return toast.error('Kadar air tidak boleh negatif')
            if (brokenRatio && parseFloat(brokenRatio) < 0) return toast.error('Butir pecah tidak boleh negatif')
        }

        if (type === 'END' && !bypassWarning) {
            const totalOut = outputs.reduce((sum, o) => sum + ((parseFloat(o.sacks) || 0) * (parseFloat(o.packSize) || 0)), 0)
            const gabahIn = parseFloat(info?.gabahReservedKg || 0)
            if (totalOut > gabahIn) {
                setShowWarningModal(true)
                return
            }
        }

        try {
            setSubmitting(true)
            const formData = new FormData()
            formData.append('sessionType', type)
            formData.append('pic', pic)
            formData.append('crewNames', crewNames)
            formData.append('notes', notes)
            
            if (type === 'END') {
                formData.append('moistureContent', moisture)
                formData.append('hardnessType', hardness)
                formData.append('brokenRatio', brokenRatio)
                formData.append('outputData', JSON.stringify(outputs.map(o => ({
                    category: o.category,
                    sacks: parseInt(o.sacks),
                    packaging_size_kg: parseFloat(o.packSize),
                    weight_kg: (parseInt(o.sacks) || 0) * (parseFloat(o.packSize) || 0),
                    notes: o.notes
                }))))
            }

            photos.forEach(p => formData.append('photos', p))

            const response = await fetch(`${API_BASE}/milling-forms/${code}/session`, {
                method: 'POST',
                body: formData
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.message || 'Gagal submit form')
            
            setSuccess(true)
        } catch (e: any) {
            toast.error(e.message || 'Gagal submit form')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-stone-900">
                <div className="fixed top-4 right-4 z-[60]">
                    
                </div>
            <div className="w-12 h-12 border-4 border-brand-light-green border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-stone-600">Memvalidasi link...</p>
        </div>
    )

    if (error) return (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-stone-900 text-center">
                <div className="fixed top-4 right-4 z-[60]">
                    
                </div>
            <AlertTriangle className="text-red-500 mb-4" size={64} />
            <h1 className="text-2xl font-bold mb-2">Error</h1>
            <p className="text-stone-600 mb-6">{error}</p>
        </div>
    )

    if (success) return (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-stone-900 text-center">
                <div className="fixed top-4 right-4 z-[60]">
                    
                </div>
            <div className="w-20 h-20 bg-brand-light-green/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="text-brand-light-green" size={48} />
            </div>
            <h1 className="text-3xl font-bold mb-2">Berhasil!</h1>
            <p className="text-stone-600 mb-8">Laporan produksi telah terkirim ke sistem.</p>
            <button onClick={() => window.location.reload()} className="px-8 py-3 text-white bg-brand-light-green hover:bg-brand-light-green/80 rounded-xl font-bold transition-all">
                Kembali
            </button>
        </div>
    )

    const sessions = info.sessions || []
    const hasStarted = sessions.some((s: any) => s.session_type === 'START')
    const hasEnded = sessions.some((s: any) => s.session_type === 'END')

    const inputGabahWeight = parseFloat(info?.gabahReservedKg || 0)
    const totalOutputWeight = outputs.reduce((sum, o) => sum + ((parseFloat(o.sacks) || 0) * (parseFloat(o.packSize) || 0)), 0)
    const isExceeding = hasStarted && totalOutputWeight > inputGabahWeight

    return (
        <div className="min-h-screen bg-stone-50 text-stone-900 pb-20">
                <div className="fixed top-4 right-4 z-[60]">
                    
                </div>
            {/* Header */}
            <div className="bg-stone-100 border-b border-stone-200 p-6 sticky top-0 z-10">
                <div className="flex items-center gap-4 mb-2">
                    <div className="p-3 bg-brand-light-green/20 rounded-2xl">
                        <Factory className="text-brand-light-green" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Produksi Giling</h1>
                        <p className="text-stone-600 text-xs">{info.processNo}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-4 bg-stone-200 p-3 rounded-xl">
                    <Wheat className="text-amber-400" size={16} />
                    <span className="text-sm font-medium">{info.gabahName} • {Number(info.gabahReservedKg).toLocaleString()} kg</span>
                </div>
            </div>

            <div className="p-6 space-y-8 max-w-2xl mx-auto">
                {/* Status Stepper */}
                <div className="flex items-center justify-between px-4">
                    <div className="flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${hasStarted ? 'bg-brand-light-green border-brand-light-green' : 'border-brand-light-green text-brand-light-green'}`}>
                            {hasStarted ? <Check size={20} /> : '1'}
                        </div>
                        <span className="text-xs font-bold">MULAI</span>
                    </div>
                    <div className={`flex-1 h-0.5 mx-2 ${hasStarted ? 'bg-brand-light-green' : 'bg-stone-300'}`}></div>
                    <div className="flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${hasEnded ? 'bg-brand-light-green border-brand-light-green' : 'border-stone-300 text-stone-500'}`}>
                            {hasEnded ? <Check size={20} /> : '2'}
                        </div>
                        <span className="text-xs font-bold">SELESAI</span>
                    </div>
                </div>

                {hasEnded ? (
                    <div className="bg-brand-light-green/10 border border-brand-light-green/20 p-6 rounded-3xl text-center">
                        <CheckCircle2 className="text-brand-light-green mx-auto mb-3" size={48} />
                        <h2 className="text-xl font-bold mb-1">Proses Selesai</h2>
                        <p className="text-stone-600 text-sm">Data produksi sudah masuk ke sistem.</p>
                    </div>
                ) : (
                    <div className="bg-stone-100 border border-stone-200 rounded-3xl p-6 shadow-xl">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            {!hasStarted ? <Users className="text-brand-light-green" /> : <Scale className="text-brand-light-green" />}
                            {!hasStarted ? 'Data Kru & PIC' : 'Laporan Hasil Produksi'}
                        </h2>

                        <div className="space-y-6">
                            {/* Common Fields */}
                            <div>
                                <label className="block text-sm font-bold text-stone-600 mb-2">Nama PIC Operator <span className="text-stone-600 font-normal">(Opsional)</span></label>
                                <input 
                                    className="w-full bg-stone-200 border border-stone-300 rounded-2xl p-4 text-stone-900 focus:outline-none focus:border-brand-light-green"
                                    placeholder="Contoh: Budi Santoso"
                                    value={pic}
                                    onChange={e => setPic(e.target.value)}
                                />
                            </div>

                            {!hasStarted && (
                                <div>
                                    <label className="block text-sm font-bold text-stone-600 mb-2">Nama Kru <span className="text-stone-600 font-normal">(Opsional, Pemisah Koma)</span></label>
                                    <textarea 
                                        className="w-full bg-stone-200 border border-stone-300 rounded-2xl p-4 text-stone-900 focus:outline-none focus:border-brand-light-green resize-none"
                                        placeholder="Sebutkan semua kru yang bertugas..."
                                        rows={3}
                                        value={crewNames}
                                        onChange={e => setCrewNames(e.target.value)}
                                    />
                                </div>
                            )}

                            {hasStarted && (
                                <>
                                    {/* QC Parameters */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-stone-500 mb-1">Kadar Air (%)</label>
                                            <NumberInput  min="0" step="0.1" className="w-full bg-stone-200 border border-stone-300 rounded-xl p-3 text-sm" 
                                                placeholder="0.0" value={moisture} onWheel={(e) => e.currentTarget.blur()} onChange={e => {
                                                    const val = e.target.value;
                                                    if (val.includes('-')) return;
                                                    setMoisture(val);
                                                }} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-stone-500 mb-1">Kekerasan</label>
                                            <select className="w-full bg-stone-200 border border-stone-300 rounded-xl p-3 text-sm"
                                                value={hardness} onChange={e => setHardness(e.target.value)}>
                                                <option>Keras</option>
                                                <option>Sedang</option>
                                                <option>Lunak</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-stone-500 mb-1">Butir Pecah (%)</label>
                                            <NumberInput  min="0" step="1" className="w-full bg-stone-200 border border-stone-300 rounded-xl p-3 text-sm" 
                                                placeholder="0" value={brokenRatio} onWheel={(e) => e.currentTarget.blur()} onChange={e => {
                                                    const val = e.target.value;
                                                    if (val.includes('-')) return;
                                                    setBrokenRatio(val);
                                                }} />
                                        </div>
                                    </div>

                                    {/* Outputs Table */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-sm font-bold text-stone-600">Output Produksi</label>
                                            <button onClick={addOutput} className="text-brand-light-green text-xs font-bold flex items-center gap-1">
                                                <Plus size={14} /> Tambah Jenis
                                            </button>
                                        </div>
                                        
                                        {outputs.map((out, _idx) => (
                                            <div key={out.id} className="bg-stone-200 border border-stone-300 p-4 rounded-2xl relative">
                                                <div className="grid grid-cols-2 gap-3 mb-3">
                                                    <div>
                                                        <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Produk</label>
                                                        <select 
                                                            className="w-full bg-stone-300 border border-stone-400 rounded-lg p-2 text-xs"
                                                            value={out.category}
                                                            onChange={e => updateOutput(out.id, 'category', e.target.value)}
                                                        >
                                                            <option>BERAS</option>
                                                            <option>MENIR</option>
                                                            <option>DEDAK</option>
                                                            <option>SEKAM</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Jml Karung <span className="text-red-500">*</span></label>
                                                        <NumberInput  min="0" className="w-full bg-stone-300 border border-stone-400 rounded-lg p-2 text-xs"
                                                            placeholder="0" value={out.sacks} onWheel={(e) => e.currentTarget.blur()} onChange={e => {
                                                                const val = e.target.value;
                                                                if (val.includes('-')) return;
                                                                updateOutput(out.id, 'sacks', val);
                                                            }} />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Kemasan (kg)</label>
                                                        <select 
                                                            className="w-full bg-stone-300 border border-stone-400 rounded-lg p-2 text-xs"
                                                            value={out.packSize}
                                                            onChange={e => updateOutput(out.id, 'packSize', e.target.value)}
                                                        >
                                                            <option value="50">50 kg</option>
                                                            <option value="25">25 kg</option>
                                                            <option value="10">10 kg</option>
                                                            <option value="5">5 kg</option>
                                                            <option value="1">1 kg (Curah)</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex items-end">
                                                        <div className="bg-stone-300/50 w-full p-2 rounded-lg text-xs font-bold text-brand-light-green text-center">
                                                            Total: {(parseFloat(out.sacks) || 0) * (parseFloat(out.packSize) || 0)} kg
                                                        </div>
                                                    </div>
                                                </div>
                                                {outputs.length > 1 && (
                                                    <button onClick={() => removeOutput(out.id)} className="absolute -top-2 -right-2 bg-red-500/20 text-red-500 p-1.5 rounded-full border border-red-500/20">
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Photos */}
                            <div>
                                <label className="block text-sm font-bold text-stone-600 mb-4">Foto Bukti <span className="font-normal">(Opsional, Maks 3)</span></label>
                                <div className="grid grid-cols-3 gap-3">
                                    {previews.map((src, i) => (
                                        <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-stone-300 relative group">
                                            <img src={src} className="w-full h-full object-cover" />
                                            <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-black/60 p-1 rounded-lg">
                                                <Trash2 size={12} className="text-red-400" />
                                            </button>
                                        </div>
                                    ))}
                                    {previews.length < 3 && (
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="aspect-square rounded-2xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center text-stone-500 hover:border-brand-light-green hover:text-brand-light-green transition-all bg-stone-200/50"
                                        >
                                            <Camera size={24} className="mb-1" />
                                            <span className="text-[10px] font-bold">AMBIL FOTO</span>
                                        </button>
                                    )}
                                </div>
                                <input type="file" hidden ref={fileInputRef} accept="image/*" multiple onChange={handlePhotoChange} />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-bold text-stone-600 mb-2">Catatan Operasional</label>
                                <textarea 
                                    className="w-full bg-stone-200 border border-stone-300 rounded-2xl p-4 text-stone-900 focus:outline-none focus:border-brand-light-green resize-none text-sm"
                                    placeholder="Opsional..."
                                    rows={2}
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                                {isExceeding && (
                                    <div className="mt-3 text-amber-500 text-xs flex gap-2 items-center bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                                        <AlertTriangle size={16} className="shrink-0" />
                                        <p>Peringatan: Total hasil produksi ({totalOutputWeight.toLocaleString()} kg) melebihi berat gabah awal ({inputGabahWeight.toLocaleString()} kg).</p>
                                    </div>
                                )}
                            </div>

                            {/* Submit Buttons */}
                            {!hasStarted ? (
                                <button 
                                    onClick={() => handleSubmit('START')}
                                    disabled={submitting}
                                    className="w-full bg-gradient-to-r text-white from-brand-light-green to-brand-light-green hover:from-brand-light-green hover:to-brand-light-green p-5 rounded-2xl font-bold text-lg shadow-lg shadow-brand-light-green/20 flex items-center justify-center gap-3 disabled:opacity-50 transition-all"
                                >
                                    {submitting ? 'Mengirim...' : (
                                        <>
                                            <Clock size={20} />
                                            MULAI GILING SEKARANG
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <button 
                                        onClick={() => handleSubmit('END')}
                                        disabled={submitting}
                                        className="w-full text-white bg-gradient-to-r from-brand-light-green to-brand-light-green hover:from-brand-light-green hover:to-brand-light-green p-5 rounded-2xl font-bold text-lg shadow-lg shadow-brand-light-green/20 flex items-center justify-center gap-3 disabled:opacity-50 transition-all"
                                    >
                                        {submitting ? 'Mengirim...' : (
                                            <>
                                                <Check size={20} />
                                                SELESAIKAN & KIRIM LAPORAN
                                            </>
                                        )}
                                    </button>
                                    <button 
                                        onClick={() => handleSubmit('PAUSE')}
                                        disabled={submitting}
                                        className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-2xl font-bold flex items-center justify-center gap-2"
                                    >
                                        <Clock size={16} />
                                        LAPORKAN JEDA (PAUSE)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Peringatan */}
            {showWarningModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowWarningModal(false)}></div>
                    <div className="relative bg-stone-200 border border-stone-300 p-6 rounded-2xl w-full max-w-sm shadow-xl animate-in zoom-in duration-200">
                        <div className="flex flex-col items-center text-center">
                            <AlertTriangle size={48} className="text-amber-500 mb-4" />
                            <h2 className="text-xl font-bold text-stone-900 mb-2">Output Berlebih</h2>
                            <p className="text-stone-700 text-sm mb-6">
                                Total berat hasil giling ({totalOutputWeight.toLocaleString()} kg) melebihi berat gabah awal ({inputGabahWeight.toLocaleString()} kg). Apakah Anda yakin data ini sudah benar?
                            </p>
                            <div className="flex w-full gap-3">
                                <button onClick={() => setShowWarningModal(false)} className="flex-1 bg-stone-300 hover:bg-stone-400 p-3 rounded-xl font-bold text-stone-900 transition-all">
                                    Kembali
                                </button>
                                <button onClick={() => {
                                    setShowWarningModal(false)
                                    handleSubmit('END', true)
                                }} className="flex-1 bg-amber-500 hover:bg-amber-600 p-3 rounded-xl font-bold text-stone-900 transition-all">
                                    Tetap Lanjut
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sticky Footer Info */}
            <div className="fixed bottom-0 left-0 right-0 bg-stone-100/80 backdrop-blur-md border-t border-stone-200 p-4 flex justify-around items-center text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                <div className="flex flex-col items-center gap-1">
                    <Clock size={14} className="text-brand-light-green" />
                    <span>Server Sync: Active</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <CheckCircle2 size={14} className="text-brand-light-green" />
                    <span>Secure Link: Verified</span>
                </div>
            </div>
        </div>
    )
}
