import { X } from 'lucide-react'
import { cn } from '@/utils/helpers'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    children: ReactNode
    footer?: ReactNode
    size?: 'default' | 'lg' | 'xl'
}

export default function Modal({ isOpen, onClose, title, children, footer, size = 'default' }: ModalProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    if (!isOpen || !mounted) return null

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    const sizeClasses = {
        default: 'sm:max-w-lg',
        lg: 'sm:max-w-2xl',
        xl: 'sm:max-w-4xl'
    }

    const modalContent = (
        <div
            className="fixed inset-0 w-full h-full bg-black/80 backdrop-blur-md z-[9999] animate-in fade-in duration-150 flex flex-col justify-end sm:items-center sm:justify-center sm:p-6"
            onClick={handleOverlayClick}
        >
            {/*
              Mobile: bottom sheet — slides up from bottom, full width, rounded top corners.
              Desktop (sm+): centered dialog, same as before.
            */}
            <div
                className={cn(
                    // Base
                    'bg-stone-200 border border-stone-300 w-full flex flex-col overflow-hidden',
                    // Mobile: bottom sheet style
                    'rounded-t-2xl max-h-[85vh] animate-in slide-in-from-bottom duration-300',
                    // Desktop: centered dialog
                    'sm:rounded-xl sm:max-h-[90vh] sm:animate-in sm:slide-in-from-bottom-4 sm:duration-200',
                    sizeClasses[size]
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-stone-300 shrink-0">
                    {/* Drag handle indicator — mobile only */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-stone-400 rounded-full sm:hidden" />
                    <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-stone-600 hover:bg-stone-300 hover:text-stone-900 transition-colors shrink-0"
                        aria-label="Tutup"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 px-5 py-4 border-t border-stone-300 bg-stone-100/50 shrink-0 rounded-b-xl safe-bottom">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )

    return createPortal(modalContent, document.body)
}
