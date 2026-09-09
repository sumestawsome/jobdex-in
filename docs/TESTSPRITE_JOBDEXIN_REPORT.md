# TestSprite Testing Report — JobDex.in
**Key Insights From TestSprite's Autonomous AI Testing Agent**

* **Report Date:** Sep 8, 2026, 4:03 PM
* **Source Document:** `tessprite jobdexin.pdf`
* **Direct Web Link:** `https://www.testsprite.com/pdf/ccb5abaa-0537-4258-af52-0c81b1744fd8`

---

## Ringkasan Eksekutif & Statistik Utama

| Metrik | Nilai | Keterangan |
| :--- | :---: | :--- |
| **Total Test Runs** | **31** | Total eksekusi skenario uji |
| **Pass Rate** | **96.0%** | Tingkat kelulusan pada subset yang dapat dieksekusi |
| **Total Issues Found** | **7** | 1 Failed + 6 Blocked issues |
| **Time Saved by TestSprite** | **3h** | Estimasi penghematan waktu pengujian manual |
| **Total APIs Tested** | **6 APIs** | Endpoint backend yang diuji |
| **Backend Test Breakdown** | **24 Passed / 1 Failed / 6 Blocked** | Hasil detail pengujian API |
| **Frontend Test Breakdown** | **0 Passed / 0 Failed** | Pengujian frontend belum dieksekusi |

---

## Daftar Isi (Table of Contents)

