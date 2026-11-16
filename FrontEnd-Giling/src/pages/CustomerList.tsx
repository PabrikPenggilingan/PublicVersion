import { useState, useEffect } from 'react'
import { getCleanErrorMessage } from '@/errors'
import { Plus, Search, User as UserIcon, Phone, MapPin, Tag, Edit2, CheckCircle2, XCircle, ShoppingCart } from 'lucide-react'
import { customersAPI, priceListAPI, salesV2API } from '@/api/client'
import { Customer, CustomerTier } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { cn } from '@/utils/helpers'

export default function CustomerList() {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [tiers, setTiers] = useState<CustomerTier[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedTier, setSelectedTier] = useState<string>('all')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)

    // Form state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        tierId: '',
        notes: ''
    })

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            setLoading(true)
            const [custRes, tierRes] = await Promise.all([
                customersAPI.getAll(),
                priceListAPI.getTiers()
            ])
            setCustomers(custRes.data)
            setTiers(tierRes.data)
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal memuat data pelanggan')
        } finally {
            setLoading(false)
        }
    }

    const filteredCustomers = customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
            (c.phone?.includes(search))
        const matchesTier = selectedTier === 'all' || c.tier_id === selectedTier
        return matchesSearch && matchesTier
    })

    const handleOpenModal = (customer?: Customer) => {
        if (customer) {
            setEditingId(customer.id)
            setFormData({
                name: customer.name,
                phone: customer.phone || '',
                address: customer.address || '',
                tierId: customer.tier_id || '',
                notes: customer.notes || ''
            })
        } else {
            setEditingId(null)
            setFormData({
                name: '',
                phone: '',
                address: '',
                tierId: tiers[0]?.id || '',
                notes: ''
            })
        }
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name) return toast.error('Nama wajib diisi')

        try {
            setIsSubmitting(true)
            if (editingId) {
                await customersAPI.update(editingId, formData)
                toast.success('Pelanggan berhasil diperbarui')
            } else {
                await customersAPI.create(formData)
                toast.success('Pelanggan baru berhasil ditambahkan')
            }
            setIsModalOpen(false)
            fetchData()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal menyimpan data')
        } finally {
            setIsSubmitting(false)
        }
    }

    const toggleStatus = async (customer: Customer) => {
        try {
            await customersAPI.update(customer.id, { is_active: !customer.is_active })
            toast.success(`Pelanggan berhasil di${customer.is_active ? 'nonaktifkan' : 'aktifkan'}`)
            fetchData()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal mengubah status')
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-200 p-6 rounded-2xl border border-stone-300 shadow-xl">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-3">
                        <UserIcon className="text-brand-light-green" />
                        Daftar Pelanggan
                    </h1>
                    <p className="text-stone-600 mt-1">Manajemen database pembeli dan segmentasi harga</p>
                </div>
                <Button
                    onClick={() => handleOpenModal()}
                    className="bg-brand-light-green hover:bg-brand-light-green text-white gap-2 px-6"
                >
                    <Plus size={18} />
                    Tambah Pelanggan
                </Button>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
                    <Input
                        placeholder="Cari nama atau nomor telepon..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="bg-stone-200 border-stone-300 text-stone-900 rounded-lg px-4 py-2 text-sm focus:ring-brand-light-green"
                    value={selectedTier}
                    onChange={(e) => setSelectedTier(e.target.value)}
                >
                    <option value="all">Semua Tier</option>
                    {tiers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-48 bg-stone-200 rounded-2xl border border-stone-300" />
                    ))}
                </div>
            ) : filteredCustomers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCustomers.map(customer => (
                        <div
                            key={customer.id}
                            className={`bg-stone-200 border rounded-2xl p-5 shadow-lg transition-all hover:border-brand-light-green/50 group relative ${customer.is_active ? 'border-stone-300' : 'border-red-900/30 opacity-75'}`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${customer.is_active ? 'bg-brand-light-green/10 text-brand-light-green' : 'bg-stone-300 text-stone-500'}`}>
                                        <UserIcon size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-stone-900 group-hover:text-brand-light-green transition-colors">
                                            {customer.name}
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-xs text-stone-600 mt-0.5">
                                            <Tag size={12} className="text-brand-light-green" />
                                            {customer.tier_name || 'Tanpa Tier'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleOpenModal(customer)}
                                        className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-300 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => toggleStatus(customer)}
                                        className={`p-2 rounded-lg transition-colors ${customer.is_active ? 'text-red-400 hover:bg-red-500/10' : 'text-brand-light-green hover:bg-brand-light-green/10'}`}
                                        title={customer.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                    >
                                        {customer.is_active ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2.5 text-sm">
                                <div className="flex items-start gap-3 text-stone-700">
                                    <Phone size={14} className="mt-1 text-stone-500" />
                                    <span>{customer.phone || '-'}</span>
                                </div>
                                <div className="flex items-start gap-3 text-stone-700">
                                    <MapPin size={14} className="mt-1 text-stone-500" />
                                    <span className="line-clamp-2">{customer.address || '-'}</span>
                                </div>
                            </div>

                            {!customer.is_active && (
                                <div className="absolute top-2 right-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded uppercase tracking-wider">
                                    Nonaktif
                                </div>
                            )}

                            <div className="mt-4 pt-4 border-t border-stone-300 flex items-center justify-between">
                                <span className="text-[10px] text-stone-500 italic">
                                    Dibuat: {format(new Date(customer.created_at), 'dd MMM yyyy', { locale: id })}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-brand-light-green hover:text-brand-light-green hover:bg-brand-light-green/5 h-8 text-xs px-2"
                                    onClick={() => setHistoryCustomer(customer)}
                                >
                                    Riwayat Order
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-stone-200 border border-stone-300 rounded-2xl p-12 text-center">
                    <div className="w-16 h-16 bg-stone-300 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-500">
                        <UserIcon size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-stone-900">Tidak ada pelanggan ditemukan</h3>
                    <p className="text-stone-600 mt-1 max-w-sm mx-auto">
                        Coba sesuaikan kata kunci pencarian atau filter tier Anda.
                    </p>
                    <Button
                        variant="outline"
                        className="mt-6 border-stone-400 hover:bg-stone-300"
                        onClick={() => { setSearch(''); setSelectedTier('all'); }}
                    >
                        Reset Filter
                    </Button>
                </div>
            )}

            {/* Modal Form */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-stone-200 border border-stone-300 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-stone-300 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-stone-900">
                                {editingId ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-stone-600 hover:text-stone-900">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1.5">Nama Pelanggan <span className="text-red-500">*</span></label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Contoh: Toko Beras Jaya"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Telepon</label>
                                    <Input
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="0812..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Tier / Ring</label>
                                    <select
                                        className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg px-4 py-2 text-sm focus:ring-brand-light-green"
                                        value={formData.tierId}
                                        onChange={e => setFormData({ ...formData, tierId: e.target.value })}
                                    >
                                        <option value="">Pilih Tier</option>
                                        {tiers.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1.5">Alamat</label>
                                <textarea
                                    className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg px-4 py-2 text-sm focus:ring-brand-light-green h-20 resize-none"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Alamat lengkap pengiriman..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1.5">Catatan Internal</label>
                                <Input
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Catatan tambahan..."
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="flex-1 text-stone-600 hover:bg-stone-300"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-brand-light-green hover:bg-brand-light-green text-white"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {historyCustomer && (
                <CustomerHistoryModal
                    customer={historyCustomer}
                    onClose={() => setHistoryCustomer(null)}
                />
            )}
        </div>
    )
}
function CustomerHistoryModal({ customer, onClose }: { customer: Customer, onClose: () => void }) {
    const [sales, setSales] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await salesV2API.getAll({ customerId: customer.id, limit: 100 })
                setSales(res.data)
            } catch (err: any) {
                toast.error('Gagal memuat riwayat order')
            } finally {
                setLoading(false)
            }
        }
        fetchHistory()
    }, [customer.id])

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-stone-200 border border-stone-300 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in duration-200">
                <div className="p-6 border-b border-stone-300 flex-shrink-0 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-stone-900">Riwayat Order</h2>
                        <p className="text-stone-600 text-sm mt-1">{customer.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-stone-600 hover:text-stone-900 rounded-lg transition-colors bg-stone-300/50">
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="p-0 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex justify-center p-12">
                            <div className="spinner border-t-brand-light-green" />
                        </div>
                    ) : sales.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[500px] text-left text-sm">
                                <thead className="bg-stone-100/50 text-stone-600 text-xs uppercase tracking-wider sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Tanggal & Nota</th>
                                        <th className="px-6 py-4 font-semibold">Status</th>
                                        <th className="px-6 py-4 font-semibold text-right">Total (Rp)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-300/50">
                                    {sales.map(sale => (
                                        <tr key={sale.id} className="hover:bg-stone-300/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-stone-900">{sale.sale_no || 'Draft'}</div>
                                                <div className="text-xs text-stone-600 mt-1">
                                                    {format(new Date(sale.sale_date), 'dd MMM yyyy', { locale: id })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest border",
                                                    sale.status === 'DEAL' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                        sale.status === 'COMPLETED' ? 'bg-brand-light-green/10 text-brand-light-green border-brand-light-green/20' :
                                                            sale.status === 'VOID' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                                'bg-stone-300 text-stone-600 border-stone-400'
                                                )}>
                                                    {sale.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-stone-900">
                                                Rp {Number(sale.total_amount).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center p-12 text-stone-600">
                            <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Belum ada riwayat order untuk pelanggan ini.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
