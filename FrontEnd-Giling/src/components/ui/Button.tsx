import React from 'react'
import { cn } from '@/utils/helpers'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
        const variants = {
            primary: 'bg-brand-light-green text-stone-900 hover:bg-brand-light-green shadow-lg shadow-brand-light-green/20',
            secondary: 'bg-stone-300 text-stone-900 hover:bg-stone-400',
            outline: 'border border-stone-400 text-stone-700 hover:bg-stone-300 hover:text-stone-900',
            ghost: 'text-stone-600 hover:bg-stone-300 hover:text-stone-900',
            danger: 'bg-red-600 text-stone-900 hover:bg-red-500',
        }

        const sizes = {
            sm: 'px-3 py-1.5 text-xs',
            md: 'px-4 py-2 text-sm',
            lg: 'px-6 py-3 text-base',
            icon: 'p-2',
        }

        return (
            <button
                ref={ref}
                className={cn(
                    'inline-flex items-center justify-center rounded-lg font-medium transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-95',
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            />
        )
    }
)

Button.displayName = 'Button'
