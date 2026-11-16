import re
import sys

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Skipping {filepath}: {e}")
        return

    # Add import if not exists
    if 'import ThemeToggle' not in content:
        # For PurchaseForm.tsx, MillingForm.tsx, DryingForm.tsx
        # they all import Modal or some lucide icons
        content = content.replace('import Modal from', 'import ThemeToggle from \'@/components/ThemeToggle\'\nimport Modal from')
        if 'import ThemeToggle' not in content:
            content = content.replace('import {', 'import ThemeToggle from \'@/components/ThemeToggle\'\nimport {', 1)

    # Inject floating ThemeToggle into all `<div className="min-h-screen...` 
    # Use absolute position so it floats on the top right
    content = re.sub(
        r'(<div className="min-h-screen[^>]*>)',
        r'\1\n                <div className="fixed top-4 right-4 z-[60]">\n                    <ThemeToggle />\n                </div>',
        content
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Processed {filepath}")

process_file('src/pages/form/PurchaseForm.tsx')
process_file('src/pages/form/DryingForm.tsx')
process_file('src/pages/form/MillingForm.tsx')
