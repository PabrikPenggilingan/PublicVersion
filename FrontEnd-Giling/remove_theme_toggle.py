import os
import re

files_to_clean = [
    'src/pages/form/MillingForm.tsx',
    'src/pages/form/PurchaseForm.tsx',
    'src/pages/form/DryingForm.tsx',
    'src/components/layout/Sidebar.tsx'
]

for filepath in files_to_clean:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        content = re.sub(r'import\s+ThemeToggle\s+from\s+[\'\"].*?ThemeToggle[\'\"]\s*;?\n?', '', content)
        content = re.sub(r'<\s*ThemeToggle\s*/?>', '', content)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

if os.path.exists('src/components/ThemeToggle.tsx'):
    os.remove('src/components/ThemeToggle.tsx')

print('ThemeToggle removed')
