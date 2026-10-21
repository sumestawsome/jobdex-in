# Inventaris Template Pesan Keluar (Outbound Messages) WhatsApp JobDex.in

Dokumen ini memuat seluruh template pesan keluar (outbound messages) yang dikirim oleh sistem JobDex.in ke WhatsApp, baik melalui **notifikasi otomatis event sistem**, **pengingat berkala Vercel Cron**, maupun **balasan interaktif WhatsApp Bot**.

> **Catatan Label:**  
> Seluruh pesan bot menggunakan konstanta label dari [`src/lib/server/whatsapp-labels.ts`](file:///d:/Download/jobdescin/src/lib/server/whatsapp-labels.ts) dengan format `*JobdexIn*` (tanpa titik) demi keamanan agar WhatsApp tidak memblokir atau mendeteksi teks sebagai link/domain eksternal.

---

## 1. Notifikasi Siklus Tugas Otomatis (Event-Driven Notifications)
File sumber: [`src/lib/notification-templates.ts`](file:///d:/Download/jobdescin/src/lib/notification-templates.ts) & [`src/lib/server/notifications.ts`](file:///d:/Download/jobdescin/src/lib/server/notifications.ts)

### 1.1 Tugas Baru Dibuat (`task_created`)
* **Trigger:** Koordinator/Admin membuat tugas baru di dashboard atau via bot yang ditugaskan ke PIC tertentu.
* **Tujuan:** Grup divisi/acara atau personal PIC.
* **Variabel:**
  * `${input.task.name}` : Judul tugas
  * `${picName}` : Nama PIC yang ditugaskan
  * `${coordinatorName}` : Nama koordinator pembuat tugas
  * `${deadline}` : Tanggal batas waktu (format tanggal Indonesia)
* **Teks Template:**
```text
[*JobdexIn* Reminder] Tugas Baru

Tugas: {input.task.name}
PIC: {picName}
Koordinator: {coordinatorName}
Deadline: {deadline}
```

---

### 1.2 Pembaruan Status Tugas (`task_status_changed`)
* **Trigger:** Anggota atau PIC mengubah status pengerjaan (misal: "sedang dikerjakan", "draft selesai", "ditunda").
* **Tujuan:** Grup divisi/acara terkait.
* **Variabel:**
  * `${actorName}` : Nama anggota yang melakukan update
  * `${input.task.name}` : Judul tugas
  * `${statusLabel}` : Label status baru
  * `${input.note || "-"}` : Catatan pengerjaan
  * `${deadline}` : Tanggal batas waktu tugas
* **Teks Template:**
```text
[*JobdexIn* Reminder] Update Tugas

Nama: {actorName}
Tugas: {input.task.name}
Status: {statusLabel}
Catatan: {input.note || "-"}
Deadline: {deadline}
```

---

### 1.3 Tugas Butuh Bantuan / Kendala Pengerjaan (`task_help_needed`)
* **Trigger:** PIC mengubah status menjadi `butuh_bantuan` atau `stuck` beserta rincian kendala.
* **Tujuan:** Grup panitia/divisi agar koordinator dan rekan tim dapat segera membantu.
* **Variabel:**
  * `${actorName}` : Nama PIC yang mengalami kendala
  * `${input.task.name}` : Judul tugas
  * `${statusLabel}` : Label status (`Stuck` / `Butuh Bantuan`)
  * `${input.stuckNotes || input.note || "-"}` : Uraian kendala yang dihadapi
  * `${deadline}` : Tanggal batas waktu tugas
* **Teks Template:**
```text
[*JobdexIn* Reminder] Perlu Bantuan

Anggota: {actorName}
Tugas: {input.task.name}
Status: {statusLabel}
Kendala: {input.stuckNotes || input.note || "-"}
Deadline: {deadline}
```

---

### 1.4 Hasil Desain Diunggah / Menunggu Approval (`task_result_uploaded`)
* **Trigger:** PIC mengunggah draf/hasil desain akhir melalui form dashboard atau perintah WA `!jobdex upload hasil`.
* **Tujuan:** Grup kepanitiaan/divisi agar koordinator memeriksa file.
* **Variabel:**
  * `${actorName}` : Nama PIC pengunggah
  * `${input.task.name}` : Judul tugas
  * `${input.thumbnailUrl || "-"}` : URL thumbnail preview gambar
  * `${input.uploadUrl || "-"}` : Link Google Drive / Canva hasil desain
* **Teks Template:**
```text
[*JobdexIn* Reminder] Hasil Desain Diupload

Anggota: {actorName}
Tugas: {input.task.name}
Status: Menunggu Approval
Preview: {input.thumbnailUrl || "-"}
Link: {input.uploadUrl || "-"}
```

---

### 1.5 Permintaan Revisi (`task_revision_requested`)
* **Trigger:** Koordinator/Admin meminta perbaikan pada desain yang telah diunggah.
* **Tujuan:** Grup divisi/acara dan mention ke nomor PIC terkait.
* **Variabel:**
  * `${input.task.name}` : Judul tugas
  * `${picName}` : Nama PIC yang mengerjakan
  * `${input.revisionNotes || input.note || "-"}` : Poin-poin detail revisi
* **Teks Template:**
```text
[*JobdexIn* Reminder] Revisi Diperlukan

Tugas: {input.task.name}
PIC: {picName}
Catatan Revisi: {input.revisionNotes || input.note || "-"}
```

---

### 1.6 Tugas Disetujui / Selesai (`task_approved`)
* **Trigger:** Koordinator/Admin memberikan approval final atas hasil pengerjaan desain.
* **Tujuan:** Grup divisi/acara terkait.
* **Variabel:**
  * `${input.task.name}` : Judul tugas
  * `${picName}` : Nama PIC
  * `${coordinatorName}` : Nama koordinator yang menyetujui
* **Teks Template:**
```text
[*JobdexIn* Reminder] Tugas Disetujui

Tugas: {input.task.name}
PIC: {picName}
Disetujui oleh: {coordinatorName}
```

---

## 2. Pengingat Deadline & Notifikasi Cron
File sumber: [`src/lib/server/deadline-reminders.ts`](file:///d:/Download/jobdescin/src/lib/server/deadline-reminders.ts) & [`src/app/api/cron/deadline-reminders/route.ts`](file:///d:/Download/jobdescin/src/app/api/cron/deadline-reminders/route.ts)

### 2.1 Rekap Harian Deadline Jam 12 Siang (`buildDigestReminderMessage`)
* **Trigger:** Vercel Cron berjalan setiap hari pukul 04:00 UTC (12:00 WITA / Siang).
* **Tujuan:** Grup WhatsApp masing-masing acara atau divisi ormawa.
* **Variabel:**
  * `${dateText}` : Tanggal hari ini dalam bahasa Indonesia
  * `${sections}` : Blok daftar tugas per kategori (Overdue, Hari-H, H-1, H-2/H-3, H-5/H-7, Waiting Approval, Stuck)
  * Item tugas memuat: Judul, Nama PIC, Mention `@<nomor>`, Deadline, Status, Divisi/Acara, Kendala, Aksi Cepat
  * Rangkuman jumlah angka kategori
* **Teks Template:**
```text
[*JobdexIn* Digest Reminder]

Rekap tugas perlu ditindaklanjuti
Tanggal cek: {dateText}

{sections (daftar tugas terkelompok per kategori)}

Ringkasan:
- Overdue: {digest.categories.overdue}
- Menunggu Approval: {digest.categories.waitingApproval}
- Stuck/Butuh Bantuan: {digest.categories.stuck}
- Hari-H: {digest.categories.today}
- H-1: {digest.categories.h_1}
- H-2/H-3: {digest.categories.h_2_h_3}
- H-5/H-7: {digest.categories.h_5_h_7}

Catatan:
Task stuck/butuh bantuan yang sudah overdue ditampilkan di bagian OVERDUE.

Buka dashboard untuk detail lengkap.{remainingText}
```

---

### 2.2 Smart Follow-up: H-3 Belum Dimulai (Personal PIC)
* **Trigger:** Tugas berjarak 3 hari dari deadline tetapi statusnya masih `belum_dimulai`.
* **Tujuan:** Jalur pesan pribadi (personal chat) ke nomor WhatsApp PIC.
* **Variabel:**
  * `${pic?.name || "Rekan"}` : Nama PIC
  * `${task.name}` : Judul tugas
* **Teks Template:**
```text
[*JobdexIn* Reminder]

Halo {pic.name}, task "{task.name}" deadline H-3.

Status saat ini: Belum Dimulai

Yuk mulai dikerjakan dan update progress kamu!
Update cepat:
!jobdex {task.name} sudah mulai dikerjakan
```

---

### 2.3 Smart Follow-up: H-1 Belum Selesai (Personal PIC)
* **Trigger:** Tugas berjarak 1 hari dari deadline dan belum berstatus `menunggu_approval` atau `approved`.
* **Tujuan:** Pesan pribadi ke nomor WhatsApp PIC.
* **Variabel:**
  * `${pic?.name || "Rekan"}` : Nama PIC
  * `${task.name}` : Judul tugas
  * `${statusLabel}` : Status tugas saat ini
* **Teks Template:**
```text
[*JobdexIn* Reminder]

Halo {pic.name}, task "{task.name}" deadline H-1.

Status saat ini: {statusLabel}

Update cepat:
!jobdex {task.name} sudah upload
atau
!jobdex {task.name} stuck, catatan: [kendala]
```

---

### 2.4 Smart Follow-up: Stuck > 12 Jam (Grup Koordinator)
* **Trigger:** Status tugas `stuck` atau `butuh_bantuan` tidak mengalami update lebih dari 12 jam.
* **Tujuan:** Grup WhatsApp acara/divisi terkait.
* **Variabel:**
  * `${task.name}` : Judul tugas
  * `${durationStr}` : Durasi macet (misal: "14 jam")
  * `${pic?.name || "-"}` : Nama PIC
  * `${constraint}` : Rincian kendala
* **Teks Template:**
```text
[*JobdexIn* Koor Alert]

Ada tugas butuh perhatian:
1. {task.name} — stuck {durationStr}
   PIC: {pic.name}
   Kendala: {task.stuck_notes}

Aksi cepat koordinator:
- Tanya PIC langsung
- Bantu carikan solusi atau alihkan tugas jika berat
```

---

### 2.5 Smart Follow-up: Menunggu Materi > 24 Jam (Grup Koordinator)
* **Trigger:** Status tugas `menunggu_materi` selama lebih dari 24 jam tanpa ada materi baru.
* **Tujuan:** Grup WhatsApp acara/divisi terkait.
* **Variabel:**
  * `${task.name}` : Judul tugas
  * `${pic?.name || "-"}` : Nama PIC
  * `${task.stuck_notes || "-"}` : Catatan kebutuhan materi
* **Teks Template:**
```text
[*JobdexIn* Koor Alert]

Ada tugas butuh perhatian:
1. {task.name} — menunggu materi 1 hari
   PIC: {pic.name}
   Catatan kendala: {task.stuck_notes || "-"}

Harap koordinator atau pembuat task segera mengirimkan materi agar tugas dapat mulai dikerjakan.
```

---

### 2.6 Smart Follow-up: Menunggu Approval > 24 Jam (Grup Koordinator)
* **Trigger:** Hasil desain sudah diunggah oleh PIC dan berstatus `menunggu_approval` selama lebih dari 24 jam.
* **Tujuan:** Grup WhatsApp acara/divisi terkait.
* **Variabel:**
  * `${task.name}` : Judul tugas
  * `${pic?.name || "-"}` : Nama PIC
* **Teks Template:**
```text
[*JobdexIn* Koor Alert]

Ada tugas butuh perhatian:
1. {task.name} — menunggu approval 1 hari
   PIC: {pic.name}

Koordinator harap segera mengecek hasil dan memberikan persetujuan (approve) atau revisi:
- !jobdex acc {task.name}
- !jobdex revisi {task.name}, catatan: [catatan]
```

---

## 3. Respon Interaktif Perintah Tugas (Task Bot Commands)
File sumber: [`src/lib/server/whatsapp-task-command-executor.ts`](file:///d:/Download/jobdescin/src/lib/server/whatsapp-task-command-executor.ts)

### 3.1 Daftar Tugas Saya (`!jobdex tugas saya`)
* **Trigger:** Anggota mengirim pesan `!jobdex tugas saya` atau variasinya (`tugas saya minggu ini`, `deadline dekat`).
* **Variabel:**
  * `${user.name}` : Nama pengguna pengirim
  * Iterasi daftar tugas: Judul, Status, Prioritas, Deadline, Selisih Hari (`H-X` / `Hari ini` / `Overdue`), Acara/Divisi
* **Teks Template:**
```text
[*JobdexIn* Tugas Saya]

Halo {user.name}, berikut tugas aktif kamu:

1. {task.name}
   Status: {status}
   Prioritas: {priority}
   Deadline: {deadlineStr} ({diffLabel})
   Acara/Divisi: {divisionOrEventName}

...dan {X} tugas lainnya. Buka dashboard JobdexIn untuk detail lengkap.
```

---

### 3.2 Detail Tugas Lengkap (`!jobdex detail task <nama>`)
* **Trigger:** Pengguna menanyakan detail spesifik dari satu job desk.
* **Variabel:**
  * Rincian lengkap: Judul, Status, Prioritas, PIC, Deadline, Acara/Divisi, Teks Redaksi, Link Referensi Desain/Drive, Arahan Visual, Status 6 Item Checklist, Catatan Terakhir.
* **Teks Template:**
```text
[*JobdexIn* Detail Task]

Task: {task.name}
Status: {status}
Prioritas: {priority}
PIC: {picName}
Deadline: {deadlineValue}
Acara/Divisi: {divisionOrEventName}

Redaksi:
{task.copywriting || "-"}

Referensi:
{task.design_reference_url || "-"}
{task.drive_reference_url || "-"}
{task.copywriting_docs_url || "-"}

Arahan Visual:
{task.visual_direction || "-"}

Checklist:
- Redaksi/materi tersedia: {Selesai/Belum}
- Referensi desain tersedia: {Selesai/Belum}
- Draft awal: {Selesai/Belum}
- Revisi internal: {Selesai/Belum}
- Finalisasi desain: {Selesai/Belum}
- Upload hasil: {Selesai/Belum}

Catatan terakhir:
{lastNote}
```

---

### 3.3 Pembaruan Status Tugas (`!jobdex update status <nama> menjadi <status>`)
* **Trigger:** Anggota/koordinator memperbarui status melalui chat WhatsApp.
* **Variabel:**
  * `${task.name}` : Judul tugas
  * `${statusEnum}` : Nama status baru
  * `${notes}` : Catatan penjelasan (wajib jika stuck/butuh bantuan)
  * `${user.name}` : Nama pengubah
* **Teks Template:**
```text
[*JobdexIn* Status]

Status task berhasil diperbarui.

Tugas: {task.name}
Status baru: {statusEnum}
Catatan: {notes}
Diperbarui oleh: {user.name}
```

---

### 3.4 Persetujuan Tugas (`!jobdex approve task <nama>`)
* **Trigger:** Koordinator/Admin menyetujui tugas yang telah selesai.
* **Variabel:**
  * `${task.name}` : Judul tugas
  * `${picName}` : Nama PIC pembuat desain
  * `${user.name}` : Koordinator/admin penyetujui
  * `${timeStr}` : Waktu persetujuan (format WITA)
* **Teks Template:**
```text
[*JobdexIn* Approval]

Task berhasil di-approve.

Tugas: {task.name}
PIC: {picName}
Approved oleh: {user.name}
Waktu: {timeStr} WITA
```

---

### 3.5 Pengunggahan Hasil Desain (`!jobdex upload hasil <nama>`)
* **Trigger:** PIC menyetor link hasil pengerjaan desain.
* **Variabel:**
  * `${task.name}` : Judul tugas
  * `${picName}` : Nama PIC
  * `${link}` : URL file/drive/canva
* **Teks Template:**
```text
[*JobdexIn* Upload Hasil]

Hasil task berhasil dikirim.

Tugas: {task.name}
PIC: {picName}
Status baru: Menunggu Approval
Link: {link}

Koordinator dapat mengecek dan approve/revisi task ini.
```

---

### 3.6 Permintaan Revisi Tugas (`!jobdex minta revisi <nama>`)
* **Trigger:** Koordinator meminta revisi disertai catatan kendala.
* **Variabel:**
  * `${task.name}` : Judul tugas
  * `${picName}` : Nama PIC
  * `${catatan}` : Detail poin revisi yang harus dikerjakan
* **Teks Template:**
```text
[*JobdexIn* Minta Revisi]

Revisi berhasil diminta.

Tugas: {task.name}
PIC: {picName}
Status baru: Perlu Revisi

Catatan revisi:
{catatan}
```

---

### 3.7 Penandaan Checklist Selesai (`!jobdex checklist <nama> <item> selesai`)
* **Trigger:** PIC menandai salah satu tahapan checklist (redaksi, referensi, draft, revisi, final, upload).
* **Variabel:**
  * `${task.name}` : Judul tugas
  * `${targetLabel}` : Label item checklist
  * `${user.name}` : Nama penuntas
* **Teks Template:**
```text
[*JobdexIn* Checklist]

Item checklist berhasil ditandai selesai.

Tugas: {task.name}
Item: {targetLabel}
PIC/Penuntas: {user.name}
```

---

### 3.8 Pergantian PIC Tugas (`!jobdex ganti pic <nama> ke <nama_baru>`)
* **Trigger:** Koordinator mengalihkan tugas ke anggota lain.
* **Variabel:**
  * `${task.name}` : Judul tugas
  * `${oldPicName}` : Nama PIC terdahulu
  * `${targetUser.name}` : Nama PIC baru yang ditugaskan
* **Teks Template:**
```text
[*JobdexIn* Ganti PIC]

PIC task berhasil diganti.

Tugas: {task.name}
PIC lama: {oldPicName}
PIC baru: {targetUser.name}
```

---

### 3.9 Klarifikasi Nama Tugas Ambigu (Fuzzy Candidate Disambiguation)
* **Trigger:** Sistem mendeteksi lebih dari 1 tugas yang memiliki nama mirip dengan kata kunci pengguna.
* **Variabel:**
  * Daftar tugas bernomor dengan kode kandidat unik (misal: `TSKX7A0`, `TSKX7A1`).
* **Teks Template:**
```text
[*JobdexIn* Task]

Ditemukan beberapa task mirip:

1. {task1.name}
   Kode: {code1}

2. {task2.name}
   Kode: {code2}

Gunakan:
!jobdex update status kode [KODE] menjadi sedang dikerjakan
(atau perintah yang relevan)
```

---

## 4. Perintah Manajemen & Briefing Koordinator
File sumber: [`src/lib/server/whatsapp-task-command-executor.ts`](file:///d:/Download/jobdescin/src/lib/server/whatsapp-task-command-executor.ts)

### 4.1 Briefing Cepat Koordinator (`!jobdex briefing`)
* **Trigger:** Koordinator/Admin meminta ikhtisar status terkini tugas divisi/acara.
* **Variabel:**
  * `${scopeName}` : Nama lingkup (Acara / Divisi)
  * Jumlah: overdue, deadline H-1/H-2, stuck, menunggu approval, belum update 2 hari
* **Teks Template:**
```text
[*JobdexIn* Briefing Koor]

{scopeName} — Ringkasan Hari Ini

Perlu dicek:
🔴 {overdueCount} overdue
🟡 {nearDeadlineCount} deadline H-1/H-2
⚠️ {stuckCount} stuck
⏳ {waitingApprovalCount} menunggu approval
📝 {noUpdateCount} belum update 2 hari

Aksi cepat:
- !jobdex siapa belum update
- !jobdex deadline dekat
- !jobdex siapa yang stuck
- !jobdex siapa yang menunggu approval
```

---

### 4.2 Laporan Anggota Belum Update (`!jobdex siapa belum update`)
* **Trigger:** Koordinator memantau anggota yang pasif atau belum melaporkan kemajuan pengerjaan.
* **Variabel:**
  * Daftar nama PIC beserta jumlah tugas yang belum mengalami pembaruan progress $\ge 2$ hari.
* **Teks Template:**
```text
[*JobdexIn* Siapa Belum Update]

Daftar PIC yang belum update progress task (>= 2 hari):

1. {name}: {count} task belum diupdate
2. ...

Saran: Hubungi PIC terkait untuk menanyakan progress.
```

---

### 4.3 Menghubungkan Grup WhatsApp ke Acara (`!jobdex hubungkan grup acara <nama>`)
* **Trigger:** Koordinator mendaftarkan grup WhatsApp tempat bot berada agar terafiliasi dengan kepanitiaan acara di sistem.
* **Variabel:**
  * `${matchedEvent.name}` : Nama acara yang berhasil ditautkan
* **Teks Template:**
```text
[*JobdexIn* Approval]

Grup ini berhasil dihubungkan dengan acara "{matchedEvent.name}".

Notifikasi dan reminder acara akan dikirim ke grup ini.
```

---

## 5. Preview & Konfirmasi Tindakan (Draft & Approval Flow)
File sumber: [`src/lib/server/whatsapp-command-preview.ts`](file:///d:/Download/jobdescin/src/lib/server/whatsapp-command-preview.ts) & [`src/lib/server/whatsapp-command-executor.ts`](file:///d:/Download/jobdescin/src/lib/server/whatsapp-command-executor.ts)

### 5.1 Draf Preview Tambah Job Desk
* **Trigger:** Pengguna mengirim format `!jobdex tambah jobdesk`.
* **Teks Template:**
```text
[*JobdexIn* Preview Jobdesk]

Saya membaca rencana tambah job desk:

Acara: {nama acara / Divisi}
Judul: {judul}
PIC: {picUser.name}
Deadline: {deadlineRaw}
Prioritas: {prioritas}
Status awal: Belum Dimulai

Checklist otomatis:
{checklistText}

Referensi terdekat yang saya temukan:
{referenceSection}

Status validasi:
- PIC ditemukan: {picUser.name}
- Deadline terbaca: {deadlineRaw}

Preview ini belum disimpan ke database.
Konfirmasi dengan: !jobdex konfirmasi {PREVIEW_CODE}
```

---

### 5.2 Konfirmasi Draf Edit Detail Tugas (`!jobdex konfirmasi edit <EDT_CODE>`)
* **Trigger:** Koordinator menyetujui perubahan judul, deadline, PIC, atau redaksi yang dipreview sebelumnya.
* **Teks Template:**
```text
[*JobdexIn* Confirm Edit]

Perubahan tugas berhasil disimpan.

Tugas: {task.name}
Disimpan oleh: {user.name}
```

---

### 5.3 Konfirmasi Pengarsipan Tugas (`!jobdex konfirmasi archive <ARC_CODE>`)
* **Trigger:** Koordinator/Admin menyetujui pengarsipan tugas.
* **Teks Template:**
```text
[*JobdexIn* Confirm Archive]

Tugas berhasil diarsipkan.

Tugas: {task.name}
Diarsipkan oleh: {user.name}
```

---

## 6. Sistem, Keamanan, Sandbox, dan Bantuan
File sumber: [`src/lib/server/whatsapp/command-handler.ts`](file:///d:/Download/jobdescin/src/lib/server/whatsapp/command-handler.ts) & [`src/lib/server/whatsapp/index.ts`](file:///d:/Download/jobdescin/src/lib/server/whatsapp/index.ts)

### 6.1 Sandbox Mode Interceptor Banner
* **Trigger:** Pesan keluar dikirim saat sistem berada dalam mode pengujian (`isTestMode: true` atau `sandbox_mode: true`).
* **Keterangan:** Semua pesan dialihkan ke grup sandbox `120363406824082148@g.us`.
* **Teks Template:**
```text
🧪 *[SANDBOX JOBDEX]*
_(Pesan simulasi dialihkan dari tujuan asli: {originalTarget})_

{Isi Pesan Asli}
```

---

### 6.2 Akses Ditolak / Tidak Diizinkan (Permission Denied)
* **Trigger:** Pengguna mencoba mengeksekusi perintah yang berada di luar wewenang rolenya (misal: anggota biasa mencoba menghapus tugas atau approve hasil).
* **Variabel:**
  * `${user.name}` : Nama pengguna
  * `${roleLabel}` : Jabatan saat ini (Anggota, Koordinator, Super Admin)
* **Teks Template:**
```text
[*JobdexIn* Akses Ditolak]

Kamu terdeteksi sebagai: {user.name} ({roleLabel})
Aksi ini tidak diizinkan untuk role kamu atau task ini bukan dalam cakupan akses kamu.
```

---

### 6.3 Menu Bantuan Perintah Bot (`!jobdex bantuan`)
* **Trigger:** Pengguna mengirim `!jobdex bantuan` atau `!jobdex help`.
* **Keterangan:** Menu perintah disesuaikan secara dinamis dengan role pengguna (Anggota, Koordinator, atau Super Admin).
* **Teks Template:**
```text
[*JobdexIn* Bantuan]

Halo {senderUserProfile.name},
📋 Command untuk Anggota:
- !jobdex tugas saya
- !jobdex detail task [nama task]
- !jobdex update status [nama task] menjadi [status]
- !jobdex upload hasil [nama task]
  link: [URL]
  catatan: [CATATAN]
- !jobdex cek checklist [nama task]
- !jobdex checklist [nama task] redaksi selesai
- !jobdex tambah catatan [nama task]
  catatan: [CATATAN]
- !jobdex cari [keyword]
- !jobdex cek role saya

👤 Tambahan untuk Koordinator:
- !jobdex briefing
- !jobdex siapa belum update
- !jobdex deadline dekat
- !jobdex minta revisi [nama task]
  catatan: [CATATAN]
- !jobdex approve task [nama task]
- !jobdex ganti PIC [nama task] ke [nama]
- !jobdex tambah jobdesk
- !jobdex tambah banyak jobdesk
- !jobdex tambah referensi
- !jobdex edit task [nama task]
- !jobdex archive task [nama task]
- !jobdex hubungkan grup acara [nama acara]

🔑 Tambahan untuk Super Admin:
- !jobdex tambah acara
- !jobdex siapa yang stuck
- !jobdex siapa yang menunggu approval
- !jobdex cek pengirim
- !jobdex cek grup
- !jobdex event grup

Format lengkap: !jobdex format jobdesk
Referensi: !jobdex format referensi
```

---

### 6.4 Hasil Pencarian Referensi Desain
File sumber: [`src/lib/server/reference-search.ts`](file:///d:/Download/jobdescin/src/lib/server/reference-search.ts)
* **Trigger:** Pengguna menanyakan referensi desain di chat WhatsApp (misal: *"ada referensi pamflet dies natalis tahun lalu?"*).
* **Teks Template:**
```text
[*JobdexIn* Referensi]

Saya menemukan {X} referensi yang benar-benar relevan dengan "{assetDisplayName}":

1. {ref.title}
   Kegiatan: {ref.event_name || "-"}
   Tahun: {ref.year}
   Alasan relevan: {item.reason}
   File cocok:
   - {file.name}
     Link: {file.url}

Catatan:
Saya hanya menampilkan referensi yang benar-benar mengandung {assetDisplayName} pada judul atau file.
Untuk melihat semua referensi, buka dashboard Referensi.
```

---

### 6.5 Pesan Ringkasan AI Assistant
File sumber: [`src/app/api/ai/send-whatsapp/route.ts`](file:///d:/Download/jobdescin/src/app/api/ai/send-whatsapp/route.ts)
* **Trigger:** Pengguna mengklik tombol "Kirim ke WhatsApp" pada panel AI Assistant di dashboard.
* **Teks Template:**
```text
[JobDex.in] Ringkasan AI Assistant

{answer}
```
