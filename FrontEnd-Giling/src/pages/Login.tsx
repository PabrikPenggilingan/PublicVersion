import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function Login() {
    const navigate = useNavigate()
    const { login } = useAuth()

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await login(username, password)
            navigate('/dashboard')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login gagal. Periksa username dan password.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-50 p-6">
            <div className="w-full max-w-md">
                <div className="bg-stone-200 border border-stone-300 rounded-2xl p-8 shadow-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <img
                            src="/logo.png"
                            alt="Logo Padi Nadi"
                            className="h-20 mx-auto mb-2 object-contain"
                        />
                        <p className="text-stone-600 text-sm italic">Sistem Manajemen Penggilingan Gabah</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-3 p-4 mb-6 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit}>
                        <div className="mb-5">
                            <label className="block text-sm font-medium mb-2" htmlFor="username">
                                Username
                            </label>
                            <input
                                type="text"
                                id="username"
                                className="w-full px-4 py-3 bg-stone-300 border border-stone-400 rounded-lg text-stone-900 placeholder-stone-600 focus:outline-none focus:border-brand-light-green focus:ring-2 focus:ring-brand-light-green/20 transition-all"
                                placeholder="Masukkan username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2" htmlFor="password">
                                Password
                            </label>
                            <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                className="w-full px-4 py-3 pr-12 bg-stone-300 border border-stone-400 rounded-lg text-stone-900 placeholder-stone-600 focus:outline-none focus:border-brand-light-green focus:ring-2 focus:ring-brand-light-green/20 transition-all"
                                placeholder="Masukkan password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-stone-600 hover:text-stone-900 transition-colors"
                                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full py-3 px-4 bg-gradient-to-r from-brand-light-green to-brand-light-green hover:from-brand-light-green hover:to-brand-light-green text-white font-semibold rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-brand-light-green/25"
                            disabled={loading}
                        >
                            {loading ? 'Memproses...' : 'Masuk'}
                        </button>
                    </form>

                    <p className="text-center mt-6 text-xs text-stone-500">
                        © 2026 Padi Nadi. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    )
}
