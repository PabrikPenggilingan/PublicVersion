import toast from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { batchLinksAPI, batchesAPI, type BatchLink } from '@/api/client'
import type { Batch } from '@/types'
import { formatDateShort } from '@/utils/helpers'
import { confirmDialog } from '@/utils/confirmDialog'
import {
    ChevronLeft,
    Link2,
    Copy,
    Check,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Plus,
    ExternalLink
} from 'lucide-react'

export default function LinkManagement() {
    const { id: batchId } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [batch, setBatch] = useState<Batch | null>(null)
    const [links, setLinks] = useState<BatchLink[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [copied, setCopied] = useState<string | null>(null)

    useEffect(() => {
        if (batchId) {
            loadData()
        }
    }, [batchId])

    const loadData = async () => {
        if (!batchId) return
        try {
            setLoading(true)
            const [batchRes, linksRes] = await Promise.all([
                batchesAPI.getById(batchId),
                batchLinksAPI.getByBatch(batchId)
            ])
            setBatch(batchRes.data)
            setLinks(linksRes.data || [])
        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateLink = async () => {
        if (!batchId) return
        try {
            setCreating(true)
            await batchLinksAPI.create(batchId, { formType: 'PURCHASE' })
            loadData()
        } catch (error) {
            console.error('Failed to create link:', error)
            toast.error('Failed to create link')
        } finally {
            setCreating(false)
        }
    }

    const handleToggle = async (link: BatchLink) => {
        try {
            await batchLinksAPI.toggle(link.id, !link.is_active)
            loadData()
        } catch (error) {
            console.error('Failed to toggle link:', error)
        }
    }

    const handleDelete = async (linkId: string) => {
        if (!await confirmDialog('Yakin ingin menghapus link ini?')) return
        try {
            await batchLinksAPI.delete(linkId)
            loadData()
        } catch (error) {
            console.error('Failed to delete link:', error)
        }
    }

    const copyToClipboard = async (linkCode: string) => {
        const fullUrl = `${window.location.origin}/form/batch/${linkCode}`
        await navigator.clipboard.writeText(fullUrl)
        setCopied(linkCode)
        setTimeout(() => setCopied(null), 2000)
    }

    const getFormUrl = (linkCode: string) => {
        return `${window.location.origin}/form/batch/${linkCode}`
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="spinner"></div>
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => navigate(`/batches/${batchId}`)}
                    className="flex items-center gap-2 text-stone-600 hover:text-stone-900 mb-4 transition-colors"
                >
                    <ChevronLeft size={20} />
                    Kembali ke Detail Batch
                </button>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold">Kelola Link Form</h1>
                        <p className="text-stone-600 text-xs sm:text-sm mt-1">
                            Batch: {batch && formatDateShort(batch.batch_date)} •
                            Status: {batch?.status === 'OPEN' ? '🟢 Terbuka' : '🔴 Tertutup'}
                        </p>
                    </div>
                    <button
                        onClick={handleCreateLink}
                        disabled={creating || batch?.status !== 'OPEN'}
                        className="w-full text-white sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-light-green hover:bg-brand-light-green/80 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        <Plus size={18} />
                        {creating ? 'Membuat...' : 'Buat Link Baru'}
                    </button>
                </div>
            </div>

            {batch?.status !== 'OPEN' && (
                <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400">
                    ⚠️ Batch sudah ditutup. Link tidak bisa digunakan untuk mengisi form.
                </div>
            )}

            {/* Links List */}
            <div className="bg-stone-200 border border-stone-300 rounded-xl overflow-hidden">
                {links.length > 0 ? (
                    <div className="divide-y divide-stone-300">
                        {links.map((link) => (
                            <div key={link.id} className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${link.is_active ? 'bg-brand-light-green/20' : 'bg-stone-400'}`}>
                                            <Link2 className={`w-5 h-5 ${link.is_active ? 'text-brand-light-green' : 'text-stone-600'}`} />
                                        </div>
                                        <div>
                                            <p className="font-mono font-medium">{link.link_code}</p>
                                            <p className="text-xs text-stone-600">
                                                {link.form_type} • Dibuat {formatDateShort(link.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleToggle(link)}
                                            className={`p-2 rounded-lg transition-colors ${link.is_active
                                                ? 'bg-brand-light-green/20 text-brand-light-green'
                                                : 'bg-stone-400 text-stone-600'
                                                }`}
                                            title={link.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                        >
                                            {link.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(link.id)}
                                            className="p-2 rounded-lg text-stone-600 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* URL Box */}
                                <div className="flex items-center gap-2 p-3 bg-stone-100 rounded-lg">
                                    <input
                                        type="text"
                                        value={getFormUrl(link.link_code)}
                                        readOnly
                                        className="flex-1 bg-transparent text-sm text-stone-700 focus:outline-none"
                                    />
                                    <button
                                        onClick={() => copyToClipboard(link.link_code)}
                                        className="p-2 rounded-lg bg-stone-300 hover:bg-stone-400 transition-colors"
                                        title="Copy link"
                                    >
                                        {copied === link.link_code ? (
                                            <Check size={16} className="text-brand-light-green" />
                                        ) : (
                                            <Copy size={16} />
                                        )}
                                    </button>
                                    <a
                                        href={getFormUrl(link.link_code)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded-lg bg-stone-300 hover:bg-stone-400 transition-colors"
                                        title="Buka di tab baru"
                                    >
                                        <ExternalLink size={16} />
                                    </a>
                                </div>

                                {!link.is_active && (
                                    <p className="text-xs text-yellow-400 mt-2">
                                        ⚠️ Link tidak aktif - Employee tidak bisa mengisi form
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Link2 className="w-16 h-16 text-stone-400 mx-auto mb-4" />
                        <h3 className="font-semibold mb-2">Belum Ada Link</h3>
                        <p className="text-stone-600 text-sm mb-6">
                            Buat link untuk share ke employee agar bisa mengisi form pembelian
                        </p>
                        {batch?.status === 'OPEN' && (
                            <button
                                onClick={handleCreateLink}
                                disabled={creating}
                                className="px-6 py-3 text-white bg-brand-light-green hover:bg-brand-light-green/80 rounded-lg font-medium transition-colors"
                            >
                                <Plus size={18} className="inline mr-2" />
                                Buat Link Pertama
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Instructions */}
            <div className="mt-6 p-4 bg-stone-200 border border-stone-300 rounded-xl">
                <h3 className="font-semibold mb-2">📋 Cara Penggunaan</h3>
                <ol className="text-sm text-stone-600 space-y-1 list-decimal list-inside">
                    <li>Klik "Buat Link Baru" untuk generate link form</li>
                    <li>Copy link dan kirim ke employee (via WhatsApp, dll)</li>
                    <li>Employee buka link → Login → Isi form pembelian</li>
                    <li>Data akan masuk otomatis ke batch ini</li>
                </ol>
            </div>
        </div>
    )
}
