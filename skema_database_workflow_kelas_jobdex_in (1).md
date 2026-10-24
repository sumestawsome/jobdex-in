# BLUEPRINT DATABASE & WORKFLOW RUANG KERJA KELAS (JOBDEX.IN)

Dokumen ini mendefinisikan skema Firestore, pemisahan role multi-workspace, struktur data tugas kuliah, dan logika broadcast WhatsApp untuk modul Kelas/Akademik tanpa merusak struktur Ormawa Forkom KIP yang sudah berjalan.

---

## 1. Konsep Arsitektur: 1 Project, Multi-Workspace Type

Untuk menjaga efisiensi kode dan mencegah duplikasi pemeliharaan, seluruh data tetap berada dalam 1 database Firestore. Perbedaan perilaku sistem dikontrol sepenuhnya oleh atribut `type` pada koleksi `workspaces`:

* **`type: "ormawa"` (Contoh: Forkom KIP Undiksha):**
  * Fitur lengkap: Divisi, Acara, Multi-PIC, Approval Desain, Arsip Referensi.
* **`type: "kelas"` (Contoh: Kelas Ilmu Komputer 2024):**
  * Fitur ultra-ringkas: Khusus manajemen jadwal kuliah & tugas.
  * Menu Divisi, Approval, dan Arsip Referensi otomatis disembunyikan.
  * Anggota kelas tidak wajib memiliki akun login; hanya **Korti** (dan Super Admin) yang menginput tugas. Teman sekelas murni bertindak sebagai penerima siaran (*broadcast recipients*) di grup WhatsApp Pengumuman Komunitas.

---

## 2. Struktur Koleksi Firestore (JSON Specification)

### A. Koleksi `workspaces` (Ruang Kerja)
Dokumen ini menyimpan konfigurasi identitas kelas dan saluran komunikasi WhatsApp.

* **Path:** `workspaces/{workspace_id}`
* **Contoh Dokumen (`ws_ilkom_2024`):**
```json
{
  "id": "ws_ilkom_2024",
  "name": "Kelas Ilmu Komputer 2024",
  "short_name": "ILKOM 24",
  "institution": "Universitas Pendidikan Ganesha",
  "type": "kelas",
  "status": "aktif",
  "whatsapp_settings": {
    "group_id": "120363411033795051@g.us",
    "channel_type": "community_announcement",
    "enabled": true
  },
  "reminder_rules": {
    "milestones_days": [5, 3, 1],
    "urgent_threshold_days": 3,
    "cron_hour_wita": 12
  },
  "created_at": "2026-10-24T04:00:00.000Z",
  "created_by": "user_sumesta_id"
}
```

---

### B. Koleksi `users` & Penanganan Role Multi-Workspace
Bagaimana memisahkan role pengguna antara Ormawa dan Kelas? Gunakan mapping `workspace_roles` di dalam dokumen pengguna sehingga 1 akun bisa memiliki peran berbeda di setiap ruang kerja.

* **Path:** `users/{user_id}`
* **Contoh Dokumen:**
```json
{
  "id": "user_sumesta_id",
  "name": "Sumesta C",
  "email": "sumestacreative@gmail.com",
  "phone": "6285119459703",
  "global_role": "super_admin",
  "workspace_roles": {
    "ws_forkom_kip": "super_admin",
    "ws_ilkom_2024": "korti"
  },
  "status": "aktif",
  "created_at": "2026-05-29T10:00:00.000Z"
}
```

* **Daftar Role Khusus Ruang Kerja Kelas:**
  1. `super_admin`: Pemilik sistem, memiliki akses penuh ke seluruh workspace.
  2. `korti` (Koordinator Tingkat / Wakil Korti): Berhak membuat, mengedit, membatalkan, dan menghapus tugas kuliah di workspace kelas tersebut.
  3. `anggota` (Opsional/Jika mendaftar): Hanya bisa melihat jadwal di web dashboard (read-only).

---

### C. Koleksi `tasks` (Tugas Kuliah & State Pengingat)
Tugas kuliah disimpan di koleksi `tasks` yang sama, namun dibedakan oleh `workspace_id` dan `type: "tugas_kuliah"`. Dokumen ini dilengkapi array `reminders_sent` untuk mencatat riwayat milestone pengingat.

* **Path:** `tasks/{task_id}`
* **Contoh Dokumen (`task_web_001`):**
```json
{
  "id": "task_web_001",
  "workspace_id": "ws_ilkom_2024",
  "type": "tugas_kuliah",
  "subject_name": "Teknologi Web",
  "title": "Proyek Pembuatan Website Portofolio & Form Dinamis",
  "description": "Tugas kelompok membuat website responsif dengan framework bebas. Dikumpulkan dalam format link GitHub repo dan PDF laporan pengujian.",
  "submission_link": "https://elearning.undiksha.ac.id/mod/assign/view.php?id=12345",
  "deadline": "2026-10-31T23:59:00.000Z",
  "status": "aktif",
  "notification_tracker": {
    "instant_created_sent": true,
    "milestones_sent": ["h5", "h3"],
    "last_sent_at": "2026-10-28T04:00:00.000Z",
    "last_edit_broadcast_at": null,
    "edit_count": 0
  },
  "created_by": {
    "user_id": "user_sumesta_id",
    "name": "Sumesta C (Korti)"
  },
  "updated_at": "2026-10-24T04:30:00.000Z",
  "created_at": "2026-10-24T04:30:00.000Z"
}
```

