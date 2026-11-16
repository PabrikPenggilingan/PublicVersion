/**
 * Client-side image compression utility.
 * Compresses an image File to a target size using Canvas API.
 * PDFs are returned as-is (cannot be compressed via Canvas).
 */

const TARGET_KB = 200
const MAX_DIMENSION = 1920

/**
 * Compresses an image file to ≤200KB using Canvas API.
 * Falls back to the original file if:
 * - The file is already small enough
 * - The file is a PDF
 * - Canvas compression is unavailable
 */
export async function compressImage(file: File, targetKB: number = TARGET_KB): Promise<File> {
    // Skip PDFs — can't compress via Canvas
    if (file.type === 'application/pdf') {
        return file
    }

    // Skip non-images
    if (!file.type.startsWith('image/')) {
        return file
    }

    const targetBytes = targetKB * 1024

    // Already small enough
    if (file.size <= targetBytes) {
        return file
    }

    try {
        const compressed = await _compressWithCanvas(file, targetBytes)
        // If somehow compression made it bigger (very rare), use original
        return compressed.size < file.size ? compressed : file
    } catch (e) {
        console.warn('[imageCompression] Canvas compression failed, using original:', e)
        return file
    }
}

async function _compressWithCanvas(file: File, targetBytes: number): Promise<File> {
    const img = await _loadImage(file)

    // Determine output dimensions, capping at MAX_DIMENSION
    let { width, height } = img
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
            height = Math.round((height / width) * MAX_DIMENSION)
            width = MAX_DIMENSION
        } else {
            width = Math.round((width / height) * MAX_DIMENSION)
            height = MAX_DIMENSION
        }
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, width, height)

    // Try progressively lower quality until we hit the target
    const qualities = [0.85, 0.75, 0.65, 0.55, 0.45]
    for (const quality of qualities) {
        const blob = await _canvasToBlob(canvas, 'image/jpeg', quality)
        if (blob.size <= targetBytes || quality === qualities[qualities.length - 1]) {
            return new File([blob], _toJpegName(file.name), {
                type: 'image/jpeg',
                lastModified: Date.now(),
            })
        }
    }

    // Fallback: return a max-compressed version regardless of size
    const blob = await _canvasToBlob(canvas, 'image/jpeg', 0.45)
    return new File([blob], _toJpegName(file.name), {
        type: 'image/jpeg',
        lastModified: Date.now(),
    })
}

function _loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
        img.src = url
    })
}

function _canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('toBlob returned null')),
            type,
            quality
        )
    })
}

function _toJpegName(name: string): string {
    const base = name.replace(/\.[^.]+$/, '')
    return `${base}.jpg`
}
