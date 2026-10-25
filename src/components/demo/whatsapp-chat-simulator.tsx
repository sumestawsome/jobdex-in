"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
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
  Megaphone,
  Sparkles,
} from "lucide-react";

export type DemoScenario = "scenario_broadcast" | "scenario_voicenote" | "scenario_group";

interface Props {
  activeScenario: DemoScenario;
  onScenarioChange?: (scenario: DemoScenario) => void;
}

export function WhatsAppChatSimulator({ activeScenario, onScenarioChange }: Props) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [customInputValue, setCustomInputValue] = useState("");
  const [vnHoverPos, setVnHoverPos] = useState<{ x: number; y: number } | null>(null);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset audio playback when scenario changes
  useEffect(() => {
    setIsPlayingAudio(false);
    setAudioProgress(0);
    setVnHoverPos(null);
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
    }
  }, [activeScenario]);

  // Voice Note Play / Pause simulation
  function toggleAudioPlayback() {
    if (isPlayingAudio) {
      setIsPlayingAudio(false);
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    } else {
      setIsPlayingAudio(true);
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

  // Calculate audio seconds display
  const currentSeconds = Math.floor((audioProgress / 100) * 22);
  const audioDisplayTime = `0:${currentSeconds < 10 ? "0" + currentSeconds : currentSeconds}`;

  return (
    <div className="w-full max-w-3xl mx-auto rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-none overflow-hidden flex flex-col font-sans">
      {/* ── 1. HEADER CHAT SIMULATOR (Authentic WhatsApp Web Style) ────────── */}
      <div className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between gap-3 rounded-none shadow-none">
        {/* Profile / Chat Identity */}
        <div className="flex items-center gap-3 min-w-0">
          {activeScenario === "scenario_broadcast" && (
            <div className="size-10 rounded-none bg-emerald-600 text-white flex items-center justify-center shrink-0 border border-emerald-700">
              <Megaphone size={20} />
            </div>
          )}

          {activeScenario === "scenario_voicenote" && (
            <div className="relative shrink-0">
              <div className="size-10 rounded-none bg-primary text-white flex items-center justify-center font-black text-sm tracking-tighter border border-primary">
                J
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 size-3 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-none" />
            </div>
          )}

          {activeScenario === "scenario_group" && (
            <div className="size-10 rounded-none bg-indigo-600 text-white flex items-center justify-center font-bold text-xs tracking-tight shrink-0 border border-indigo-700">
              IK-B
            </div>
          )}

          <div className="min-w-0 leading-tight">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {activeScenario === "scenario_broadcast" && "Coba JobdexIn"}
              {activeScenario === "scenario_voicenote" && "JobDex in AI"}
              {activeScenario === "scenario_group" && "Diskusi Kelas Ilkom B 2024"}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
              {activeScenario === "scenario_broadcast" && "Announcements"}
              {activeScenario === "scenario_voicenote" && "online"}
              {activeScenario === "scenario_group" && "Budi, Darma, Ayu, Korti, Anda, +29 lainnya"}
            </p>
          </div>
        </div>

        {/* Decorative Tools */}
        <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 shrink-0">
          {activeScenario !== "scenario_broadcast" && (
            <>
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
            </>
          )}
          <button
            type="button"
            className="p-2 rounded-none hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors shadow-none cursor-pointer"
            title="Cari"
            aria-label="Cari"
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

      {/* ── 2. CHAT CANVAS & CONVERSATIONS (Authentic Clean WhatsApp Format) ── */}
      <div className="flex-1 min-h-[480px] p-4 sm:p-5 space-y-4 overflow-y-auto bg-zinc-100 dark:bg-zinc-950 relative select-text">
        {/* Date Chip */}
        <div className="flex justify-center my-1">
          <span className="px-2.5 py-1 text-[11px] font-medium rounded-none bg-white/90 dark:bg-zinc-800/90 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 shadow-none uppercase tracking-wider">
            Hari ini
          </span>
        </div>

        {/* =================================================================== */}
        {/* SKENARIO 1: SALURAN PENGUMUMAN KOMUNITAS */}
        {/* =================================================================== */}
        {activeScenario === "scenario_broadcast" && (
          <div className="space-y-4">
            {/* Banner Sambutan Komunitas WhatsApp */}
            <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none text-xs text-zinc-800 dark:text-zinc-200 flex items-start gap-3 shadow-none max-w-lg mx-auto">
              <Megaphone size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                  Welcome to your community!
                </p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Send important admin updates to all your members at once. Members can see announcements here without distractions.
                </p>
              </div>
            </div>

            {/* Pesan 1: Siaran Tugas Baru (Format Resmi dengan Gambar Preview) */}
            <div className="flex flex-col items-start max-w-md sm:max-w-lg">
              <div className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-none overflow-hidden w-full">
                {/* Header Image Preview (Logo Undiksha resmi) */}
                <div className="w-full h-36 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-3 relative">
                  <Image
                    src="https://cdn.undiksha.ac.id/wp-content/uploads/2021/12/27081301/logo-undiksha.png"
                    alt="Logo Undiksha"
                    width={180}
                    height={80}
                    className="max-h-24 w-auto object-contain"
                    unoptimized
                  />
                  <span className="absolute bottom-1 right-2 text-[10px] text-zinc-400 bg-white/80 dark:bg-zinc-900/80 px-1 font-mono">
                    elearning.undiksha.ac.id
                  </span>
                </div>

                {/* Teks Pesan Siaran */}
                <div className="p-3.5 space-y-2 text-xs leading-relaxed">
                  <p>
                    📢 <strong className="font-bold">PENGUMUMAN TUGAS KULIAH</strong> ✨
                  </p>
                  <p>
                    Halo rekan-rekan <strong className="font-bold">Ilmu Komputer Undiksha 2024</strong>!
                  </p>
                  <p>
                    Ada tugas baru nih, jangan lupa dicatat dan dibuat ya Guys! 🙌<br />
                    📚 <strong className="font-bold">Mata Kuliah:</strong> Kalkulus Lanjut<br />
                    📝 <strong className="font-bold">Tugas:</strong> Problem Set 4 - Integral Lipat Dua<br />
                    ⏰ <strong className="font-bold">Tenggat:</strong> Rabu, 28 Oktober 2026 (23:59 WITA)
                  </p>
                  <p>
                    📌 <strong className="font-bold">Ketentuan / Deskripsi:</strong><br />
                    Buat tugas di double folio bergaris dengan tulisan tangan rapi, scan dan kumpulkan dalam format PDF.
                  </p>
                  <p>
                    🔗 <strong className="font-bold">Tempat Pengumpulan / LMS:</strong><br />
                    Drive: <span className="text-primary hover:underline">https://elearning.undiksha.ac.id</span>
                  </p>
                  <p>
                    Yuk cicil dari sekarang biar gak keteteran pas deadline! 🙌<br />
                    👉 Cek kalender & jadwal lengkap:<br />
                    <Link href="/jadwal-tugas-ilkom-b" className="text-primary hover:underline break-all font-mono">
                      https://jobdexin.sumestawsome.xyz/jadwal-tugas-ilkom-b
                    </Link>
                  </p>

                  {/* Jam Pesan Pojok Kanan Bawah */}
                  <div className="flex justify-end pt-1">
                    <span className="text-[10px] text-zinc-400 font-mono">14:42</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pesan 2: Pengingat Progres H-3 (Tugas Lain) */}
            <div className="flex flex-col items-start max-w-md sm:max-w-lg">
              <div className="p-3.5 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-none text-xs space-y-2 w-full leading-relaxed">
                <p>
                  ⚠️ <strong className="font-bold">PENGINGAT PROGRES TUGAS (H-3)</strong> 📌
                </p>
                <p>
                  Halo rekan-rekan <strong className="font-bold">Ilmu Komputer Undiksha 2024</strong>!
                </p>
                <p>
                  Tenggat pengumpulan tugas tinggal 3 hari lagi:<br />
                  📚 <strong className="font-bold">Mata Kuliah:</strong> Grafika Komputer<br />
                  📝 <strong className="font-bold">Tugas:</strong> Transformasi 3D WebGL<br />
                  ⏰ <strong className="font-bold">Tenggat:</strong> Sabtu, 31 Oktober 2026 (23:59 WITA) (3 hari lagi)
                </p>
                <p>
                  🔗 <strong className="font-bold">Tempat Pengumpulan / LMS:</strong><br />
                  E-Learning Undiksha
                </p>
                <p>
                  Yuk mulai dicicil dari sekarang biar santai pas mendekati deadline! 💪<br />
                  👉 Cek kalender & jadwal lengkap:<br />
                  <Link href="/jadwal-tugas-ilkom-b" className="text-primary hover:underline break-all font-mono">
                    https://jobdexin.sumestawsome.xyz/jadwal-tugas-ilkom-b
                  </Link>
                </p>

                {/* Jam Pesan Pojok Kanan Bawah */}
                <div className="flex justify-end pt-1">
                  <span className="text-[10px] text-zinc-400 font-mono">12:00</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SKENARIO 2: JAPRI ADMIN / KORTI (INPUT TUGAS & WORKFLOW ACC) */}
        {/* =================================================================== */}
        {activeScenario === "scenario_voicenote" && (
          <div className="space-y-3.5">
            {/* ── Interaksi 1: Input Lewat Voice Note (VN) ── */}

            {/* Pesan 1 (Korti): Voice Note */}
            <div className="flex flex-col items-end w-full">
              <div
                className="relative p-2.5 sm:p-3 rounded-none border border-lime-400 dark:border-lime-700 bg-lime-100 dark:bg-lime-950/40 text-zinc-900 dark:text-zinc-100 shadow-none max-w-xs sm:max-w-md w-full"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setVnHoverPos({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }}
                onMouseLeave={() => setVnHoverPos(null)}
              >
                {/* Floating Tooltip dekat Kursor saat Hover */}
                {vnHoverPos && (
                  <div
                    className="absolute z-50 pointer-events-none p-2 rounded-none bg-zinc-900 dark:bg-black text-white text-[11px] leading-tight border border-zinc-700 shadow-none max-w-[260px] animate-in fade-in duration-100"
                    style={{
                      left: Math.max(10, Math.min(vnHoverPos.x - 40, 200)),
                      top: Math.max(-65, vnHoverPos.y - 70),
                    }}
                  >
                    Korti cukup rekam suara detail tugas. AI akan otomatis mendengarkan dan merangkum isinya jadi draf.
                  </div>
                )}

                {/* Audio Player Row */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={toggleAudioPlayback}
                    className="size-9 rounded-none bg-emerald-600 text-white flex items-center justify-center shrink-0 cursor-pointer hover:opacity-90 shadow-none"
                    title={isPlayingAudio ? "Jeda" : "Putar"}
                    aria-label="Putar Voice Note"
                  >
                    {isPlayingAudio ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>

                  <div className="flex-1 space-y-1 min-w-0">
                    {/* Waveform graphic */}
                    <div className="flex items-center gap-0.5 h-5">
                      {[
                        30, 60, 40, 80, 50, 90, 70, 30, 45, 85, 100, 65, 40, 75, 55, 95, 80, 50, 35, 60, 40, 70, 90, 50, 30, 65, 45, 80, 60, 35
                      ].map((h, i) => {
                        const isPlayed = (i / 30) * 100 <= audioProgress;
                        return (
                          <span
                            key={i}
                            className={`w-1 rounded-none transition-all duration-150 ${
                              isPlayed ? "bg-emerald-600" : "bg-zinc-400 dark:bg-zinc-600"
                            } ${isPlayingAudio ? "animate-pulse" : ""}`}
                            style={{ height: `${h}%` }}
                          />
                        );
                      })}
                    </div>

                    {/* Duration & Timestamp */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                      <span>{isPlayingAudio ? audioDisplayTime : "0:22"}</span>
                      <div className="flex items-center gap-1">
                        <span>10:14</span>
                        <CheckCheck size={13} className="text-primary inline" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pesan 2 (Bot AI): Draf Menunggu Persetujuan */}
            <div className="flex flex-col items-start max-w-md sm:max-w-lg">
              <div className="p-3.5 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-none text-xs space-y-2.5 w-full leading-relaxed">
                <p>
                  📋 <strong className="font-bold">Draf Tugas Kuliah (Menunggu Persetujuan)</strong>
                </p>
                <p>
                  📚 <strong className="font-bold">Mata Kuliah:</strong> Matematika Teknik<br />
                  📝 <strong className="font-bold">Judul Tugas:</strong> Latihan 15<br />
                  ⏰ <strong className="font-bold">Tenggat:</strong> Senin, 26 Oktober 2026 pukul 17:00 WITA<br />
                  📌 <strong className="font-bold">Ketentuan:</strong> Dikerjakan di double folio, di-upload di e-learning Undiksha.<br />
                  🔗 <strong className="font-bold">Pengumpulan:</strong> E-Learning Undiksha
                </p>
                <p className="text-zinc-400 font-mono">--------------------------------------</p>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300">
                  Periksa draf di atas. Jika data sudah benar:<br />
                  👉 Ketik <strong className="font-bold">!tugas acc</strong> (atau <strong className="font-bold">acc</strong>) untuk mempublikasikan.<br />
                  👉 Ketik <strong className="font-bold">!tugas batal</strong> (atau <strong className="font-bold">batal</strong>) untuk membuang draf.<br />
                  👉 Atau kirim pesan/VN perbaikan jika ada kata yang salah.<br />
                  👉 Cek dashboard: <Link href="/dashboard/tasks" className="text-primary hover:underline font-mono">https://jobdexin.sumestawsome.xyz/dashboard/tasks</Link>
                </p>

                {/* Jam Pesan Pojok Kanan Bawah */}
                <div className="flex justify-end pt-1">
                  <span className="text-[10px] text-zinc-400 font-mono">10:14</span>
                </div>
              </div>
            </div>

            {/* Pesan 3 (Korti): Konfirmasi ACC */}
            <div className="flex flex-col items-end w-full">
              <div className="p-2 sm:px-3 sm:py-2 rounded-none border border-lime-400 dark:border-lime-700 bg-lime-100 dark:bg-lime-950/40 text-zinc-900 dark:text-zinc-100 shadow-none text-xs flex items-center gap-2">
                <span>!tugas acc</span>
                <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono ml-2">
                  <span>10:15</span>
                  <CheckCheck size={13} className="text-primary inline" />
                </div>
              </div>
            </div>

            {/* Pesan 4 (Bot AI): Sukses Terbit */}
            <div className="flex flex-col items-start max-w-md sm:max-w-lg">
              <div className="p-3.5 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-none text-xs space-y-2 w-full leading-relaxed">
                <p>
                  ✅ <strong className="font-bold">Tugas Berhasil Disetujui & Diterbitkan!</strong>
                </p>
                <p>
                  📚 <strong className="font-bold">Mata Kuliah:</strong> Matematika Teknik<br />
                  📝 <strong className="font-bold">Tugas:</strong> Latihan 15<br />
                  ⏰ <strong className="font-bold">Tenggat:</strong> Senin, 26 Oktober 2026 pukul 17:00 WITA
                </p>
                <p>
                  Tugas telah tersimpan di JobDex dan disiarkan ke kelas.<br />
                  👉 Cek dashboard: <Link href="/dashboard/tasks" className="text-primary hover:underline font-mono">https://jobdexin.sumestawsome.xyz/dashboard/tasks</Link>
                </p>

                {/* Jam Pesan Pojok Kanan Bawah */}
                <div className="flex justify-end pt-1">
                  <span className="text-[10px] text-zinc-400 font-mono">10:15</span>
                </div>
              </div>
            </div>

            {/* ── Interaksi 2: Input Cepat Lewat Perintah Teks Langsung ── */}
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
              <p className="text-[11px] text-zinc-400 font-medium italic text-center">
                — Alternatif: Korti juga bisa menambah tugas kilat via pesan teks biasa —
              </p>

              {/* User text command */}
              <div className="flex flex-col items-end w-full">
                <div className="p-2.5 sm:p-3 rounded-none border border-lime-400 dark:border-lime-700 bg-lime-100 dark:bg-lime-950/40 text-zinc-900 dark:text-zinc-100 shadow-none text-xs max-w-md break-words space-y-1">
                  <p className="font-mono text-[11px]">
                    !tugas tambah Pemrograman Web | Bikin REST API Next.js & Push GitHub | Kerjakan berkelompok maks 3 orang | 28/10/2026 23:59 | E-Learning Undiksha
                  </p>
                  <div className="flex justify-end items-center gap-1 text-[10px] text-zinc-500 font-mono">
                    <span>11:20</span>
                    <CheckCheck size={13} className="text-primary inline" />
                  </div>
                </div>
              </div>

              {/* Bot instant confirmation */}
              <div className="flex flex-col items-start max-w-md sm:max-w-lg">
                <div className="p-3.5 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-none text-xs space-y-2 w-full leading-relaxed">
                  <p>
                    ✅ <strong className="font-bold">Tugas Berhasil Ditambahkan!</strong>
                  </p>
                  <p>
                    📚 <strong className="font-bold">Mata Kuliah:</strong> Pemrograman Web<br />
                    📝 <strong className="font-bold">Tugas:</strong> Bikin REST API Next.js & Push GitHub<br />
                    ⏰ <strong className="font-bold">Tenggat:</strong> Rabu, 28 Oktober 2026 (23:59 WITA)<br />
                    📌 <strong className="font-bold">Ketentuan:</strong> Kerjakan berkelompok maks 3 orang<br />
                    🔗 <strong className="font-bold">LMS:</strong> E-Learning Undiksha
                  </p>
                  <p>
                    Tugas telah tersimpan di kalender kelas dan disiarkan.<br />
                    👉 Cek jadwal: <Link href="/jadwal-tugas-ilkom-b" className="text-primary hover:underline font-mono">https://jobdexin.sumestawsome.xyz/jadwal-tugas-ilkom-b</Link>
                  </p>

                  <div className="flex justify-end pt-1">
                    <span className="text-[10px] text-zinc-400 font-mono">11:20</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SKENARIO 3: GRUP DISKUSI KELAS */}
        {/* =================================================================== */}
        {activeScenario === "scenario_group" && (
          <div className="space-y-3">
            {/* Chat 1: Darma */}
            <div className="flex flex-col items-start max-w-xs sm:max-w-md">
              <div className="p-2.5 sm:p-3 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-none text-xs space-y-1 w-full">
                <p className="font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
                  Darma Tanaya
                </p>
                <p>
                  Guys, tugas praktikum kemarin ada instruksi tambahan dari dosen gak ya?
                </p>
                <div className="flex justify-end pt-0.5">
                  <span className="text-[10px] text-zinc-400 font-mono">14:18</span>
                </div>
              </div>
            </div>

            {/* Chat 2: Ayu */}
            <div className="flex flex-col items-start max-w-xs sm:max-w-md">
              <div className="p-2.5 sm:p-3 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-none text-xs space-y-1 w-full">
                <p className="font-bold text-[11px] text-teal-600 dark:text-teal-400">
                  Ayu Saraswati
                </p>
                <p>
                  Kayaknya udah dicatat sama bot deh, coba panggil aja.
                </p>
                <div className="flex justify-end pt-0.5">
                  <span className="text-[10px] text-zinc-400 font-mono">14:19</span>
                </div>
              </div>
            </div>

            {/* Chat 3: Budi Santoso */}
            <div className="flex flex-col items-start max-w-xs sm:max-w-md">
              <div className="p-2.5 sm:p-3 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-none text-xs space-y-1 w-full">
                <p className="font-bold text-[11px] text-amber-600 dark:text-amber-400">
                  Budi Santoso
                </p>
                <p>
                  Guys, ada tugas yang tenggatnya mepet minggu ini gak ya? Takut ada yang kelupaan ngerjain nih.
                </p>
                <div className="flex justify-end pt-0.5">
                  <span className="text-[10px] text-zinc-400 font-mono">14:20</span>
                </div>
              </div>
            </div>

            {/* Chat 4: User memanggil !tugas mepet */}
            <div className="flex flex-col items-end w-full">
              <div className="p-2 sm:px-3 sm:py-2 rounded-none border border-lime-400 dark:border-lime-700 bg-lime-100 dark:bg-lime-950/40 text-zinc-900 dark:text-zinc-100 shadow-none text-xs flex items-center gap-2">
                <span>!tugas mepet</span>
                <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono ml-2">
                  <span>14:21</span>
                  <CheckCheck size={13} className="text-primary inline" />
                </div>
              </div>
            </div>

            {/* Chat 5: Jawaban Bot AI */}
            <div className="flex flex-col items-start max-w-md sm:max-w-lg">
              <div className="p-3.5 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-none text-xs space-y-2.5 w-full leading-relaxed">
                <div className="space-y-1">
                  <p>
                    📋 <strong className="font-bold">DAFTAR TUGAS MEPEK ILKOM B (≤ 3 HARI)</strong> 🚨<br />
                    Total: 3 tugas perlu segera diselesaikan!
                  </p>
                </div>

                <div className="space-y-2">
                  <p>
                    1. <strong className="font-bold">Matematika Teknik</strong><br />
                    📝 <strong className="font-bold">Tugas:</strong> Latihan 15<br />
                    ⏰ <strong className="font-bold">Tenggat:</strong> Besok, 26 Oktober 2026 (17:00 WITA)<br />
                    🔗 <strong className="font-bold">LMS:</strong> E-Learning Undiksha
                  </p>

                  <p>
                    2. <strong className="font-bold">Kalkulus Lanjut</strong><br />
                    📝 <strong className="font-bold">Tugas:</strong> Problem Set 4 - Integral Lipat Dua<br />
                    ⏰ <strong className="font-bold">Tenggat:</strong> Rabu, 28 Oktober 2026 (23:59 WITA) (2 hari lagi)<br />
                    🔗 <strong className="font-bold">LMS:</strong> E-Learning Undiksha
                  </p>

                  <p>
                    3. <strong className="font-bold">Pemrograman Web</strong><br />
                    📝 <strong className="font-bold">Tugas:</strong> Bikin REST API Next.js & Push GitHub<br />
                    ⏰ <strong className="font-bold">Tenggat:</strong> Rabu, 28 Oktober 2026 (23:59 WITA) (2 hari lagi)<br />
                    🔗 <strong className="font-bold">LMS:</strong> GitHub & E-Learning
                  </p>
                </div>

                <p>
                  👉 Cek jadwal & kalender lengkap:<br />
                  <Link href="/jadwal-tugas-ilkom-b" className="text-primary hover:underline font-mono">
                    https://jobdexin.sumestawsome.xyz/jadwal-tugas-ilkom-b
                  </Link>
                </p>

                {/* Jam Pesan Pojok Kanan Bawah */}
                <div className="flex justify-end pt-1">
                  <span className="text-[10px] text-zinc-400 font-mono">14:21</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. BOTTOM INPUT BAR (SIMULASI WHATSAPP INPUT ASLI) ────────────── */}
      <div className="bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-2.5 flex items-center gap-2 rounded-none shadow-none">
        <button
          type="button"
          className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-none cursor-pointer"
          title="Emotikon"
          aria-label="Emotikon"
        >
          <Smile size={18} />
        </button>
        <button
          type="button"
          className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-none cursor-pointer"
          title="Lampiran"
          aria-label="Lampiran"
        >
          <Paperclip size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            placeholder={
              activeScenario === "scenario_voicenote"
                ? "Ketik '!tugas acc' atau pesan koreksi..."
                : "Ketik pesan..."
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
            className="p-2 bg-emerald-600 text-white rounded-none cursor-pointer hover:opacity-90 shadow-none"
            title="Kirim Pesan"
            aria-label="Kirim Pesan"
          >
            <Send size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleAudioPlayback}
            className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-none cursor-pointer"
            title="Kirim Pesan Suara"
            aria-label="Kirim Pesan Suara"
          >
            <Mic size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
