Ide pemisahan peran dan pemanfaatan slot multi-device WhatsApp ini sangat masuk akal secara teknis.

Berikut analisis mendalam mengenai penempatan fitur, evaluasi keamanan trik 2 akun Green-API, serta skema data untuk diterapkan.

---

**1. Penempatan Menu & Antarmuka "Tambah Kelas"**

Lokasi terbaik untuk fitur ini adalah di **Sidebar Bawah > Menu "Pengaturan Ruang Kerja" (`/dashboard/settings/workspaces`)** yang dikunci hak aksesnya khusus untuk peran `super_admin`:

* **Alur Akses:** Klik foto profil/avatar di kiri bawah $\rightarrow$ pilih **"Kelola Kelas"** atau **"Workspace Settings"**.
* **Formulir Input Data Kelas Baru:**
* **Nama Kelas:** contoh `Kelas Ilmu Komputer B 2024`
* **Slug / ID Workspace:** otomatis dari nama, misal `ws_ilkom_b_2024`
* **ID Grup Pengumuman (Broadcast):** contoh `120363411033795051@g.us`
* **ID Grup Diskusi Kelas (Interaktif & VN):** contoh `120363xxxxxxxxx@g.us`
* **Nomor WhatsApp Admin Komunitas 1:** format `628xxxxxxxx`
* **Nomor WhatsApp Admin Komunitas 2:** format `628xxxxxxxx`
* **Kredensial Instance Green-API (Opsional/Dinamis):** kolom input `GREEN_API_ID_INSTANCE` dan `TOKEN` jika setiap kelas menggunakan instance mandiri, atau memilih gateway default sistem.



---

**2. Evaluasi Trik 2 Akun Green-API pada 1 Nomor HP**

**Apakah Bisa Berjalan?**
**Bisa 100%.** Protokol resmi WhatsApp Multi-Device mengizinkan 1 akun WhatsApp utama terhubung ke maksimal **4 Perangkat Tertaut (Linked Devices)** secara bersamaan:

* Slot 1: Akun Green-API A (Instance Interaktif & VN)
* Slot 2: Akun Green-API B (Instance Khusus Siaran / Outbound)
* Slot 3 & 4: Masih tersisa untuk WhatsApp Web di laptop/PC pribadi Anda.

**Pembagian Kuota & Dialog (3 Chat Lock):**

* **Instance A (Akun Gmail 1) $\rightarrow$ Khusus Interaksi & Webhook:**
* Chat 1: Nomor Admin 1 (DM pribadi)
* Chat 2: Nomor Admin 2 (DM pribadi)
* Chat 3: Grup Diskusi Kelas
* *Status:* Pas 3 chat (limit free tier terpenuhi). Di dalam Grup Diskusi, pesan suara dari Super Admin, Admin 1, maupun Admin 2 tetap terbaca karena Green-API menghitung **ID Room Chat**, bukan jumlah pengirim di dalam grup.


* **Instance B (Akun Gmail 2) $\rightarrow$ Khusus Siaran Pengumuman:**
* Chat 1: Grup Pengumuman Komunitas
* Chat 2 & 3: Kosong / cadangan
* *Konfigurasi:* **Webhook dimatikan total** di console Green-API Instance B agar tidak mengirim webhook ganda ke server. Server JobDex.in hanya menembak endpoint `sendMessage` Instance B saat ada tugas yang siap disiarkan.



**Perbandingan Fonnte vs. 2 Akun Green-API:**

| Parameter | Fonnte (Free Tier) | 2 Akun Green-API (Developer Free) |
| --- | --- | --- |
| **Watermark** | Ada (`Sent via fonnte.com`) | **Bersih 100% tanpa watermark** |
| **Kapasitas Pesan** | Terbatas kuota harian/bulanan | Masing-masing 1.000 pesan/bulan (Total 2.000 pesan) |
| **Penerimaan Audio Utuh** | Sering terpotong/link kedaluwarsa | Menyediakan URL download buffer audio utuh |
| **Setup Akun** | 1 akun | Butuh 2 akun email terpisah untuk scan QR |

---

**3. Aspek Keamanan & Risiko Blokir (Safety Audit)**

* **Apakah Aman dari Banned WhatsApp?**
Aman, asalkan beban pesan tidak bersifat *spam blast* massal ke nomor asing. Karena bot hanya mengirimkan pesan ke grup kelas sendiri dan admin yang sudah terdaftar di kontak, sistem deteksi spam WhatsApp tidak akan menandainya sebagai spam liar.
* **Mitigasi Session Desync (Terputus Tiba-Tiba):**
Kadang jika dua bot browser headless berjalan di nomor yang sama, pembaruan kunci enkripsi dari WhatsApp pusat bisa membuat salah satu session ter-logout sendiri.
* *Solusi:* Buat pengecekan status instance sederhana di halaman pengaturan (`/getStateInstance`) agar Super Admin tahu jika ada salah satu instance yang butuh scan ulang QR.


* **Pencegahan Echo Loop:**
Karena Instance B hanya melakukan `sendMessage` tanpa webhook aktif, risiko *self-echo loop* otomatis 0%.

---

**4. Struktur Skema Firestore (`workspaces`)**

Dokumen ruang kerja kelas di Firestore dapat dirancang seperti ini:

```json
{
  "id": "ws_ilkom_b_2024",
  "name": "Kelas Ilmu Komputer B 2024",
  "type": "kelas",
  "status": "aktif",
  "whatsapp_settings": {
    "announcement_group_id": "120363411033795051@g.us",
    "discussion_group_id": "120363999888777111@g.us",
    "gateways": {
      "interactive_instance_id": "710722779829",
      "interactive_token": "token_instance_a",
      "broadcast_instance_id": "710799887766",
      "broadcast_token": "token_instance_b"
    }
  },
  "authorized_admins": {
    "admin_1": {
      "phone": "6285119459703",
      "name": "Sumesta (Korti)",
      "allow_voice_note_dm": true
    },
    "admin_2": {
      "phone": "6281234567890",
      "name": "Wakil Korti",
      "allow_voice_note_dm": true
    },
    "super_admin": {
      "phone": "6285119459703",
      "allow_voice_note_dm": false,
      "allow_voice_note_group": true
    }
  },
  "created_at": "2026-10-25T12:00:00.000Z"
}

```

Rencana menggunakan 2 akun Green-API pada 1 nomor WhatsApp untuk memisahkan jalur interaktif dan jalur siaran adalah solusi gratis yang paling bersih dari watermark dan sangat layak diimplementasikan.