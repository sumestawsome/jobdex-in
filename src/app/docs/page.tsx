"use client";

import Link from "next/link";
import { useTheme } from "@/components/theme/theme-provider";
import { DocsTableOfContents, TocItem } from "@/components/docs/docs-table-of-contents";
import { CommandTable, BotCommandItem } from "@/components/docs/command-table";
import { MiniChatPreview } from "@/components/docs/mini-chat-preview";
import {
  Sun,
  Moon,
  ArrowRight,
  BookOpen,
  Calendar,
  Sparkles,
  Server,
  Mic,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  HelpCircle,
  Cpu,
  Layers,
  Zap,
} from "lucide-react";

const TOC_ITEMS: TocItem[] = [
  {
    id: "alur-setup",
    title: "1. Alur Memulai & Setup Kelas Baru",
    subitems: [
      { id: "setup-green-api", title: "Langkah 1: Setup 2 Instance Green-API" },
      { id: "setup-gemini", title: "Langkah 2: Ambil API Key Gemini AI" },
      { id: "setup-group-id", title: "Langkah 3: Ambil ID Grup WhatsApp" },
      { id: "setup-dashboard", title: "Langkah 4: Input Ruang Kerja di Dashboard" },
    ],
  },
  {
    id: "arsitektur-instance",
    title: "2. Arsitektur Multi-Instance Bebas Loop",
  },
  {
    id: "kamus-perintah",
    title: "3. Kamus Lengkap Perintah Bot WhatsApp",
    subitems: [
      { id: "perintah-umum", title: "Perintah Umum (Bisa di Grup & DM)" },
      { id: "perintah-voice-note", title: "Alur Voice Note & Konfirmasi ACC" },
      { id: "perintah-tambah-kilat", title: "Perintah Tambah Kilat (Format Pipa)" },
      { id: "perintah-edit", title: "Perintah Edit & Siaran Revisi" },
      { id: "perintah-selesai", title: "Perintah Selesai & Arsip" },
    ],
  },
  {
    id: "troubleshooting",
    title: "4. Troubleshooting & FAQ",
  },
];

const BOT_COMMANDS: BotCommandItem[] = [
  {
    command: "!tugas menu",
    parameters: "atau !tugas bantuan",
    scope: "all",
    location: "group_or_dm",
    description: "Menampilkan panduan ringkas seluruh perintah bot tugas akademik yang didukung sistem.",
    example: "!tugas menu",
  },
  {
    command: "!tugas list",
    parameters: "",
    scope: "all",
    location: "group_or_dm",
    description: "Menampilkan seluruh daftar tugas aktif kelas yang diurutkan mulai dari tenggat waktu terdekat.",
    example: "!tugas list",
  },
  {
    command: "!tugas mepet",
    parameters: "",
    scope: "all",
    location: "group_or_dm",
    description: "Menyaring dan menampilkan tugas-tugas aktif yang sisa tenggat waktunya ≤ 3 hari.",
    example: "!tugas mepet",
  },
  {
    command: "Voice Note",
    parameters: "(Kirim rekaman audio)",
    scope: "admin",
    location: "dm_only",
    description: "Korti mengirim rekaman suara rincian tugas. AI menyusun draf pratinjau yang siap dikonfirmasi.",
    example: "🎙️ [Rekaman Suara: Tugas Matkul Kalkulus Lanjut...]",
  },
  {
    command: "!tugas acc",
    parameters: "atau acc",
    scope: "admin",
    location: "dm_only",
    description: "Menyetujui draf tugas yang dihasilkan AI untuk dipublikasikan ke kalender dan disiarkan ke kelas.",
    example: "!tugas acc",
  },
  {
    command: "!tugas batal",
    parameters: "atau batal",
    scope: "admin",
    location: "dm_only",
    description: "Membatalkan dan menghapus draf tugas sementara yang belum diterbitkan.",
    example: "!tugas batal",
  },
  {
    command: "!tugas tambah",
    parameters: "[Matkul] | [Judul] | [Deskripsi] | [Tenggat] | [LMS]",
    scope: "admin",
    location: "group_or_dm",
    description: "Menambah tugas kilat berformat pipa 4 atau 5 parameter tanpa perlu rekaman suara.",
    example: "!tugas tambah Pemrograman Web | REST API Next.js | Buat API CRUD | 28/10/2026 23:59 | E-Learning",
  },
  {
    command: "!tugas edit",
    parameters: "[No/Nama] | [tenggat/deskripsi/link/judul] | [Nilai Baru]",
    scope: "admin",
    location: "group_or_dm",
    description: "Mengubah rincian tugas tertentu dan otomatis menyiarkan pesan pembaruan ke saluran pengumuman.",
    example: "!tugas edit 1 | tenggat | 31/10/2026 23:59",
  },
  {
    command: "!tugas selesai",
    parameters: "[No/Nama Matkul]",
    scope: "admin",
    location: "group_or_dm",
    description: "Menandai tugas telah selesai dikerjakan dan menonaktifkan pengingat cron otomatis H-3 / H-1.",
    example: "!tugas selesai 1",
  },
  {
    command: "!tugas arsip",
    parameters: "[No/Nama Matkul]",
    scope: "admin",
    location: "group_or_dm",
    description: "Mengarsipkan tugas dari tampilan aktif ke repositori arsip kelas.",
    example: "!tugas arsip Matematika Teknik",
  },
];

