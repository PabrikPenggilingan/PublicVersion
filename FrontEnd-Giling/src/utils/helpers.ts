import type { BatchStatus, ProcessStatus, KualitasGabah, HasilKualitas } from '@/types'

// Format number as currency (IDR)
export function formatCurrency(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount)
}

// Format number with thousand separator
export function formatNumber(num: number | null | undefined, decimals = 2): string {
    if (num === null || num === undefined) return '-'
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num)
}

// Format date
export function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date)
}

// Format date short
export function formatDateShort(dateString: string | null | undefined): string {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date)
}

// Get status badge classes (Tailwind)
type StatusType = BatchStatus | ProcessStatus | KualitasGabah | HasilKualitas | 'PENDING' | 'PENDING_APPROVAL' | 'AVAILABLE' | 'RESERVED' | 'DEPLETED'

export function getStatusClasses(status: StatusType, context?: 'drying' | 'milling'): string {
    const classes: Record<string, string> = {
        OPEN: 'bg-brand-light-green/20 text-brand-light-green',
        CLOSED: 'bg-slate-500/20 text-slate-500',
        PENDING: 'bg-slate-500/20 text-slate-500',
        IN_PROGRESS: 'bg-amber-500/30 text-amber-500',
        PENDING_APPROVAL: 'bg-purple-500/20 text-purple-400',
        COMPLETED: context === 'milling' ? 'bg-brand-light-green/20 text-brand-light-green' : 'bg-purple-500/20 text-purple-400',
        CANCELLED: 'bg-red-500/20 text-red-400',
        AVAILABLE: 'bg-brand-light-green/20 text-brand-light-green',
        RESERVED: 'bg-amber-500/20 text-amber-400',
        DEPLETED: 'bg-slate-500/20 text-slate-500',
        jelek: 'bg-red-500/20 text-red-400',
        biasa: 'bg-slate-500/20 text-slate-500',
        bagus: 'bg-blue-500/20 text-blue-400',
        sangat_bagus: 'bg-brand-light-green/20 text-brand-light-green',
        IN_WAREHOUSE: 'bg-brand-light-green/20 text-brand-light-green',
    }
    return classes[status as string] || 'bg-slate-500/20 text-slate-500'
}

// Translate status to Indonesian
export function translateStatus(status: StatusType, context?: 'drying' | 'milling'): string {
    const translations: Record<string, string> = {
        OPEN: 'Terbuka',
        CLOSED: 'Tertutup',
        PENDING: 'Pending',
        IN_PROGRESS: 'Sedang Proses',
        PENDING_APPROVAL: 'Menunggu Persetujuan',
        COMPLETED: context === 'milling' ? 'Selesai' : 'Menunggu Masuk Gudang',
        IN_WAREHOUSE: 'Selesai',
        CANCELLED: 'Batal',
        jelek: 'Jelek',
        biasa: 'Biasa',
        bagus: 'Bagus',
        sangat_bagus: 'Sangat Bagus',
    }
    return translations[status as string] || status
}

// Get user initials
export function getInitials(name: string | undefined): string {
    if (!name) return '?'
    return name.charAt(0).toUpperCase()
}

// Classnames helper
export function cn(...classes: (string | undefined | false)[]): string {
    return classes.filter(Boolean).join(' ')
}
