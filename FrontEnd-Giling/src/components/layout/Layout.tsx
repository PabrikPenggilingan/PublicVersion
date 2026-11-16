import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div className="flex min-h-screen bg-stone-100">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="flex-1 flex flex-col w-full md:ml-64 md:w-[calc(100%-16rem)] min-w-0 transition-all duration-300">
                <Navbar onMenuClick={() => setSidebarOpen(prev => !prev)} />
                <main className="flex-1 p-3.5 sm:p-5 md:p-6 overflow-y-auto overflow-x-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
