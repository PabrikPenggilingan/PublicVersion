import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authAPI } from '@/api/client'
import type { User } from '@/types'

interface AuthContextType {
    user: User | null
    loading: boolean
    login: (username: string, password: string) => Promise<void>
    logout: () => Promise<void>
    checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

interface AuthProviderProps {
    children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        checkAuth()
    }, [])

    const checkAuth = async () => {
        try {
            const response = await authAPI.me()
            setUser(response.data)
        } catch {
            setUser(null)
        } finally {
            setLoading(false)
        }
    }

    const login = async (username: string, password: string) => {
        const response = await authAPI.login(username, password)
        setUser(response.data.user)
    }

    const logout = async () => {
        try {
            await authAPI.logout()
        } catch (e) {
            console.error('Logout failed', e)
        }
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
