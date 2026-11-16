import { useState, useRef } from 'react'
import { filesAPI, type FileData } from '@/api/client'
import { Upload, X, File, Image, Trash2, Loader } from 'lucide-react'
import { cn } from '@/utils/helpers'
import { confirmDialog } from '@/utils/confirmDialog'
import { compressImage } from '@/utils/imageCompression'

interface FileUploadProps {
    fileType: 'struk' | 'gabah' | 'proses' | 'hasil'
    association: { purchaseId?: string; processId?: string; saleId?: string; saleType?: string }
    existingFiles?: FileData[]
    onUploadComplete?: (file: FileData) => void
    onDelete?: (fileId: string) => void
    maxFiles?: number
}

export default function FileUpload({
    fileType,
    association,
    existingFiles = [],
    onUploadComplete,
    onDelete,
    maxFiles = 3,
}: FileUploadProps) {
    const [uploading, setUploading] = useState(false)
    const [compressing, setCompressing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const canUpload = existingFiles.length < maxFiles

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            setError('File terlalu besar. Maksimal 10MB.')
            return
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        if (!validTypes.includes(file.type)) {
            setError('Format file tidak didukung. Gunakan JPEG, PNG, WebP, atau PDF.')
            return
        }

        setError(null)

        // Compress image client-side before uploading
        let fileToUpload = file
        if (file.type.startsWith('image/')) {
            setCompressing(true)
            try {
                fileToUpload = await compressImage(file)
            } finally {
                setCompressing(false)
            }
        }

        setUploading(true)

        try {
            const response = await filesAPI.upload(fileToUpload, fileType, association)
            onUploadComplete?.(response.data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload gagal')
        } finally {
            setUploading(false)
            // Reset input
            if (inputRef.current) {
                inputRef.current.value = ''
            }
        }
    }

    const handleDelete = async (fileId: string) => {
        if (!await confirmDialog('Yakin ingin menghapus file ini?')) return

        try {
            await filesAPI.delete(fileId)
            onDelete?.(fileId)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal menghapus file')
        }
    }

    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return Image
        return File
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    return (
        <div className="space-y-4">
            {/* Existing Files */}
            {existingFiles.length > 0 && (
                <div className="space-y-2">
                    {existingFiles.map((file) => {
                        const FileIcon = getFileIcon(file.mime_type)
                        return (
                            <div
                                key={file.id}
                                className="flex items-center gap-3 p-3 bg-stone-300 rounded-lg border border-stone-400"
                            >
                                {file.mime_type.startsWith('image/') && file.url ? (
                                    <img
                                        src={file.url}
                                        alt={file.original_name}
                                        className="w-12 h-12 object-cover rounded"
                                    />
                                ) : (
                                    <div className="w-12 h-12 bg-stone-400 rounded flex items-center justify-center">
                                        <FileIcon size={24} className="text-stone-600" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{file.original_name}</p>
                                    <p className="text-xs text-stone-600">{formatFileSize(file.size_bytes)}</p>
                                </div>
                                <button
                                    onClick={() => handleDelete(file.id)}
                                    className="p-2 rounded-lg text-stone-600 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Upload Area */}
            {canUpload && (
                <div
                    className={cn(
                        'relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
                        uploading
                            ? 'border-brand-light-green bg-brand-light-green/10'
                            : 'border-stone-400 hover:border-brand-light-green/50 hover:bg-stone-300/50'
                    )}
                    onClick={() => inputRef.current?.click()}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading || compressing}
                    />

                    {compressing ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader size={32} className="text-amber-400 animate-spin" />
                            <p className="text-sm text-amber-400">Mengompresi gambar...</p>
                        </div>
                    ) : uploading ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader size={32} className="text-brand-light-green animate-spin" />
                            <p className="text-sm text-stone-600">Mengupload...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <Upload size={32} className="text-stone-600" />
                            <p className="text-sm text-stone-600">
                                Klik untuk upload atau drag & drop
                            </p>
                            <p className="text-xs text-stone-500">
                                JPEG, PNG, WebP, PDF (max 10MB)
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    <X size={16} />
                    <span>{error}</span>
                </div>
            )}

            {/* Upload Limit Info */}
            <p className="text-xs text-stone-500 text-center">
                {existingFiles.length} / {maxFiles} file
            </p>
        </div>
    )
}
