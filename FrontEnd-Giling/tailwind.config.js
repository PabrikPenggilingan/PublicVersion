/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                white: 'rgb(var(--color-white) / <alpha-value>)',
                gray: {
                    400: 'rgb(var(--color-gray-400) / <alpha-value>)',
                    500: 'rgb(var(--color-gray-500) / <alpha-value>)',
                },
                slate: {
                    400: 'rgb(var(--color-slate-400) / <alpha-value>)',
                    800: 'rgb(var(--color-slate-800) / <alpha-value>)',
                },
                red: {
                    400: 'rgb(var(--color-red-400) / <alpha-value>)',
                    500: 'rgb(var(--color-red-500) / <alpha-value>)',
                },
                amber: {
                    400: 'rgb(var(--color-amber-400) / <alpha-value>)',
                    500: 'rgb(var(--color-amber-500) / <alpha-value>)',
                },
                emerald: {
                    400: 'rgb(var(--color-emerald-400) / <alpha-value>)',
                    500: 'rgb(var(--color-emerald-500) / <alpha-value>)',
                },
                cyan: {
                    500: 'rgb(var(--color-cyan-500) / <alpha-value>)',
                },
                blue: {
                    500: 'rgb(var(--color-blue-500) / <alpha-value>)',
                },
                violet: {
                    500: 'rgb(var(--color-violet-500) / <alpha-value>)',
                },
                primary: {
                    200: 'rgb(var(--color-primary-200) / <alpha-value>)',
                    300: 'rgb(var(--color-primary-300) / <alpha-value>)',
                    400: 'rgb(var(--color-primary-400) / <alpha-value>)',
                    500: 'rgb(var(--color-primary-500) / <alpha-value>)',
                    600: 'rgb(var(--color-primary-600) / <alpha-value>)',
                    700: 'rgb(var(--color-primary-700) / <alpha-value>)',
                    900: 'rgb(var(--color-primary-900) / <alpha-value>)',
                },
                stone: {
                    50: 'rgb(var(--color-stone-50) / <alpha-value>)',
                    100: 'rgb(var(--color-stone-100) / <alpha-value>)',
                    200: 'rgb(var(--color-stone-200) / <alpha-value>)',
                    300: 'rgb(var(--color-stone-300) / <alpha-value>)',
                    400: 'rgb(var(--color-stone-400) / <alpha-value>)',
                    500: 'rgb(var(--color-stone-500) / <alpha-value>)',
                    600: 'rgb(var(--color-stone-600) / <alpha-value>)',
                    700: 'rgb(var(--color-stone-700) / <alpha-value>)',
                    800: 'rgb(var(--color-stone-800) / <alpha-value>)',
                    900: 'rgb(var(--color-stone-900) / <alpha-value>)',
                    950: 'rgb(var(--color-stone-950) / <alpha-value>)',
                },
                brand: {
                    brown: 'rgb(var(--color-brand-brown) / <alpha-value>)',
                    'dark-green': 'rgb(var(--color-brand-dark-green) / <alpha-value>)',
                    'light-green': 'rgb(var(--color-brand-light-green) / <alpha-value>)',
                    yellow: 'rgb(var(--color-brand-yellow) / <alpha-value>)',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
