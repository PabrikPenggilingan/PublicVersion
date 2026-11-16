import { ImageOff } from 'lucide-react'
import { useState } from 'react'

/**
 * Turn a stored upload path into a URL the app can load.
 * Paths in the database come in several shapes:
 *   uploads\purchases\photos-1.png          (Windows separators)
 *   C:\...\backend\uploads\drying\drying-1.png (absolute path)
 *   milling/milling-1.png                  (no uploads/ prefix)
 *   https://...                            (already a URL)
 */
export function photoUrl(path?: string | null): string | null {
    if (!path) return null
    const p = String(path).trim()
    if (!p) return null
    if (/^(https?:|blob:|data:)/i.test(p)) return p
    const normalized = p.replace(/\\/g, '/')
    const idx = normalized.toLowerCase().lastIndexOf('uploads/')
    const rel = idx >= 0 ? normalized.slice(idx) : `uploads/${normalized.replace(/^\/+/, '')}`
    return `/${rel}`
}

function Thumb({ url, alt, size }: { url: string; alt: string; size: string }) {
    const [broken, setBroken] = useState(false)
    if (broken) {
        return (
            <div className={`${size} rounded-lg bg-stone-300 flex flex-col items-center justify-center text-stone-500 text-[9px] text-center p-1`} title="Foto tidak ditemukan di server">
                <ImageOff size={16} />
                <span>Tidak tersedia</span>
            </div>
        )
    }
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className={`${size} block rounded-lg overflow-hidden border border-stone-300 bg-stone-100 hover:opacity-90`}>
            <img src={url} alt={alt} loading="lazy" className="w-full h-full object-cover" onError={() => setBroken(true)} />
        </a>
    )
}

/** Row of clickable photo thumbnails (opens the full photo in a new tab). */
export default function PhotoStrip({
    paths,
    label = 'Foto',
    size = 'w-20 h-20',
    emptyText,
}: {
    paths?: (string | null | undefined)[] | null
    label?: string
    size?: string
    emptyText?: string
}) {
    const urls = (paths || []).map(photoUrl).filter((u): u is string => !!u)
    if (urls.length === 0) {
        return emptyText ? <p className="text-xs text-stone-500 italic">{emptyText}</p> : null
    }
    return (
        <div>
            {label && <p className="text-[10px] text-stone-500 uppercase font-bold mb-1.5">{label} ({urls.length})</p>}
            <div className="flex flex-wrap gap-2">
                {urls.map((url, i) => <Thumb key={url + i} url={url} alt={`${label} ${i + 1}`} size={size} />)}
            </div>
        </div>
    )
}
