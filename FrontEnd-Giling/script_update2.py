# 1. DryingList.tsx pagination buttons
with open('src/pages/DryingList.tsx', 'r', encoding='utf-8') as f:
    dl_content = f.read()

dl_content = dl_content.replace('className="px-3 py-1.5 text-sm bg-dark-700 border border-dark-600', 'className="px-3 py-1.5 text-sm bg-dark-900 border border-dark-800 hover:bg-dark-800')

with open('src/pages/DryingList.tsx', 'w', encoding='utf-8') as f:
    f.write(dl_content)

# 2. confirmDialog.tsx text-white -> text-[#ffffff]
with open('src/utils/confirmDialog.tsx', 'r', encoding='utf-8') as f:
    cd_content = f.read()

cd_content = cd_content.replace('text-white', 'text-[#ffffff]')
cd_content = cd_content.replace('hover:text-white', 'hover:text-[#ffffff]')

with open('src/utils/confirmDialog.tsx', 'w', encoding='utf-8') as f:
    f.write(cd_content)

# 3. DryingDetail.tsx Alur Pengeringan nodes
with open('src/pages/DryingDetail.tsx', 'r', encoding='utf-8') as f:
    dd_content = f.read()

# Replace Node 1 (Batches)
old_node1 = 'bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3 border-[3px] border-[#bfdbfe]">\n<Package size={20} className="text-[#bfdbfe]" />'
# Wait, did I run the script that replaced border-4 with border-[3px]? 
# Let me check what I actually did in multi_replace_file_content... Oh, I only replaced stray quotes there.
# Let me just use regex or replace.
import re
# Node 1
dd_content = re.sub(
    r'bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3 border-[^\"]+\">\n\s*<Package size=\{20\} className=\"text-[^\"]+\"',
    r'bg-[#10b981] rounded-2xl flex items-center justify-center shadow-lg shadow-[#10b981]/20 mb-3 border-[3px] border-[#6ee7b7]">\n                                <Package size={20} className="text-[#6ee7b7]"',
    dd_content
)
# Node 2 (Mulai)
dd_content = re.sub(
    r'bg-amber-500 shadow-amber-500/20 border-[^\']+\' : \'bg-dark-700 text-dark-500 border-dark-700\'}\">\n\s*<Zap size=\{20\} className=\{startSession \? \'text-[^\']+\'',
    r'bg-[#f59e0b] shadow-[#f59e0b]/20 border-[#fcd34d]\' : \'bg-dark-700 text-dark-500 border-dark-600\'}">\n                                <Zap size={20} className={startSession ? \'text-[#fcd34d]\'',
    dd_content
)
# Node 3 (Selesai)
dd_content = re.sub(
    r'bg-emerald-500 shadow-emerald-500/20 border-[^\']+\' : \'bg-dark-700 text-dark-500 border-dark-700\'}\">\n\s*<Check size=\{20\} className=\{endSession \? \'text-[^\']+\'',
    r'bg-[#10b981] shadow-[#10b981]/20 border-[#6ee7b7]\' : \'bg-dark-700 text-dark-500 border-dark-600\'}">\n                                <Check size={20} className={endSession ? \'text-[#6ee7b7]\'',
    dd_content
)

# And make sure border is 3px for Mulai and Selesai
dd_content = dd_content.replace('mb-3 border-4 transition-all', 'mb-3 border-[3px] transition-all')

# Fix Giling/Simpan Node
dd_content = dd_content.replace('bg-dark-700 text-dark-500 mb-3 border-4 border-dark-700', 'bg-dark-700 text-dark-500 mb-3 border-[3px] border-dark-600')

with open('src/pages/DryingDetail.tsx', 'w', encoding='utf-8') as f:
    f.write(dd_content)

print('Updated files successfully')
