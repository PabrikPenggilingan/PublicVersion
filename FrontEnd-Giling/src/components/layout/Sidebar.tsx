import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
    LayoutDashboard,
    Package,
    Database,
    Sun,
    Warehouse,
    Factory,
    LogOut,
    Wheat,
    Activity,
    ChevronDown,
    Layers,
    Trash2,
    Users,
    Tag,
    ShoppingCart,
    Landmark,
    BrainCircuit,
    Truck,
    FileText,
    CheckCircle,
    Settings,
    X
} from 'lucide-react'
import { cn } from '@/utils/helpers'

interface SubItem {
    label: string
    categoryCode?: string
    icon?: React.ReactNode
    color?: string
}

interface NavItem {
    path: string
    icon: React.ElementType
    label: string
    children?: SubItem[]
    minTier?: string
    moduleCode?: string
}

interface SidebarProps {
    isOpen?: boolean
    onClose?: () => void
}

const NAV_ITEMS: NavItem[] = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', moduleCode: 'DASHBOARD' },
    { path: '/batches', icon: Package, label: 'Belanja', moduleCode: 'PURCHASES' },
    { path: '/pendataan', icon: Database, label: 'Pendataan Gabah', moduleCode: 'PENDATAAN' },
    { path: '/drying', icon: Sun, label: 'Pengeringan', moduleCode: 'DRYING' },
    {
        path: '/inventory', icon: Warehouse, label: 'Inventaris', moduleCode: 'INVENTORY',
        children: [
            { label: 'Semua Stok' },
            { label: 'Gabah', categoryCode: 'GABAH', icon: <Wheat size={14} />, color: 'rgb(var(--color-amber-500))' },
            { label: 'Beras', categoryCode: 'BERAS', icon: <Package size={14} />, color: 'rgb(var(--color-brand-light-green))' },
            { label: 'Produk Turunan', categoryCode: 'TURUNAN', icon: <Layers size={14} />, color: 'rgb(var(--color-violet-500))' },
            { label: 'Limbah / Sekam', categoryCode: 'LIMBAH', icon: <Trash2 size={14} />, color: 'rgb(var(--color-gray-500))' },
        ]
    },
    { path: '/processes', icon: Factory, label: 'Proses Giling', moduleCode: 'PROCESSES' },
    {
        path: '/sales', icon: ShoppingCart, label: 'Penjualan', moduleCode: 'SALES',
        children: [
            { label: 'Nota Penjualan', categoryCode: 'SALES', icon: <ShoppingCart size={14} />, color: 'rgb(var(--color-blue-500))' },
            { label: 'Data Pelanggan', categoryCode: 'CUSTOMERS', icon: <Users size={14} />, color: 'rgb(var(--color-brand-light-green))' },
            { label: 'Daftar Harga', categoryCode: 'PRICES', icon: <Tag size={14} />, color: 'rgb(var(--color-amber-500))' },
        ]
    },
    { path: '/logistics', icon: Truck, label: 'Logistik & Transport', moduleCode: 'LOGISTICS' },
    {
        path: '/finance', icon: Landmark, label: 'Finance Center', minTier: 'TIER_B', moduleCode: 'FINANCE',
        children: [
            { label: 'Dashboard', categoryCode: 'FINANCE_DASHBOARD', icon: <Landmark size={14} />, color: 'rgb(var(--color-brand-light-green))' },
            { label: 'Bagan Akun (CoA)', categoryCode: 'COA', icon: <FileText size={14} />, color: 'rgb(var(--color-amber-500))' },
            { label: 'Approval Transaksi', categoryCode: 'APPROVALS', icon: <CheckCircle size={14} />, color: 'rgb(var(--color-blue-500))' },
        ]
    },
    { path: '/ai-analysis', icon: BrainCircuit, label: 'AI Analysis', moduleCode: 'AI_ANALYSIS' },
    { path: '/logs', icon: Activity, label: 'Riwayat Aktivitas', moduleCode: 'LOGS' },
    { path: '/settings', icon: Settings, label: 'Pengaturan Sistem', minTier: 'TIER_B', moduleCode: 'SETTINGS' },
]

