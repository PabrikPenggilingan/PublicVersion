# Green Palette Unification to `brand-light-green`
**Date**: October 27, 2026  
**Author**: Michael  

## Overview
All green shades used in the frontend (`emerald-*`, `primary-*`, `green-*`, `teal-*`) were replaced with a single brand token, `brand-light-green` (`--color-brand-light-green: 91 161 46` / `#5BA12E`).

Where text and background would have the same green (a "collision"), the background uses reduced opacity, the same way `emerald-500` (bg, `/10`–`/20`) and `emerald-400` (text) were paired before.

---

## Changes Made

### 1. Class replacement (46 files in `src/components` and `src/pages`)
- Every color utility (`text`, `bg`, `border`, `ring`, `from/via/to`, `shadow`, `divide`, `fill`, `stroke`, etc.) that used `emerald|primary|green|teal-<shade>` now uses `brand-light-green`.
- Existing opacity suffixes were preserved (e.g. `bg-emerald-500/10` → `bg-brand-light-green/10`).
- `hover:bg-*-600/700` and `hover:border-*-600/700` → `hover:*-brand-light-green/80`, so solid buttons still show hover feedback.

### 2. Hard-coded / inline values
| File | Before | After |
|---|---|---|
| `pages/Dashboard.tsx` | `color: '#10b981'` | `color: '#5BA12E'` |
| `components/layout/Sidebar.tsx` | `rgb(var(--color-emerald-500))` | `rgb(var(--color-brand-light-green))` |
| `pages/SalesDetail.tsx` | `rgba(var(--primary-500), …)` shadows | `rgba(var(--color-brand-light-green), …)` |
| `index.css` | `::selection` `bg-primary-500`, spinner `border-t-primary-500` | `brand-light-green` |

### 3. Collision fix
- `pages/Logistics.tsx` badge: `bg-green-* text-green-*/30` → `bg-brand-light-green/20 text-brand-light-green`.

### 4. Review of earlier text/bg edits (fixes)
- `pages/ProcessDetail.tsx`: invalid class `text-stone-[#4338ca]` → `text-[#4338ca]`.
- `pages/form/MillingForm.tsx`: warning-modal button had white text on white bg (`bg-white … text-white`) → `bg-stone-300 … text-stone-900`.
- `pages/DryingList.tsx`: `hover:from-/hover:to-` with no gradient had no effect → `hover:bg-amber-600`.

---

## Notes
- The old `--color-emerald-*` / `--color-primary-*` variables and Tailwind entries are still defined but no longer used in `src`; they can be removed later.
- `brand-dark-green` was not touched.
- Verified with `tsc --noEmit` (no errors); visual check in the browser is still recommended.
