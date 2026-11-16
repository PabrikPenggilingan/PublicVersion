import React, { useEffect, useRef, useState } from 'react'
import { Input } from './Input'

/**
 * Drop-in replacement for <input type="number"> that shows Indonesian thousand separators
 * while typing (12.500.000 · 14,5). The surrounding code is unchanged: onChange still
 * receives an event whose target.value is the raw number string ("12500000", "14.5").
 *
 * - "." is a thousand separator, "," is the decimal separator.
 * - Typing "." at the end (phone keyboards) is treated as the decimal separator.
 * - Pass `ui` to get the styling of the shared <Input> component.
 */
type NativeProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'>

export interface NumberInputProps extends NativeProps {
    value?: string | number | null
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    /** Use the shared <Input> styling */
    ui?: boolean
}

const toRaw = (display: string): string => {
    let s = display.replace(/\s/g, '')
    const negative = s.startsWith('-')
    s = s.replace(/[^0-9,]/g, '')
    const firstComma = s.indexOf(',')
    if (firstComma !== -1) s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, '')
    const raw = s.replace(',', '.')
    return (negative && raw !== '' ? '-' : '') + raw
}

const toDisplay = (raw: string | number | null | undefined): string => {
    if (raw === null || raw === undefined) return ''
    const str = String(raw).trim()
    if (str === '' || str === '-') return str
    const negative = str.startsWith('-')
    const [intPartRaw, decPart] = str.replace('-', '').split('.')
    const intDigits = intPartRaw.replace(/\D/g, '')
    const intFormatted = intDigits === '' ? (decPart !== undefined ? '0' : '') : intDigits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return (negative ? '-' : '') + intFormatted + (decPart !== undefined ? ',' + decPart.replace(/\D/g, '') : '')
}

// Values coming from outside (DB "800.00") drop trailing decimal zeros: 800.00 → 800, 14.50 → 14,5
const fromOutside = (raw: string | number | null | undefined): string => {
    if (raw === null || raw === undefined) return ''
    const str = String(raw).trim()
    if (!str.includes('.')) return toDisplay(str)
    return toDisplay(str.replace(/0+$/, '').replace(/\.$/, ''))
}

// Number of digits/commas before the caret — used to put the caret back after reformatting
const significantBefore = (text: string, caret: number) => text.slice(0, caret).replace(/[^0-9,-]/g, '').length

const caretFor = (text: string, count: number) => {
    if (count <= 0) return 0
    let seen = 0
    for (let i = 0; i < text.length; i++) {
        if (/[0-9,-]/.test(text[i])) seen++
        if (seen === count) return i + 1
    }
    return text.length
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
    ({ value, onChange, ui, inputMode, min, max, step, ...rest }, forwardedRef) => {
        const innerRef = useRef<HTMLInputElement | null>(null)
        const [display, setDisplay] = useState(() => fromOutside(value))
        const pendingCaret = useRef<number | null>(null)

        // Follow outside changes (reset, auto-fill) without fighting the user's typing
        useEffect(() => {
            const current = toRaw(display)
            const incoming = value === null || value === undefined ? '' : String(value)
            if (current !== incoming && Number(current) !== Number(incoming === '' ? NaN : incoming)) {
                setDisplay(fromOutside(incoming))
            } else if (incoming === '' && display !== '' && display !== '-') {
                setDisplay('')
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [value])

        useEffect(() => {
            if (pendingCaret.current !== null && innerRef.current && document.activeElement === innerRef.current) {
                const pos = caretFor(display, pendingCaret.current)
                innerRef.current.setSelectionRange(pos, pos)
            }
            pendingCaret.current = null
        }, [display])

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const el = e.target
            let typed = el.value
            const caret = el.selectionStart ?? typed.length
            const allowDecimal = step === undefined || step === 'any' || !Number.isInteger(Number(step))

            // A "." the user types (phone keyboards) means decimal; our own dots are thousands.
            // Find what was just inserted by diffing against the current display.
            if (allowDecimal && !typed.includes(',')) {
                let pre = 0
                while (pre < display.length && pre < typed.length && display[pre] === typed[pre]) pre++
                let suf = 0
                while (suf < display.length - pre && suf < typed.length - pre &&
                       display[display.length - 1 - suf] === typed[typed.length - 1 - suf]) suf++
                const inserted = typed.slice(pre, typed.length - suf)
                if (inserted.includes('.')) {
                    typed = typed.slice(0, pre) + inserted.replace('.', ',').replace(/\./g, '') + typed.slice(typed.length - suf)
                }
            }
            if (!allowDecimal) typed = typed.replace(/,/g, '')

            const raw = toRaw(typed)
            const nextDisplay = typed.endsWith(',') ? toDisplay(raw.replace(/\.$/, '')) + ',' : toDisplay(raw)
            pendingCaret.current = significantBefore(typed, caret)
            setDisplay(nextDisplay)

            if (onChange) {
                // defineProperties (not assignment): the DOM setters must not run on these copies
                const target = Object.create(el, {
                    value: { value: raw.endsWith('.') ? raw.slice(0, -1) : raw, enumerable: true },
                    name: { value: el.name, enumerable: true },
                    id: { value: el.id, enumerable: true },
                    type: { value: 'number', enumerable: true },
                })
                const synthetic = Object.create(e, {
                    target: { value: target, enumerable: true },
                    currentTarget: { value: target, enumerable: true },
                })
                onChange(synthetic as React.ChangeEvent<HTMLInputElement>)
            }
        }

        const setRefs = (node: HTMLInputElement | null) => {
            innerRef.current = node
            if (typeof forwardedRef === 'function') forwardedRef(node)
            else if (forwardedRef) forwardedRef.current = node
        }

        const props = {
            ...rest,
            ref: setRefs,
            type: 'text' as const,
            inputMode: inputMode || ((step === undefined || step === 'any' || !Number.isInteger(Number(step))) ? 'decimal' as const : 'numeric' as const),
            autoComplete: rest.autoComplete || 'off',
            value: display,
            onChange: handleChange,
            'data-min': min,
            'data-max': max,
        }
        return ui ? <Input {...props} /> : <input {...props} />
    }
)

NumberInput.displayName = 'NumberInput'
