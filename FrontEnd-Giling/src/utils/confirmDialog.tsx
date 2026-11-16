import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { AlertTriangle, Check, X, HelpCircle } from 'lucide-react'

interface ConfirmOptions {
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'warning' | 'info'
    hideCancel?: boolean
}

const ConfirmModal: React.FC<{
    options: ConfirmOptions
    onResolve: (result: boolean) => void
}> = ({ options, onResolve }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [closing, setClosing] = useState(false)

    useEffect(() => {
        // Trigger entrance animation
        requestAnimationFrame(() => setIsOpen(true))
    }, [])

    const handleClose = (result: boolean) => {
        setClosing(true)
        setTimeout(() => {
            onResolve(result)
        }, 200) // Wait for exit animation
    }

    const variantStyles = {
        danger: {
            icon: <AlertTriangle className="text-rose-500 w-7 h-7 animate-pulse" />,
            border: 'border-rose-500/30',
            bg: 'bg-rose-500/10',
            button: 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-lg shadow-rose-500/20',
        },
        warning: {
            icon: <AlertTriangle className="text-amber-500 w-7 h-7 animate-bounce" />,
            border: 'border-amber-500/30',
            bg: 'bg-amber-500/10',
            button: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/20',
        },
        info: {
            icon: <HelpCircle className="text-sky-400 w-7 h-7" />,
            border: 'border-sky-500/30',
            bg: 'bg-sky-500/10',
            button: 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-lg shadow-sky-500/20',
        },
    }

    const currentVariant = variantStyles[options.variant || 'danger']

    return (
        <div
            className={`fixed inset-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-opacity duration-200 ${
                isOpen && !closing ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={(e) => {
                if (e.target === e.currentTarget) handleClose(false)
            }}
        >
            <div
                className={`w-full max-w-md bg-stone-200/95 border ${currentVariant.border} rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl transform transition-all duration-200 ${
                    isOpen && !closing ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'
                }`}
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl ${currentVariant.bg} border ${currentVariant.border} shrink-0`}>
                            {currentVariant.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-stone-900 tracking-wide mb-1">
                                {options.title || 'Konfirmasi Tindakan'}
                            </h3>
                            <p className="text-sm text-stone-700 leading-relaxed">
                                {options.message}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-stone-100/60 border-t border-stone-300/60">
                    {!options.hideCancel && (
                        <button
                            type="button"
                            onClick={() => handleClose(false)}
                            className="px-5 py-2.5 rounded-xl bg-stone-300/80 hover:bg-stone-400 text-stone-800 hover:text-white font-semibold text-sm transition-all duration-150 border border-stone-400/50 hover:border-stone-500 flex items-center gap-1.5"
                        >
                            <X size={16} />
                            {options.cancelText || 'Batal'}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => handleClose(true)}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] ${currentVariant.button}`}
                    >
                        <Check size={16} />
                        {options.confirmText || (options.hideCancel ? 'Mengerti' : 'Yakin & Lanjutkan')}
                    </button>
                </div>
            </div>
        </div>
    )
}

export const confirmDialog = (message: string, options: Partial<ConfirmOptions> = {}): Promise<boolean> => {
    return new Promise((resolve) => {
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = ReactDOM.createRoot(container)

        const handleResolve = (result: boolean) => {
            root.unmount()
            if (container.parentNode) {
                container.parentNode.removeChild(container)
            }
            resolve(result)
        }

        root.render(<ConfirmModal options={{ message, ...options }} onResolve={handleResolve} />)
    })
}

export const alertDialog = (message: string, options: Partial<ConfirmOptions> = {}): Promise<boolean> => {
    return confirmDialog(message, {
        title: 'Peringatan',
        variant: 'warning',
        confirmText: 'Mengerti',
        hideCancel: true,
        ...options,
    })
}