export default function DocsPage() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* ── TOP HEADER / NAVBAR ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xs border-b border-zinc-200 dark:border-zinc-800 rounded-none shadow-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-black text-lg tracking-tight">
              <span className="size-8 rounded-none bg-primary text-white flex items-center justify-center font-bold text-sm">
                J
              </span>
              <span>
                JobDex<span className="text-primary">.in</span>
              </span>
            </Link>
            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-none bg-primary/10 text-primary border border-primary/20">
              Dokumentasi & Setup
            </span>
          </div>

          {/* Quick Actions & Navigation */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/demo"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-none transition-colors"
            >
              <Sparkles size={13} className="text-primary" />
              <span>Demo Interaktif</span>
            </Link>

            <Link
              href="/jadwal-tugas-ilkom-b"
              target="_blank"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-none transition-colors"
            >
              <Calendar size={13} className="text-primary" />
              <span>Jadwal Ilkom B</span>
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-none bg-primary text-white hover:opacity-90 shadow-none transition-opacity"
            >
              <span>Dashboard</span>
              <ArrowRight size={13} />
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              className="size-9 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer shadow-none transition-colors"
              title={isDark ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun size={16} className="text-amber-400" />
              ) : (
                <Moon size={16} className="text-zinc-600 dark:text-zinc-400" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO BANNER ────────────────────────────────────────────────────── */}
      <section className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-none bg-primary/10 text-primary border border-primary/20">
            <BookOpen size={14} />
            <span>Dokumentasi Lengkap Asisten WhatsApp JobDex.in</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            Panduan Setup & Kamus Perintah Bot Tugas Kelas
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
            Petunjuk lengkap konfigurasi 2 instance Green-API pada 1 nomor WhatsApp, integrasi Gemini 2.5 Flash untuk ekstraksi suara Korti, setup grup saluran pengumuman, serta referensi baku seluruh perintah bot tugas akademik.
          </p>
        </div>
      </section>

      {/* ── MAIN CONTENT WITH STICKY TOC ───────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-8 items-start">
        {/* ── LEFT & CENTER: DOCUMENTATION CONTENT ───────────────────────────── */}
        <main className="flex-1 min-w-0 space-y-12">
          {/* ================================================================= */}
          {/* BAGIAN 1: ALUR MEMULAI & SETUP KELAS BARU */}
          {/* ================================================================= */}
          <section id="alur-setup" className="space-y-6">
            <div className="space-y-1 border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                <span className="size-7 bg-primary text-white rounded-none flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>Alur Memulai & Setup Kelas Baru</span>
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Langkah-langkah menyambungkan bot ke nomor WhatsApp kelas Anda tanpa biaya langganan bulanan.
              </p>
            </div>

            {/* Sub-langkah 1: Green-API Dual Instance */}
            <div id="setup-green-api" className="p-5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 rounded-none shadow-none">
              <div className="flex items-center gap-2">
                <Server size={18} className="text-primary shrink-0" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Langkah 1: Membuat 2 Instance Green-API pada 1 Nomor WhatsApp
                </h3>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Green-API paket Developer Free menyediakan kuota 1.000 pesan/bulan per instance tanpa watermark. Untuk menghindari risiko pesan berulang (*self-echo loop*) dan limit 3-chat, sistem JobDex memisahkan tugas menjadi 2 instance pada 1 nomor WhatsApp yang sama:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Instance A */}
                <div className="p-3.5 border border-primary/30 bg-primary/5 rounded-none space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-primary text-white rounded-none">
                    Instance A • Jalur Interaktif
                  </span>
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                    Webhook AKTIF (Incoming & Commands)
                  </h4>
                  <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1 list-disc pl-4">
                    <li>Menangani pesan masuk DM dari Korti (Voice Note & Teks).</li>
                    <li>Menerima perintah <code>!tugas mepet</code> di grup diskusi.</li>
                    <li>Mengarahkan webhook ke URL endpoint JobDex:</li>
                  </ul>
                  <code className="block text-[10px] font-mono p-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 break-all">
                    https://jobdexin.sumestawsome.xyz/api/webhooks/green-api
                  </code>
                </div>

                {/* Instance B */}
                <div className="p-3.5 border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-none space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-emerald-600 text-white rounded-none">
                    Instance B • Jalur Siaran
                  </span>
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                    Webhook MATI (Outbound Broadcast Only)
                  </h4>
                  <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1 list-disc pl-4">
                    <li>Khusus menyiarkan pengumuman tugas ke Saluran Komunitas.</li>
                    <li>Mengirim pesan pengingat otomatis progres H-3 & H-1.</li>
                    <li>Webhook dinonaktifkan (OFF), sehingga risiko echo bernilai 0%.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Sub-langkah 2: Gemini AI Key */}
            <div id="setup-gemini" className="p-5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 rounded-none shadow-none">
              <div className="flex items-center gap-2">
                <Mic size={18} className="text-primary shrink-0" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Langkah 2: Mengambil API Key Gemini AI Gratis
                </h3>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                JobDex memanfaatkan kecerdasan model <strong>Gemini 2.5 Flash</strong> untuk mendengarkan rekaman suara bahasa Indonesia santai dari Korti, lalu mengekstrak nama mata kuliah, tugas, ketentuan, tenggat WITA, dan LMS pengumpulan.
              </p>
              <ol className="text-xs text-zinc-700 dark:text-zinc-300 space-y-1.5 list-decimal pl-5">
                <li>Buka konsol <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold">Google AI Studio (aistudio.google.com)</a>.</li>
                <li>Login menggunakan akun Google kampus atau pribadi.</li>
                <li>Klik tombol <strong>"Get API Key"</strong> lalu salin kunci API Anda.</li>
                <li>Simpan di file lingkungan (<code>GEMINI_API_KEY</code>) atau input langsung di konfigurasi kelas.</li>
              </ol>
            </div>

            {/* Sub-langkah 3: Mengambil ID Grup */}
            <div id="setup-group-id" className="p-5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 rounded-none shadow-none">
              <div className="flex items-center gap-2">
                <Terminal size={18} className="text-primary shrink-0" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Langkah 3: Mengambil ID Grup WhatsApp
                </h3>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Setiap obrolan grup WhatsApp memiliki ID unik berakhiran <code>@g.us</code>. Anda membutuhkan dua ID grup:
              </p>
              <ul className="text-xs text-zinc-700 dark:text-zinc-300 space-y-2 list-disc pl-5">
                <li>
                  <strong>ID Saluran Komunitas (Pengumuman):</strong> Contoh format: <code>120363411033795051@g.us</code>. Digunakan untuk siaran satu arah pengumuman tugas.
                </li>
                <li>
                  <strong>ID Grup Diskusi Kelas:</strong> Contoh format: <code>120363999888777111@g.us</code>. Digunakan teman sekelas untuk memanggil perintah <code>!tugas mepet</code>.
                </li>
              </ul>
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                <p className="font-bold text-zinc-900 dark:text-zinc-100">Cara termudah cek ID Grup:</p>
                <p>Kirim pesan sembarang di grup WhatsApp tersebut. Buka menu <em>Logs</em> pada konsol Green-API Instance A, lalu salin nilai pada atribut <code>chatId</code>.</p>
              </div>
            </div>

            {/* Sub-langkah 4: Input di Dashboard */}
            <div id="setup-dashboard" className="p-5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 rounded-none shadow-none">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary shrink-0" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Langkah 4: Daftarkan Ruang Kerja Kelas di Dashboard JobDex.in
                </h3>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Super Admin dapat menambahkan ruang kerja kelas secara instan tanpa perlu menyentuh basis data secara manual:
              </p>
              <ol className="text-xs text-zinc-700 dark:text-zinc-300 space-y-2 list-decimal pl-5">
                <li>Login dengan akun Super Admin, lalu buka menu <Link href="/dashboard/settings/workspaces" className="text-primary hover:underline font-bold">Kelola Ruang Kerja Kelas (/dashboard/settings/workspaces)</Link>.</li>
                <li>Klik tombol <strong>"Tambah Ruang Kerja Kelas Baru"</strong>.</li>
                <li>Isi Nama Kelas (contoh: <code>Kelas Ilmu Komputer B 2024</code>) dan Slug ID (<code>ilkom-b-2024</code>).</li>
                <li>Tempelkan ID Grup Pengumuman dan ID Grup Diskusi.</li>
                <li>Masukkan kredensial Instance A (ID + Token) dan Instance B (ID + Token).</li>
                <li>Masukkan nomor WhatsApp Korti yang diizinkan mengirim Voice Note.</li>
                <li>Klik tombol <strong>"Uji Koneksi A & B"</strong> untuk memvalidasi token Green-API secara langsung.</li>
                <li>Klik <strong>"Simpan Ruang Kerja"</strong>. Bot kini siap bekerja!</li>
              </ol>
            </div>
          </section>

          {/* ================================================================= */}
          {/* BAGIAN 2: ARSITEKTUR MULTI-INSTANCE BEBAS LOOP */}
          {/* ================================================================= */}
          <section id="arsitektur-instance" className="space-y-4">
            <div className="space-y-1 border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                <span className="size-7 bg-primary text-white rounded-none flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>Arsitektur Multi-Instance Bebas Loop</span>
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Pencegahan mutlak dari echo loop, pemborosan kuota, dan watermark.
              </p>
            </div>

            <div className="p-5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 rounded-none shadow-none">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-1">
                  <span className="font-bold text-primary block">1. Masukan Korti</span>
                  <p className="text-zinc-600 dark:text-zinc-400">Korti mengirim VN / pesan teks via japri ke nomor bot WhatsApp.</p>
                </div>
                <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-1">
                  <span className="font-bold text-primary block">2. Instance A (Inbound)</span>
                  <p className="text-zinc-600 dark:text-zinc-400">Menerima webhook, mengekstrak data audio via Gemini, dan mengirim draf persetujuan.</p>
                </div>
                <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-1">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block">3. Instance B (Outbound)</span>
                  <p className="text-zinc-600 dark:text-zinc-400">Setelah diketik <code>!tugas acc</code>, Instance B menyiarkan pesan ke saluran komunitas tanpa webhook aktif.</p>
                </div>
              </div>

              <div className="p-4 bg-lime-50 dark:bg-lime-950/20 border border-lime-300 dark:border-lime-800 text-xs text-zinc-800 dark:text-zinc-200 space-y-1">
                <p className="font-bold text-lime-900 dark:text-lime-300 flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>Garansi Idempotensi & Tanpa Self-Echo</span>
                </p>
                <p className="leading-relaxed">
                  Karena webhook pada Instance B sengaja dimatikan, saat Instance B mempublikasikan pesan siaran ke grup komunitas, server JobDex tidak menerima webhook balik. Hal ini memotong rantai *looping* (bot membaca pesannya sendiri) secara permanen.
                </p>
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* BAGIAN 3: KAMUS LENGKAP PERINTAH BOT WHATSAPP */}
          {/* ================================================================= */}
          <section id="kamus-perintah" className="space-y-6">
            <div className="space-y-1 border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                <span className="size-7 bg-primary text-white rounded-none flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>Kamus Lengkap Perintah Bot WhatsApp</span>
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Daftar lengkap format perintah teks dan interaksi rekaman suara yang didukung bot.
              </p>
            </div>

            {/* Tabel Perintah Utama */}
            <CommandTable commands={BOT_COMMANDS} />

            {/* Sub-bagian A: Perintah Umum */}
            <div id="perintah-umum" className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Terminal size={16} className="text-primary" />
                <span>A. Perintah Umum (Bisa di Grup Diskusi & Japri)</span>
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Seluruh anggota kelas dapat memanggil perintah ini kapan saja untuk mengecek tugas tanpa perlu membuka browser.
              </p>

              <MiniChatPreview
                title="Simulasi Perintah Umum di Grup Diskusi"
                subtitle="Contoh pemanggilan !tugas mepet"
                messages={[
                  {
                    id: "msg_user_mepet",
                    sender: "user",
                    text: "!tugas mepet",
                    time: "14:21",
                    tooltip: "💡 Perintah ini memfilter seluruh tugas aktif yang sisa waktunya ≤ 3 hari.",
                  },
                  {
                    id: "msg_bot_mepet",
                    sender: "bot",
                    text: `📋 *DAFTAR TUGAS MEPEK ILKOM B (≤ 3 HARI)* 🚨
Total: 2 tugas perlu segera diselesaikan!

1. *Matematika Teknik*
📝 *Tugas:* Latihan 15
⏰ *Tenggat:* Besok, 26 Oktober 2026 (17:00 WITA)
🔗 *LMS:* E-Learning Undiksha

2. *Kalkulus Lanjut*
📝 *Tugas:* Problem Set 4 - Integral Lipat Dua
⏰ *Tenggat:* Rabu, 28 Oktober 2026 (23:59 WITA) (2 hari lagi)
🔗 *LMS:* E-Learning Undiksha

👉 Cek jadwal lengkap:
https://jobdexin.sumestawsome.xyz/jadwal-tugas-ilkom-b`,
                    time: "14:21",
                    tooltip: "📋 Bot menyajikan rekap nomor urut tugas, nama matkul, tenggat waktu, dan link LMS secara instan.",
                  },
                ]}
              />
            </div>

            {/* Sub-bagian B: Alur Voice Note */}
            <div id="perintah-voice-note" className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Mic size={16} className="text-primary" />
                <span>B. Alur Voice Note & Konfirmasi ACC (Khusus Korti)</span>
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Korti cukup merekam pesan suara langsung di obrolan pribadi dengan bot. AI Gemini Flash akan mendengarkan, mengekstrak entitas penting, lalu menyajikan draf. Tugas hanya akan disiarkan ke kelas jika Korti membalas dengan <code>!tugas acc</code>.
              </p>

              <MiniChatPreview
                title="Simulasi Alur Voice Note & Konfirmasi Persetujuan"
                subtitle="Interaksi di Obrolan Pribadi (DM) Korti"
                messages={[
                  {
                    id: "msg_vn_korti",
                    sender: "user",
                    isVoiceNote: true,
                    vnDuration: "0:22",
                    time: "10:14",
                    tooltip: "🎙️ Korti rekam suara: 'Halo bot, ada tugas baru Matkul Matematika Teknik, Latihan 15, kumpul Senin besok jam 5 sore di e-learning ya.'",
                  },
                  {
                    id: "msg_bot_draft",
                    sender: "bot",
                    text: `📋 *Draf Tugas Kuliah (Menunggu Persetujuan)*

📚 *Mata Kuliah:* Matematika Teknik
📝 *Judul Tugas:* Latihan 15
⏰ *Tenggat:* Senin, 26 Oktober 2026 pukul 17:00 WITA
📌 *Ketentuan:* Dikerjakan di double folio, di-upload di e-learning Undiksha.
🔗 *Pengumpulan:* E-Learning Undiksha

--------------------------------------
Periksa draf di atas. Jika data sudah benar:
👉 Ketik *!tugas acc* untuk mempublikasikan.
👉 Ketik *!tugas batal* untuk membuang draf.`,
                    time: "10:14",
                    tooltip: "📋 Bot menyusun draf terstruktur agar Korti bisa memastikan nama matkul dan tenggat waktu tidak keliru.",
                  },
                  {
                    id: "msg_user_acc",
                    sender: "user",
                    text: "!tugas acc",
                    time: "10:15",
                    tooltip: "✅ Perintah ACC menyetujui draf dan memicu pengiriman siaran resmi ke Saluran Komunitas.",
                  },
                  {
                    id: "msg_bot_success",
                    sender: "bot",
                    text: `✅ *Tugas Berhasil Disetujui & Diterbitkan!*

📚 *Mata Kuliah:* Matematika Teknik
📝 *Tugas:* Latihan 15
⏰ *Tenggat:* Senin, 26 Oktober 2026 pukul 17:00 WITA

Tugas telah tersimpan di JobDex dan disiarkan ke kelas.`,
                    time: "10:15",
                    tooltip: "📢 Bot mengonfirmasi penerbitan dan mengaktifkan cron pengingat progres H-3.",
                  },
                ]}
              />
            </div>

            {/* Sub-bagian C: Perintah Tambah Kilat */}
            <div id="perintah-tambah-kilat" className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Zap size={16} className="text-primary" />
                <span>C. Perintah Tambah Kilat (Format Pipa 4 atau 5 Parameter)</span>
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Jika admin sedang di tempat bising atau tidak sempat merekam suara, gunakan perintah teks instan menggunakan tanda pipa <code>|</code> sebagai pemisah:
              </p>

              <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1.5 font-mono text-xs">
                <p className="text-[11px] text-zinc-500 font-sans font-bold">Format 5 Parameter (Lengkap):</p>
                <code className="block text-primary break-all">
                  !tugas tambah [Matkul] | [Judul] | [Deskripsi] | [Tenggat] | [LMS]
                </code>
                <p className="text-[11px] text-zinc-500 font-sans font-bold pt-1">Format 4 Parameter (Ringkas):</p>
                <code className="block text-primary break-all">
                  !tugas tambah [Matkul] | [Judul] | [Tenggat] | [LMS]
                </code>
              </div>

              <MiniChatPreview
                title="Simulasi Tambah Tugas Kilat via Pesan Teks"
                messages={[
                  {
                    id: "msg_user_quick",
                    sender: "user",
                    text: "!tugas tambah Pemrograman Web | Bikin REST API Next.js & Push GitHub | Kerjakan berkelompok maks 3 orang | 28/10/2026 23:59 | E-Learning Undiksha",
                    time: "11:20",
                    tooltip: "💡 Admin langsung mengetik format teks dengan pemisah pipa (|) untuk mencatat tugas kilat tanpa rekaman suara.",
                  },
                  {
                    id: "msg_bot_quick_res",
                    sender: "bot",
                    text: `✅ *Tugas Berhasil Ditambahkan!*

📚 *Mata Kuliah:* Pemrograman Web
📝 *Tugas:* Bikin REST API Next.js & Push GitHub
⏰ *Tenggat:* Rabu, 28 Oktober 2026 (23:59 WITA)
📌 *Ketentuan:* Kerjakan berkelompok maks 3 orang
🔗 *LMS:* E-Learning Undiksha

Tugas telah tersimpan di kalender kelas dan disiarkan ke saluran pengumuman.`,
                    time: "11:20",
                    tooltip: "⚡ Bot mengekstrak kelima parameter dan mempublikasikan tugas secara langsung.",
                  },
                ]}
              />
            </div>

            {/* Sub-bagian D: Perintah Edit */}
            <div id="perintah-edit" className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Terminal size={16} className="text-primary" />
                <span>D. Perintah Edit & Siaran Revisi</span>
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Jika dosen memundurkan tenggat atau merevisi instruksi tugas, Korti dapat mengubah rincian tersebut. Bot akan otomatis mengirimkan pesan siaran revisi ke grup saluran komunitas.
              </p>

              <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1.5 font-mono text-xs">
                <p className="text-[11px] text-zinc-500 font-sans font-bold">Format Edit:</p>
                <code className="block text-primary break-all">
                  !tugas edit [Nomor Urut / Nama Matkul] | [tenggat/deskripsi/link/judul] | [Nilai Baru]
                </code>
              </div>

              <MiniChatPreview
                title="Simulasi Perintah Edit Tugas & Siaran Pembaruan"
                messages={[
                  {
                    id: "msg_user_edit",
                    sender: "user",
                    text: "!tugas edit 1 | tenggat | 31/10/2026 23:59",
                    time: "15:10",
                    tooltip: "💡 Mengubah batas waktu tugas nomor 1 menjadi 31 Oktober 2026 pukul 23:59 WITA.",
                  },
                  {
                    id: "msg_bot_edit",
                    sender: "bot",
                    text: `✅ *Tugas Berhasil Diperbarui & Disiarkan!*

📚 *Mata Kuliah:* Matematika Teknik
⏰ *Tenggat Baru:* Sabtu, 31 Oktober 2026 (23:59 WITA)

Pembaruan jadwal telah disinkronkan ke kalender web dan disiarkan ke kelas.`,
                    time: "15:10",
                    tooltip: "📢 Bot memperbarui database, mereset timer pengingat cron, dan menyiarkan revisi ke kelas.",
                  },
                ]}
              />
            </div>

            {/* Sub-bagian E: Perintah Selesai & Arsip */}
            <div id="perintah-selesai" className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-primary" />
                <span>E. Perintah Selesai & Arsip Tugas</span>
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Tandai tugas yang telah melewati masa pengumpulan atau sudah dinilai oleh dosen agar tidak lagi muncul di daftar <code>!tugas mepet</code>.
              </p>

              <MiniChatPreview
                title="Simulasi Penyelesaian Tugas Kuliah"
                messages={[
                  {
                    id: "msg_user_selesai",
                    sender: "user",
                    text: "!tugas selesai 1",
                    time: "09:00",
                    tooltip: "💡 Menandai tugas selesai berdasarkan nomor urut di daftar !tugas list.",
                  },
                  {
                    id: "msg_bot_selesai",
                    sender: "bot",
                    text: `🎉 *Tugas Ditandai Selesai!*

📚 *Mata Kuliah:* Matematika Teknik
📝 *Tugas:* Latihan 15

Status tugas telah diubah menjadi Selesai. Pengingat otomatis untuk tugas ini dinonaktifkan.`,
                    time: "09:00",
                    tooltip: "✅ Tugas diarsipkan dan sistem cron berhenti mengirimkan notifikasi pengingat.",
                  },
                ]}
              />
            </div>
          </section>

          {/* ================================================================= */}
          {/* BAGIAN 4: TROUBLESHOOTING & FAQ */}
          {/* ================================================================= */}
          <section id="troubleshooting" className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="space-y-1 border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                <HelpCircle size={22} className="text-primary shrink-0" />
                <span>4. Tanya Jawab & Troubleshooting</span>
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">
                  Q: Apakah nomor bot berisiko diblokir (banned) oleh WhatsApp?
                </h4>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Tidak berisiko. Bot hanya mengirim pesan ke grup kelas sendiri dan admin yang sudah terdaftar di kontak. Bot tidak melakukan *spam blast* massal ke nomor asing.
                </p>
              </div>

              <div className="p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">
                  Q: Bagaimana jika suara rekaman VN tidak lengkap atau tidak terdengar jelas?
                </h4>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Model Gemini Flash akan menyusun draf dengan menandai bagian yang kosong. Korti cukup mengirim pesan suara susulan atau teks perbaikan sebelum mengetik <code>!tugas acc</code>.
                </p>
              </div>

              <div className="p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">
                  Q: Apakah pesan di grup diskusi kelas akan selalu dibalas oleh bot?
                </h4>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Tidak. Di grup diskusi kelas, bot hanya akan merespons jika pesan diawali dengan perintah <code>!tugas</code> (misalnya <code>!tugas mepet</code>, <code>!tugas list</code>, atau <code>!tugas menu</code>). Percakapan santai teman sekelas lainnya akan diabaikan secara otomatis sehingga grup tetap nyaman.
                </p>
              </div>
            </div>
          </section>
        </main>

        {/* ── RIGHT COLUMN: STICKY TABLE OF CONTENTS ────────────────────────── */}
        <DocsTableOfContents items={TOC_ITEMS} />
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 text-center text-xs text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900">
        <p>© {new Date().getFullYear()} JobDex.in • Universitas Pendidikan Ganesha. All rights reserved.</p>
      </footer>
    </div>
  );
}