---

### D. Koleksi `notifications_log` (Audit Jejak Siaran WA)
Setiap pesan yang berhasil ditembakkan ke WhatsApp Fonnte dicatat di sini untuk mencegah pengiriman ganda (*idempotency*).

* **Path:** `notifications_log/{log_id}`
* **Contoh Dokumen:**
```json
{
  "id": "notif_20261024_001",
  "workspace_id": "ws_ilkom_2024",
  "task_id": "task_web_001",
  "trigger_type": "instant_create",
  "target_group": "120363411033795051@g.us",
  "message_preview": "📢 *PENGUMUMAN TUGAS BARU: Teknologi Web*...",
  "status": "delivered",
  "sent_at": "2026-10-24T04:30:05.000Z"
}
```

---

## 3. Logika Trigger & Mitigasi Pengingat (Algoritma Penjadwalan)

### Skenario 1: Input Tugas Normal ($\Delta t \ge 5$ Hari)
* **Kondisi:** Selisih antara waktu buat dan deadline $\ge 5$ hari (misal tugas dibuat hari ini untuk minggu depan).
* **Aksi Saat Simpan:** Simpan ke database tanpa langsung membunyikan WhatsApp (agar grup tidak bising). `notification_tracker.instant_created_sent = false`.
* **Aksi Cron Job (Setiap Jam 12:00 WITA):**
  * **H-5:** Jika hari ini tepat H-5 dan belum ada `"h5"` di `milestones_sent`, kirim sapaan awal untuk mencicil.
  * **H-3:** Jika hari ini tepat H-3 dan belum ada `"h3"` di `milestones_sent`, kirim pengingat progres.
  * **H-1:** Jika hari ini tepat H-1 dan belum ada `"h1"` di `milestones_sent`, kirim pengingat mendesak sebelum pengumpulan.

### Skenario 2: Input Tugas Mepet ($\Delta t \le 3$ Hari atau Besok)
* **Kondisi:** Tugas baru dibuat saat sisa waktu tinggal $\le 3$ hari, 2 hari, atau 1 hari.
* **Aksi Saat Simpan:** 
  * Sistem langsung mendeteksi kondisi mepet.
  * Kirim **Instant Broadcast** ke grup pengumuman: *"📢 Tugas Baru (Deadline Mepet)!"*.
  * Tandai milestone yang sudah lewat sebagai terlewati (misal langsung isi `milestones_sent: ["instant_created", "h5", "h3"]`), sehingga Cron Job jam 12:00 WITA tinggal melanjutkan milestone yang tersisa (H-1).

### Skenario 3: Perubahan Data Tugas (Edit Jadwal / Deskripsi)
* **Kondisi:** Korti mengedit tanggal deadline atau merevisi isi ketentuan tugas.
* **Aksi Saat Simpan Edit:**
  * **Jika Deadline Berubah:** Kirim siaran instan ke grup:
    `⚠️ *INFO PERUBAHAN DEADLINE KULIAH*`  
    `Tugas: *Teknologi Web*`  
    `Jadwal Baru: *Jumat, 31 Oktober 2026 (23:59 WITA)*`  
    `Catatan: Jadwal pengumpulan telah diundur/dimajukan oleh dosen/Korti. Jangan sampai terlewat ya!`
  * **Jika Deskripsi/Ketentuan Berubah:** Kirim siaran instan:
    `📝 *UPDATE KETENTUAN TUGAS: Teknologi Web*`  
    `Ada pembaruan instruksi tugas dari dosen. Silakan cek detail ketentuan terbaru di dashboard web.`
  * Reset milestone yang relevan jika tanggal pengumpulan diundur secara signifikan.

---

## 4. Templat Pesan WhatsApp Ramah Mahasiswa

### A. Format Pesan Tugas Baru / Mepet
```text
📢 *PENGUMUMAN TUGAS KULIAH* ✨
Halo rekan-rekan *Kelas Ilmu Komputer 2024*!

Ada tugas baru yang baru saja diinput oleh Korti:
📚 *Mata Kuliah:* Teknologi Web
📝 *Tugas:* Proyek Pembuatan Website Portofolio
⏰ *Tenggat:* Sabtu, 31 Oktober 2026 (23:59 WITA)

📌 *Ketentuan / Deskripsi:*
Tugas kelompok membuat website responsif dengan framework bebas. Dikumpulkan dalam format link GitHub repo dan PDF laporan pengujian.

🔗 *Link Pengumpulan / LMS:*
https://elearning.undiksha.ac.id/mod/assign/view.php?id=12345

Yuk mulai dicicil dari sekarang biar gak keteteran pas deadline! 🙌
👉 Cek jadwal lengkap: https://jobdexin.sumestawsome.xyz/dashboard/tasks
```

### B. Format Pengingat H-1 (Urgent Reminder)
```text
⏰ *PENGINGAT DEADLINE BESOK!* 🔥
Halo teman-teman! Jangan lupa tugas berikut batas pengumpulannya besok ya:

📚 *Mata Kuliah:* Teknologi Web
📝 *Tugas:* Proyek Pembuatan Website Portofolio
🚨 *Deadline:* Besok, 31 Oktober 2026 pukul 23:59 WITA

Pastikan file/link tugas sudah siap disubmit sebelum server LMS penuh. Semangat menyelesaikannya! 🚀
```