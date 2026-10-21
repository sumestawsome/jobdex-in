# ATURAN BAKU PENGERJAAN UI & DESIGN SYSTEM (JOBDEX.IN)

Setiap kali melakukan modifikasi atau pembuatan antarmuka (UI), Antigravity WAJIB mematuhi aturan berikut tanpa pengecualian:

1. DILARANG KERAS MEMAKAI KODE HEKSA LANGSUNG:
   - Jangan pernah menulis arbitrary class seperti `bg-[#4F46E5]`, `text-[#65A30D]`, atau warna heksa inline lainnya.
   - Selalu gunakan token semantik yang sudah terdaftar di Tailwind / `globals.css`:
     * Primary: `bg-primary`, `text-primary`, `border-primary` (Indigo-600)
     * Secondary / Accent: `bg-secondary`, `text-secondary`, `border-secondary` (Lime-600)
     * Success: `bg-success`, `text-success` (Emerald-600)
     * Warning: `bg-warning`, `text-warning` (Amber-600)
     * Border: `border-zinc-200` atau token border default.

2. GEOMETRI TEGAS (ZERO ROUNDED):
   - Semua elemen WAJIB serba kotak tajam.
   - Dilarang menambahkan class `rounded`, `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, atau `rounded-full`.
   - Pastikan komponen menggunakan atau mewarisi `rounded-none`.

3. ELEVASI FLAT (ZERO SHADOW):
   - Dilarang menambahkan class bayangan seperti `shadow`, `shadow-sm`, `shadow-md`, `shadow-lg`.
   - Gunakan garis pembatas tegas (`border border-zinc-200`) sebagai pemisah visual antar komponen.

4. BACA FILE SUMBER SEBELUM EDIT:
   - Sebelum membuat atau mengubah komponen UI, selalu periksa `src/app/globals.css` dan komponen dasar di `src/components/ui/` (seperti `button.tsx` dan `badge.tsx`) untuk memastikan konsistensi class.