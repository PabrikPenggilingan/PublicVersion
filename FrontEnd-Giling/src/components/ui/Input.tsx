import React from 'react'
import { cn } from '@/utils/helpers'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, ...props }, ref) => {
        return (
            <input
                ref={ref}
                className={cn(
                    'w-full bg-stone-100 border border-stone-300 text-stone-900 rounded-lg px-4 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-light-green/50 focus:border-brand-light-green placeholder:text-stone-400',
                    className
                )}
                {...props}
            />
        )
    }
)

Input.displayName = 'Input'
