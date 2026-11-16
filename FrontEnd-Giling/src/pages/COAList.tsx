import { useState, useEffect } from 'react'
import { financeAPI } from '@/api/client'
import { Plus, Edit2, Archive, CheckCircle, Search, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

interface Account {
    id: string
    name: string
    account_type: string
    account_category: string
    account_code: string
    description: string
    balance: number
    is_active: boolean
}

const CATEGORIES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']
const CATEGORY_COLORS: Record<string, string> = {
    ASSET: 'bg-brand-light-green/10 text-brand-light-green border-brand-light-green/20',
    LIABILITY: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    EQUITY: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    REVENUE: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    EXPENSE: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

export default function COAList() {
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingAccount, setEditingAccount] = useState<Account | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        account_category: 'EXPENSE',
        account_type: 'OPEX',
        account_code: '',
        description: '',
        is_active: true
    })

    useEffect(() => {
        loadAccounts()
    }, [])

    const loadAccounts = async () => {
        try {
            setLoading(true)
            const res = await financeAPI.getAccounts()
            const raw = Array.isArray(res.data) ? res.data : []
            const unique = raw.filter((acc: any, idx: number, arr: any[]) =>
                idx === arr.findIndex((t: any) => t.account_code === acc.account_code)
            )
            setAccounts(unique)
        } catch (error) {
            toast.error('Gagal memuat Chart of Accounts')
        } finally {
            setLoading(false)
        }
    }

    const openModal = (acc?: Account) => {
        if (acc) {
            setEditingAccount(acc)
            setFormData({
                name: acc.name,
                account_category: acc.account_category || 'EXPENSE',
                account_type: acc.account_type || 'OPEX',
                account_code: acc.account_code || '',
                description: acc.description || '',
                is_active: acc.is_active
            })
        } else {
            setEditingAccount(null)
            setFormData({
                name: '',
                account_category: 'EXPENSE',
                account_type: 'OPEX',
                account_code: '',
                description: '',
                is_active: true
            })
        }
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (editingAccount) {
                await financeAPI.updateAccount(editingAccount.id, formData)
                toast.success('Akun berhasil diperbarui')
            } else {
                await financeAPI.createAccount(formData)
                toast.success('Akun baru berhasil ditambahkan')
            }
            setIsModalOpen(false)
            loadAccounts()
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal menyimpan akun')
        }
    }

    const toggleActive = async (acc: Account) => {
        try {
            await financeAPI.updateAccount(acc.id, { is_active: !acc.is_active })
            toast.success(`Akun ${acc.name} ${!acc.is_active ? 'diaktifkan' : 'dinonaktifkan'}`)
            loadAccounts()
        } catch (error) {
            toast.error('Gagal mengubah status akun')
        }
    }

    const filteredAccounts = accounts.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.account_code && a.account_code.toLowerCase().includes(search.toLowerCase()))
    )

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight flex items-center gap-3">
                        <FileText className="text-indigo-400 w-8 h-8 sm:w-10 sm:h-10 shrink-0" />
                        Bagan Akun (CoA)
                    </h1>
                    <p className="text-stone-600 mt-1 sm:mt-2 text-sm sm:text-lg">Kelola master data akun keuangan, klasifikasi, dan kode akun.</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                >
                    <Plus className="w-5 h-5" />
                    Tambah Akun Baru
                </button>
            </header>

            <div className="bg-stone-200 rounded-2xl border border-stone-300 overflow-hidden shadow-xl flex flex-col min-h-[400px]">
                <div className="p-4 border-b border-stone-300 bg-stone-200/50 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Cari nama atau kode akun..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-stone-100 border border-stone-400 rounded-xl pl-10 pr-4 py-2 text-stone-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4">
                    {loading ? (
                        <div className="flex justify-center items-center h-48">
                            <div className="spinner"></div>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {filteredAccounts.map(acc => (
                                <div key={acc.id} className={`bg-stone-100 border ${acc.is_active ? 'border-stone-300' : 'border-red-900/50 opacity-60'} rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-500/50 transition-colors`}>
                                    <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                                        <div className={`px-2.5 py-1 rounded-lg border text-[10px] sm:text-xs font-bold shrink-0 ${CATEGORY_COLORS[acc.account_category] || 'bg-stone-300 text-stone-700'}`}>
                                            {acc.account_category || 'UNMAPPED'}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2 flex-wrap">
                                                {acc.account_code && <span className="text-indigo-400 font-mono">[{acc.account_code}]</span>}
                                                <span>{acc.name}</span>
                                                {!acc.is_active && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">Nonaktif</span>}
                                            </h3>
                                            <p className="text-xs sm:text-sm text-stone-600 mt-0.5 sm:mt-1">{acc.description || 'Tidak ada deskripsi'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-200">
                                        <div className="text-left sm:text-right">
                                            <div className="text-[10px] text-stone-600 mb-0.5">Saldo Buku Besar</div>
                                            <div className="text-sm font-black text-stone-900 font-mono">
                                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(acc.balance || 0)}
                                            </div>
                                        </div>
                                        <div className="text-left sm:text-right sm:mr-2">
                                            <div className="text-[10px] text-stone-600 mb-0.5">Tipe (Sub)</div>
                                            <div className="text-xs font-semibold text-stone-800 bg-stone-200 px-2.5 py-1 rounded-lg border border-stone-300">{acc.account_type}</div>
                                        </div>
                                        <button
                                            onClick={() => openModal(acc)}
                                            className="p-2 bg-stone-300 hover:bg-indigo-600 text-stone-700 hover:text-stone-900 rounded-lg transition-colors tooltip"
                                            title="Edit Akun"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => toggleActive(acc)}
                                            className={`p-2 rounded-lg transition-colors tooltip ${acc.is_active ? 'bg-stone-300 hover:bg-red-600 text-stone-700' : 'bg-red-900/50 hover:bg-brand-light-green/80 text-red-400'}`}
                                            title={acc.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                        >
                                            {acc.is_active ? <Archive className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {filteredAccounts.length === 0 && (
                                <div className="text-center text-stone-600 py-12">Tidak ada akun yang ditemukan.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Form */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-stone-200 border border-stone-300 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-stone-300 flex justify-between items-center bg-stone-100/50">
                            <h2 className="text-xl font-bold text-stone-900">{editingAccount ? 'Edit Akun' : 'Tambah Akun Baru'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-stone-600 hover:text-stone-900">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Kode Akun<span className="text-rose-500 ml-1">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.account_code}
                                    onChange={e => setFormData({ ...formData, account_code: e.target.value })}
                                    className="w-full bg-stone-100 border border-stone-400 rounded-xl px-4 py-2 text-stone-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Contoh: 5-601"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Nama Akun<span className="text-rose-500 ml-1">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-stone-100 border border-stone-400 rounded-xl px-4 py-2 text-stone-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Contoh: Beban Konsumsi Rapat"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Kategori Induk<span className="text-rose-500 ml-1">*</span></label>
                                    <select
                                        value={formData.account_category}
                                        onChange={e => setFormData({ ...formData, account_category: e.target.value })}
                                        className="w-full bg-stone-100 border border-stone-400 rounded-xl px-4 py-2 text-stone-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        {CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Tipe (Sub)<span className="text-rose-500 ml-1">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.account_type}
                                        onChange={e => setFormData({ ...formData, account_type: e.target.value.toUpperCase() })}
                                        className="w-full bg-stone-100 border border-stone-400 rounded-xl px-4 py-2 text-stone-900 focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                                        placeholder="CASH, OPEX, dll"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Deskripsi Singkat</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-stone-100 border border-stone-400 rounded-xl px-4 py-2 text-stone-900 focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                                    placeholder="Penjelasan penggunaan akun ini..."
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 rounded-xl bg-stone-300 text-stone-900 font-semibold hover:bg-stone-400">Batal</button>
                                <button type="submit" className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20">
                                    Simpan Akun
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
