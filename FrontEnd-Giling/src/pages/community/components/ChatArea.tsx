import { User, Users, MessageSquare, Paperclip, Send } from 'lucide-react'
import { cn } from '@/utils/helpers'

interface Message {
    id: string
    text: string
    time: string
    isSender: boolean
    userAvatar?: string
}

const mockDirectMessages: Message[] = [
    { id: '1', text: 'Selamat siang Pak Michael', time: '14:05', isSender: false },
    { id: '2', text: 'Selamat siang Pak Akmal', time: '14:05', isSender: true },
    { id: '3', text: 'Apakah bapak masih memiliki slot penggiling?', time: '14:05', isSender: false },
    { id: '4', text: 'Masih banyak pak, ingin pinjam berapa', time: '14:05', isSender: true },
    { id: '5', text: 'Saya ingin pinjam satu, nanti saya bayar via tf', time: '14:05', isSender: false },
    { id: '6', text: 'Totalnya 5 juta pak', time: '14:07', isSender: true },
    { id: '7', text: 'Akan saya kirim sekarang', time: '14:07', isSender: false },
    { id: '8', text: 'Baik, ditunggu ya', time: '14:07', isSender: true },
]

const mockGroupMessages: Message[] = [
    { id: '1', text: 'Selamat siang semuanya', time: '14:05', isSender: false, userAvatar: 'A' },
    { id: '2', text: 'Apakah ada yang punya kenalan jasa gudang?', time: '14:05', isSender: false, userAvatar: 'A' },
    { id: '3', text: 'Saya punya pak, ada di Sidoarjo', time: '14:05', isSender: false, userAvatar: 'B' },
    { id: '4', text: 'Waduh terlalu jauh, apakah ada kenalan lain', time: '14:05', isSender: false, userAvatar: 'A' },
    { id: '5', text: 'Saya punya pak, di Karawang', time: '14:07', isSender: true, },
    { id: '6', text: 'Apakah bisa memberikan nomornya?', time: '14:07', isSender: false, userAvatar: 'C' },
    { id: '7', text: 'Ini pak: XXXYYYYZZZZ', time: '14:07', isSender: true },
]

export default function ChatArea({ activeChat }: { activeChat: string | null }) {
    if (!activeChat) {
        return (
            <div className="flex-1 bg-stone-100 flex flex-col items-center justify-center text-stone-600">
                <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
                <p>Select a chat to start messaging</p>
            </div>
        )
    }

    const isGroup = activeChat === '2' || activeChat === '4' || activeChat === '6'
    const messages = isGroup ? mockGroupMessages : mockDirectMessages
    const chatTitle = isGroup ? 'Komunitas Pabrik Penggiling Karawang' : 'Pak Akmal, Pemilik Pabrik Penggiling Karawang'

    return (
        <div className="flex-1 bg-stone-100 flex flex-col h-full overflow-hidden">
            {/* Chat Header */}
            <div className="h-[72px] px-6 border-b border-stone-300 bg-stone-200/80 flex items-center gap-4 shrink-0 backdrop-blur-sm">
                <div className="w-12 h-12 rounded-full bg-stone-400 flex items-center justify-center border border-stone-500">
                    {isGroup ? <Users size={24} className="text-stone-600" /> : <User size={24} className="text-stone-600" />}
                </div>
                <div>
                    <h2 className="font-semibold text-stone-900">{chatTitle}</h2>
                    <p className="text-xs text-stone-600">{isGroup ? '128 members, 4 online' : 'Online'}</p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            "flex max-w-[70%]",
                            msg.isSender ? "ml-auto justify-end" : "mr-auto justify-start"
                        )}
                    >
                        {!msg.isSender && msg.userAvatar && (
                            <div className="w-8 h-8 rounded-full bg-stone-300 text-stone-700 flex items-center justify-center text-xs font-bold mr-3 shrink-0 self-end mb-1 border border-stone-400">
                                {msg.userAvatar}
                            </div>
                        )}
                        <div className="flex flex-col">
                            <div
                                className={cn(
                                    "px-4 py-2.5 rounded-2xl relative group",
                                    msg.isSender
                                        ? "bg-brand-light-green text-white rounded-tr-sm"
                                        : "bg-stone-200 text-black border border-stone-300 rounded-tl-sm"
                                )}
                            >
                                <p className="text-sm leading-relaxed">{msg.text}</p>
                                <div className={cn(
                                    "text-[10px] mt-1 flex items-center gap-1",
                                    msg.isSender ? "text-brand-light-green justify-end" : "text-stone-600 justify-start"
                                )}>
                                    {msg.time}
                                    {msg.isSender && <span className="opacity-80">✓✓</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-stone-200/80 border-t border-stone-300 shrink-0 backdrop-blur-sm">
                <div className="flex items-center gap-2 max-w-4xl mx-auto">
                    <button className="p-2.5 text-stone-600 hover:text-stone-900 hover:bg-stone-300 rounded-full transition-colors shrink-0">
                        <Paperclip size={20} />
                    </button>
                    <div className="flex-1 bg-stone-100 border border-stone-300 rounded-full px-4 py-2.5 flex items-center">
                        <input
                            type="text"
                            placeholder="Ketik pesan di sini..."
                            className="flex-1 bg-transparent border-none outline-none text-sm text-stone-900 placeholder-stone-500"
                        />
                    </div>
                    <button className="p-2.5 bg-brand-light-green hover:bg-brand-light-green/80 text-stone-900 rounded-full transition-colors shadow-lg shadow-brand-light-green/25 shrink-0 flex items-center justify-center">
                        <Send size={18} className="ml-0.5" />
                    </button>
                </div>
                <div className="text-[10px] text-stone-500 text-center mt-2">
                    (untuk attach gambar) gunakan icon paperclip
                </div>
            </div>
        </div>
    )
}
