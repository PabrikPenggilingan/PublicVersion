import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { getCleanErrorMessage } from '@/errors'
import type { PaymentInput } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import ModalPortal from '@/components/ui/ModalPortal'
import { compressImage } from '@/utils/imageCompression'

interface AddPaymentModalProps {
    onClose: () => void
    refresh: () => void
    // Persists the payment (e.g. salesV2API.createPayment / batchesAPI.createPayment)
    submit: (data: PaymentInput) => Promise<unknown>
    maxAmount?: number
    title?: string
    remainingLabel?: string
    showNotes?: boolean
    notesLabel?: string
    // Render the notes field below Bukti Nota instead of above it
    notesBelowBukti?: boolean
}

export default function AddPaymentModal({
    onClose,
    refresh,
    submit,
    maxAmount,
    title = 'Catat Pembayaran',
    remainingLabel = 'sisa tagihan',
    showNotes = false,
    notesLabel = 'Catatan',
    notesBelowBukti = false
}: AddPaymentModalProps) {
    const [amount, setAmount] = useState('')
    const [method, setMethod] = useState('CASH')
    const [refNo, setRefNo] = useState('')
    const [notes, setNotes] = useState('')
    const [buktiNota, setBuktiNota] = useState<File | null>(null)
    const [buktiPreview, setBuktiPreview] = useState<string>('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleBuktiChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const compressed = await compressImage(file)
        setBuktiNota(compressed)
        const prev = URL.createObjectURL(compressed)
        setBuktiPreview(prev)
    }

    const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
        if (e) e.preventDefault()

        if (!amount) {
            toast.error('Jumlah pembayaran wajib diisi')
            return
        }

        const amountNum = parseFloat(amount) || 0
        if (amountNum <= 0) {
            toast.error('Jumlah pembayaran harus lebih dari 0')
            return
        }

        if (maxAmount !== undefined && amountNum > maxAmount) {
            toast.error(`Jumlah pembayaran tidak boleh melebihi ${remainingLabel} (Rp ${maxAmount.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`)
            return
        }

        try {
            setIsSubmitting(true)
            await submit({
                amount: parseFloat(amount),
                paymentMethod: method,
                paymentDate: new Date().toISOString(),
                referenceNo: refNo,
                notes: showNotes ? notes : undefined,
                buktiNota: buktiNota || null
            })
            toast.success('Pembayaran dicatat')
            refresh()
            onClose()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err))
        } finally {
            setIsSubmitting(false)
        }
    }

    const notesField = (
        <div>
            <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
                {notesLabel} <span className="text-stone-500 font-normal normal-case">(Opsional)</span>
            </label>
            <textarea
                className="w-full bg-stone-100 border border-stone-300 text-stone-900 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-brand-light-green"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={notesBelowBukti ? 'Misal: Pelunasan via transfer BCA' : 'Misal: Cicilan ke-1 ke petani'}
            />
        </div>
    )

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
                <div className="relative bg-stone-200 border border-stone-300 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6 animate-in zoom-in duration-200">
                    <h2 className="text-xl font-bold text-stone-900 mb-6">{title}</h2>
                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Jumlah Pembayaran (Rp)</label>
                            <CurrencyInput value={amount} onChange={(val: string) => setAmount(val)} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Metode</label>
                                <select
                                    className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg px-4 py-2 text-sm"
                                    value={method}
                                    onChange={e => setMethod(e.target.value)}
                                >
                                    <option value="CASH">Tunai</option>
                                    <option value="TRANSFER">Transfer</option>
                                    <option value="GIRO">Giro</option>
                                    <option value="CEK">Cek</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">No. Referensi</label>
                                <Input value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Misal: No Struk / Ref Bank" />
                            </div>
                        </div>

                        {showNotes && !notesBelowBukti && notesField}

                        {/* Bukti Nota - Optional */}
                        <div>
                            <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
                                Bukti Nota <span className="text-stone-500 font-normal normal-case">(Opsional)</span>
                            </label>
                            {buktiPreview ? (
                                <div className="relative rounded-xl overflow-hidden border border-stone-300 mb-2">
                                    <img src={buktiPreview} alt="Bukti Nota" className="w-full max-h-48 object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => { setBuktiNota(null); setBuktiPreview('') }}
                                        className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 rounded-full w-7 h-7 flex items-center justify-center text-stone-900 text-sm font-bold"
                                    >×</button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-stone-400 hover:border-amber-500 rounded-xl p-4 cursor-pointer transition-colors">
                                    <span className="text-2xl">📷</span>
                                    <span className="text-xs text-stone-600">Tap untuk upload foto nota</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={handleBuktiChange}
                                    />
                                </label>
                            )}
                        </div>

                        {showNotes && notesBelowBukti && notesField}

                        <div className="pt-2 flex gap-3">
                            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Batal</Button>
                            <Button type="button" onClick={handleSubmit} className="flex-1 bg-brand-light-green text-white" disabled={isSubmitting}>Simpan Bayar</Button>
                        </div>
                    </form>
                </div>
            </div>
        </ModalPortal>
    )
}