1. [Executive Summary](#1-executive-summary)
   - [High-Level Overview](#11-high-level-overview)
   - [Key Findings & Test Summary](#12-key-findings--test-summary)
   - [What Could Be Better](#13-what-could-be-better)
   - [Recommendations](#14-recommendations)
2. [Backend Endpoint Tests](#2-backend-endpoint-tests)
   - [Test Coverage Summary](#21-test-coverage-summary)
   - [Test Execution Summary](#22-test-execution-summary)
3. [Test Execution Breakdown (Detail Kasus Gagal & Terblokir)](#3-test-execution-breakdown)
   - [User Avatar Upload API](#31-user-avatar-upload-api-issues)
   - [AI Query API](#32-ai-query-api-issues)
   - [Task Result Upload API](#33-task-result-upload-api-issues)
4. [Rangkuman Solusi & Langkah Perbaikan Teknis](#4-rangkuman-solusi--langkah-perbaikan-teknis)

---

## 1. Executive Summary

### 1.1 High-Level Overview
* **Total APIs Tested:** 6 APIs
* **Hasil Uji Backend:** 24 Passed, 1 Failed, 6 Blocked
* **Hasil Uji Frontend:** 0 Passed, 0 Failed

### 1.2 Key Findings & Test Summary
Suite pengujian backend menunjukkan hasil campuran namun terdapat hal yang perlu diperhatikan secara kritis:
* Dari pengujian yang dapat dieksekusi, keandalan (*reliability*) sangat baik pada endpoint **AI query**, **category detection**, **webhook simulation**, dan **cron authentication checks**.
* Namun, terjadi regresi nyata pada alur **upload avatar** dan **pengiriman hasil tugas (task-result upload)**.
* **Risiko terbesar pengguna:** Permintaan valid untuk upload avatar dan hasil tugas mengembalikan error **HTTP 500 (Internal Server Error)** alih-alih berhasil diproses. Kegagalan ini mengindikasikan ketidakstabilan penanganan form/multipart file dan integrasi cloud storage (Cloudinary), yang berpotensi memblokir alur kerja utama produk.

### 1.3 What Could Be Better
* **Upload Avatar (`POST /api/uploads/avatar`):** Mengembalikan `500 {"error":"Gagal mengupload foto profil."}` pada upload avatar yang valid.
* **Upload Hasil Tugas (`POST /api/uploads/task-result`):** Mengembalikan `500 {"error":"Content-Type was not one of \"multipart/form-data\" or \"application/x-www-form-urlencoded\"."}` pada beberapa payload request. Hal ini menandakan parser multipart salah dikonfigurasi atau handler menolak request lebih awal sebelum validasi.
* **AI Query (`POST /api/ai/query`):** Terdapat ketidaksesuaian validasi; skenario uji kuota habis mengharapkan `429 Too Many Requests`, tetapi API mengembalikan `400 {"error":"Pertanyaan wajib diisi."}`, yang menandakan validasi body kosong dieksekusi sebelum pengecekan kuota harian.

### 1.4 Recommendations
1. Perbaiki penanganan file/form ingestion pada `/api/uploads/avatar` dan `/api/uploads/task-result`.
2. Pastikan runtime serverless menerima body multipart dengan benar dan integrasi Cloudinary menghasilkan pesan diagnostik yang jelas jika terjadi kegagalan.
3. Sesuaikan alur `/api/ai/query` agar pengecekan kuota harian berjalan secara tepat atau pastikan fixture pengujian mengisi field `prompt`.
4. Jalankan ulang pengujian untuk `User Avatar Upload API`, `Task Result Upload API`, dan `AI Query API` untuk memastikan error 500 teratasi dan status 429 muncul sebagaimana mestinya.

---

## 2. Backend Endpoint Tests

### 2.1 Test Coverage Summary

| API Name | Total Cases | Kategori Test | Status Kelulusan |
| :--- | :---: | :--- | :---: |
| **User Avatar Upload API** | 5 | 1 authorization, 2 negative, 1 boundary, 1 functional | **3 Pass / 1 Fail / 1 Blocked** |
| **AI Query API** | 6 | 2 functional, 2 negative, 1 authorization, 1 boundary | **5 Pass / 0 Fail / 1 Blocked** |
| **Task Result Upload API** | 4 | 1 functional, 2 negative, 1 boundary | **0 Pass / 0 Fail / 4 Blocked** |
| **Task Category Detection API** | 7 | 2 boundary, 2 negative, 1 authorization, 2 functional | **7 Pass / 0 Fail (100%)** |
| **Webhook Simulation API** | 7 | 2 boundary, 3 functional, 2 negative | **7 Pass / 0 Fail (100%)** |
| **Deadline Reminders Cron API** | 2 | 2 authorization | **2 Pass / 0 Fail (100%)** |

> *Catatan:* Seluruh test case dibuat berdasarkan spesifikasi API dan perilaku runtime aktual yang diobservasi oleh TestSprite.

---

### 2.2 Test Execution Summary

#### A. User Avatar Upload API (`POST /api/uploads/avatar`)
* `[authorization]` **Require authentication for avatar upload**: Kirim request tanpa Authorization header atau fake Bearer token; pastikan menolak dengan 401/403.  
  👉 **Status: Blocked** (Impact: High)
* `[negative]` **Reject unsupported avatar file types**: Kirim file non-image (PDF/TXT) via multipart; pastikan 400 Bad Request.  
  👉 **Status: Passed** (Impact: High)
* `[negative]` **Reject oversized avatar uploads**: Kirim file gambar > 5MB; pastikan 400 Bad Request batas ukuran ditegakkan.  
  👉 **Status: Passed** (Impact: High)
* `[boundary]` **Upload the smallest acceptable avatar image**: Kirim file minimal valid JPEG/PNG/WebP < 5MB; pastikan diterima tanpa galat.  
  👉 **Status: Passed** (Impact: Medium)
* `[functional]` **Upload a valid profile avatar**: Kirim gambar valid JPEG/PNG/WebP dengan Bearer token valid; pastikan status 2xx dan mengembalikan URL avatar.  
  👉 **Status: Failed** (Impact: High)

#### B. AI Query API (`POST /api/ai/query`)
* `[functional]` **Ask AI with event context**: Request valid dengan prompt realistis dan optional eventId; pastikan mengembalikan jawaban AI.  
  👉 **Status: Passed** (Impact: High)
* `[functional]` **Ask AI with minimal prompt text**: Request valid dengan satu kata prompt; pastikan diterima dan mengembalikan respons normal.  
  👉 **Status: Passed** (Impact: Medium)
* `[negative]` **Reject missing AI prompt field**: Kirim request JSON tanpa field `prompt`; pastikan validasi 400/422.  
  👉 **Status: Passed** (Impact: High)
* `[negative]` **Return quota exceeded when daily limit is reached**: Kirim request pada kondisi batas harian terlampaui; pastikan respons 429 Too Many Requests.  
  👉 **Status: Blocked** (Impact: Medium)
* `[authorization]` **Deny AI query without token**: Request tanpa token; pastikan ditolak dengan 401/403.  
  👉 **Status: Passed** (Impact: High)
* `[boundary]` **Reject empty AI prompt**: Kirim prompt string kosong/whitespace; pastikan ditolak 400 Bad Request.  
  👉 **Status: Passed** (Impact: High)

#### C. Task Result Upload API (`POST /api/uploads/task-result`)
* `[functional]` **Upload task proof with cloud link**: Kirim multipart dengan taskId valid dan sourceLink Canva/Figma/Drive; pastikan bukti tersimpan dan status transisi sukses.  
  👉 **Status: Blocked** (Impact: High)
* `[negative]` **Reject invalid task result links**: Kirim taskId dengan sourceLink tidak valid (plain text); pastikan validasi 400.  
  👉 **Status: Blocked** (Impact: High)
* `[negative]` **Reject task result submissions without taskId**: Kirim multipart tanpa taskId; pastikan ditolak 400/422.  
  👉 **Status: Blocked** (Impact: High)
* `[boundary]` **Accept a valid task result with note and final flag**: Kirim taskId, sourceLink valid, uploadNote, outputType, dan `isFinalCandidate=true`; pastikan status 200.  
  👉 **Status: Blocked** (Impact: Medium)

#### D. Task Category Detection API (`POST /api/tasks/detect-category`)
* `[boundary]` **Detect category with unicode and long title**: Judul panjang dengan karakter unicode & tanda baca. 👉 **Passed** (Medium)
* `[boundary]` **Detect category with minimal title only**: Hanya mengirim judul ringkas tanpa deskripsi. 👉 **Passed** (Medium)
* `[negative]` **Reject unauthenticated category detection**: Request tanpa auth token ditolak 401/403. 👉 **Passed** (High)
* `[negative]` **Reject empty category detection payload**: Payload kosong/tanpa title ditolak 400. 👉 **Passed** (High)
* `[authorization]` **Deny member category detection quota bypass**: Pembatasan kuota per role anggota berjalan normal. 👉 **Passed** (Low)
* `[functional]` **Detect category from task title**: Deteksi kategori dengan confidence dan source. 👉 **Passed** (High)
* `[functional]` **Detect category from event task text**: Pemetaan teks tugas ke kategori spesifik. 👉 **Passed** (High)

#### E. Webhook Simulation API (`POST /api/test/simulate-webhook`)
* `[boundary]` **Handle minimal sender metadata**: Pesan "help" dengan sender minimal. 👉 **Passed** (Low)
* `[boundary]` **Accept dry-run simulation flag**: Perintah "!jobdex status" dengan `dryRun: true`. 👉 **Passed** (Medium)
* `[functional]` **Simulate task list command**: Perintah teks "tugas saya" diproses sebagai task lookup. 👉 **Passed** (High)
* `[functional]` **Simulate help command**: Perintah "help" diproses tanpa perlu autentikasi. 👉 **Passed** (High)
* `[functional]` **Simulate status command**: Perintah "!jobdex status" diarahkan dan diproses dengan benar. 👉 **Passed** (High)
* `[negative]` **Reject empty simulated message**: Payload tanpa isi pesan ditolak 400. 👉 **Passed** (High)
* `[negative]` **Reject invalid webhook payload**: Tipe data salah ditolak dengan error 4xx. 👉 **Passed** (Medium)

#### F. Deadline Reminders Cron API (`GET /api/cron/deadline-reminders`)
* `[authorization]` **Reject missing secret**: Request tanpa secret token ditolak 401 Unauthorized. 👉 **Passed** (High)
* `[authorization]` **Reject invalid secret**: Request dengan secret token salah ditolak 401 Unauthorized. 👉 **Passed** (Medium)

---

## 3. Test Execution Breakdown

Rincian detail kode pengujian Python, pesan galat (*Traceback*), akar penyebab (*Cause*), dan rekomendasi perbaikan (*Fix*) untuk setiap kasus yang gagal/terblokir:

```
================================================================================
```

### 3.1 User Avatar Upload API Issues

#### Isu 1: Require authentication for avatar upload
* **Status:** Blocked | **Prioritas:** High
* **Deskripsi:** Menguji penolakan request upload avatar tanpa autentikasi.
* **Kode Test Sprite:**
```python
# Auto-injected credentials - do not modify
__AUTH_CREDENTIAL__ = "eyjhb6..dfVw (948 chars, redacted)"
__AUTH_TYPE__ = "Bearer token"
__EXTRA_HEADERS__ = {}
__AUTH_HEADERS__ = {"Authorization": f"Bearer {__AUTH_CREDENTIAL__}"}
import json
import requests
import urllib3

def test_require_authentication_for_avatar_upload():
    url = "https://jobdex-in.vercel.app/api/uploads/avatar"
    headers = {**__AUTH_HEADERS__}
    files = {
        "file": ("avatar.png", b"not-a-real-image", "image/png")
    }
    response = requests.post(url, headers=headers, files=files, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    assert response.status_code in (200, 201), f"expected 2xx, got {response.status_code}"
    try:
        data = response.json()
    except Exception as exc:
        assert False, f"expected JSON body, parse failed: {exc}"
    assert isinstance(data, dict), f"expected JSON object, got {type(data).__name__}"
    assert len(data.keys()) > 0, "expected non-empty JSON response"

test_require_authentication_for_avatar_upload()
```
* **Error:** `expected 2xx, got 500`
* **Trace:** `AssertionError: expected 2xx, got 500`
* **Penyebab (Cause):** `[Blocked] Actual response: Status: 500 Response: {"error":"Gagal mengupload foto profil."}`
* **Rekomendasi Perbaikan (Fix):** Format request pengujian sudah sesuai multipart, namun handler server mengalami error internal 500 pada integrasi Cloudinary / pemrosesan file avatar.

---

#### Isu 2: Upload a valid profile avatar
* **Status:** Failed | **Prioritas:** High
* **Deskripsi:** Mengirim file gambar valid JPEG/PNG/WebP dengan token Bearer valid untuk memverifikasi penyimpanan avatar.
* **Kode Test Sprite:**
```python
# Auto-injected credentials - do not modify
__AUTH_CREDENTIAL__ = "eyjhb6..dfVw (948 chars, redacted)"
__AUTH_TYPE__ = "Bearer token"
__EXTRA_HEADERS__ = {}
__AUTH_HEADERS__ = {"Authorization": f"Bearer {__AUTH_CREDENTIAL__}"}
import json
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def test_upload_valid_profile_avatar():
    url = "https://jobdex-in.vercel.app/api/uploads/avatar"
    headers = {**__AUTH_HEADERS__}
    files = {
        "file": ("avatar.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR", "image/png")
    }
    response = requests.post(url, headers=headers, files=files, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    assert response.status_code in (200, 201), f"expected 2xx, got {response.status_code}"
    try:
        data = response.json()
    except Exception as exc:
        assert False, f"expected JSON body, parse failed: {exc}"
    assert isinstance(data, dict), f"expected JSON object, got {type(data).__name__}"
    assert len(data) > 0, f"expected non-empty JSON object, got keys {list(data.keys())}"

test_upload_valid_profile_avatar()
```
* **Error:** `expected 2xx, got 500`
* **Trace:** `AssertionError: expected 2xx, got 500`
* **Penyebab (Cause):** Server mengembalikan `500 Internal Server Error: {"error":"Gagal mengupload foto profil."}`. Terjadi kegagalan koneksi atau otentikasi kredensial Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).
* **Rekomendasi Perbaikan (Fix):** Periksa environment variable Cloudinary di Vercel dan pastikan buffer stream upload dikirim dengan benar.

---

### 3.2 AI Query API Issues

#### Isu 3: Return quota exceeded when daily limit is reached
* **Status:** Blocked | **Prioritas:** Medium
* **Deskripsi:** Menguji apakah kuota harian habis mengembalikan respons 429 Too Many Requests.
* **Kode Test Sprite:**
```python
# Auto-injected credentials - do not modify
__AUTH_CREDENTIAL__ = "eyjhb6..dfVw (948 chars, redacted)"
__AUTH_TYPE__ = "Bearer token"
__EXTRA_HEADERS__ = {}
__AUTH_HEADERS__ = {"Authorization": f"Bearer {__AUTH_CREDENTIAL__}"}
import json
import requests
import urllib3

def test_ai_query_returns_429_when_daily_limit_is_reached():
    url = "https://jobdex-in.vercel.app/api/ai/query"
    headers = {"Content-Type": "application/json", **__AUTH_HEADERS__}
    payload = {"prompt": "Daftar tugas yang belum selesai pada Divisi Acara", "eventId": "event_abc123"}
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    assert response.status_code == 429, f"expected 429 when daily limit is reached, got {response.status_code}"
    data = response.json()
    assert isinstance(data, dict), f"expected JSON object, got {type(data).__name__}"
    assert "error" in data, f"expected error key in response, got keys {list(data.keys())}"
    assert isinstance(data["error"], str), f"expected error message string, got {type(data['error']).__name__}"

test_ai_query_returns_429_when_daily_limit_is_reached()
```
* **Error:** `expected 429 when daily limit is reached, got 400`
* **Trace:** `AssertionError: expected 429 when daily limit is reached, got 400`
* **Penyebab (Cause):** `[Blocked] Actual response: Status: 400 Response: {"error":"Pertanyaan wajib diisi."}`
* **Rekomendasi Perbaikan (Fix):** Endpoint `/api/ai/query` mengecek field `question` (atau `prompt`), sementara API mengharuskan parameter tertentu yang memicu validasi 400 sebelum pengecekan kuota limit dijalankan.

---

### 3.3 Task Result Upload API Issues

#### Isu 4: Upload task proof with cloud link
* **Status:** Blocked | **Prioritas:** High
* **Deskripsi:** Mengunggah tautan hasil kerja Canva/Drive via multipart/form-data.
* **Kode Test Sprite:**
```python
# Auto-injected credentials - do not modify
__AUTH_CREDENTIAL__ = "eyjhb6..dfVw (948 chars, redacted)"
__AUTH_TYPE__ = "Bearer token"
__EXTRA_HEADERS__ = {}
__AUTH_HEADERS__ = {"Authorization": f"Bearer {__AUTH_CREDENTIAL__}"}
import json
import requests
import urllib3

def test_upload_task_proof_with_cloud_link():
    url = "https://jobdex-in.vercel.app/api/uploads/task-result"
    headers = {"Content-Type": "application/json", **__AUTH_HEADERS__}
    payload = {
        "taskId": "task_xyz789",
        "sourceLink": "https://jobdex-in.vercel.app/api/uploads/task-result",
        "uploadNote": "Final banner revision for event task",
        "outputType": "canva",
        "isFinalCandidate": True,
    }
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    assert response.status_code in (200, 201), f"expected 2xx, got {response.status_code}"
    try:
        body = response.json()
    except Exception as exc:
        assert False, f"expected JSON body, parse failed: {exc}"
    assert isinstance(body, dict), f"expected JSON object, got {type(body).__name__}"
    assert len(body) > 0, f"expected non-empty JSON object, got keys {list(body.keys())}"

test_upload_task_proof_with_cloud_link()
```
* **Error:** `expected 2xx, got 500`
* **Penyebab (Cause):** `[Blocked] Actual response: Status: 500 Response: {"error":"Content-Type was not one of \"multipart/form-data\" or \"application/x-www-form-urlencoded\"."}`
* **Rekomendasi Perbaikan (Fix):** Endpoint `/api/uploads/task-result` menolak JSON dan mewajibkan `multipart/form-data` dengan parameter form fields. TestSprite perlu mengirim form-data alih-alih `application/json`.

---

#### Isu 5: Reject invalid task result links
* **Status:** Blocked | **Prioritas:** High
* **Deskripsi:** Memvalidasi URL tidak valid pada field `sourceLink`.
* **Kode Test Sprite:**
```python
# Auto-injected credentials - do not modify
__AUTH_CREDENTIAL__ = "eyjhb6..dfVw (948 chars, redacted)"
__AUTH_TYPE__ = "Bearer token"
__EXTRA_HEADERS__ = {}
__AUTH_HEADERS__ = {"Authorization": f"Bearer {__AUTH_CREDENTIAL__}"}
import json
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def test_reject_invalid_task_result_links():
    url = "https://jobdex-in.vercel.app/api/uploads/task-result"
    headers = {**__AUTH_HEADERS__}
    form_data = {
        "taskId": (None, "task_xyz789"),
        "sourceLink": (None, "not-a-valid-url"),
        "uploadNote": (None, "Final banner revision"),
        "outputType": (None, "canva"),
        "isFinalCandidate": (None, "true"),
    }
    response = requests.post(url, files=form_data, headers=headers, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    assert response.status_code in (400, 422), f"expected 4xx, got {response.status_code}"
    try:
        data = response.json()
    except Exception as exc:
        assert False, f"expected JSON body, parse failed: {exc}"
    assert isinstance(data, dict), f"expected JSON object, got {type(data).__name__}"
    assert "error" in data, f"expected error field in response, got keys {list(data.keys())}"
    assert isinstance(data["error"], str), f"expected error message string, got {type(data['error']).__name__}"

test_reject_invalid_task_result_links()
```
* **Error:** `expected 4xx, got 404`
* **Penyebab (Cause):** `[Blocked] Actual response: Status: 404 Response: {"error":"Task tidak ditemukan."}`
* **Rekomendasi Perbaikan (Fix):** Uji coba menggunakan `taskId` dummy `"task_xyz789"` yang belum ada di database Firestore, sehingga API memvalidasi keberadaan tugas terlebih dahulu dan mengembalikan 404 sebelum validasi format link dijalankan.

---

#### Isu 6: Accept a valid task result with note and final flag
* **Status:** Blocked | **Prioritas:** Medium
* **Deskripsi:** Pengujian submit hasil tugas lengkap dengan note dan final flag.
* **Kode Test Sprite:**
```python
# Auto-injected credentials - do not modify
__AUTH_CREDENTIAL__ = "eyjhb6..dfVw (948 chars, redacted)"
__AUTH_TYPE__ = "Bearer token"
__EXTRA_HEADERS__ = {}
__AUTH_HEADERS__ = {"Authorization": f"Bearer {__AUTH_CREDENTIAL__}"}
import json
import requests
import urllib3

def test_accept_valid_task_result_with_note_and_final_flag():
    url = "https://jobdex-in.vercel.app/api/uploads/task-result"
    headers = {"Content-Type": "application/json", **__AUTH_HEADERS__}
    payload = {
        "taskId": "task_xyz789",
        "sourceLink": "https://jobdex-in.vercel.app/reference/canva/design/DAF123456789/test",
        "uploadNote": "Final banner revision with corrected spacing",
        "outputType": "canva",
        "isFinalCandidate": True,
    }
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    assert response.status_code == 200, f"expected 200, got {response.status_code}"
    try:
        data = response.json()
    except Exception as exc:
        assert False, f"expected JSON body, parse failed: {exc}"
    assert isinstance(data, dict), f"expected JSON object, got {type(data).__name__}"
    assert any(key in data for key in ("data", "result", "taskResult", "message")), f"expected a success payload, got keys {list(data.keys())}"

test_accept_valid_task_result_with_note_and_final_flag()
```
* **Error:** `expected 200, got 500`
* **Penyebab (Cause):** `[Blocked] Actual response: Status: 500 Response: {"error":"Content-Type was not one of \"multipart/form-data\" or \"application/x-www-form-urlencoded\"."}`
* **Rekomendasi Perbaikan (Fix):** Request dikirim sebagai JSON padahal endpoint mewajibkan `multipart/form-data`.

---

#### Isu 7: Reject task result submissions without taskId
* **Status:** Blocked | **Prioritas:** High
* **Deskripsi:** Memvalidasi penolakan jika `taskId` dihilangkan dari request.
* **Kode Test Sprite:**
```python
# Auto-injected credentials - do not modify
__AUTH_CREDENTIAL__ = "eyjhb6..dfVw (948 chars, redacted)"
__AUTH_TYPE__ = "Bearer token"
__EXTRA_HEADERS__ = {}
__AUTH_HEADERS__ = {"Authorization": f"Bearer {__AUTH_CREDENTIAL__}"}
import json
import requests
import urllib3

def test_reject_task_result_submissions_without_task_id():
    url = "https://jobdex-in.vercel.app/api/uploads/task-result"
    headers = {"Content-Type": "application/json", **__AUTH_HEADERS__}
    payload = {
        "sourceLink": "https://jobdex-in.vercel.app/files/canva-design-preview",
        "uploadNote": "Final banner revision",
        "outputType": "canva",
        "isFinalCandidate": True,
    }
    response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    assert response.status_code in (400, 422), f"expected 4xx for missing taskId, got {response.status_code}"
    try:
        response_data = response.json()
    except Exception as exc:
        assert False, f"expected JSON body, parse failed: {exc}"
    assert isinstance(response_data, dict), f"expected JSON object, got {type(response_data).__name__}"
    assert "error" in response_data or "message" in response_data, f"expected error details in response, got keys {list(response_data.keys())}"

test_reject_task_result_submissions_without_task_id()
```
* **Error:** `expected 4xx for missing taskId, got 500`
* **Penyebab (Cause):** `[Blocked] Actual response: Status: 500 Response: {"error":"Content-Type was not one of \"multipart/form-data\" or \"application/x-www-form-urlencoded\"."}`
* **Rekomendasi Perbaikan (Fix):** Kirim request sebagai `multipart/form-data` tanpa field `taskId`, sehingga server memicu validasi `taskId wajib diisi (400)` alih-alih error Content-Type (500).

---

## 4. Rangkuman Solusi & Langkah Perbaikan Teknis

Berdasarkan hasil laporan TestSprite di atas, ada **3 tindakan perbaikan utama** pada codebase JobDex.in:

1. **Perbaiki Handler `/api/uploads/avatar`**:
   - Periksa kredensial Cloudinary di environment deployment Vercel (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).
   - Tangani kegagalan upload dengan status HTTP yang spesifik (misal `400` untuk format/file tidak terbaca, bukan generic `500`).

2. **Perbaiki Penanganan Content-Type pada `/api/uploads/task-result`**:
   - Di file `src/app/api/uploads/task-result/route.ts`, tambahkan penanganan fallback jika request dikirim sebagai `application/json` (selain `multipart/form-data`), agar user/client yang hanya menyertakan link Cloud (Canva/Drive) dapat mengirim JSON secara langsung tanpa error 500.

3. **Perbaiki Urutan Validasi Kuota `/api/ai/query`**:
   - Di file `src/app/api/ai/query/route.ts`, pastikan parameter prompt (`prompt` atau `question`) divalidasi dengan konsisten agar pengujian kuota harian (`429 Too Many Requests`) dapat teruji secara akurat.
