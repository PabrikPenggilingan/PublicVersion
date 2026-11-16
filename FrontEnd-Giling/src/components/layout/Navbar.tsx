import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getInitials } from '@/utils/helpers'
import { Menu } from 'lucide-react'

interface NavbarProps {
    onMenuClick?: () => void
}

export default function Navbar({ onMenuClick }: NavbarProps) {
    const location = useLocation()
    const { user } = useAuth()

    const getPageTitle = (): string => {
        const path = location.pathname
        if (path === '/dashboard') return 'Dashboard'
        if (path === '/batches') return 'Belanja'
        if (path.startsWith('/batches/')) return 'Detail Belanja'
        if (path === '/pendataan') return 'Pendataan Gabah'
        if (path.startsWith('/pendataan/')) return 'Detail Pendataan'
        if (path === '/drying') return 'Pengeringan'
        if (path.startsWith('/drying/')) return 'Detail Pengeringan'
        if (path === '/inventory') return 'Inventaris Gudang'
        if (path.startsWith('/inventory/')) return 'Detail Stok'
        if (path === '/processes') return 'Proses Giling'
        if (path.startsWith('/processes/')) return 'Detail Proses Giling'
        if (path === '/sales') return 'Nota Penjualan'
        if (path.startsWith('/sales/')) return 'Detail Penjualan'
        if (path === '/customers') return 'Data Pelanggan'
        if (path === '/price-list') return 'Daftar Harga'
        if (path === '/logistics') return 'Logistik & Transport'
        if (path === '/finance') return 'Finance Dashboard'
        if (path === '/finance/ledger') return 'Buku Besar Akuntansi'
        if (path === '/finance/approvals') return 'Approval Center'
        if (path === '/finance/accounts') return 'Akun Keuangan'
        if (path === '/finance/coa') return 'Chart of Accounts'
        if (path === '/finance/overhead') return 'Biaya Operasional'
        if (path === '/finance/debt') return 'Hutang / Piutang'
        if (path === '/ai-analysis') return 'AI Analysis & Audit'
        if (path === '/activity-logs') return 'Activity Logs'
        if (path === '/settings') return 'Pengaturan'
        if (path === '/master-account') return 'Master Akun'
        if (path === '/master-page') return 'Master Page'
        if (path === '/link-management') return 'Link Management'
        return 'Padi Nadi'
    }

    return (
        <header className="h-16 bg-stone-200 border-b border-stone-300 flex items-center justify-between px-3.5 sm:px-6 sticky top-0 z-30 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <button
                    onClick={onMenuClick}
                    className="p-2 -ml-1 text-stone-700 hover:text-stone-900 hover:bg-stone-300 rounded-lg md:hidden transition-colors"
                    aria-label="Buka menu"
                >
                    <Menu size={22} />
                </button>
                <h1 className="text-base sm:text-lg font-semibold truncate max-w-[200px] sm:max-w-xs md:max-w-none">
                    {getPageTitle()}
                </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-stone-300 rounded-full shrink-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-brand-light-green to-brand-light-green rounded-full flex items-center justify-center text-xs font-semibold shrink-0">
                    {getInitials(user?.username)}
                </div>
                <span className="text-xs sm:text-sm font-medium hidden sm:inline max-w-[120px] truncate">
                    {user?.username}
                </span>
            </div>
        </header>
    )
}
