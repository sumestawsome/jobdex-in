"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FolderArchive,
  Layers,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";

const navigation = [
  { label: "Fitur Utama", href: "#fitur" },
  { label: "Alur Kerja", href: "#alur" },
  { label: "Integrasi WhatsApp", href: "#wa-bot" },
  { label: "Testimoni", href: "#testimoni" },
  { label: "FAQ", href: "#faq" },
];

const faqs = [
  {
    q: "Apakah butuh nomor WhatsApp khusus untuk bot?",
    a: "Tidak perlu. JobDex.in sudah menyediakan bot WhatsApp resmi terverifikasi yang langsung siap dihubungkan ke grup kepanitiaan atau mengirim pesan pengingat ke nomor PIC masing-masing.",
  },
  {
    q: "Berapa banyak divisi dan anggota yang dapat didaftarkan?",
    a: "Untuk organisasi dan kepanitiaan, Anda dapat membuat hingga 15 divisi dengan jumlah anggota tanpa batas pada setiap workspace event.",
  },
  {
    q: "Bagaimana jika PIC tidak memiliki akun website?",
    a: "Anggota tetap dapat menerima pengingat tugas dan mengonfirmasi penyelesaian tugas langsung melalui tautan cepat yang dikirimkan oleh bot WhatsApp tanpa wajib login ke website.",
  },
  {
    q: "Apakah data kepanitiaan dapat diekspor untuk lampiran LPJ?",
    a: "Ya, Anda dapat mengekspor rekapitulasi progres, catatan kendala, dan tanggal penyelesaian tugas dalam format Microsoft Excel (.xlsx) atau file PDF siap cetak.",
  },
];

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans antialiased selection:bg-indigo-600 selection:text-white">
      {/* Top Sticky Navigation */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-zinc-200">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-inherit no-underline">
            <div className="w-8 h-8 rounded-none bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-none">
              J
            </div>
            <span className="text-lg font-bold tracking-tight text-zinc-900">
              JobDex<span className="text-indigo-600">.in</span>
            </span>
            <span className="text-[11px] font-semibold text-lime-700 bg-lime-50 border border-lime-300 px-2 py-0.5 rounded-none shadow-none">
              v1.2
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7" aria-label="Menu Utama">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-semibold rounded-none border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 shadow-none transition-all"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-semibold rounded-none bg-indigo-600 !text-white hover:bg-indigo-700 shadow-none transition-all"
            >
              Buat Workspace
            </Link>
          </div>
        </div>
      </header>

      {/* Blueprint Grid Divider with Crosshairs */}
      <div className="max-w-[1200px] mx-auto px-6 relative">
        <div className="border-t border-zinc-200 w-full relative">
          <span className="absolute -top-2.5 left-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
          <span className="absolute -top-2.5 right-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
        </div>
      </div>

      {/* Hero Section: 7-Cell Message + 9-Cell Product Showcase Image */}
      <section className="py-12 lg:py-20 relative bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-16 gap-10 lg:gap-12 items-center">
            
            {/* Left 7-Cell Content Area */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-none text-xs font-semibold bg-white border border-zinc-200 text-zinc-800 w-fit mb-5 shadow-none">
                <span className="text-lime-600 font-bold">✦</span>
                Terintegrasi WhatsApp Cloud Bot
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-bold text-zinc-900 leading-[1.08] tracking-[-0.03em] mb-4">
                Koordinasi divisi rapi, tanpa ada tugas yang terlewat.
              </h1>

              <p className="text-base sm:text-lg text-zinc-600 leading-relaxed mb-7 max-w-xl">
                Kelola pembagian tugas, progress, dan koordinasi divisi dalam satu dashboard terpusat. Dilengkapi bot pengingat WhatsApp otomatis ke grup panitia.
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-10">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-none bg-indigo-600 !text-white text-sm font-semibold hover:bg-indigo-700 shadow-none transition-all group"
                >
                  Buat Workspace
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a
                  href="#demo"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-none border border-zinc-200 bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-50 shadow-none transition-all"
                >
                  Lihat Demo
                </a>
              </div>

              {/* Stats Strip */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-zinc-200">
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-indigo-600">120+</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Organisasi &amp; Event</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-lime-600">45.000+</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Tugas Terselesaikan</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-emerald-600">99.4%</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Ketepatan Waktu</div>
                </div>
              </div>
            </div>

            {/* Right 9-Cell Clean Product Screenshot Showcase */}
            <div className="lg:col-span-9" id="demo">
              <div className="rounded-none border border-zinc-200 bg-white shadow-none overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-none bg-zinc-300" />
                    <span className="w-2.5 h-2.5 rounded-none bg-zinc-300" />
                    <span className="w-2.5 h-2.5 rounded-none bg-zinc-300" />
                  </div>
                  <span className="text-xs font-mono text-zinc-500">JobDex.in / Dashboard Workspace</span>
                  <span className="text-[11px] font-semibold text-lime-700 bg-lime-50 border border-lime-300 px-2 py-0.5 rounded-none">
                    Live Preview
                  </span>
                </div>
                
                <div className="p-2 sm:p-4 bg-zinc-50/50 flex items-center justify-center">
                  <Image
                    src="/images/landing/hero-jobdex-in.png"
                    alt="Mockup Dashboard JobDex.in"
                    width={1400}
                    height={900}
                    className="w-full h-auto max-h-[520px] object-contain rounded-none shadow-none"
                    priority
                    unoptimized
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Blueprint Grid Divider with Crosshairs */}
      <div className="max-w-[1200px] mx-auto px-6 relative">
        <div className="border-t border-zinc-200 w-full relative">
          <span className="absolute -top-2.5 left-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
          <span className="absolute -top-2.5 right-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
        </div>
      </div>

      {/* Core 3-Band Workflow Section */}
      <section className="py-16 sm:py-20 bg-white border-y border-zinc-200" id="alur">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <span className="inline-block text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-none mb-3">
              Fondasi Koordinasi
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight mb-3">
              Tiga pilar koordinasi divisi tanpa drama komunikasi.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
              Dirancang khusus untuk kepengurusan organisasi, kepanitiaan event, dan unit kegiatan yang membutuhkan transparansi tinggi tanpa ribet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 border border-zinc-200 rounded-none overflow-hidden bg-white divide-y md:divide-y-0 md:divide-x divide-zinc-200">
            <div className="p-6 sm:p-8 flex flex-col justify-start">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
                01 / Struktur Jelas
              </span>
              <div className="w-9 h-9 rounded-none bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-900 mb-4">
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                Distribusi Jobdesk &amp; PIC Pasti
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Setiap tugas memiliki Penanggung Jawab (PIC) tunggal, tenggat waktu spesifik, dan link dokumen pendukung. Tidak ada lagi alasan saling lempar tanggung jawab.
              </p>
            </div>

            <div className="p-6 sm:p-8 flex flex-col justify-start">
              <span className="text-xs font-bold text-lime-700 uppercase tracking-wider mb-3">
                02 / Otomasi WA
              </span>
              <div className="w-9 h-9 rounded-none bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-900 mb-4">
                <MessageSquare className="w-5 h-5 text-lime-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                Pengingat Otomatis ke WhatsApp
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Bot WhatsApp cerdas mengirimkan reminder berkala ke nomor PIC atau grup divisi. Koordinator dan ketua tidak perlu repot menagih manual satu per satu setiap malam.
              </p>
            </div>

            <div className="p-6 sm:p-8 flex flex-col justify-start">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3">
                03 / Visibilitas Real-Time
              </span>
              <div className="w-9 h-9 rounded-none bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-900 mb-4">
                <Layers className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                Pantauan Progres &amp; Rekap LPJ
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Ketua pelaksana dapat melihat persentase kesiapan acara dalam sekejap. Seluruh riwayat tugas siap diekspor ke format rekap untuk lampiran LPJ kepanitiaan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Blueprint Grid Divider with Crosshairs */}
      <div className="max-w-[1200px] mx-auto px-6 relative">
        <div className="border-t border-zinc-200 w-full relative">
          <span className="absolute -top-2.5 left-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
          <span className="absolute -top-2.5 right-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
        </div>
      </div>

      {/* WhatsApp Integration Showcase Section */}
      <section className="py-16 sm:py-20 bg-white" id="wa-bot">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <span className="inline-block text-xs font-semibold text-lime-700 bg-lime-50 border border-lime-300 px-2.5 py-1 rounded-none mb-3">
              Integrasi WhatsApp Bot
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight mb-3">
              Koordinasi dan update progres langsung dari chat WhatsApp.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
              Pantau deadline, terima pengingat otomatis berkala, dan perbarui status tugas kepanitiaan langsung melalui grup WhatsApp divisi tanpa perlu login setiap saat.
            </p>
          </div>

          <div className="rounded-none border border-zinc-200 bg-white shadow-none overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-none bg-zinc-300" />
                <span className="w-2.5 h-2.5 rounded-none bg-zinc-300" />
                <span className="w-2.5 h-2.5 rounded-none bg-zinc-300" />
              </div>
              <span className="text-xs font-mono text-zinc-500">JobDex.in / WhatsApp Bot Integration</span>
              <span className="text-[11px] font-semibold text-lime-700 bg-lime-50 border border-lime-300 px-2 py-0.5 rounded-none">
                Bot Online
              </span>
            </div>

            <div className="p-3 sm:p-6 bg-zinc-50/50 flex items-center justify-center">
              <Image
                src="/images/landing/whatsapp-jobdex-in.png"
                alt="Visual Desain WhatsApp Bot JobDex.in"
                width={1672}
                height={941}
                className="w-full h-auto rounded-none shadow-none"
                unoptimized
              />
            </div>
          </div>
        </div>
      </section>

      {/* Blueprint Grid Divider with Crosshairs */}
      <div className="max-w-[1200px] mx-auto px-6 relative">
        <div className="border-t border-zinc-200 w-full relative">
          <span className="absolute -top-2.5 left-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
          <span className="absolute -top-2.5 right-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
        </div>
      </div>

      {/* 4-Feature Deep Dive Grid (Shared borders) */}
      <section className="py-16 sm:py-20 bg-white border-y border-zinc-200" id="fitur">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <span className="inline-block text-xs font-semibold text-zinc-800 bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-none mb-3">
              Fitur Terintegrasi
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight mb-3">
              Semua yang dibutuhkan tim kepanitiaan dalam satu wadah.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
              Setiap modul dirancang selaras dengan ritme kerja organisasi di Indonesia: cepat, fleksibel, dan terhubung ke WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-zinc-200 rounded-none overflow-hidden bg-white divide-y sm:divide-y-0 sm:divide-x divide-zinc-200">
            <div className="p-6 flex flex-col justify-start">
              <div className="w-9 h-9 rounded-none bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-900 mb-4">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 mb-2">
                Manajemen Multi-Divisi
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                Kelola divisi Acara, Humas, Logistik, Konsumsi, dan Keamanan secara terpisah namun tetap terkoordinasi di bawah satu event.
              </p>
            </div>

            <div className="p-6 flex flex-col justify-start">
              <div className="w-9 h-9 rounded-none bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-900 mb-4">
                <FolderArchive className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 mb-2">
                Arsip Referensi &amp; Dokumen
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                Sematkan link Google Drive, template surat, atau referensi vendor langsung di setiap kartu tugas agar mudah diakses panitia.
              </p>
            </div>

            <div className="p-6 flex flex-col justify-start">
              <div className="w-9 h-9 rounded-none bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-900 mb-4">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 mb-2">
                Pengaturan Hak Akses
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                Beri wewenang berbeda untuk Ketua Panitia (BPH), Koordinator Divisi, dan Anggota Pelaksana dengan kontrol akses terverifikasi.
              </p>
            </div>

            <div className="p-6 flex flex-col justify-start">
              <div className="w-9 h-9 rounded-none bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-900 mb-4">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 mb-2">
                Ekspor Laporan LPJ
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                Unduh rekapitulasi capaian jobdesk dalam format spreadsheet atau PDF siap cetak untuk kelengkapan administrasi pasca acara.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Blueprint Grid Divider with Crosshairs */}
      <div className="max-w-[1200px] mx-auto px-6 relative">
        <div className="border-t border-zinc-200 w-full relative">
          <span className="absolute -top-2.5 left-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
          <span className="absolute -top-2.5 right-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
        </div>
      </div>

      {/* Testimonials Section */}
      <section className="py-16 sm:py-20 bg-white" id="testimoni">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <span className="inline-block text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-none mb-3">
              Pengalaman Pengguna
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight mb-3">
              Dipercaya oleh ketua panitia dan koordinator divisi.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-6 rounded-none border border-zinc-200 bg-white shadow-none flex flex-col justify-between">
              <p className="text-sm text-zinc-700 leading-relaxed mb-6">
                &ldquo;Sebelum pakai JobDex.in, saya harus chat koordinator divisi satu-satu setiap jam 10 malam untuk nanya progres. Sekarang bot WA otomatis yang ingetin, dan saya tinggal cek rekap pagi hari.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-none bg-zinc-100 text-zinc-900 font-bold text-xs flex items-center justify-center border border-zinc-200">
                  FN
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-900">Fajar Nugraha</div>
                  <div className="text-[11px] text-zinc-500">Ketua Pelaksana Festival Budaya Kampus</div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-none border border-zinc-200 bg-white shadow-none flex flex-col justify-between">
              <p className="text-sm text-zinc-700 leading-relaxed mb-6">
                &ldquo;Notifikasi pengingat H-1 ke grup divisi sangat membantu saat koordinasi lapangan. Kami bisa tahu persis vendor mana yang belum lunas dan perlengkapan mana yang belum siap.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-none bg-zinc-100 text-zinc-900 font-bold text-xs flex items-center justify-center border border-zinc-200">
                  AN
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-900">Adinda Nurul</div>
                  <div className="text-[11px] text-zinc-500">Koordinator Acara Seminar Nasional</div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-none border border-zinc-200 bg-white shadow-none flex flex-col justify-between">
              <p className="text-sm text-zinc-700 leading-relaxed mb-6">
                &ldquo;Paling juara waktu bikin LPJ. Semua riwayat tanggal selesai dan bukti tugas sudah tercatat rapi, nggak perlu lagi ngumpulin data lembaran manual.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-none bg-zinc-100 text-zinc-900 font-bold text-xs flex items-center justify-center border border-zinc-200">
                  BP
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-900">Bagus Pratama</div>
                  <div className="text-[11px] text-zinc-500">Sekretaris Umum BEM Fakultas</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Blueprint Grid Divider with Crosshairs */}
      <div className="max-w-[1200px] mx-auto px-6 relative">
        <div className="border-t border-zinc-200 w-full relative">
          <span className="absolute -top-2.5 left-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
          <span className="absolute -top-2.5 right-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
        </div>
      </div>

      {/* FAQ Section */}
      <section className="py-16 sm:py-20 bg-white border-y border-zinc-200" id="faq">
        <div className="max-w-[800px] mx-auto px-6">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold text-zinc-800 bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-none mb-3">
              Pertanyaan Umum
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight mb-3">
              Pertanyaan seputar JobDex.in
            </h2>
            <p className="text-sm sm:text-base text-zinc-600">
              Hal-hal yang sering ditanyakan mengenai integrasi WhatsApp bot dan pengaturan workspace.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-none border border-zinc-200 bg-white overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left text-sm sm:text-base font-semibold text-zinc-900 hover:bg-zinc-50 transition-colors"
                    aria-expanded={isOpen}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-indigo-600" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs sm:text-sm text-zinc-600 leading-relaxed border-t border-zinc-200 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Blueprint Grid Divider with Crosshairs */}
      <div className="max-w-[1200px] mx-auto px-6 relative">
        <div className="border-t border-zinc-200 w-full relative">
          <span className="absolute -top-2.5 left-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
          <span className="absolute -top-2.5 right-0 text-xs font-mono text-zinc-400 select-none pointer-events-none">+</span>
        </div>
      </div>

      {/* Call to Action Banner */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="rounded-none bg-zinc-950 text-white p-8 sm:p-14 text-center flex flex-col items-center border border-zinc-800 shadow-none">
            <span className="inline-block text-xs font-semibold bg-white/10 border border-white/20 text-lime-400 px-3 py-1 rounded-none mb-4">
              Mulai Tanpa Biaya
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight mb-3 max-w-2xl">
              Siap wujudkan kepanitiaan yang teratur dan tepat waktu?
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 max-w-xl mb-8 leading-relaxed">
              Buat workspace divisi Anda dalam 2 menit. Hubungkan dengan grup WhatsApp panitia dan rasakan kemudahan koordinasi tanpa hambatan.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-none bg-indigo-600 !text-white text-sm font-semibold hover:bg-indigo-500 transition-all shadow-none group"
              >
                Buat Workspace Sekarang
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-6 py-3 rounded-none border border-zinc-700 text-white text-sm font-semibold hover:bg-zinc-900 transition-all shadow-none"
              >
                Masuk ke Akun
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Site Footer */}
      <footer className="bg-white border-t border-zinc-200 py-10 text-xs text-zinc-500">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-none bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
              J
            </div>
            <span className="font-semibold text-zinc-900">JobDex.in</span>
            <span>— Platform Koordinasi &amp; Distribusi Proker Divisi.</span>
          </div>

          <div className="flex items-center gap-5">
            <a href="#fitur" className="hover:text-zinc-900 transition-colors">Fitur</a>
            <a href="#alur" className="hover:text-zinc-900 transition-colors">Alur Kerja</a>
            <a href="#wa-bot" className="hover:text-zinc-900 transition-colors">Integrasi WA</a>
            <a href="#faq" className="hover:text-zinc-900 transition-colors">FAQ</a>
            <span>•</span>
            <span>© 2026 JobDex.in. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

