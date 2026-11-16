import { useState, useEffect } from 'react'
import { NumberInput } from '@/components/ui/NumberInput'
import { getCleanErrorMessage } from '@/errors'
import { financeAPI, purchasesAPI } from '@/api/client'
import { Wallet, Search, Filter, Calendar, DollarSign, ChevronLeft, CreditCard } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'

export default function DebtManager() {
    const [purchases, setPurchases] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedPurchase, setSelectedPurchase] = useState<any>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [filters, setFilters] = useState({
        paymentStatus: 'UNPAID',
        calo: ''
    })
    
    const [formData, setFormData] = useState({
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        amount: '',
        paymentMethod: 'CASH',
        financeAccountId: '',
        referenceNo: '',
        notes: ''
    })

    useEffect(() => {
        loadPurchases()
        loadAccounts()
    }, [filters])

    const loadPurchases = async () => {
        try {
            setLoading(true)
            // Need to update purchasesAPI.getAll in client.ts
            const res = await (purchasesAPI as any).getAll(filters)
            setPurchases(res.data)
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    const loadAccounts = async () => {
        try {
            const res = await financeAPI.getAccounts({ category: 'ASSET' })
            setAccounts(res.data)
            if (res.data.length > 0 && !formData.financeAccountId) {
                setFormData(prev => ({ ...prev, financeAccountId: res.data[0].id }))
            }
        } catch (err: any) {
            console.error(err)
        }
    }

    const handleOpenPayment = (purchase: any) => {
        setSelectedPurchase(purchase)
        setFormData(prev => ({
            ...prev,
            amount: (purchase.total_harga - purchase.paid_amount).toString()
        }))
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedPurchase) return

        try {
            setIsSubmitting(true)
            await financeAPI.recordPurchasePayment({
                purchaseId: selectedPurchase.id,
                ...formData,
                financeAccountId: formData.financeAccountId || undefined,
                amount: parseFloat(formData.amount || '0')
            })
            toast.success('Pembayaran berhasil dicatat')
            setIsModalOpen(false)
            loadPurchases()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err))
        } finally {
            setIsSubmitting(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/finance" className="p-2 bg-stone-200 hover:bg-stone-300 text-stone-900 rounded-xl transition-all">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Debt Manager (Hutang)</h1>
                        <p className="text-stone-600 text-sm">Kelola pelunasan pembelian gabah ke supplier/calo.</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-stone-200 border border-stone-300 p-4 rounded-2xl flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                    <input 
                        type="text" 
                        placeholder="Cari nama calo..." 
                        className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-brand-light-green transition-all"
                        value={filters.calo}
                        onChange={e => setFilters({ ...filters, calo: e.target.value })}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-stone-500" />
                    <select 
                        className="bg-stone-100 border-stone-300 text-stone-900 rounded-xl px-4 py-2 text-sm focus:ring-brand-light-green"
                        value={filters.paymentStatus}
                        onChange={e => setFilters({ ...filters, paymentStatus: e.target.value })}
                    >
                        <option value="UNPAID">Belum Bayar</option>
                        <option value="PARTIAL">Cicilan</option>
                        <option value="PAID">Lunas</option>
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 flex justify-center">
                        <div className="spinner"></div>
                    </div>
                ) : purchases.length > 0 ? purchases.map(p => (
                    <div key={p.id} className="bg-stone-200 border border-stone-300 rounded-2xl overflow-hidden hover:border-brand-light-green/30 transition-all group">
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-stone-900 font-bold text-lg leading-tight">{p.calo}</h3>
                                    <p className="text-stone-500 text-xs mt-1 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {format(new Date(p.tanggal_belanja), 'd MMM yyyy', { locale: id })}
                                    </p>
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                                    p.payment_status === 'PAID' ? 'bg-brand-light-green/10 text-brand-light-green' : 
                                    p.payment_status === 'PARTIAL' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                    {p.payment_status}
                                </span>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-stone-300/50">
                                <div className="flex justify-between text-sm">
                                    <span className="text-stone-600">Total Harga</span>
                                    <span className="text-stone-900 font-bold">{formatCurrency(p.total_harga)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-brand-light-green/80">
                                    <span>Sudah Dibayar</span>
                                    <span>{formatCurrency(p.paid_amount || 0)}</span>
                                </div>
                                <div className="flex justify-between text-base pt-1 border-t border-stone-300/30">
                                    <span className="text-stone-600 font-medium">Sisa Hutang</span>
                                    <span className="text-rose-400 font-black">{formatCurrency(p.total_harga - (p.paid_amount || 0))}</span>
                                </div>
                            </div>

                            {p.payment_status !== 'PAID' && (
                                <button 
                                    onClick={() => handleOpenPayment(p)}
                                    className="w-full bg-stone-300 hover:bg-brand-light-green/80 text-stone-900 font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <CreditCard className="w-4 h-4" />
                                    Bayar Cicilan
                                </button>
                            )}
                        </div>
                    </div>
                )) : (
                    <div className="col-span-full py-20 text-center text-stone-500 bg-stone-200 border border-stone-300 rounded-2xl">
                        Tidak ada data hutang yang ditemukan.
                    </div>
                )}
            </div>

            {/* Modal Pembayaran */}
            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title="Pelunasan Hutang"
            >
                {selectedPurchase && (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-stone-100 p-4 rounded-xl border border-stone-300 mb-6">
                            <p className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-1">Pembayaran Untuk</p>
                            <p className="text-stone-900 font-bold">{selectedPurchase.calo}</p>
                            <p className="text-stone-600 text-sm mt-1">Total Hutang: {formatCurrency(selectedPurchase.total_harga - selectedPurchase.paid_amount)}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Tanggal Bayar</label>
                                <Input 
                                    type="date" 
                                    value={formData.paymentDate}
                                    onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Metode</label>
                                <select 
                                    className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg px-4 py-2.5 text-sm focus:ring-brand-light-green"
                                    value={formData.paymentMethod}
                                    onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                                >
                                    <option value="CASH">CASH</option>
                                    <option value="TRANSFER">TRANSFER</option>
                                    <option value="OTHER">LAINNYA</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Jumlah Bayar (Rp)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                                <NumberInput 
 
                                    className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg pl-11 pr-4 py-2.5 text-sm focus:ring-brand-light-green"
                                    placeholder="0"
                                    max={selectedPurchase.total_harga - selectedPurchase.paid_amount}
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Kas Sumber Dana</label>
                            <select 
                                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg px-4 py-2.5 text-sm focus:ring-brand-light-green"
                                value={formData.financeAccountId}
                                onChange={e => setFormData({ ...formData, financeAccountId: e.target.value })}
                                required
                            >
                                <option value="">Tanpa Akun Kas (Hanya Catat Lunas)</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name} (Saldo: {formatCurrency(acc.balance)})</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Referensi / Catatan</label>
                            <textarea 
                                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg px-4 py-3 text-sm focus:ring-brand-light-green h-20"
                                placeholder="Nomor kuitansi atau catatan lainnya..."
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-900 font-bold py-3 rounded-xl transition-all"
                            >
                                Batal
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="flex-[2] bg-brand-light-green hover:bg-brand-light-green text-stone-900 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <div className="spinner-sm"></div> : <Wallet className="w-5 h-5" />}
                                Konfirmasi Bayar
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    )
}
