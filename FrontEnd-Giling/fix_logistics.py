import re

with open('src/pages/Logistics.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Strip all dark classes
content = re.sub(r'\s+dark:[a-zA-Z0-9\-]+', '', content)
content = re.sub(r'dark:[a-zA-Z0-9\-]+\s+', '', content)

# 2. Replace all gray with stone
content = content.replace('gray', 'stone')

# 3. Fix colors
# Tambah button text color to white
content = content.replace('px-4 py-2 bg-green-600 hover:bg-green-700 text-stone-900', 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white')

# Floating Tabs container
content = content.replace('bg-stone-100 p-1', 'bg-stone-200 p-1')
content = content.replace('bg-white text-green-600', 'bg-stone-100 text-green-600')
content = content.replace('bg-white text-blue-600', 'bg-stone-100 text-blue-600')

# Table container
content = content.replace('bg-white rounded-xl shadow-sm border border-stone-100', 'bg-stone-200 rounded-xl shadow-sm border border-stone-300')
content = content.replace('bg-stone-50 border-b border-stone-100', 'bg-stone-300/50 border-b border-stone-300')

# Table rows
content = content.replace('border-b border-stone-50 hover:bg-stone-50', 'border-b border-stone-300/50 hover:bg-stone-300/50')
content = content.replace('bg-stone-50', 'bg-stone-300/50')

# Header Texts
content = content.replace('text-stone-900 tracking-tight', 'text-stone-900 tracking-tight font-black')

with open('src/pages/Logistics.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done Logistics.tsx')
