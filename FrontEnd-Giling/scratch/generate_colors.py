import re

with open('src/index.css', 'r', encoding='utf-8') as f:
    content = f.read()

invert_start = content.find('/* Inverted Colors */')
invert_end = content.find('.theme-inverted {', invert_start)
invert_content = content[invert_start:invert_end]

color_map = {}
for line in invert_content.split('\n'):
    line = line.strip()
    if line.startswith('--color-') and line.endswith(';'):
        match = re.match(r'--color-(.+)-invert:\s*(\d+)\s+(\d+)\s+(\d+);', line)
        if match:
            name = match.group(1)
            r, g, b = int(match.group(2)), int(match.group(3)), int(match.group(4))
            hx = f'{r:02x}{g:02x}{b:02x}'
            color_map[name] = (hx, r, g, b)

md_lines = [
    '# Light Mode Color Palette Preview',
    '',
    'Here is the complete color mapping used when the theme toggle is set to light mode.',
    '',
    '| Color Name | Preview | Hex Code | RGB |',
    '|---|---|---|---|'
]

for name, (hx, r, g, b) in color_map.items():
    row = f'| `{name}` | ![](https://placehold.co/40x40/{hx}/{hx}.png) | `#{hx}` | `rgb({r}, {g}, {b})` |'
    md_lines.append(row)

# Write to the Antigravity artifact directory
import sys
if len(sys.argv) > 1:
    out_file = sys.argv[1]
    with open(out_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(md_lines))
    print(f"Generated markdown at {out_file}")
