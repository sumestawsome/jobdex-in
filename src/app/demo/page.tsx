"use client";

import Link from "next/link";
import { useTheme } from "@/components/theme/theme-provider";
import { WhatsAppChatSimulator } from "@/components/demo/whatsapp-chat-simulator";
import {
  Sun,
  Moon,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Mic,
  Server,
  Calendar,
  Lock,
  Layers,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

export default function DemoShowcasePage() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* ── TOP HEADER / NAVBAR ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xs border-b border-zinc-200 dark:border-zinc-800 rounded-none shadow-none">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-black text-lg tracking-tight">
              <span className="size-8 rounded-none bg-primary text-white flex items-center justify-center font-bold text-sm">
                J
              </span>
              <span>JobDex<span className="text-primary">.in</span></span>
            </Link>
            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-none bg-primary/10 text-primary border border-primary/20">
              Interactive Showcase
            </span>
          </div>

          {/* Quick Actions & Theme Toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
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
              {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-zinc-600 dark:text-zinc-400" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO INTRODUCTION ──────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-6 text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-none bg-lime-100 dark:bg-lime-950/40 text-lime-800 dark:text-lime-300 border border-lime-400 dark:border-lime-700 shadow-none">
          <Sparkles size={14} className="text-primary" />
          <span>Demo Interaktif Asisten WhatsApp Multimodal</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
          Simulasi Alur Kerja Cerdas Bot WhatsApp JobDex.in
        </h1>

        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Uji coba langsung bagaimana bot mengekstrak <strong>Voice Note</strong> rekaman suara Korti, menyusun draf persetujuan, mencegah echo loop, dan menyiarkan pengumuman tugas secara bersih tanpa watermark.
        </p>
      </section>

      {/* ── CHAT SIMULATOR INTERFACE ───────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-12">
        <WhatsAppChatSimulator />
      </main>

      {/* ── ARCHITECTURAL ADVANTAGES CARDS ─────────────────────────────────── */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-1.5">
            <h2 className="text-lg sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              Keunggulan Teknis & Standar Rekayasa Sistem
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
              Dibangun dengan arsitektur serverless modern, distributed lock idempotensi, dan proteksi mutlak dari self-echo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Multimodal AI Voice */}
            <div className="p-5 rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-2.5 shadow-none">
              <div className="size-9 rounded-none bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
                <Mic size={18} />
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Multimodal Gemini Flash Audio
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Menerima rekaman suara bahasa Indonesia santai langsung dari WhatsApp, mengekstrak entitas mata kuliah, judul tugas, tenggat waktu zona WITA, serta tempat pengumpulan dalam hitungan detik.
              </p>
            </div>

            {/* Card 2: Human-in-the-loop Guard */}
            <div className="p-5 rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-2.5 shadow-none">
              <div className="size-9 rounded-none bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center font-bold">
                <ShieldCheck size={18} />
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Human-in-the-Loop & Distributed Lock
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Hasil ekstraksi suara tidak langsung diumumkan ke grup, melainkan disimpan sebagai draf pratinjau. Tugas hanya disiarkan setelah Korti memeriksa dan mengetik perintah <code>!tugas acc</code>.
              </p>
            </div>

            {/* Card 3: Dual Green-API Routing */}
            <div className="p-5 rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-2.5 shadow-none">
              <div className="size-9 rounded-none bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center justify-center font-bold">
                <Server size={18} />
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Dual Instance & 3-Chat Limit Guard
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Instance A didedikasikan untuk 3 chat (Admin 1 DM, Admin 2 DM, Grup Diskusi). Instance B bertugas khusus siaran outbound tanpa webhook sehingga 100% bebas watermark dan risiko loop bernilai 0%.
              </p>
            </div>
          </div>

          {/* Banner CTA */}
          <div className="p-6 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-none flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-none">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Ingin Mengintegrasikan Kelas Anda?
              </h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Super Admin dapat menambahkan ruang kerja kelas dan menghubungkan grup WhatsApp secara instan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/settings/workspaces"
                className="px-4 py-2 text-xs font-bold rounded-none bg-primary text-white hover:opacity-90 shadow-none transition-opacity"
              >
                Kelola Ruang Kerja Kelas
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
        <p>© {new Date().getFullYear()} JobDex.in • Universitas Pendidikan Ganesha. All rights reserved.</p>
      </footer>
    </div>
  );
}
