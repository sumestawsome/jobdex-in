# ATURAN BAKU PENGERJAAN & WORKFLOW SISTEM (JOBDEX.IN)

File ini adalah Standard Operating Procedure (SOP) mutlak. Setiap kali Antigravity membaca instruksi pengguna, seluruh aturan di bawah ini WAJIB dijalankan tanpa pengecualian.

---

## 1. WORKFLOW EKSEKUSI & GIT (WAJIB TIAP SELESAI TUGAS)
Setiap kali selesai melakukan modifikasi, penambahan fitur, atau perbaikan bug:
1. **Verifikasi Build:** Jalankan `npm run build` untuk memastikan tidak ada error TypeScript, rute patah, atau dependensi gagal kompilasi.
2. **Git Staging:** Jalankan `git add .` untuk seluruh perubahan yang relevan.
3. **Commit Terstruktur:** Lakukan `git commit -m "<tipe>: <deskripsi>"` dengan format baku:
   - `ui:` perbaikan tampilan / layout / warna
   - `feat:` penambahan fitur baru
   - `fix:` perbaikan bug logika / crash
   - `chore:` pembersihan file / konfigurasi
4. **Push Siap Pakai:** Otomatis eksekusi `git push origin main` atau instruksikan dengan jelas bahwa branch siap di-push.
5. **Anti-Hang Terminal:** Jangan pernah membiarkan command runner Node.js menggantung tanpa exit signal (selalu pastikan proses selesai).

---

## 2. DESIGN SYSTEM & GEOMETRI UI (STRICT TOKENS)
1. **Dilarang Keras Memakai Kode Heksa Langsung:**
   - Jangan pernah menulis arbitrary class seperti `bg-[#4F46E5]` atau inline style heksa.
   - Gunakan token semantik Tailwind / `globals.css`:
     * Primary: `bg-primary`, `text-primary`, `border-primary` (Indigo)
     * Secondary / Accent: `bg-secondary`, `text-secondary`, `border-secondary` (Lime)
     * Detail: Background Indigo / Blue solid
     * Solusi / Link: Background Purple / Emerald solid
     * Edit: Background Amber / Orange solid
     * Danger / Arsip: Background Rose / Red solid
2. **Geometri Tegas (Zero Rounded):**
   - Semua elemen antarmuka WAJIB serba kotak tajam.
   - Dilarang menambahkan class `rounded`, `rounded-md`, `rounded-lg`, atau `rounded-full`.
   - Gunakan class `rounded-none` jika komponen turunan memiliki pembulatan sudut bawaan.
3. **Elevasi Flat (Zero Shadow):**
   - Dilarang menambahkan class shadow (`shadow`, `shadow-md`, dll).
   - Gunakan border kontras (`border border-zinc-200` atau `border-zinc-800` pada dark mode) sebagai pemisah bidang.
4. **Hindari Duplikasi Ikon dan Teks:**
   - Tombol dilarang memiliki simbol dobel, misalnya icon Plus yang masih diikuti teks "+ Tambah". Gunakan 1 icon diikuti teks bersih (contoh: `<Plus /> Tambah Job Desk`).

---

## 3. RESPONSIFITAS & LOGIKA VIEW
1. **Tampilan Mobile (< 768px):**
   - Halaman Job Desk dan Acara wajib terkunci secara default pada tampilan **Kartu (Cards)** agar nyaman di layar HP.
2. **Tampilan Desktop:**
   - Default tampilan Job Desk adalah **Kartu (Cards)**, dengan toggle opsi Tabel yang tersimpan persisten di state pengguna.
3. **Pencarian Berbasis Kata (Word-Based Search):**
   - Input pencarian (search bar) wajib memecah string menjadi token kata individual (case-insensitive) dan memeriksa kecocokan di nama tugas, acara, PIC, maupun deskripsi.

---

## 4. KONSISTENSI DARK MODE
1. Latar gelap container wajib konsisten memakai palet zinc/slate (`bg-zinc-900`, `bg-black`, `border-zinc-800`).
2. Teks di mode gelap wajib memiliki kontras yang nyaman dibaca (`text-zinc-100`, `text-zinc-300`).
3. Dilarang ada kartu atau pop-up berlatar putih terang yang bocor ketika dark mode aktif.

---

## 5. FORMATTING WHATSAPP & GUARDRAIL BOT
1. **Format Markdown WA:** Seluruh pesan keluar ke WhatsApp dilarang memakai bold markdown ganda (`**`). Selalu gunakan helper pembersih untuk mengubahnya menjadi bintang tunggal (`*teks*`).
2. **Anti-OOT Guardrail:** AI Assistant bot dilarang membuatkan materi di luar urusan job desk dan kepanitiaan ormawa Forkom KIP Undiksha.