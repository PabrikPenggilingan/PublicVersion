import { useState } from 'react'
import { User } from 'lucide-react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import MapArea, { LocationEntity } from './components/MapArea'

export default function Community() {
    const [activeTab, setActiveTab] = useState<'direct'|'group'|'find'>('group')
    const [activeChat, setActiveChat] = useState<string | null>('2')
    const [selectedLocation, setSelectedLocation] = useState<LocationEntity | null>(null)

    return (
        <div className="flex flex-col h-screen w-full bg-stone-100 overflow-hidden">
            {/* Top Logo Header matching the mockup */}
            <div className="h-14 bg-stone-200 border-b border-stone-300 flex items-center justify-between px-6 shrink-0">
                <img src="/logo.png" alt="Logo" className="h-8 object-contain" />
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-stone-600 hover:bg-stone-300 hover:text-stone-900 transition-colors">
                    <span className="font-medium text-sm hidden sm:block">Profile</span>
                    <div className="w-8 h-8 rounded-full bg-stone-400 flex items-center justify-center shrink-0 border border-stone-500">
                        <User size={16} className="text-stone-600" />
                    </div>
                </button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
                <Sidebar 
                    activeTab={activeTab} 
                    setActiveTab={setActiveTab} 
                    activeChat={activeChat} 
                    setActiveChat={setActiveChat}
                    selectedLocation={selectedLocation}
                    setSelectedLocation={setSelectedLocation}
                />
                {activeTab === 'find' ? (
                    <MapArea 
                        selectedLocation={selectedLocation}
                        setSelectedLocation={setSelectedLocation}
                    />
                ) : (
                    <ChatArea activeChat={activeChat} />
                )}
            </div>
        </div>
    )
}