const ADMIN_ITEMS = [
    { path: '/master-page', icon: Users, label: 'Master Akses' },
    { path: '/master-account', icon: CheckCircle, label: 'Master Akun' }
]

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
    const { logout, user } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()

    // Auto-open accordions when on their paths
    const [expanded, setExpanded] = useState<string | null>(() => {
        if (location.pathname.startsWith('/inventory')) return '/inventory'
        if (location.pathname.startsWith('/sales') || location.pathname === '/customers' || location.pathname === '/price-list') return '/sales'
        if (location.pathname.startsWith('/finance')) return '/finance'
        return null
    })

    // Determine which category sub-item is active from the URL
    const activeCategory = new URLSearchParams(location.search).get('category') || null

    const handleSubNav = (parentPath: string, categoryCode?: string) => {
        let url = parentPath
        if (categoryCode) {
            // Mapping for special categories
            if (categoryCode === 'SALES') url = '/sales'
            else if (categoryCode === 'CUSTOMERS') url = '/customers'
            else if (categoryCode === 'PRICES') url = '/price-list'
            else if (categoryCode === 'FINANCE_DASHBOARD') url = '/finance'
            else if (categoryCode === 'COA') url = '/finance/coa'
            else if (categoryCode === 'APPROVALS') url = '/finance/approvals'
            else url = `${parentPath}?category=${categoryCode}`
        }
        navigate(url)
        onClose?.()
    }

    const handleItemClick = () => {
        setExpanded(null)
        onClose?.()
    }

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            <aside
                className={cn(
                    'w-64 h-screen bg-stone-200 border-r border-stone-300 fixed left-0 top-0 flex flex-col z-50 transition-transform duration-300 ease-in-out',
                    isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
                )}
                // 100dvh = the visible screen on phones (100vh runs under the browser toolbar and hid Logout)
                style={{ height: '100dvh' }}
            >
                {/* Logo & Close Button */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-stone-300 shrink-0">
                    <img
                        src="/logo.png"
                        alt="Padi Nadi Logo"
                        className="h-9 object-contain"
                    />
                    {/* Close button — meets 44px touch target */}
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-300 md:hidden transition-colors"
                        aria-label="Tutup menu"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 min-h-0 p-4 overflow-y-auto overscroll-contain">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 px-3 mb-2">
                        Menu Utama
                    </div>

                    {NAV_ITEMS.filter(item => {
                        // Admin can see all main menu items
                        if (user?.role === 'admin') return true;

                        // Finance Center is for the pabrik owner/admin only (backend blocks it too)
                        if (item.moduleCode === 'FINANCE' && ['operator', 'viewer'].includes(String(user?.role || '').toLowerCase())) return false;

                        // For other roles, check accessible_modules (default to all if not set)
                        if (item.moduleCode) {
                            const allowedModules = user?.accessible_modules || NAV_ITEMS.map(m => m.moduleCode).filter(Boolean);
                            return allowedModules.includes(item.moduleCode);
                        }

                        return true;
                    }).map((item) => {
                        const isOnPath = location.pathname.startsWith(item.path)
                        const hasChildren = item.children && item.children.length > 0
                        const isExpanded = expanded === item.path

                        // Items with children: accordion toggle
                        if (hasChildren) {
                            return (
                                <div key={item.path} className="mb-1">
                                    {/* Parent button */}
                                    <button
                                        onClick={() => setExpanded(isExpanded ? null : item.path)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all min-h-[44px]',
                                            isOnPath
                                                ? 'bg-brand-light-green/20 text-brand-light-green'
                                                : 'text-stone-600 hover:bg-stone-300 hover:text-stone-900'
                                        )}
                                    >
                                        <item.icon size={20} />
                                        <span className="flex-1 text-left">{item.label}</span>
                                        <ChevronDown
                                            size={16}
                                            className={cn(
                                                'transition-transform duration-200 text-stone-600',
                                                isExpanded && 'rotate-180 text-brand-light-green'
                                            )}
                                        />
                                    </button>

                                    {/* Accordion children */}
                                    <div
                                        className={cn(
                                            'overflow-hidden transition-all duration-200 pl-4 space-y-1',
                                            isExpanded ? 'max-h-60 mt-1' : 'max-h-0'
                                        )}
                                    >
                                        {item.children?.map((child) => {
                                            const isActive = activeCategory === child.categoryCode ||
                                                (!activeCategory && !child.categoryCode && location.pathname === item.path)
                                            return (
                                                <button
                                                    key={child.label}
                                                    onClick={() => handleSubNav(item.path, child.categoryCode)}
                                                    className={cn(
                                                        'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left min-h-[40px]',
                                                        isActive
                                                            ? 'text-stone-900'
                                                            : 'text-stone-600 hover:bg-stone-300 hover:text-stone-900'
                                                    )}
                                                    style={isActive && child.color ? { backgroundColor: child.color + '25', color: child.color } : {}}
                                                >
                                                    <span style={{ color: child.color || 'currentColor' }}>
                                                        {child.icon || <Warehouse size={14} />}
                                                    </span>
                                                    {child.label}
                                                    {isActive && (
                                                        <span
                                                            className="ml-auto w-1.5 h-1.5 rounded-full"
                                                            style={{ backgroundColor: child.color || '#6B7280' }}
                                                        />
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        }

                        // Regular flat items
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={handleItemClick}
                                className={({ isActive }) => cn(
                                    'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all mb-1 min-h-[44px]',
                                    isActive
                                        ? 'bg-brand-light-green/20 text-brand-light-green'
                                        : 'text-stone-600 hover:bg-stone-300 hover:text-stone-900'
                                )}
                            >
                                <item.icon size={20} />
                                <span>{item.label}</span>
                            </NavLink>
                        )
                    })}

                    {user?.role === 'admin' && (
                        <>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 px-3 mt-4 mb-2">
                                Super Admin
                            </div>
                            {ADMIN_ITEMS.map((item) => {
                                const isActive = location.pathname.startsWith(item.path)
                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        onClick={handleItemClick}
                                        className={cn(
                                            'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all mb-1 min-h-[44px]',
                                            isActive
                                                ? 'bg-brand-light-green/20 text-brand-light-green'
                                                : 'text-stone-600 hover:bg-stone-300 hover:text-stone-900'
                                        )}
                                    >
                                        <item.icon size={20} />
                                        <span>{item.label}</span>
                                    </NavLink>
                                )
                            })}
                        </>
                    )}
                </nav>

                {/* Footer */}
                <div
                    className="shrink-0 p-3 border-t border-stone-300 safe-bottom bg-stone-200"
                    style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
                >
                    <button
                        onClick={() => {
                            logout()
                            onClose?.()
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-sm font-medium text-stone-600 bg-stone-300/50 hover:bg-red-500/20 hover:text-red-400 transition-all min-h-[44px]"
                    >
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </>
    )
}
