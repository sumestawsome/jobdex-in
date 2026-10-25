"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Phone,
  Video,
  Search,
  MoreVertical,
  Play,
  Pause,
  Send,
  Paperclip,
  Smile,
  Mic,
  CheckCheck,
  Check,
  Sparkles,
  ShieldCheck,
  Zap,
  Info,
  Calendar,
  ExternalLink,
  MessageSquare,
  Volume2,
  RefreshCw,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react";

export type DemoScenario = "scenario_broadcast" | "scenario_voicenote" | "scenario_group";

export function WhatsAppChatSimulator() {
  const [activeScenario, setActiveScenario] = useState<DemoScenario>("scenario_voicenote");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [showTranscriptTooltip, setShowTranscriptTooltip] = useState(false);
  const [customInputValue, setCustomInputValue] = useState("");
  const [scenarioStep, setScenarioStep] = useState<number>(3); // 3 shows all messages by default
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset audio playback on scenario change
  useEffect(() => {
    setIsPlayingAudio(false);
    setAudioProgress(0);
    setShowTranscriptTooltip(false);
    setScenarioStep(3);
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
    }
  }, [activeScenario]);

  // Handle Voice Note Play / Pause simulation
  function toggleAudioPlayback() {
    if (isPlayingAudio) {
      setIsPlayingAudio(false);
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    } else {
      setIsPlayingAudio(true);
      setShowTranscriptTooltip(true);
      const interval = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 5;
        });
      }, 200);
      audioIntervalRef.current = interval;
    }
  }

  // Calculate audio seconds
  const currentSeconds = Math.floor((audioProgress / 100) * 22);
  const audioDisplayTime = `0:${currentSeconds < 10 ? "0" + currentSeconds : currentSeconds}`;

  return (
    <div className="w-full max-w-4xl mx-auto rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-none overflow-hidden flex flex-col">
      {/* ── 1. HEADER CHAT SIMULATOR (WhatsApp Neo-Flat Bar) ──────────────── */}
      <div className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between gap-3 rounded-none shadow-none">
        {/* Profile / Bot Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="size-10 rounded-none bg-primary text-white flex items-center justify-center font-black text-sm tracking-tighter border border-primary">
              J
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 size-3 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-none" title="Online" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate tracking-tight">
                {activeScenario === "scenario_broadcast"
                  ? "📢 Saluran Komunitas Ilkom B"
                  : activeScenario === "scenario_voicenote"
                  ? "JobDex in AI (DM Korti)"
                  : "👥 Kelas Ilmu Komputer B 2024"}
              </h2>
              <span className="px-1.5 py-0.2 rounded-none bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold uppercase shrink-0">
                Verified Bot
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-none bg-emerald-500" />
              <span>
                {activeScenario === "scenario_broadcast"
                  ? "124 Pelanggan • Siaran Resmi"
                  : activeScenario === "scenario_voicenote"
                  ? "Online • Asisten Cerdas Suara"
                  : "34 Anggota • Diskusi & Tugas"}
              </span>
            </p>
          </div>
        </div>

        {/* Decorative Tools */}
        <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 shrink-0">
          <button
            type="button"
            className="p-2 rounded-none hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors shadow-none cursor-pointer"
            title="Panggilan Suara"
            aria-label="Panggilan Suara"
          >
            <Phone size={16} />
          </button>
          <button
            type="button"
            className="p-2 rounded-none hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors shadow-none cursor-pointer"
            title="Panggilan Video"
            aria-label="Panggilan Video"
          >
            <Video size={16} />
          </button>
          <button
            type="button"
            className="p-2 rounded-none hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors shadow-none cursor-pointer"
            title="Pencarian Pesan"
            aria-label="Pencarian Pesan"
          >
            <Search size={16} />
          </button>
          <button
            type="button"
            className="p-2 rounded-none hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors shadow-none cursor-pointer"
            title="Menu Lainnya"
            aria-label="Menu Lainnya"
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {/* ── 2. SCENARIO TAB SWITCHER ────────────────────────────────────────── */}
      <div className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 p-1.5 flex items-center gap-1 overflow-x-auto rounded-none shadow-none">
        <button
          type="button"
          onClick={() => setActiveScenario("scenario_broadcast")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-none transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 shadow-none ${
            activeScenario === "scenario_broadcast"
              ? "bg-white dark:bg-zinc-900 text-primary border-primary font-bold"
              : "text-zinc-600 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          }`}
        >
          <span>📢 Skenario 1: Saluran Pengumuman</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveScenario("scenario_voicenote")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-none transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 shadow-none ${
            activeScenario === "scenario_voicenote"
              ? "bg-white dark:bg-zinc-900 text-primary border-primary font-bold"
              : "text-zinc-600 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          }`}
        >
          <span>🎙️ Skenario 2: DM Admin (Voice Note & ACC)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveScenario("scenario_group")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-none transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 shadow-none ${
            activeScenario === "scenario_group"
              ? "bg-white dark:bg-zinc-900 text-primary border-primary font-bold"
              : "text-zinc-600 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          }`}
        >
          <span>👥 Skenario 3: Grup Diskusi Kelas</span>
        </button>
      </div>

      {/* ── 3. CHAT CANVAS & CONVERSATION MESSAGES ──────────────────────────── */}
      <div className="flex-1 min-h-[460px] p-4 sm:p-6 space-y-5 overflow-y-auto bg-zinc-50/70 dark:bg-zinc-950/70 relative">
        {/* Date Chip */}
        <div className="flex justify-center">
          <span className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-none bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 shadow-none">
            Hari ini
          </span>
        </div>

        {/* =================================================================== */}
        {/* SKENARIO 1: SALURAN PENGUMUMAN KOMUNITAS */}
        {/* =================================================================== */}
        {activeScenario === "scenario_broadcast" && (
          <>
            {/* System banner */}
            <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none text-xs text-zinc-600 dark:text-zinc-400 space-y-1 shadow-none">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
                <Info size={14} className="text-primary" />
                <span>Saluran Informasi Resmi Kelas Ilkom B 2024</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Saluran ini disiarkan secara outbound via <strong>Instance B Green-API</strong>. 100% bebas watermark pihak ketiga dan webhook dinonaktifkan sehingga risiko looping bernilai 0%.
              </p>
            </div>

            {/* Pesan 1: Siaran Tugas Baru Kalkulus */}
            <div className="flex flex-col items-start gap-1 max-w-xl">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-none bg-primary/10 text-primary border border-primary/20 uppercase">
                  💡 Outbound Broadcast (Instance B)
                </span>
                <span className="text-[10px] text-zinc-400">10:00 WITA</span>
              </div>

              <div className="p-4 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 space-y-3 shadow-none w-full">
                {/* Header Pengumuman */}
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    📢 *PENGUMUMAN TUGAS KULIAH* ✨
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    Halo rekan-rekan *Ilkom B*! Ada tugas baru nih, jangan lupa dicatat dan dibuat ya Guys! 🙌
                  </p>
                </div>

                {/* Detail Tugas */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">📚 Mata Kuliah:</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">Kalkulus Lanjut</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">📝 Tugas:</span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-medium">Problem Set 4 - Integral Lipat Dua</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">⏰ Tenggat:</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">Sabtu, 31 Oktober 2026 (23:59 WITA)</span>
                  </div>
                  <div className="pt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-0.5">📌 Ketentuan / Deskripsi:</span>
                    <p className="p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-none leading-relaxed">
                      Kerjakan pada kertas double folio bergaris dengan tulisan tangan rapi beserta langkah pengerjaan lengkap. Scan dan unggah dalam format PDF maksimal 10MB.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">🔗 Tempat Kumpul:</span>
                    <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-[11px] rounded-none border border-zinc-200 dark:border-zinc-700">
                      E-Learning Undiksha
                    </span>
                  </div>
                </div>

                {/* Footer Tautan */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">Yuk cicil dari sekarang! 💪</span>
                  <Link
                    href="/jadwal-tugas-ilkom-b"
                    target="_blank"
                    className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                  >
                    <span>Cek Kalender Jadwal</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            </div>

            {/* Pesan 2: Pengingat H-3 Otomatis */}
            <div className="flex flex-col items-start gap-1 max-w-xl">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-none bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 uppercase">
                  💡 Automated Cron Reminder (H-3 pada 12:00 WITA)
                </span>
                <span className="text-[10px] text-zinc-400">12:00 WITA</span>
              </div>

              <div className="p-4 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 space-y-2.5 shadow-none w-full">
                <p className="font-bold text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Clock size={14} />
                  <span>⚠️ *PENGINGAT PROGRES TUGAS (H-3)* 📌</span>
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Halo rekan-rekan *Ilkom B*! Tenggat pengumpulan tugas tinggal <strong>3 hari lagi</strong>:
                </p>

                <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-none text-xs space-y-1">
                  <p><strong>📚 Mata Kuliah:</strong> Kalkulus Lanjut</p>
                  <p><strong>📝 Tugas:</strong> Problem Set 4 - Integral Lipat Dua</p>
                  <p className="text-rose-600 dark:text-rose-400 font-bold">
                    <strong>⏰ Tenggat:</strong> Sabtu, 31 Oktober 2026 (23:59 WITA)
                  </p>
                  <p><strong>🔗 Link Pengumpulan:</strong> E-Learning Undiksha</p>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">Mulai dibuat yuk biar santai! ✌️</span>
                  <Link
                    href="/jadwal-tugas-ilkom-b"
                    target="_blank"
                    className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                  >
                    <span>Buka Jadwal</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}

        {/* =================================================================== */}
        {/* SKENARIO 2: DM ADMIN (VOICE NOTE & WORKFLOW ACC) */}
        {/* =================================================================== */}
        {activeScenario === "scenario_voicenote" && (
          <>
            {/* 3-Chat Limit Guard Notice */}
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] flex items-center gap-2 rounded-none">
              <ShieldCheck size={16} className="shrink-0 text-emerald-600" />
              <span>
                <strong>Jalur Khusus DM:</strong> Hanya Admin 1 dan Admin 2 (Korti & Wakil Korti) yang memiliki hak akses VN di jalur pesan pribadi demi menjaga batas 3-chat limit Instance A.
              </span>
            </div>

            {/* Pesan 1 (User / Korti): Voice Note */}
            <div className="flex flex-col items-end gap-1 w-full">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] text-zinc-400">10:14 WITA • Korti (Admin 1)</span>
              </div>

              <div
                className="relative group p-3.5 rounded-none border border-lime-400 dark:border-lime-700 bg-lime-100 dark:bg-lime-950/40 text-zinc-900 dark:text-zinc-100 shadow-none max-w-sm sm:max-w-md w-full"
                onMouseEnter={() => setShowTranscriptTooltip(true)}
                onMouseLeave={() => setShowTranscriptTooltip(false)}
              >
                {/* Voice Note Player Header */}
                <div className="flex items-center gap-3">
                  {/* Play / Pause Button */}
                  <button
                    type="button"
                    onClick={toggleAudioPlayback}
                    className="size-10 rounded-none bg-primary text-white flex items-center justify-center shrink-0 cursor-pointer hover:opacity-90 shadow-none transition-transform"
                    title={isPlayingAudio ? "Jeda Audio" : "Putar Rekaman Suara"}
                  >
                    {isPlayingAudio ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                  </button>

                  {/* Waveform Visualization Bars */}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-0.5 h-6">
                      {[
                        30, 60, 40, 80, 50, 90, 70, 30, 45, 85, 100, 65, 40, 75, 55, 95, 80, 50, 35, 60, 40, 70, 90, 50, 30, 65, 45, 80, 60, 35
                      ].map((height, i) => {
                        const isPlayed = (i / 30) * 100 <= audioProgress;
                        return (
                          <span
                            key={i}
                            className={`w-1 rounded-none transition-all duration-150 ${
                              isPlayed
                                ? "bg-primary"
                                : "bg-lime-600/40 dark:bg-lime-400/40"
                            } ${isPlayingAudio ? "animate-pulse" : ""}`}
                            style={{ height: `${height}%` }}
                          />
                        );
                      })}
                    </div>

                    {/* Progress Bar & Timer */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-600 dark:text-zinc-400 font-mono">
                      <span>{isPlayingAudio ? audioDisplayTime : "0:22"}</span>
                      <div className="flex items-center gap-1">
                        <span>Pesan Suara</span>
                        <CheckCheck size={13} className="text-primary inline" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hover / Active Audio Transcript Tooltip */}
                {showTranscriptTooltip && (
                  <div className="mt-2.5 p-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-none text-[11px] text-zinc-800 dark:text-zinc-200 shadow-none space-y-1 animate-in fade-in duration-150">
                    <p className="font-bold text-primary flex items-center gap-1 text-[10px] uppercase tracking-wider">
                      <Volume2 size={12} />
                      <span>Transkrip Suara (Multimodal AI)</span>
                    </p>
                    <p className="italic leading-snug">
                      &quot;Halo bot, tolong catat tugas Matematika Teknik, judulnya Latihan 15, dikumpul Senin 26 Oktober jam 5 sore di e-learning ya.&quot;
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Pesan 2 (Bot AI): Draf Pratinjau Menunggu Persetujuan */}
            <div className="flex flex-col items-start gap-1 max-w-xl">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-none bg-primary/10 text-primary border border-primary/20 uppercase">
                  💡 AI Multimodal Extraction & Draft Generation
                </span>
                <span className="text-[10px] text-zinc-400">10:14 WITA</span>
              </div>

              <div className="p-4 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 space-y-2.5 shadow-none w-full">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                    📋 *Draf Tugas Kuliah (Menunggu Persetujuan)*
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Bot telah mengekstrak detail tugas dari rekaman suara Anda:
                  </p>
                </div>

                <div className="space-y-1 text-xs">
                  <p><strong>📚 Mata Kuliah:</strong> Matematika Teknik</p>
                  <p><strong>📝 Tugas:</strong> Latihan 15</p>
                  <p className="text-amber-600 dark:text-amber-400 font-bold">
                    <strong>⏰ Tenggat:</strong> Senin, 26 Oktober 2026 (17:00 WITA)
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    <strong>📌 Ketentuan:</strong> Selesaikan latihan 15 sesuai arahan dosen pengampu.
                  </p>
                  <p><strong>🔗 Pengumpulan:</strong> E-Learning Undiksha</p>
                </div>

                <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-none text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">⚡ Langkah Selanjutnya:</p>
                  <p>
                    Ketik <code className="px-1 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-primary font-bold">!tugas acc</code> untuk menyetujui & menerbitkan tugas ini ke grup siaran.
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    Atau balas dengan koreksi (contoh: <em>&quot;ganti deadline besok jam 8 malam&quot;</em>) atau ketik <code>batal</code>.
                  </p>
                </div>
              </div>
            </div>

            {/* Pesan 3 (User / Korti): ACC Command */}
            <div className="flex flex-col items-end gap-1 w-full">
              <div className="p-2.5 rounded-none border border-lime-400 dark:border-lime-700 bg-lime-100 dark:bg-lime-950/40 text-zinc-900 dark:text-zinc-100 shadow-none font-mono text-xs flex items-center gap-2">
                <span>!tugas acc</span>
                <CheckCheck size={13} className="text-primary inline" />
              </div>
              <span className="text-[10px] text-zinc-400">10:15 WITA</span>
            </div>

            {/* Pesan 4 (Bot AI): Konfirmasi ACC Sukses */}
            <div className="flex flex-col items-start gap-1 max-w-xl">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-none bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 uppercase">
                  💡 Human-in-the-loop Guard & Atomic Save
                </span>
                <span className="text-[10px] text-zinc-400">10:15 WITA</span>
              </div>

              <div className="p-4 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 space-y-2 shadow-none w-full">
                <p className="font-bold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>✅ *Tugas Berhasil Disetujui & Diterbitkan!*</span>
                </p>
                <p className="text-xs text-zinc-700 dark:text-zinc-300">
                  Tugas <strong>Matematika Teknik - Latihan 15</strong> telah tersimpan di kalender kelas dan otomatis disiarkan ke Grup Pengumuman Komunitas!
                </p>
                <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">Tenggat: Senin, 26 Okt 2026 (17:00 WITA)</span>
                  <Link
                    href="/jadwal-tugas-ilkom-b"
                    target="_blank"
                    className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                  >
                    <span>Buka Jadwal Publik</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}

        {/* =================================================================== */}
        {/* SKENARIO 3: GRUP DISKUSI KELAS */}
        {/* =================================================================== */}
        {activeScenario === "scenario_group" && (
          <>
            {/* Group info banner */}
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-[11px] flex items-center gap-2 rounded-none">
              <MessageSquare size={14} className="shrink-0 text-primary" />
              <span>
                <strong>Grup Diskusi Kelas:</strong> Di grup ini, seluruh anggota kelas dapat berinteraksi, dan Admin 1, 2, serta Super Admin diizinkan mengirimkan Voice Note tugas.
              </span>
            </div>

            {/* Pesan 1 (Mahasiswa A) */}
            <div className="flex flex-col items-start gap-1 max-w-md">
              <div className="p-3 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs shadow-none space-y-1">
                <span className="text-[10px] font-bold text-indigo-500 block">
                  Budi Santoso (+62 812-3456-xxxx)
                </span>
                <p>
                  Guys, ada tugas yang tenggatnya mepet minggu ini gak ya? Takut ada yang kelupaan ngerjain nih 🙏
                </p>
                <span className="text-[10px] text-zinc-400 text-right block">14:20</span>
              </div>
            </div>

            {/* Pesan 2 (User / Korti mengetik command !tugas mepet) */}
            <div className="flex flex-col items-end gap-1 w-full">
              <div className="p-2.5 rounded-none border border-lime-400 dark:border-lime-700 bg-lime-100 dark:bg-lime-950/40 text-zinc-900 dark:text-zinc-100 shadow-none font-mono text-xs flex items-center gap-2">
                <span>!tugas mepet</span>
                <CheckCheck size={13} className="text-primary inline" />
              </div>
              <span className="text-[10px] text-zinc-400">14:21 WITA</span>
            </div>

            {/* Pesan 3 (Bot AI menjawab instan) */}
            <div className="flex flex-col items-start gap-1 max-w-xl">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-none bg-primary/10 text-primary border border-primary/20 uppercase">
                  💡 Fast Query Dual Identifier (&lt;100ms)
                </span>
                <span className="text-[10px] text-zinc-400">14:21 WITA</span>
              </div>

              <div className="p-4 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 space-y-3 shadow-none w-full">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <p className="font-bold text-xs text-rose-600 dark:text-rose-400">
                    ⏰ *DAFTAR TUGAS KULIAH TENGGAT MEPET* (≤ 3 Hari)
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Halo rekan-rekan *Ilkom B*! Berikut tugas yang mendekati batas waktu:
                  </p>
                </div>

                {/* List Tugas Mepet */}
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-none space-y-1">
                    <p className="font-bold text-rose-700 dark:text-rose-400">
                      1. 🔴 *Matematika Teknik* - Latihan 15
                    </p>
                    <p className="text-[11px] text-zinc-700 dark:text-zinc-300">
                      🗓️ Senin, 26 Oktober 2026 (17:00 WITA)
                    </p>
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      ⏳ Sisa waktu: 1 hari lagi (Mendesak!)
                    </p>
                    <p className="text-[10px] text-zinc-500">🔗 LMS: E-Learning Undiksha</p>
                  </div>

                  <div className="p-2.5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-none space-y-1">
                    <p className="font-bold text-amber-700 dark:text-amber-400">
                      2. 🟠 *Basis Data* - Perancangan ERD Rumah Sakit
                    </p>
                    <p className="text-[11px] text-zinc-700 dark:text-zinc-300">
                      🗓️ Rabu, 28 Oktober 2026 (23:59 WITA)
                    </p>
                    <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      ⏳ Sisa waktu: 3 hari lagi
                    </p>
                    <p className="text-[10px] text-zinc-500">🔗 LMS: Google Classroom</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">Gunakan <code>!tugas detail [nomor]</code> untuk detail</span>
                  <Link
                    href="/jadwal-tugas-ilkom-b"
                    target="_blank"
                    className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                  >
                    <span>Cek Kalender Lengkap</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── 4. QUICK ACTION CHIPS ────────────────────────────────────────────── */}
      <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto rounded-none shadow-none text-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 shrink-0">
          Uji Coba Cepat:
        </span>

        {activeScenario === "scenario_broadcast" && (
          <>
            <button
              type="button"
              onClick={() => setActiveScenario("scenario_voicenote")}
              className="px-2.5 py-1 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-primary text-[11px] font-medium shrink-0 cursor-pointer shadow-none transition-colors"
            >
              🎙️ Coba Voice Note & ACC
            </button>
            <button
              type="button"
              onClick={() => setActiveScenario("scenario_group")}
              className="px-2.5 py-1 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-primary text-[11px] font-medium shrink-0 cursor-pointer shadow-none transition-colors"
            >
              👥 Coba Perintah Grup
            </button>
          </>
        )}

        {activeScenario === "scenario_voicenote" && (
          <>
            <button
              type="button"
              onClick={toggleAudioPlayback}
              className="px-2.5 py-1 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-primary text-[11px] font-medium shrink-0 cursor-pointer shadow-none transition-colors flex items-center gap-1"
            >
              <Volume2 size={12} className="text-primary" />
              <span>{isPlayingAudio ? "Jeda Voice Note" : "Putar Voice Note (0:22)"}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowTranscriptTooltip(!showTranscriptTooltip)}
              className="px-2.5 py-1 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-primary text-[11px] font-medium shrink-0 cursor-pointer shadow-none transition-colors"
            >
              👁️ {showTranscriptTooltip ? "Sembunyikan Transkrip" : "Tampilkan Transkrip"}
            </button>
          </>
        )}

        {activeScenario === "scenario_group" && (
          <>
            <button
              type="button"
              onClick={() => setCustomInputValue("!tugas mepet")}
              className="px-2.5 py-1 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-primary text-[11px] font-medium shrink-0 cursor-pointer shadow-none transition-colors"
            >
              ⚡ !tugas mepet
            </button>
            <button
              type="button"
              onClick={() => setCustomInputValue("!tugas aktif")}
              className="px-2.5 py-1 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-primary text-[11px] font-medium shrink-0 cursor-pointer shadow-none transition-colors"
            >
              📋 !tugas aktif
            </button>
            <button
              type="button"
              onClick={() => setCustomInputValue("!jadwal")}
              className="px-2.5 py-1 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-primary text-[11px] font-medium shrink-0 cursor-pointer shadow-none transition-colors"
            >
              📅 !jadwal
            </button>
          </>
        )}
      </div>

      {/* ── 5. BOTTOM INPUT BAR (SIMULATED WHATSAPP INPUT) ───────────────────── */}
      <div className="bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-2.5 flex items-center gap-2 rounded-none shadow-none">
        <button
          type="button"
          className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-none cursor-pointer"
          title="Emotikon"
        >
          <Smile size={18} />
        </button>
        <button
          type="button"
          className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-none cursor-pointer"
          title="Lampiran Dokumen/Media"
        >
          <Paperclip size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            placeholder={
              activeScenario === "scenario_voicenote"
                ? "Ketik '!tugas acc' atau pesan koreksi..."
                : "Ketik pesan atau perintah bot..."
            }
            value={customInputValue}
            onChange={(e) => setCustomInputValue(e.target.value)}
            className="w-full px-3 py-2 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs outline-none focus:border-primary shadow-none"
          />
        </div>

        {customInputValue.trim() ? (
          <button
            type="button"
            onClick={() => setCustomInputValue("")}
            className="p-2 bg-primary text-white rounded-none cursor-pointer hover:opacity-90 shadow-none"
            title="Kirim Pesan"
          >
            <Send size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleAudioPlayback}
            className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-none cursor-pointer"
            title="Kirim Pesan Suara"
          >
            <Mic size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
