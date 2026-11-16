import { useState, useEffect } from 'react'
import { useTableCards } from '@/utils/useTableCards'
import { NumberInput } from '@/components/ui/NumberInput'
import { getCleanErrorMessage } from '@/errors'
import { financeAPI } from '@/api/client'
import { Plus, Search, Calendar, DollarSign, Tag, FileText, ChevronLeft, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'

export default function OverheadList() {
    const tableCardsRef = useTableCards()

    const [overheads, setOverheads] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [_loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        expenseDate: format(new Date(), 'yyyy-MM-dd'),
        category: '',
        description: '',
        amount: '',
        frequency: 'DAILY',
        paymentMethod: 'CASH',
        financeAccountId: ''
    })

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [ovRes, accRes] = await Promise.all([
                financeAPI.getDailyReport(), // Using daily report as proxy for now or can add specific list API
                financeAPI.getAccounts({ category: 'ASSET' })
            ])
            setOverheads(ovRes.data.overheads || [])
            setAccounts(accRes.data)
            if (accRes.data.length > 0) {
                setFormData(prev => ({ ...prev, financeAccountId: accRes.data[0].id }))
            }
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setIsSubmitting(true)
            await financeAPI.createOverhead({
                ...formData,
                amount: parseFloat(formData.amount)
            })
            toast.success('Biaya berhasil dicatat')
            setIsModalOpen(false)
            setFormData({
                expenseDate: format(new Date(), 'yyyy-MM-dd'),
                category: '',
                description: '',
                amount: '',
                frequency: 'DAILY',
                paymentMethod: 'CASH',
                financeAccountId: accounts[0]?.id || ''
            })
            loadData()
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
                        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Biaya Operasional</h1>
                        <p className="text-stone-600 text-sm">Kelola pengeluaran harian dan mingguan pabrik.</p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-brand-light-green hover:bg-brand-light-green text-stone-900 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand-light-green/20 transition-all active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Tambah Biaya
                </button>
            </div>

            {/* List */}
            <div className="bg-stone-200 border border-stone-300 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-stone-300 bg-stone-200/50 flex flex-col md:flex-row justify-between gap-4">
                    <div className="relative group flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 group-focus-within:text-brand-light-green transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Cari biaya..." 
                            className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-xl pl-11 pr-4 py-2.5 text-sm focus:ring-brand-light-green transition-all"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-stone-300 text-stone-900 rounded-xl text-sm font-medium border border-stone-400">Semua</button>
                        <button className="px-4 py-2 bg-stone-200 text-stone-600 hover:text-stone-900 rounded-xl text-sm font-medium border border-stone-300 transition-colors">Harian</button>
                        <button className="px-4 py-2 bg-stone-200 text-stone-600 hover:text-stone-900 rounded-xl text-sm font-medium border border-stone-300 transition-colors">Mingguan</button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table ref={tableCardsRef} className="table-cards w-full md:min-w-[650px] text-left">
                        <thead>
                            <tr className="bg-stone-100/30 text-stone-600 text-xs font-black uppercase tracking-widest border-b border-stone-300">
                                <th className="px-6 py-4">Tanggal</th>
                                <th className="px-6 py-4">Kategori</th>
                                <th className="px-6 py-4">Keterangan</th>
                                <th className="px-6 py-4">Frekuensi</th>
                                <th className="px-6 py-4 text-right">Jumlah</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-300/50">
                            {overheads.length > 0 ? overheads.map(ov => (
                                <tr key={ov.id} className="hover:bg-stone-300/30 transition-colors group">
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-stone-300 rounded-lg">
                                                <Calendar className="w-4 h-4 text-sky-400" />
                                            </div>
                                            <span className="text-stone-900 text-sm font-medium">
                                                {format(new Date(ov.expense_date), 'd MMM yyyy', { locale: id })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="px-3 py-1 bg-stone-300 text-brand-light-green text-[10px] font-black uppercase tracking-widest rounded-full border border-brand-light-green/10">
                                            {ov.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <p className="text-stone-700 text-sm max-w-xs truncate">{ov.description || '-'}</p>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-stone-600 text-xs">{ov.frequency}</span>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <span className="text-stone-900 font-bold text-sm">{formatCurrency(ov.amount)}</span>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <button className="p-2 text-stone-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-stone-500">
                                        Belum ada data biaya operasional.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Tambah Biaya */}
            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title="Catat Biaya Operasional"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Tanggal</label>
                            <Input 
                                type="date" 
                                value={formData.expenseDate}
                                onChange={e => setFormData({ ...formData, expenseDate: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Frekuensi</label>
                            <select 
                                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg px-4 py-2.5 text-sm focus:ring-brand-light-green"
                                value={formData.frequency}
                                onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                            >
                                <option value="DAILY">Harian</option>
                                <option value="WEEKLY">Mingguan</option>
                                <option value="MONTHLY">Bulanan</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Kategori Biaya</label>
                        <div className="relative">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                            <input 
                                list="categories"
                                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg pl-11 pr-4 py-2.5 text-sm focus:ring-brand-light-green"
                                placeholder="Gaji, Solar, Maintenance, dll"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                required
                            />
                            <datalist id="categories">
                                <option value="Gaji & Bonus" />
                                <option value="Solar & Bahan Bakar" />
                                <option value="Maintenance Mesin" />
                                <option value="Listrik & Air" />
                                <option value="Perlengkapan Kantor" />
                                <option value="Karet Roll / Sparepart" />
                            </datalist>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Jumlah Biaya (Rp)</label>
                        <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                            <NumberInput 
 
                                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg pl-11 pr-4 py-2.5 text-sm focus:ring-brand-light-green"
                                placeholder="0"
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
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name} (Saldo: {formatCurrency(acc.balance)})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Keterangan Tambahan</label>
                        <div className="relative">
                            <FileText className="absolute left-4 top-3 w-4 h-4 text-stone-500" />
                            <textarea 
                                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg pl-11 pr-4 py-3 text-sm focus:ring-brand-light-green h-24"
                                placeholder="Detail biaya..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
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
                            {isSubmitting ? <div className="spinner-sm"></div> : <Plus className="w-5 h-5" />}
                            Simpan Biaya
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
