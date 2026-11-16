# 🎨 Visual Color Guide: Green & Cyan (FrontEnd AERP Giling)

Dokumentasi visual palet warna **Hijau (*Green/Emerald*)** dan **Sian (*Cyan/Teal*)** pada FrontEnd AERP Giling. Warna ditampilkan secara langsung dalam bentuk swatch visual, badge, dan kode hex/RGB.

---

## ⚡ Pembaruan Terkini (Refactoring Selesai)
1. **Pembersihan Shade Tidak Terpakai:** Shade `primary-50`, `primary-100`, `primary-800`, dan `primary-950` telah **dihapus secara permanen** dari [`src/index.css`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/index.css) dan [`tailwind.config.js`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/tailwind.config.js).
2. **Standardisasi Nilai Hardcoded:** 
   - `text-[#5ba12e]` dan `border-[#267e3c]` di [`Dashboard.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/Dashboard.tsx) telah diganti menjadi `text-brand-light-green`, `bg-brand-light-green`, dan `border-brand-dark-green`.
   - `bg-[#10b981]`, `border-[#6ee7b7]`, `text-[#6ee7b7]`, dan `text-[#047857]` di [`DryingDetail.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/DryingDetail.tsx) telah diganti menjadi class bawaan `emerald-500`, `emerald-300`, dan `emerald-700`.
   - Glow inline arbitrary di [`PendataanDetail.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/PendataanDetail.tsx), [`PendataanForm.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/PendataanForm.tsx), dan [`FinanceAccounts.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/FinanceAccounts.tsx) telah distandardisasi dengan utility shadow Tailwind (`shadow-cyan-400/50`, `shadow-emerald-500/50`).

---

## 🌾 1. Brand Colors (Identitas Visual Pabrik)

Warna identitas utama yang terdaftar pada token `brand.*` di Tailwind dan CSS variables:

| Visual Swatch | Token Tailwind | Badge Warna | RGB Code | Pemakaian di UI |
|:---:|---|:---:|---|---|
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#267E3C"/></svg> | `brand-dark-green` | <span style="background-color:#267E3C;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#267E3C</span> | `rgb(38, 126, 60)` | Border node batch aktif di [`Dashboard.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/Dashboard.tsx#L173) |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#5BA12E"/></svg> | `brand-light-green` | <span style="background-color:#5BA12E;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#5BA12E</span> | `rgb(91, 161, 46)` | Link nomor batch & node batch aktif di [`Dashboard.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/Dashboard.tsx#L119) |

---

## 🟢 2. Primary Palette (Emerald Spectrum)

Warna tema utama aplikasi (`primary-*`). Seluruh komponen utama (tombol submit, input focus, spinner loading) merujuk ke palet ini.

| Visual Swatch | Token Tailwind | Badge Warna | RGB Code | Pemakaian di UI |
|:---:|---|:---:|---|---|
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#A7F3D0"/></svg> | `primary-200` | <span style="background-color:#A7F3D0;color:#064E3B;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#A7F3D0</span> | `rgb(167, 243, 208)` | Teks balon pesan pengirim di [`ChatArea.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/community/components/ChatArea.tsx#L87) |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#6EE7B7"/></svg> | `primary-300` | <span style="background-color:#6EE7B7;color:#064E3B;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#6EE7B7</span> | `rgb(110, 231, 183)` | Hover tombol aksi di [`CustomerList.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/CustomerList.tsx#L229) |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#34D399"/></svg> | `primary-400` | <span style="background-color:#34D399;color:#022C22;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#34D399</span> | `rgb(52, 211, 153)` | Subjudul, text badge, icon status di Sales & Proses |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#10B981"/></svg> | **`primary-500`** | <span style="background-color:#10B981;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#10B981</span> | `rgb(16, 185, 129)` | **Tombol CTA primer, focus outline, spinner loading, tab aktif** |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#059669"/></svg> | `primary-600` | <span style="background-color:#059669;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#059669</span> | `rgb(5, 150, 105)` | Hover state tombol utama, gradien button |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#047857"/></svg> | `primary-700` | <span style="background-color:#047857;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#047857</span> | `rgb(4, 120, 87)` | Watermark truck icon di [`SalesDetail.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/SalesDetail.tsx#L336) |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#064E3B"/></svg> | `primary-900` | <span style="background-color:#064E3B;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#064E3B</span> | `rgb(6, 78, 59)` | Drop shadow aksen `shadow-primary-900/20` di [`Button.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/components/ui/Button.tsx) |

> 🗑️ **Dihapus Permanen:** `primary-50`, `primary-100`, `primary-800`, `primary-950` karena tidak memiliki pemakaian di antarmuka.

---

## 🍃 3. Explicit Emerald Palette

Digunakan untuk badge status (`PAID`, `AVAILABLE`, `COMPLETED`), modul Penjualan, dan kategori Beras di Sidebar:

| Visual Swatch | Token Tailwind | Badge Warna | RGB Code | Pemakaian di UI |
|:---:|---|:---:|---|---|
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#6EE7B7"/></svg> | `emerald-300` | <span style="background-color:#6EE7B7;color:#064E3B;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#6EE7B7</span> | `rgb(110, 231, 183)` | Border timeline step di [`DryingDetail.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/DryingDetail.tsx#L519) |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#34D399"/></svg> | `emerald-400` | <span style="background-color:#34D399;color:#022C22;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#34D399</span> | `rgb(52, 211, 153)` | Outstanding bayar di `SalesDetail`, total output giling di `ProcessDetail` |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#10B981"/></svg> | `emerald-500` | <span style="background-color:#10B981;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#10B981</span> | `rgb(16, 185, 129)` | Status badge `PAID` / `COMPLETED`, icon Beras di [`Sidebar.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/components/layout/Sidebar.tsx#L61) |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#059669"/></svg> | `emerald-600` | <span style="background-color:#059669;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#059669</span> | `rgb(5, 150, 105)` | Tombol "Simpan Bayar", "Finalisasi", "Tambah Harga" |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#047857"/></svg> | `emerald-700` | <span style="background-color:#047857;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#047857</span> | `rgb(4, 120, 87)` | Indikator metrik stat card di [`DryingDetail.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/DryingDetail.tsx#L426) |

---

## 💎 4. Cyan Palette

Warna identitas modul **Pendataan Gabah Masuk** dan indikator barang **Titipan**:

| Visual Swatch | Token Tailwind | Badge Warna | RGB Code | Pemakaian di UI |
|:---:|---|:---:|---|---|
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#ECFEFF"/></svg> | `cyan-50` | <span style="background-color:#ECFEFF;color:#0891B2;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;border:1px solid #0891B240;">#ECFEFF</span> | `rgb(236, 254, 255)` | State hover card pendataan di [`PendataanList.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/PendataanList.tsx#L102) |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#22D3EE"/></svg> | `cyan-400` | <span style="background-color:#22D3EE;color:#083344;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#22D3EE</span> | `rgb(34, 211, 238)` | Kondisi gabah di `PendataanDetail`, tag Titipan di `InventoryList` |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#06B6D4"/></svg> | **`cyan-500`** | <span style="background-color:#06B6D4;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#06B6D4</span> | `rgb(6, 182, 212)` | **Tema modul Pendataan**, button mode Titipan, ring focus |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#0891B2"/></svg> | `cyan-600` | <span style="background-color:#0891B2;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#0891B2</span> | `rgb(8, 145, 178)` | Hover button toggle Titipan di [`InventoryList.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/InventoryList.tsx#L690) |

---

## 🌊 5. Teal Palette (Turquoise / Hijau Laut)

Digunakan pada modul **Inventory & Gudang Pengeringan**:

| Visual Swatch | Token Tailwind | Badge Warna | RGB Code | Pemakaian di UI |
|:---:|---|:---:|---|---|
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#5EEAD4"/></svg> | `teal-300` | <span style="background-color:#5EEAD4;color:#134E4A;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#5EEAD4</span> | `rgb(94, 234, 212)` | Header status gudang di [`DryingDetail.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/DryingDetail.tsx#L890) |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#2DD4BF"/></svg> | `teal-400` | <span style="background-color:#2DD4BF;color:#134E4A;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#2DD4BF</span> | `rgb(45, 212, 191)` | Nomor karung di `InventoryDetail`, total berat di `InventoryList` |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#14B8A6"/></svg> | `teal-500` | <span style="background-color:#14B8A6;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#14B8A6</span> | `rgb(20, 184, 166)` | Focus border input giling, icon Gudang & filter tab di `InventoryList` |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#0D9488"/></svg> | `teal-600` | <span style="background-color:#0D9488;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#0D9488</span> | `rgb(13, 148, 136)` | Hover state tombol aksi gudang di [`DryingDetail.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/DryingDetail.tsx#L907) |

---

## 🍃 6. Standard Tailwind Green

Digunakan pada alur logistik muatan, checkmark konfirmasi, dan step wizard:

| Visual Swatch | Token Tailwind | Badge Warna | RGB Code | Pemakaian di UI |
|:---:|---|:---:|---|---|
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#DCFCE7"/></svg> | `green-100` | <span style="background-color:#DCFCE7;color:#14532D;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;border:1px solid #14532D30;">#DCFCE7</span> | `rgb(220, 252, 231)` | Badge status di [`Logistics.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/Logistics.tsx#L178) |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#4ADE80"/></svg> | `green-400` | <span style="background-color:#4ADE80;color:#14532D;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#4ADE80</span> | `rgb(74, 222, 128)` | Checklist icon di `MasterPage.tsx`, state disabled di `Logistics.tsx` |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#22C55E"/></svg> | `green-500` | <span style="background-color:#22C55E;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#22C55E</span> | `rgb(34, 197, 94)` | Step indicator di `PurchaseForm` & `MillingForm`, icon `CheckCircle2` |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#16A34A"/></svg> | `green-600` | <span style="background-color:#16A34A;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#16A34A</span> | `rgb(22, 163, 74)` | Tombol "Kirim Muatan" di [`Logistics.tsx`](file:///c:/Users/micha/OneDrive/Documents/Projects/AERP/FrontEnd-Giling/src/pages/Logistics.tsx#L101) |
| <svg width="32" height="32"><rect width="32" height="32" rx="8" fill="#15803D"/></svg> | `green-700` | <span style="background-color:#15803D;color:#FFFFFF;padding:4px 10px;border-radius:8px;font-weight:bold;font-family:monospace;">#15803D</span> | `rgb(21, 128, 61)` | Hover state tombol muatan logistik |
