import { useState } from 'react'
import { usersAPI } from '@/api/client'
import { UserPlus, Save, Lock, User, ShieldAlert, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MasterAccount() {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'owner' // Default to 'owner' as requested
    })
    const [saving, setSaving] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.username || !formData.password || !formData.role) {
            toast.error('Harap lengkapi semua field')
            return
        }

        try {
            setSaving(true)
            const res = await usersAPI.create(formData)
            if (res.success) {
                toast.success('Akun berhasil dibuat')
                setFormData({ username: '', password: '', role: 'owner' })
            }
        } catch (error: any) {
            toast.error(error.message || 'Gagal membuat akun')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="p-6 max-w-2xl mx-auto h-full flex flex-col justify-center">
            <div className="bg-stone-200 rounded-xl border border-stone-300 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-stone-300 bg-stone-200/50 flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 rounded-full bg-brand-light-green/20 flex items-center justify-center mb-4">
                        <UserPlus size={32} className="text-brand-light-green" />
                    </div>
                    <h2 className="text-2xl font-semibold text-stone-900">Buat Akun Baru</h2>
                    <p className="text-stone-600 mt-2 text-center text-sm max-w-md">
                        Tambahkan akun pengguna baru ke dalam sistem. Secara bawaan, peran "Owner" memiliki akses ke semua modul kecuali Master Page.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1.5">
                                Peran (Role)
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <ShieldAlert size={18} className="text-stone-600" />
                                </div>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full bg-stone-100 border border-stone-300 rounded-lg pl-10 pr-4 py-3 text-stone-900 focus:outline-none focus:border-brand-light-green focus:ring-1 focus:ring-brand-light-green appearance-none"
                                >
                                    <option value="owner">Owner (Pemilik Pabrik)</option>
                                    <option value="operator">Operator (Staff)</option>
                                    <option value="viewer">Viewer (Hanya Lihat)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1.5">
                                Username
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User size={18} className="text-stone-600" />
                                </div>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full bg-stone-100 border border-stone-300 rounded-lg pl-10 pr-4 py-3 text-stone-900 focus:outline-none focus:border-brand-light-green focus:ring-1 focus:ring-brand-light-green"
                                    placeholder="Masukkan username"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-stone-600" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full bg-stone-100 border border-stone-300 rounded-lg pl-10 pr-12 py-3 text-stone-900 focus:outline-none focus:border-brand-light-green focus:ring-1 focus:ring-brand-light-green"
                                    placeholder="Masukkan password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-600 hover:text-stone-900 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-stone-300">
                        <button
                            type="submit"
                            disabled={saving}
                            className={`w-full flex items-center justify-center gap-2 bg-brand-light-green hover:bg-brand-light-green text-white py-3 px-4 rounded-lg font-medium transition-colors ${saving ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                        >
                            {saving ? (
                                <div className="spinner w-5 h-5 border-2 border-white/20 border-t-white" style={{ borderRadius: '50%' }}></div>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Buat Akun
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
