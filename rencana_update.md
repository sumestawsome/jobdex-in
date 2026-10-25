# DOKUMEN REVISI HALAMAN DEMO & SHOWCASE WHATSAPP (`/demo`)

Dokumen ini mencatat seluruh poin perbaikan tampilan antarmuka (UI), alur skenario, dan penulisan teks (*copywriting*) pada halaman demo simulasi WhatsApp agar persis seperti obrolan WhatsApp asli dengan geometri tegas khas sistem JobDex.in (`rounded-none`).

---

## 1. Perbaikan Judul & Teks Bagian Atas (Gaya No Berat-Berat)

Pangkas kalimat kaku dan istilah teknis di bagian atas halaman (seperti "Uji coba langsung tanpa watermark" atau "Instance B Outbound"). Ganti dengan bahasa yang santai, lugas, dan langsung menjawab kebutuhan mahasiswa:

* **Judul Utama:**
**Nggak Perlu Buka Web, Cukup Lewat WhatsApp**
* **Deskripsi Singkat:**
Biar nggak ada lagi tugas yang kelupaan gara-gara infonya tenggelam di grup. Mulai dari Korti yang input tugas lewat *voice note*, pengumuman resmi tanpa spam, sampai cek deadline mepet bareng teman sekelas—semuanya jalan otomatis di WhatsApp.
* **Tombol Pilihan Skenario (Pindahkan ke Bawah Deskripsi):**
Keluarkan tab filter dari dalam jendela chat WhatsApp. Tempatkan tepat di bawah teks pengantar berupa 3 tombol pertanyaan santai:
1. `📢 Gimana cara JobDex ngumumin tugas di grup komunitas?`
2. `🎙️ Gimana Korti nambah tugas lewat japri?`
3. `👥 Gimana cara cek tugas bareng-bareng di grup kelas?`



---

## 2. Aturan Baku Tampilan Chat (Kembalikan ke Tampilan Asli WhatsApp)

Hindari modifikasi berlebihan yang merusak suasana obrolan WhatsApp asli:

* **Hilangkan Semua Badge Teknis di Dalam Chat:**
Hapus seluruh label internal seperti `OUTBOUND BROADCAST (INSTANCE B)`, `AI MULTIMODAL EXTRACTION`, `VERIFIED BOT`, atau kotak hijau `Jalur Khusus DM`. Di WhatsApp asli tidak pernah ada label seperti ini.
* **Jam Pesan Wajib di Pojok Kanan Bawah:**
Pindahkan posisi jam (misalnya `11:38` atau `14:37`) ke pojok kanan bawah di dalam masing-masing kotak chat, berdampingan dengan centang dua untuk pesan keluar.
* **Dilarang Mewarnai Teks Sembarangan:**
WhatsApp tidak mendukung warna teks kustom. Hapus pewarnaan merah, oranye, atau hijau pada teks isi pesan (seperti tanggal atau link). Semua teks pesan bot wajib hitam/abu gelap di mode terang (`text-zinc-900`) dan putih/abu terang di mode gelap (`text-zinc-100`).
* **Hapus Kotak Bersarang (Nested Cards) & Garis Divider:**
Jangan membuat kotak baru atau garis pembatas tebal di dalam bubble chat. Format pesan bot murni mengandalkan baris teks, spasi, emoji, dan tanda bintang tunggal (`*teks*`) persis seperti pesan WhatsApp sesungguhnya.
* **Geometri Kotak:**
Tetap pertahankan aturan proyek: semua bubble chat, kotak input, dan tombol berbentuk kotak tegas tanpa sudut membulat (`rounded-none`) dan tanpa bayangan (`shadow-none`).

---

## 3. Rincian Revisi Tiap Skenario

### Skenario 1: Saluran Pengumuman Komunitas

Tujuan skenario ini adalah memperlihatkan bagaimana info tugas disiarkan secara resmi, rapi, dan satu arah tanpa tertimbun obrolan santai.

* **Header Percakapan:**
* Nama: `Coba JobdexIn` (atau `Saluran Komunitas Ilkom B 2024`).
* Subjudul: `Announcements` (ikon pengumuman WhatsApp).


* **Isi Pesan di Saluran:**
1. **Kartu Sambutan WhatsApp:**
* Tampilkan banner sambutan komunitas seperti bawaan WhatsApp:
*Ikon megaphone* $\rightarrow$ *"Welcome to your community! Send important admin updates to all your members at once."*


