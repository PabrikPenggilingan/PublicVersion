

export default function ColorsPreview() {
    const brandColors = [
        { name: 'Brand Brown', cls: 'bg-brand-brown' },
        { name: 'Brand Dark Green', cls: 'bg-brand-dark-green' },
        { name: 'Brand Light Green', cls: 'bg-brand-light-green' },
        { name: 'Brand Yellow', cls: 'bg-brand-yellow' },
    ]

    const colorfulClasses = [
        'primary', 'red', 'amber', 'emerald', 'cyan', 'blue', 'violet'
    ]

    const grayClasses = [
        'stone', 'slate', 'gray'
    ]

    const renderScale = (prefix: string, max: number = 950) => {
        const steps = max === 950 ? [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] : [400, 500]
        if (prefix === 'slate') return [800]
        if (prefix === 'white') return []
        
        // For stone we have 50-950, for primary we have active shades 200-900
        // For others like red, amber, etc. we only mapped 500 in tailwind.config.js
        const primarySteps = [200, 300, 400, 500, 600, 700, 900]
        const activeSteps = prefix === 'primary' ? primarySteps : (prefix === 'stone' ? steps : [500])
        
        return (
            <div className="mb-8" key={prefix}>
                <h3 className="text-xl font-bold mb-4 capitalize">{prefix}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {activeSteps.map(step => (
                        <div key={`${prefix}-${step}`} className="flex flex-col border border-stone-300 rounded-lg overflow-hidden bg-stone-200">
                            <div className={`h-24 bg-${prefix}-${step}`}></div>
                            <div className="p-3 text-stone-900 text-sm">
                                <p className="font-bold">{prefix}-{step}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-stone-100 p-8 pt-20 text-stone-900">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Color Palette Preview</h1>
                <p className="text-stone-600 mb-8">
                    Toggle your theme in the sidebar and watch these colors change.
                </p>

                <h2 className="text-2xl font-bold mb-4 border-b border-stone-300 pb-2">Brand Colors (New)</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                    {brandColors.map(color => (
                        <div key={color.name} className="flex flex-col border border-stone-300 rounded-lg overflow-hidden bg-stone-200">
                            <div className={`h-32 ${color.cls}`}></div>
                            <div className="p-3 text-stone-900 text-sm">
                                <p className="font-bold">{color.name}</p>
                                <p className="text-stone-600 font-mono mt-1 text-xs">{color.cls.replace('bg-', '')}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <h2 className="text-2xl font-bold mb-4 border-b border-stone-300 pb-2">Colorful Palette (Overridden to Green in Light Mode)</h2>
                {colorfulClasses.map(prefix => renderScale(prefix))}

                <h2 className="text-2xl font-bold mb-4 border-b border-stone-300 pb-2">Grays & Backgrounds (Mathematically Inverted in Light Mode)</h2>
                {grayClasses.map(prefix => renderScale(prefix))}
            </div>
        </div>
    )
}
