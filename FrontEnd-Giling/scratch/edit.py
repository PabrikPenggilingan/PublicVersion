import re

# Edit Batches.tsx
path = "src/pages/Batches.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# State
content = content.replace(
    "const [newBatchDate, setNewBatchDate] = useState(new Date().toISOString().split('T')[0])\n    const [creating, setCreating] = useState(false)",
    "const [newBatchDate, setNewBatchDate] = useState(new Date().toISOString().split('T')[0])\n    const [newJenisGabah, setNewJenisGabah] = useState(JENIS_GABAH_OPTIONS[0])\n    const [creating, setCreating] = useState(false)"
)

# handleCreate
content = content.replace(
    "await batchesAPI.create({ batchDate: newBatchDate })",
    "await batchesAPI.create({ batchDate: newBatchDate, jenisGabah: newJenisGabah })"
)
content = content.replace(
    "setNewBatchDate(new Date().toISOString().split('T')[0])",
    "setNewBatchDate(new Date().toISOString().split('T')[0])\n            setNewJenisGabah(JENIS_GABAH_OPTIONS[0])"
)

# Modal Form
modal_replacement = """                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Tanggal Batch</label>
                    <input
                        type="date"
                        className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                        value={newBatchDate}
                        onChange={(e) => setNewBatchDate(e.target.value)}
                        required
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Jenis Gabah</label>
                    <select
                        className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                        value={newJenisGabah}
                        onChange={(e) => setNewJenisGabah(e.target.value)}
                        required
                    >
                        {JENIS_GABAH_OPTIONS.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </div>"""
content = re.sub(
    r'                <div className="mb-4">\s+<label className="block text-sm font-medium mb-2">Tanggal Batch</label>\s+<input\s+type="date"\s+className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"\s+value=\{newBatchDate\}\s+onChange=\{\(e\) => setNewBatchDate\(e\.target\.value\)\}\s+required\s+/>\s+</div>',
    modal_replacement,
    content
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated Batches.tsx")

# Edit PurchaseForm.tsx
path2 = "src/pages/form/PurchaseForm.tsx"
with open(path2, "r", encoding="utf-8") as f:
    content2 = f.read()

# Remove JENIS_GABAH_OPTIONS
content2 = re.sub(
    r'const JENIS_GABAH_OPTIONS = \[\s+\'IR64\',\s+\'Ciherang\',\s+\'Mekongga\',\s+\'Inpari\',\s+\'Situ Bagendit\',\s+\'Rojolele\',\s+\'Mentik Wangi\',\s+\'Lainnya\'\s+\]\n\n',
    '',
    content2
)

# Remove from initial form state
content2 = content2.replace("        jenisGabah: '',\n", "")

# Remove from handleEditEntry
content2 = content2.replace("            jenisGabah: entry.jenis_gabah || 'IR64',\n", "")

# Remove from clear form in handleSubmit
content2 = content2.replace("                jenisGabah: '',\n", "")

# Remove from validation
content2 = content2.replace(
    "if (!form.calo || !form.lokasiBelanja || !form.hargaPerKg || !form.beratGabahKg || !form.jenisGabah) {",
    "if (!form.calo || !form.lokasiBelanja || !form.hargaPerKg || !form.beratGabahKg) {"
)

# Remove input field UI
ui_to_remove = """                    {/* Jenis Gabah */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Jenis Gabah <span className="text-red-400">*</span>
                        </label>
                        <select
                            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                            value={form.jenisGabah}
                            onChange={(e) => setForm(prev => ({ ...prev, jenisGabah: e.target.value }))}
                            required
                        >
                            <option value="">Pilih Jenis Gabah</option>
                            {JENIS_GABAH_OPTIONS.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>"""
content2 = content2.replace(ui_to_remove, "")

with open(path2, "w", encoding="utf-8") as f:
    f.write(content2)

print("Updated PurchaseForm.tsx")