2. **Siaran Tugas Baru (Format Resmi):**
* Tampilkan kartu gambar preview di bagian atas pesan (gambar logo Undiksha berlatar putih/biru).
* Format teks pesan di bawah gambar:
```text
📢 *PENGUMUMAN TUGAS KULIAH* ✨
Halo rekan-rekan *Ilmu Komputer Undiksha 2024*!

Ada tugas baru nih, jangan lupa dicatat dan dibuat ya Guys! 🙌
📚 *Mata Kuliah:* Kalkulus Lanjut
📝 *Tugas:* Problem Set 4 - Integral Lipat Dua
⏰ *Tenggat:* Rabu, 28 Oktober 2026 (23:59 WITA)

📌 *Ketentuan / Deskripsi:*
Buat tugas di double folio bergaris dengan tulisan tangan rapi, scan dan kumpulkan dalam format PDF.

🔗 *Tempat Pengumpulan / LMS:*
Drive: https://elearning.undiksha.ac.id

Yuk cicil dari sekarang biar gak keteteran pas deadline! 🙌
👉 Cek kalender & jadwal lengkap:
https://jobdexin.sumestawsome.xyz/jadwal-tugas-ilkom-b

```


* Jam pengiriman: pojok kanan bawah (`14:42`).


3. **Pengingat Progres H-3 (Tugas Lain):**
* Tambahkan 1 pesan pengingat otomatis untuk matkul *Grafika Komputer* atau *Matematika Teknik* yang jatuh tempo 3 hari lagi.





---

### Skenario 2: Japri Admin / Korti (Input Tugas & Persetujuan Draf)

Tujuan skenario ini adalah memperlihatkan kemudahan Korti dalam menginput tugas via rekaman suara maupun perintah teks.

* **Header Percakapan:**
* Nama: `JobDex in AI` (status: `online`).


* **Interaksi 1: Input Lewat Voice Note (VN)**
* **Pesan User (Korti):**
* Tampilan bubble chat suara warna hijau lime aksen (posisi kanan).
* Berisi foto profil pengirim, tombol play, visual grafik suara (*waveform*), durasi `0:22`, jam `10:14`, dan centang dua biru.


* **Interaksi Hover Tooltip (Bukan Kotak Tambahan):**
* Saat mouse diarahkan (*hover*) ke bubble voice note, muncul kotak kecil (*floating tooltip*) di dekat kursor:
`"Korti cukup rekam suara detail tugas. AI akan otomatis mendengarkan dan merangkum isinya jadi draf."`


* **Pesan Balasan Bot (Kartu Draf Menunggu ACC):**
* Tampilan bubble putih di kiri:
```text
📋 *Draf Tugas Kuliah (Menunggu Persetujuan)*

📚 *Mata Kuliah:* Matematika Teknik
📝 *Judul Tugas:* Latihan 15
⏰ *Tenggat:* Senin, 26 Oktober 2026 pukul 17:00 WITA
📌 *Ketentuan:* Dikerjakan di double folio, di-upload di e-learning Undiksha.
🔗 *Pengumpulan:* E-Learning Undiksha

--------------------------------------
Periksa draf di atas. Jika data sudah benar:
👉 Ketik *!tugas acc* (atau *acc*) untuk mempublikasikan.
👉 Ketik *!tugas batal* (atau *batal*) untuk membuang draf.
👉 Atau kirim pesan/VN perbaikan jika ada kata yang salah.
👉 Cek dashboard: https://jobdexin.sumestawsome.xyz/dashboard/tasks

```


* Jam pengiriman: pojok kanan bawah (`10:14`).


* **Pesan User (Konfirmasi):**
* Teks: `!tugas acc` (jam `10:15`, centang dua biru).


* **Pesan Balasan Bot (Sukses Terbit):**
* ```text
✅ *Tugas Berhasil Disetujui & Diterbitkan!*

📚 *Mata Kuliah:* Matematika Teknik
📝 *Tugas:* Latihan 15
⏰ *Tenggat:* Senin, 26 Oktober 2026 pukul 17:00 WITA

Tugas telah tersimpan di JobDex dan disiarkan ke kelas.
👉 Cek dashboard: https://jobdexin.sumestawsome.xyz/dashboard/tasks

```






