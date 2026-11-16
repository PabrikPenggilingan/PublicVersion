import os
import glob
import re

# 1. Update tailwind.config.js
with open('tailwind.config.js', 'r', encoding='utf-8') as f:
    tw_content = f.read()

# Replace dark with stone in tailwind.config.js
tw_content = tw_content.replace('dark: {', 'stone: {')
tw_content = tw_content.replace('--color-dark-', '--color-stone-')

with open('tailwind.config.js', 'w', encoding='utf-8') as f:
    f.write(tw_content)

# 2. Update index.css
with open('src/index.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

# Remove .theme-inverted block and all -invert variables
css_lines = css_content.split('\n')
new_css_lines = []
in_theme_inverted = False
for line in css_lines:
    if line.strip().startswith('.theme-inverted {'):
        in_theme_inverted = True
        continue
    if in_theme_inverted:
        if line.strip() == '}':
            in_theme_inverted = False
        continue
    if '-invert:' in line:
        continue
    new_css_lines.append(line)

new_css = '\n'.join(new_css_lines)

# Now, we need to redefine variables in index.css
# The old inverted values will become the standard values.
# --color-white-invert: 0 0 0; -> This means standard white should be 255 255 255, but the old inversion made it black. 
# Wait, if they want "light mode only", we should just put the light mode values as the default.

light_mode_vars = {
    '--color-white': '255 255 255', # White stays white, except in light mode text-white was used where it inverted to black. I'll replace text-white with text-stone-900 in code.
    '--color-gray-400': '156 163 175',
    '--color-gray-500': '107 114 128',
    '--color-slate-800': '30 41 59',
    
    # Primary palette (needs a proper green scale)
    # We will use standard emerald values for primary, since it was previously a flat green
    '--color-primary-50': '236 253 245',
    '--color-primary-100': '209 250 229',
    '--color-primary-200': '167 243 208',
    '--color-primary-300': '110 231 183',
    '--color-primary-400': '52 211 153',
    '--color-primary-500': '16 185 129',
    '--color-primary-600': '5 150 105',
    '--color-primary-700': '4 120 87',
    '--color-primary-800': '6 95 70',
    '--color-primary-900': '6 78 59',
    '--color-primary-950': '2 44 34',

    # Stone palette (formerly dark, inverted)
    # Mapping logic: dark-950-invert -> stone-50, dark-900-invert -> stone-100, etc.
    '--color-stone-50': '250 250 249',
    '--color-stone-100': '242 242 241',
    '--color-stone-200': '230 230 228',
    '--color-stone-300': '210 210 207',
    '--color-stone-400': '184 184 178',
    '--color-stone-500': '147 147 138',
    '--color-stone-600': '111 111 102',
    '--color-stone-700': '74 74 68',
    '--color-stone-800': '47 47 44',
    '--color-stone-900': '26 26 24',
    '--color-stone-950': '13 13 12',
}

# Replace the block
root_start = new_css.find(':root {')
root_end = new_css.find('}', root_start)

brand_colors = """
    /* Brand Colors */
    --color-brand-brown: 119 59 39;
    --color-brand-dark-green: 38 126 60;
    --color-brand-light-green: 91 161 46;
    --color-brand-yellow: 246 196 22;
"""

new_root_content = ":root {\n"
for k, v in light_mode_vars.items():
    new_root_content += f"    {k}: {v};\n"
new_root_content += "\n    /* Red, Amber, Emerald, Cyan, Blue, Violet */\n"
new_root_content += "    --color-red-400: 248 113 113;\n"
new_root_content += "    --color-red-500: 239 68 68;\n"
new_root_content += "    --color-amber-400: 251 191 36;\n"
new_root_content += "    --color-amber-500: 245 158 11;\n"
new_root_content += "    --color-emerald-400: 52 211 153;\n"
new_root_content += "    --color-emerald-500: 16 185 129;\n"
new_root_content += "    --color-cyan-500: 6 182 212;\n"
new_root_content += "    --color-blue-500: 59 130 246;\n"
new_root_content += "    --color-violet-500: 139 92 246;\n"
new_root_content += brand_colors
new_root_content += "}\n"

new_css = new_css[:root_start] + new_root_content + new_css[root_end+1:]

with open('src/index.css', 'w', encoding='utf-8') as f:
    f.write(new_css)

# 3. Refactor TSX files
mapping = {
    'dark-950': 'stone-50',
    'dark-900': 'stone-100',
    'dark-800': 'stone-200',
    'dark-700': 'stone-300',
    'dark-600': 'stone-400',
    'dark-500': 'stone-500',
    'dark-400': 'stone-600',
    'dark-300': 'stone-700',
    'dark-200': 'stone-800',
    'dark-100': 'stone-900',
    'dark-50': 'stone-950',
}

def replace_classes(content):
    # First, deal with text-white -> text-stone-900
    # Wait, text-[#ffffff] was added as a workaround to keep things white.
    # We should change text-[#ffffff] -> text-white
    # And text-white -> text-stone-900
    
    # We must be careful not to double replace.
    # Replace text-white with text-stone-900
    content = re.sub(r'text-white\b', 'text-stone-900', content)
    # Now replace text-[#ffffff] with text-white
    content = content.replace('text-[#ffffff]', 'text-white')
    
    # Replace dark-* with stone-* based on mapping
    for old, new in mapping.items():
        # Match words like bg-dark-900, text-dark-900, border-dark-900
        content = re.sub(rf'\b({old})\b', new, content)
        
    return content

files = glob.glob('src/**/*.tsx', recursive=True) + glob.glob('src/**/*.ts', recursive=True)
for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    new_content = replace_classes(content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

print('Refactoring complete')
