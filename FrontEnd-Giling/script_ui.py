import re

# 1. DryingDetail.tsx (Tambahan Biaya text color)
with open('src/pages/DryingDetail.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace text-white with text-stone-900 in the Tambah Biaya Operasional modal (around line 1037 and 1049)
content = content.replace('className="w-full bg-stone-100 border-2 border-stone-300 rounded-2xl pl-12 pr-4 py-4 text-2xl font-black text-white focus:border-emerald-500 transition-all outline-none"', 'className="w-full bg-stone-100 border-2 border-stone-300 rounded-2xl pl-12 pr-4 py-4 text-2xl font-black text-stone-900 focus:border-emerald-500 transition-all outline-none"')
content = content.replace('className="w-full bg-stone-100 border-2 border-stone-300 rounded-2xl px-4 py-3 text-sm text-white focus:border-emerald-500 transition-all outline-none resize-none"', 'className="w-full bg-stone-100 border-2 border-stone-300 rounded-2xl px-4 py-3 text-sm text-stone-900 focus:border-emerald-500 transition-all outline-none resize-none"')
with open('src/pages/DryingDetail.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# 2. InventoryList.tsx (Gabah Titipan message box)
with open('src/pages/InventoryList.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
# Replace blue and amber message boxes with darker colors
content = content.replace('bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300', 'bg-blue-100 border border-blue-300 rounded-lg text-xs text-blue-800')
content = content.replace('bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300', 'bg-amber-100 border border-amber-300 rounded-lg text-xs text-amber-800')
with open('src/pages/InventoryList.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# 3. ProcessDetail.tsx (Alur Penggilingan)
with open('src/pages/ProcessDetail.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('border-4 border-stone-100', 'border-[3px]')

# Node 1
content = re.sub(
    r'bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3 border-\[3px\]\">\n\s*<Factory size=\{20\} className=\"text-white\"',
    r'bg-[#f59e0b] rounded-2xl flex items-center justify-center shadow-lg shadow-[#f59e0b]/20 mb-3 border-[3px] border-[#fcd34d]">\n                                        <Factory size={20} className="text-[#fcd34d]"',
    content
)

# Node 2
content = re.sub(
    r'hasStarted \? \'bg-blue-500 shadow-blue-500/20\' : \'bg-stone-300 text-stone-500\'\}\">\n\s*<Clock size=\{20\} className=\{hasStarted \? \'text-stone-900\' : \'text-stone-500\'\}',
    r'hasStarted ? \'bg-[#3b82f6] shadow-[#3b82f6]/20 border-[#93c5fd]\' : \'bg-stone-300 text-stone-500 border-stone-400\'}">\n                                            <Clock size={20} className={hasStarted ? \'text-[#93c5fd]\' : \'text-stone-500\'}',
    content
)

# Node 3
content = re.sub(
    r'hasEnded \? \'bg-emerald-500 shadow-emerald-500/20\' : \'bg-stone-300 text-stone-500\'\}\">\n\s*<Check size=\{20\} className=\{hasEnded \? \'text-stone-900\' : \'text-stone-500\'\}',
    r'hasEnded ? \'bg-[#10b981] shadow-[#10b981]/20 border-[#6ee7b7]\' : \'bg-stone-300 text-stone-500 border-stone-400\'}">\n                                            <Check size={20} className={hasEnded ? \'text-[#6ee7b7]\' : \'text-stone-500\'}',
    content
)

# Node 4
content = re.sub(
    r'process\.status === \'COMPLETED\' \? \'bg-indigo-500 shadow-indigo-500/20\' : \'bg-stone-300 text-stone-500\'\}\">\n\s*<Package size=\{20\} className=\{process\.status === \'COMPLETED\' \? \'text-stone-900\' : \'text-stone-500\'\}',
    r'process.status === \'COMPLETED\' ? \'bg-[#6366f1] shadow-[#6366f1]/20 border-[#a5b4fc]\' : \'bg-stone-300 text-stone-500 border-stone-400\'}">\n                                    <Package size={20} className={process.status === \'COMPLETED\' ? \'text-[#a5b4fc]\' : \'text-stone-500\'}',
    content
)

with open('src/pages/ProcessDetail.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('ProcessDetail and DryingDetail and InventoryList done')
