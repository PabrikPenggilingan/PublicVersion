import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersAPI } from '@/api/client'
import type { User } from '@/types'
import { Check, X, Shield, Settings2, MonitorCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

const AVAILABLE_MODULES = [
    { code: 'DASHBOARD', label: 'Dashboard' },
    { code: 'PURCHASES', label: 'Belanja' },
    { code: 'PENDATAAN', label: 'Pendataan Gabah' },
    { code: 'DRYING', label: 'Pengeringan' },
    { code: 'INVENTORY', label: 'Inventaris' },
    { code: 'PROCESSES', label: 'Proses Giling' },
    { code: 'SALES', label: 'Penjualan' },
    { code: 'LOGISTICS', label: 'Logistik & Transport' },
    { code: 'FINANCE', label: 'Finance Center' },
    { code: 'AI_ANALYSIS', label: 'AI Analysis' },
    { code: 'LOGS', label: 'Riwayat Aktivitas' },
    { code: 'SETTINGS', label: 'Pengaturan Sistem' }
]

export default function MasterPage() {
    const { user: currentUser } = useAuth()
    const navigate = useNavigate()
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            setLoading(true)
            const res = await usersAPI.getAll()
            if (res.success) {
                setUsers(res.data)
            }
        } catch (error: any) {
            toast.error(error.message || 'Gagal memuat data pengguna')
        } finally {
            setLoading(false)
        }
    }

    const handleToggleModule = async (moduleCode: string) => {
        if (!selectedUser) return

        let currentModules = selectedUser.accessible_modules || AVAILABLE_MODULES.map(m => m.code)
        
        if (currentModules.includes(moduleCode)) {
            currentModules = currentModules.filter(m => m !== moduleCode)
        } else {
            currentModules = [...currentModules, moduleCode]
        }

        try {
            setSaving(true)
            const res = await usersAPI.updateModules(selectedUser.id, currentModules)
            if (res.success) {
                const updated = res.data as User
                setUsers(users.map(u => u.id === updated.id ? { ...u, accessible_modules: updated.accessible_modules } : u))
                setSelectedUser({ ...selectedUser, accessible_modules: updated.accessible_modules })
                toast.success('Akses modul berhasil diperbarui')
            }
        } catch (error: any) {
            toast.error(error.message || 'Gagal memperbarui akses')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto flex flex-col md:flex-row h-full gap-6">
            <div className="flex-1 bg-stone-200 rounded-xl border border-stone-300 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-stone-300 flex justify-between items-center bg-stone-200/50">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Shield className="text-brand-light-green" size={20} />
                        Master Akses Pengguna
                    </h2>
                    {/* Show System Monitoring link only for super admin */}
                    {currentUser?.is_super_admin && (
                        <button
                            onClick={() => navigate('/system-monitoring')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-light-green/10 border border-brand-light-green/30 text-brand-light-green rounded-lg text-xs font-medium hover:bg-brand-light-green/20 transition-colors"
                        >
                            <MonitorCheck size={13} />
                            System Monitoring
                        </button>
                    )}
                </div>
                
                <div className="overflow-y-auto flex-1 p-4">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="spinner"></div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {users.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => setSelectedUser(user)}
                                    className={`w-full text-left p-4 rounded-lg border transition-all flex items-center justify-between ${
                                        selectedUser?.id === user.id 
                                        ? 'bg-brand-light-green/10 border-brand-light-green/50 text-brand-light-green' 
                                        : 'bg-stone-100 border-stone-300 hover:border-stone-500 hover:bg-stone-200/80'
                                    }`}
                                >
                                    <div>
                                        <div className="font-medium text-stone-900">{user.username}</div>
                                        <div className="text-xs text-stone-600 mt-1 uppercase tracking-wider">{user.role}</div>
                                    </div>
                                    <div className="text-xs text-stone-600">
                                        {(user.accessible_modules || AVAILABLE_MODULES).length} Modul Aktif
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Side Panel for Modules */}
            {selectedUser && (
                <div className="w-full md:w-80 bg-stone-200 rounded-xl border border-stone-300 flex flex-col shadow-xl">
                    <div className="p-4 border-b border-stone-300 bg-stone-200/50">
                        <h3 className="font-medium text-stone-900 flex items-center gap-2">
                            <Settings2 size={16} className="text-brand-light-green" />
                            Akses Modul: {selectedUser.username}
                        </h3>
                    </div>
                    
                    <div className="p-4 flex-1 overflow-y-auto space-y-2">
                        {AVAILABLE_MODULES.map(module => {
                            const currentModules = selectedUser.accessible_modules || AVAILABLE_MODULES.map(m => m.code)
                            const isChecked = currentModules.includes(module.code)
                            
                            return (
                                <button
                                    key={module.code}
                                    disabled={saving}
                                    onClick={() => handleToggleModule(module.code)}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                                        isChecked 
                                        ? 'bg-brand-light-green/10 border-brand-light-green/30 text-brand-light-green' 
                                        : 'bg-stone-100 border-stone-300 text-stone-600 opacity-60 hover:opacity-100 hover:border-stone-500'
                                    } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className="text-sm font-medium">{module.label}</span>
                                    {isChecked ? (
                                        <div className="w-5 h-5 rounded-full bg-brand-light-green/20 flex items-center justify-center">
                                            <Check size={12} className="text-brand-light-green" />
                                        </div>
                                    ) : (
                                        <div className="w-5 h-5 rounded-full bg-stone-300 flex items-center justify-center">
                                            <X size={12} className="text-stone-500" />
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
