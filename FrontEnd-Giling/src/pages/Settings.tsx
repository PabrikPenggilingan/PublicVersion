import { useState, useEffect } from 'react'
import { Save, Lock, AlertTriangle, ShieldCheck } from 'lucide-react'
import { settingsAPI } from '@/api/client'
import toast from 'react-hot-toast'

export default function Settings() {
    const [lockDate, setLockDate] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        fetchLockDate()
    }, [])

    const fetchLockDate = async () => {
        try {
            const res = await settingsAPI.getLockDate()
            if (res.success && res.data) {
                // Return format is usually full ISO string or YYYY-MM-DD
                const dateVal = res.data.split('T')[0]
                setLockDate(dateVal)
            }
        } catch (error) {
            console.error('Failed to fetch lock date', error)
        }
    }

    const handleSaveLockDate = async () => {
        setIsLoading(true)
        try {
            const dateToSave = lockDate ? lockDate : null
            const res = await settingsAPI.updateLockDate({ lockDate: dateToSave })
            if (res.success) {
                toast.success('Lock Date berhasil disimpan!')
            }
        } catch (error: any) {
            toast.error(error.message || 'Gagal menyimpan Lock Date')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8">
            <header className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight flex items-center gap-3">
                    <ShieldCheck className="text-indigo-400 w-8 h-8 sm:w-10 sm:h-10 shrink-0" />
                    Pengaturan Sistem
                </h1>
                <p className="text-stone-600 mt-1 sm:mt-2 text-sm sm:text-lg">Kelola konfigurasi inti dan keamanan data aplikasi.</p>
            </header>

            <div className="grid gap-6 sm:gap-8">
                {/* Financial Lock Date Section */}
                <section className="bg-stone-200 rounded-2xl border border-stone-300 overflow-hidden shadow-xl">
                    <div className="bg-stone-300/50 p-4 sm:p-6 border-b border-stone-400 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                        <div className="p-3 bg-red-500/20 rounded-xl">
                            <Lock className="text-red-400 w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-stone-900">Periode Tutup Buku (Financial Lock Date)</h2>
                            <p className="text-stone-600 mt-1 text-sm leading-relaxed">
                                Fitur pengamanan tingkat tinggi (Standar ERP). Semua transaksi finansial (Penjualan, Pembelian, Kas, Gudang) 
                                yang terjadi pada atau sebelum tanggal ini akan <strong>dikunci mati secara permanen di database</strong>. 
                                Data tidak bisa diedit maupun dihapus untuk menjaga validitas pelaporan pajak.
                            </p>
                        </div>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        <div className="flex items-center gap-4 bg-yellow-100 border border-yellow-300 p-4 rounded-xl text-yellow-800">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <p className="text-sm">Hanya akun dengan hak akses TIER_B (Admin) yang dapat mengubah konfigurasi ini.</p>
                        </div>

                        <div className="max-w-md">
                            <label className="block text-sm font-semibold text-stone-700 mb-2">Tanggal Terkunci Hingga:</label>
                            <input
                                type="date"
                                className="w-full bg-stone-100 border border-stone-400 rounded-xl p-3 text-stone-900 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                value={lockDate}
                                onChange={(e) => setLockDate(e.target.value)}
                            />
                        </div>

                        <div className="pt-4 border-t border-stone-300">
                            <button
                                onClick={handleSaveLockDate}
                                disabled={isLoading}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                            >
                                <Save className="w-5 h-5" />
                                {isLoading ? 'Menyimpan...' : 'Simpan Konfigurasi'}
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
