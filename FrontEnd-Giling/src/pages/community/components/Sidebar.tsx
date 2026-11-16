import { MessageSquare, Users, MapPin, User, Plus } from 'lucide-react'
import { cn } from '@/utils/helpers'
import { mockLocations, LocationEntity } from './MapArea'

interface ChatPreview {
    id: string
    name: string
    lastMessage: string
    type: 'direct' | 'group'
    avatar?: string
}

const mockChats: ChatPreview[] = [
    { id: '1', name: 'Pak Akmal, Pemilik Pabrik Penggiling...', lastMessage: 'Person A: Tolong siapkan sat...', type: 'direct' },
    { id: '2', name: 'Grup Penggilingan Jabar', lastMessage: 'Person A: Tolong siapkan sat...', type: 'group' },
    { id: '3', name: 'Budi, Pemasok Gabah', lastMessage: 'Person A: Tolong siapkan sat...', type: 'direct' },
    { id: '4', name: 'Koperasi Tani Sukamakmur', lastMessage: 'Person A: Tolong siapkan sat...', type: 'group' },
    { id: '5', name: 'Agus, Transportasi', lastMessage: 'Person A: Tolong siapkan sat...', type: 'direct' },
    { id: '6', name: 'Grup Petani Karawang', lastMessage: 'Person A: Tolong siapkan sat...', type: 'group' },
]

export default function Sidebar({
    activeTab,
    setActiveTab,
    activeChat,
    setActiveChat,
    selectedLocation,
    setSelectedLocation
}: {
    activeTab: 'direct' | 'group' | 'find',
    setActiveTab: (tab: 'direct' | 'group' | 'find') => void,
    activeChat: string | null,
    setActiveChat: (id: string) => void,
    selectedLocation: LocationEntity | null,
    setSelectedLocation: (loc: LocationEntity | null) => void
}) {
    const filteredChats = mockChats.filter(c => c.type === activeTab)

    return (
        <div className="w-80 h-full bg-stone-200 border-r border-stone-300 flex flex-col shrink-0">
            <div className="p-4 border-b border-stone-300 bg-stone-200/50">
                {activeTab === 'find' ? (
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-stone-900 px-2 py-1 bg-stone-300 rounded w-full text-center">
                            Orang dan Komunitas Terdekat
                        </h2>
                    </div>
                ) : (
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-stone-900">Chats</h2>
                        <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-stone-300 text-stone-600 hover:text-stone-900 hover:bg-stone-400 transition-colors">
                            <Plus size={18} />
                        </button>
                    </div>
                )}

                <div className="space-y-2">
                    <button
                        onClick={() => setActiveTab('direct')}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border",
                            activeTab === 'direct'
                                ? "bg-brand-light-green/20 text-brand-light-green border-brand-light-green/30"
                                : "text-stone-600 hover:bg-stone-300 hover:text-stone-900 border-transparent"
                        )}
                    >
                        <MessageSquare size={18} />
                        <span className="font-medium text-sm">Pesan langsung</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('group')}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border",
                            activeTab === 'group'
                                ? "bg-brand-light-green/20 text-brand-light-green border-brand-light-green/30"
                                : "text-stone-600 hover:bg-stone-300 hover:text-stone-900 border-transparent"
                        )}
                    >
                        <Users size={18} />
                        <span className="font-medium text-sm">Grup</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('find')}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border",
                            activeTab === 'find'
                                ? "bg-brand-light-green/20 text-brand-light-green border-brand-light-green/30"
                                : "text-stone-600 hover:bg-stone-300 hover:text-stone-900 border-transparent"
                        )}
                    >
                        <MapPin size={18} />
                        <span className="font-medium text-sm text-left leading-tight">Cari terdekat<br /><span className="text-[10px] opacity-70">di sekitar Anda</span></span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                {activeTab === 'find' ? (
                    mockLocations.map((loc) => (
                        <button
                            key={loc.id}
                            onClick={() => setSelectedLocation(loc)}
                            className={cn(
                                "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                                selectedLocation?.id === loc.id
                                    ? "bg-stone-300/80 shadow-md border border-stone-400"
                                    : "hover:bg-stone-300/50 border border-transparent"
                            )}
                        >
                            <div className="w-10 h-10 rounded-full bg-stone-400 flex items-center justify-center shrink-0 border border-stone-500">
                                {loc.type === 'community' ? <Users size={20} className="text-stone-600" /> : <User size={20} className="text-stone-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-black truncate">{loc.name}</div>
                            </div>
                            <div className="text-xs text-stone-600 shrink-0">{loc.distance}</div>
                        </button>
                    ))
                ) : (
                    filteredChats.map((chat) => (
                        <button
                            key={chat.id}
                            onClick={() => setActiveChat(chat.id)}
                            className={cn(
                                "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                                activeChat === chat.id
                                    ? "bg-stone-300/80 shadow-md border border-stone-400"
                                    : "hover:bg-stone-300/50 border border-transparent"
                            )}
                        >
                            <div className="w-10 h-10 rounded-full bg-stone-400 flex items-center justify-center shrink-0 border border-stone-500">
                                {chat.type === 'group' ? <Users size={20} className="text-stone-600" /> : <User size={20} className="text-stone-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-black truncate">{chat.name}</div>
                                <div className="text-xs text-stone-600 truncate mt-0.5">{chat.lastMessage}</div>
                            </div>
                        </button>
                    ))
                )}
            </div>

        </div>
    )
}
