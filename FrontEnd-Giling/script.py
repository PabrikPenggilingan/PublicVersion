import re

with open(r'c:\Users\User\Documents\Coding\Website\AERP\FrontEnd-Giling\src\pages\DryingDetail.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''    const handleCopyToInventory = async () => {
        if (!inventoryData.area?.trim()) {
            toast.error('Lokasi/Area gudang wajib diisi');
            return;
        }
        if (!inventoryData.tanda?.trim()) {
            toast.error('Tanda Identifikasi wajib diisi');
            return;
        }
        try {
            setSaving(true)'''

content = re.sub(r'    const handleCopyToInventory = async \(\) => \{\s+try \{\s+setSaving\(true\)', replacement, content)

content = content.replace('<label className="block text-sm font-medium mb-1">Lokasi/Area</label>', '<label className="block text-sm font-medium mb-1">Lokasi/Area <span className="text-red-400">*</span></label>')
content = content.replace('<label className="block text-sm font-medium mb-1">Tanda Identifikasi</label>', '<label className="block text-sm font-medium mb-1">Tanda Identifikasi <span className="text-red-400">*</span></label>')

with open(r'c:\Users\User\Documents\Coding\Website\AERP\FrontEnd-Giling\src\pages\DryingDetail.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
