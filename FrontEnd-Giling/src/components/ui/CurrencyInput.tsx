import React, { useState, useEffect } from 'react'
import { Input } from './Input'

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
    value: string | number;
    onChange: (val: string) => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
    ({ value, onChange, ...props }, ref) => {
        const [displayValue, setDisplayValue] = useState('');

        useEffect(() => {
            if (value === '' || value === undefined || value === null) {
                setDisplayValue('');
                return;
            }

            const strValue = value.toString();
            const parts = strValue.split('.');
            let integerPart = parts[0].replace(/\D/g, '');
            if (strValue.startsWith('-')) integerPart = '-' + integerPart;

            let formatted = integerPart && integerPart !== '-' ? parseInt(integerPart).toLocaleString('id-ID') : integerPart;
            if (parts.length > 1) {
                formatted += ',' + parts[1];
            }
            
            const currentRaw = displayValue.replace(/\./g, '').replace(',', '.');
            if (currentRaw !== strValue) {
                setDisplayValue(formatted);
            }
        }, [value]);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            let input = e.target.value;
            
            // Allow negative sign at start
            const isNegative = input.startsWith('-');
            
            // Remove all except numbers and comma
            input = input.replace(/[^0-9,]/g, '');
            if (isNegative) input = '-' + input;
            
            // Handle multiple commas
            const parts = input.split(',');
            if (parts.length > 2) {
                input = parts[0] + ',' + parts.slice(1).join('');
            }

            let formatted = '';
            const intPart = parts[0].replace('-', '');
            if (intPart) {
                formatted = parseInt(intPart).toLocaleString('id-ID');
                if (isNegative) formatted = '-' + formatted;
            } else if (isNegative) {
                formatted = '-';
            }

            if (parts.length > 1) {
                formatted += ',' + parts[1];
            }
            
            setDisplayValue(input === '' || input === '-' ? input : (input.endsWith(',') ? formatted + ',' : formatted));

            const raw = input.replace(/,/g, '.');
            onChange(raw);
        };

        return <Input ref={ref} type="text" value={displayValue} onChange={handleChange} {...props} />
    }
);

CurrencyInput.displayName = 'CurrencyInput';
