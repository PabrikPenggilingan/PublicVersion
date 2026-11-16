import { useState, useEffect } from 'react'
import { NumberInput } from '@/components/ui/NumberInput'
import { getCleanErrorMessage } from '@/errors'
import { Tag, Plus, Trash2, Calendar, TrendingUp, Info, Package, Layers, Wheat, Trash2 as TrashIcon, AlertTriangle, XCircle } from 'lucide-react'
import { priceListAPI, inventoryAPI } from '@/api/client'
import { PriceList, CustomerTier } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'react-hot-toast'
import { confirmDialog } from '@/utils/confirmDialog'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

export default function PriceListPage() {
    const [tiers, setTiers] = useState<CustomerTier[]>([])
    const [priceLists, setPriceLists] = useState<PriceList[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    // Form state
    const [formData, setFormData] = useState({
        tierId: '',
        categoryId: '',
        pricePerKg: '',
        pricePerSack: '',
        effectiveDate: format(new Date(), 'yyyy-MM-dd'),
        notes: ''
    })

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            setLoading(true)
            const [tierRes, priceRes, catRes] = await Promise.all([
                priceListAPI.getTiers(),
                priceListAPI.getAll(),
                inventoryAPI.getCategories()
            ])
            setTiers(tierRes.data)
            setPriceLists(priceRes.data)
            const categoriesData = (catRes.data || []) as any[]
            setCategories(categoriesData)
            
            if (tierRes.data.length > 0 && categoriesData.length > 0) {
                setFormData(prev => ({
                    ...prev,
                    tierId: tierRes.data[0].id,
                    categoryId: categoriesData[0].id
                }))
            }
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal memuat data harga')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.tierId || !formData.categoryId) return toast.error('Tier dan Kategori wajib diisi')
        if (!formData.pricePerKg && !formData.pricePerSack) return toast.error('Minimal satu harga harus diisi')
        
        try {
            setIsSubmitting(true)
            await priceListAPI.create({
                tier_id: formData.tierId,
                category_id: formData.categoryId,
                price_per_kg: formData.pricePerKg ? parseFloat(formData.pricePerKg) : undefined,
                price_per_sack: formData.pricePerSack ? parseFloat(formData.pricePerSack) : undefined,
                effective_date: formData.effectiveDate,
                notes: formData.notes || undefined
            } as Partial<PriceList>)
            toast.success('Harga baru berhasil ditambahkan')
            setIsModalOpen(false)
            fetchData()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal menyimpan harga')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!await confirmDialog('Apakah Anda yakin ingin menghapus data harga ini?')) return
        try {
            await priceListAPI.delete(id)
            toast.success('Harga berhasil dihapus')
            fetchData()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal menghapus harga')
        }
    }

    const getCategoryIcon = (code: string) => {
        switch (code) {
            case 'GABAH': return <Wheat size={16} />
            case 'BERAS': return <Package size={16} />
            case 'TURUNAN': return <Layers size={16} />
            case 'LIMBAH': return <TrashIcon size={16} />
            default: return <Tag size={16} />
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-200 p-6 rounded-2xl border border-stone-300 shadow-xl">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-3">
                        <TrendingUp className="text-brand-light-green" />
                        Daftar Harga (Price List)
                    </h1>
                    <p className="text-stone-600 mt-1">Pengaturan harga jual produk per tier pelanggan</p>
                </div>
                <Button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-brand-light-green hover:bg-brand-light-green text-white gap-2 px-6 shadow-lg shadow-brand-light-green/20"
                >
                    <Plus size={18} />
                    Update Harga Baru
                </Button>
            </div>

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3 text-sm text-blue-400">
                <Info size={20} className="shrink-0" />
                <p>
                    Sistem menggunakan **Effective Date**. Jika terdapat beberapa harga untuk kategori yang sama, 
                    harga dengan tanggal terbaru (namun tidak melewati tanggal nota) akan otomatis terpilih.
                </p>
            </div>

            {/* Price Table per Tier */}
            {loading ? (
                <div className="space-y-8 animate-pulse">
                    {[1,2].map(i => (
                        <div key={i} className="bg-stone-200 h-64 rounded-2xl border border-stone-300" />
                    ))}
                </div>
            ) : (
                <div className="space-y-8">
                    {tiers.map(tier => {
                        const tierPrices = priceLists.filter(p => p.tier_id === tier.id)
                        return (
                            <div key={tier.id} className="bg-stone-200 border border-stone-300 rounded-2xl overflow-hidden shadow-lg">
                                <div className="px-6 py-4 bg-stone-300/50 border-b border-stone-300 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-brand-light-green/20 text-brand-light-green flex items-center justify-center font-bold">
                                            {tier.name.charAt(tier.name.length - 1)}
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-stone-900 uppercase tracking-wider text-sm">{tier.name}</h2>
                                            <p className="text-[10px] text-stone-600 uppercase tracking-widest">{tier.description || 'Tidak ada deskripsi'}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-stone-500 font-medium">
                                        {tierPrices.length} Pengaturan Harga
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[650px] text-left text-sm">
                                        <thead className="bg-stone-100/30 text-stone-600 text-xs uppercase tracking-wider font-semibold">
                                            <tr>
                                                <th className="px-6 py-3">Kategori Produk</th>
                                                <th className="px-6 py-3">Harga per Kg</th>
                                                <th className="px-6 py-3">Harga per Karung</th>
                                                <th className="px-6 py-3">Mulai Berlaku</th>
                                                <th className="px-6 py-3">Catatan</th>
                                                <th className="px-6 py-3 text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-300">
                                            {tierPrices.length > 0 ? tierPrices.map(price => (
                                                <tr key={price.id} className="hover:bg-stone-300/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-stone-900 font-medium">
                                                            <span className="text-stone-500">{getCategoryIcon(price.category_code || '')}</span>
                                                            {price.category_name}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-brand-light-green">
                                                        {price.price_per_kg ? `Rp ${parseFloat(price.price_per_kg.toString()).toLocaleString('id-ID')}` : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-blue-400">
                                                        {price.price_per_sack ? `Rp ${parseFloat(price.price_per_sack.toString()).toLocaleString('id-ID')}` : '-'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-stone-700">
                                                            <Calendar size={14} className="text-stone-500" />
                                                            {format(new Date(price.effective_date), 'dd MMM yyyy', { locale: id })}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-stone-600 text-xs italic max-w-xs truncate">
                                                        {price.notes || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button 
                                                            onClick={() => handleDelete(price.id)}
                                                            className="p-1.5 text-stone-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-stone-500 italic">
                                                        Belum ada pengaturan harga untuk tier ini.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal Form */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-stone-200 border border-stone-300 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-stone-300 flex justify-between items-center bg-stone-300/30">
                            <div>
                                <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                                    <TrendingUp size={20} className="text-brand-light-green" />
                                    Update Harga Baru
                                </h2>
                                <p className="text-xs text-stone-600 mt-0.5">Penetapan harga yang akan berlaku kedepan</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-stone-600 hover:text-stone-900">
                                <XCircle size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Tier Pelanggan</label>
                                    <select 
                                        className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg px-4 py-2.5 text-sm focus:ring-brand-light-green"
                                        value={formData.tierId}
                                        onChange={e => setFormData({ ...formData, tierId: e.target.value })}
                                        required
                                    >
                                        {tiers.map((t, idx) => (
                                            <option key={t.id || `tier-${idx}`} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Kategori Produk</label>
                                    <select 
                                        className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg px-4 py-2.5 text-sm focus:ring-brand-light-green"
                                        value={formData.categoryId}
                                        onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                                        required
                                    >
                                        {categories.map((c, idx) => (
                                            <option key={c.id || c.code || `cat-${idx}`} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Harga per Kg (Rp)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">Rp</span>
                                        <NumberInput ui 

                                            className="pl-9"
                                            value={formData.pricePerKg}
                                            onChange={e => setFormData({ ...formData, pricePerKg: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Harga per Karung (Rp)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">Rp</span>
                                        <NumberInput ui 

                                            className="pl-9"
                                            value={formData.pricePerSack}
                                            onChange={e => setFormData({ ...formData, pricePerSack: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Tanggal Mulai Berlaku</label>
                                <Input 
                                    type="date"
                                    value={formData.effectiveDate}
                                    onChange={e => setFormData({ ...formData, effectiveDate: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Catatan</label>
                                <Input 
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Contoh: Penyesuaian harga pasar..."
                                />
                            </div>

                            <div className="bg-brand-light-green/5 border border-brand-light-green/10 rounded-lg p-3 flex gap-2 items-center text-xs text-brand-light-green">
                                <AlertTriangle size={14} className="shrink-0" />
                                <span>Harga ini akan otomatis menggantikan harga lama pada tanggal yang ditentukan.</span>
                            </div>

                            <div className="pt-2 flex gap-3">
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
                                    className="flex-1 bg-brand-light-green hover:bg-brand-light-green text-stone-900"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Menyimpan...' : 'Terapkan Harga'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