* **Interaksi 2: Input Cepat Lewat Perintah Teks (Alternatif Non-Suara)**
* Tampilkan contoh kedua di bawahnya jika admin sedang tidak bisa merekam suara:
* **User:** `!tugas tambah Pemrograman Web | Bikin REST API Next.js & Push GitHub | Kerjakan berkelompok maks 3 orang | 28/10/2026 23:59 | E-Learning Undiksha`
* **Bot:** Membalas konfirmasi sukses instan dengan pratinjau tugas yang tersimpan.





---

### Skenario 3: Grup Diskusi Kelas (Tanya AI & Cek Deadline Bersama)

Tujuan skenario ini adalah memperlihatkan interaksi santai teman sekelas di grup saat butuh info tugas tanpa harus membuka browser.

* **Header Percakapan:**
* Nama Grup: `Diskusi Kelas Ilkom B 2024` (anggota: Budi, Darma, Korti, Anda, dll.).


* **Obrolan Pengantar Mahasiswa (Suasana Alami):**
1. **Chat 1 (Darma):**
* Pesan putih kiri: *"Guys, tugas praktikum kemarin ada instruksi tambahan dari dosen gak ya?"* (jam `14:18`).


2. **Chat 2 (Ayu):**
* Pesan putih kiri: *"Kayaknya udah dicatat sama bot deh, coba panggil aja."* (jam `14:19`).


3. **Chat 3 (Budi Santoso):**
* Pesan putih kiri: *"Guys, ada tugas yang tenggatnya mepet minggu ini gak ya? Takut ada yang kelupaan ngerjain nih."* (jam `14:20`).




* **Panggilan Perintah ke Bot:**
* **Pesan User (Kanan):**
* Teks: `!tugas mepet` (jam `14:21`, centang dua).




* **Jawaban Bot AI (Format Ringkas & Bersih):**
* Teks bubble putih di kiri tanpa badge aneh:
```text
📋 *DAFTAR TUGAS MEPEK ILKOM B (≤ 3 HARI)* 🚨
Total: 3 tugas perlu segera diselesaikan!

1. *Matematika Teknik*
📝 *Tugas:* Latihan 15
⏰ *Tenggat:* Besok, 26 Oktober 2026 (17:00 WITA)
🔗 *LMS:* E-Learning Undiksha

2. *Kalkulus Lanjut*
📝 *Tugas:* Problem Set 4 - Integral Lipat Dua
⏰ *Tenggat:* Rabu, 28 Oktober 2026 (23:59 WITA) (2 hari lagi)
🔗 *LMS:* E-Learning Undiksha

3. *Pemrograman Web*
📝 *Tugas:* Bikin REST API Next.js & Push GitHub
⏰ *Tenggat:* Rabu, 28 Oktober 2026 (23:59 WITA) (2 hari lagi)
🔗 *LMS:* GitHub & E-Learning

👉 Cek jadwal & kalender lengkap:
https://jobdexin.sumestawsome.xyz/jadwal-tugas-ilkom-b

```


* Jam pengiriman: pojok kanan bawah (`14:21`).



---

## 4. Rangkuman Teknis untuk Antigravity

| Komponen | Status Saat Ini (Keliru) | Standar Perbaikan (Wajib) |
| --- | --- | --- |
| **Filter Tab Skenario** | Di dalam frame WA (bawah navbar) | Di luar frame WA, tepat di bawah judul pengantar |
| **Gaya Tombol Filter** | Kaku ("Skenario 1: Saluran Pengumuman") | Pertanyaan santai ("Gimana cara JobDex ngumumin...") |
| **Badge di Chat** | Banyak badge teknis (`OUTBOUND`, `AI EXTRACTION`) | Hapus total seluruh badge teknis dari bubble chat |
| **Posisi Jam** | Di luar chat atau di samping badge | Di pojok kanan bawah bubble chat |
| **Warna Teks Chat** | Menggunakan teks merah/oranye | Teks standar monokrom (hanya format `*bold*` dan link) |
| **Bentuk Bubble Chat** | Berisi kotak bertumpuk & border tebal | Polos, bersih, hanya teks dan emoji |
| **Hover Voice Note** | Menampilkan card baru di bawahnya | Floating tooltip sederhana dekat kursor |
| **Geometri Dasar** | Kadang bocor sudut membulat | Wajib serba kotak tajam (`rounded-none`, `shadow-none`) |