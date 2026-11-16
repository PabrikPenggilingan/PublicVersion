import re

with open('src/pages/FinanceDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Strip dark classes entirely
content = re.sub(r'\s*dark:[^\s"\'}]+', '', content)

# Color swaps
# Note: we swap specific 'dark-xxx' to their stone counterparts.
content = content.replace('bg-dark-900', 'bg-stone-100')
content = content.replace('bg-dark-800', 'bg-stone-200')
content = content.replace('bg-dark-700', 'bg-stone-300')
content = content.replace('bg-dark-600', 'bg-stone-400')

content = content.replace('border-dark-800', 'border-stone-200')
content = content.replace('border-dark-700', 'border-stone-300')
content = content.replace('border-dark-600', 'border-stone-400')

content = content.replace('text-dark-400', 'text-stone-600')
content = content.replace('text-dark-300', 'text-stone-700')
content = content.replace('text-dark-200', 'text-stone-800')
content = content.replace('text-dark-100', 'text-stone-900')
content = content.replace('text-dark-500', 'text-stone-500')
content = content.replace('divide-dark-700', 'divide-stone-300')

# For generic white text that needs to become dark
# We will do this carefully since some 'text-white' might be on green/blue buttons
content = content.replace('text-white font-mono', 'text-stone-900 font-mono')
content = content.replace('text-white font-bold', 'text-stone-900 font-bold')
content = content.replace('text-white', 'text-stone-900') # Might be broad, but typical for dark mode text

# bg-black/20 is often used for overlays, in light mode it can be bg-white/50 or stone-200/50
content = content.replace('bg-black/20', 'bg-stone-300/30')

with open('src/pages/FinanceDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Resolved FinanceDashboard.tsx')
