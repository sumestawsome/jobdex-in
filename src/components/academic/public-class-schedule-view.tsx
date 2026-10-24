"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Task } from "@/types";
import { getCalendarGrid, isSameDay } from "@/lib/calendar-utils";
import { getTaskDeadlineDiffDays, getRiskLevelFromTask } from "@/lib/task-risk";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  GraduationCap,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Info,
} from "lucide-react";

type Props = {
  initialTasks: Task[];
};

function formatWitaDateStr(dateVal: unknown): string {
  if (!dateVal) return "-";
  const d =
    typeof dateVal === "object" && dateVal !== null && "toDate" in dateVal
      ? (dateVal as { toDate: () => Date }).toDate()
      : dateVal instanceof Date
      ? dateVal
      : new Date(dateVal as string | number);

  if (isNaN(d.getTime())) return "-";

  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const witaDate = new Date(utc + 3600000 * 8);

  const dayName = days[witaDate.getDay()];
  const dateNum = witaDate.getDate();
  const monthName = months[witaDate.getMonth()];
  const year = witaDate.getFullYear();
  const hours = String(witaDate.getHours()).padStart(2, "0");
  const minutes = String(witaDate.getMinutes()).padStart(2, "0");

  return `${dayName}, ${dateNum} ${monthName} ${year} (${hours}:${minutes} WITA)`;
}

function getTaskDueDate(task: Task): Date | null {
  if (!task.deadline) return null;
  const d =
    typeof task.deadline === "object" && task.deadline !== null && "toDate" in task.deadline
      ? (task.deadline as { toDate: () => Date }).toDate()
      : task.deadline instanceof Date
      ? task.deadline
      : new Date(task.deadline as string);
  return isNaN(d.getTime()) ? null : d;
}

function getRiskDotClass(level: "none" | "yellow" | "orange" | "red"): string {
  switch (level) {
    case "red":
      return "bg-rose-500";
    case "orange":
      return "bg-orange-500";
    case "yellow":
      return "bg-amber-400";
    case "none":
    default:
      return "bg-emerald-500";
  }
}

export function PublicClassScheduleView({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyUrgent, setOnlyUrgent] = useState(false);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const setToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Re-fetch data on demand
  const refreshTasks = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/public/jadwal-tugas-ilkom-b", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.ok && Array.isArray(json.tasks)) {
          setTasks(json.tasks);
        }
      }
    } catch (err) {
      console.warn("Failed to refresh tasks:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Days grid for current view
  const daysGrid = getCalendarGrid(currentYear, currentMonth);

  // Helper to get tasks due on specific day
  const getTasksForDay = (day: Date): Task[] => {
    return tasks.filter((task) => {
      const d = getTaskDueDate(task);
      return d ? isSameDay(d, day) : false;
    });
  };

  // Filter tasks for the list
  const filteredTasks = tasks.filter((task) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const course = (task.course_name || task.subject_name || "").toLowerCase();
      const title = (task.name || task.title || "").toLowerCase();
      const desc = (task.description || "").toLowerCase();
      if (!course.includes(q) && !title.includes(q) && !desc.includes(q)) {
        return false;
      }
    }

    // Urgent filter (<= 3 days)
    if (onlyUrgent) {
      const diff = getTaskDeadlineDiffDays(task);
      if (diff === Number.MAX_SAFE_INTEGER || diff > 3) {
        return false;
      }
    }

    // Selected date filter
    if (selectedDate) {
      const d = getTaskDueDate(task);
      if (!d || !isSameDay(d, selectedDate)) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* ── Top Announcement Bar ── */}
      <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2 text-xs text-zinc-400 text-center flex items-center justify-center gap-2">
        <span className="inline-block size-2 rounded-none bg-emerald-500 animate-pulse" />
        <span>Jadwal Resmi Tugas Kuliah Kelas Ilmu Komputer 2024 (Ilkom B) Undiksha</span>
      </div>

      {/* ── Header Minimalis Sesuai AGENT_RULES.md ── */}
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative size-11 shrink-0 border border-zinc-800 bg-zinc-900 rounded-none flex items-center justify-center overflow-hidden">
              <Image
                src="https://cdn.undiksha.ac.id/wp-content/uploads/2021/12/27081301/logo-undiksha.png"
                alt="Logo Undiksha"
                width={36}
                height={36}
                className="object-contain"
                unoptimized
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono tracking-wider uppercase text-zinc-400">
                  Undiksha • Ilkom B 2024
                </span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-none text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  PUBLIC READ-ONLY
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-zinc-100 tracking-tight leading-tight">
                Jadwal & Tenggat Tugas Ilkom B 2024
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-center">
            <div className="px-3 py-1.5 rounded-none border border-amber-500/30 bg-amber-500/10 text-amber-400 font-mono text-xs font-semibold flex items-center gap-1.5 shadow-none">
              <span className="size-2 rounded-none bg-amber-400" />
              <span>{tasks.length} Tugas Aktif</span>
            </div>
            <button
              type="button"
              onClick={refreshTasks}
              disabled={isRefreshing}
              className="h-9 px-3 rounded-none border border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80 text-zinc-300 hover:text-zinc-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-none disabled:opacity-50"
              title="Segarkan data terbaru"
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-indigo-400" : ""}`} />
              <span className="hidden sm:inline">{isRefreshing ? "Memuat..." : "Segarkan"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* ── Filter & Search Toolbar ── */}
        <div className="border border-zinc-800 bg-zinc-900/40 p-3 sm:p-4 rounded-none shadow-none flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="size-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari mata kuliah, tugas, atau ketentuan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-3 text-xs sm:text-sm bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 rounded-none focus:outline-none focus:border-indigo-500 shadow-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyUrgent(!onlyUrgent)}
              className={`h-10 px-3.5 text-xs font-semibold rounded-none border flex items-center gap-1.5 transition-all shadow-none cursor-pointer ${
                onlyUrgent
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/50"
                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              <Flame className="size-3.5 text-rose-400" />
              <span>Deadline Mepet (≤ 3 Hari)</span>
            </button>

            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="h-10 px-3 text-xs font-semibold rounded-none border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 flex items-center gap-1 transition-colors cursor-pointer shadow-none"
                title="Hapus filter tanggal"
              >
                <span>Reset Tanggal</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Active Date Filter Notice (if selected) ── */}
        {selectedDate && (
          <div className="border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 rounded-none flex items-center justify-between gap-3 text-xs text-indigo-300">
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-4 shrink-0 text-indigo-400" />
              <span>
                Menampilkan tugas untuk tanggal:{" "}
                <strong className="text-zinc-100">
                  {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                </strong>{" "}
                ({filteredTasks.length} tugas ditemukan)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-xs underline font-semibold text-indigo-300 hover:text-white cursor-pointer"
            >
              Tampilkan Semua Tugas
            </button>
          </div>
        )}

        {/* ── Content Grid: Left Calendar + Right Tasks List ── */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* ── Left Column: Aspect-Square Precise Calendar (5 cols) ── */}
          <div className="lg:col-span-5 space-y-4">
            <div className="border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 rounded-none shadow-none space-y-4">
              {/* Calendar Header with Navigation */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="size-4 text-indigo-400" />
                  <h2 className="text-sm sm:text-base font-bold text-zinc-100 tracking-tight">
                    {monthNames[currentMonth]} {currentYear}
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="size-8 rounded-none border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 flex items-center justify-center transition-colors shadow-none cursor-pointer"
                    title="Bulan Sebelumnya"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={setToday}
                    className="h-8 px-2.5 rounded-none border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-none cursor-pointer"
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="size-8 rounded-none border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 flex items-center justify-center transition-colors shadow-none cursor-pointer"
                    title="Bulan Berikutnya"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>

              {/* Day Names Header */}
              <div className="grid grid-cols-7 text-center text-[10px] sm:text-[11px] font-mono uppercase text-zinc-500 tracking-wider">
                <div>Min</div>
                <div>Sen</div>
                <div>Sel</div>
                <div>Rab</div>
                <div>Kam</div>
                <div>Jum</div>
                <div>Sab</div>
              </div>

              {/* 6-Week Precise Aspect-Square Grid */}
              <div className="grid grid-cols-7 gap-1">
                {daysGrid.map((day, idx) => {
                  const isCurrentMonth = day.getMonth() === currentMonth;
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                  const dayTasks = getTasksForDay(day);

                  // Calculate highest urgency dot
                  let maxRisk: "none" | "yellow" | "orange" | "red" = "none";
                  let maxWeight = 0;
                  const weights = { red: 3, orange: 2, yellow: 1, none: 0 };
                  dayTasks.forEach((t) => {
                    const r = getRiskLevelFromTask(t);
                    const w = weights[r] || 0;
                    if (w > maxWeight) {
                      maxWeight = w;
                      maxRisk = r;
                    }
                  });

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedDate(null);
                        } else {
                          setSelectedDate(day);
                        }
                      }}
                      className={`relative aspect-square p-1 rounded-none border text-left flex flex-col justify-between transition-all cursor-pointer shadow-none overflow-hidden ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-500 text-white z-10 font-bold"
                          : isCurrentMonth
                          ? "bg-zinc-950/70 border-zinc-800/80 text-zinc-200 hover:bg-zinc-800/50 hover:border-zinc-700"
                          : "bg-zinc-950/30 border-zinc-900/60 text-zinc-600 hover:bg-zinc-900/40"
                      }`}
                    >
                      <div className="flex justify-between items-start w-full leading-none">
                        <span
                          className={`text-[11px] font-mono ${
                            isToday
                              ? isSelected
                                ? "bg-white text-indigo-600 px-1 py-0.5 font-bold"
                                : "bg-zinc-100 text-zinc-950 px-1 py-0.5 font-bold"
                              : ""
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {dayTasks.length > 0 && (
                          <span
                            className={`size-1.5 rounded-none shrink-0 ${getRiskDotClass(maxRisk)}`}
                            title={`${dayTasks.length} tugas jatuh tempo`}
                          />
                        )}
                      </div>

                      {dayTasks.length > 0 && (
                        <div className="w-full flex justify-end">
                          <span
                            className={`text-[9px] font-mono font-semibold px-1 py-0.2 rounded-none ${
                              isSelected
                                ? "bg-indigo-800 text-white"
                                : "bg-zinc-800 text-zinc-300"
                            }`}
                          >
                            {dayTasks.length}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Calendar Legend */}
              <div className="border-t border-zinc-800 pt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-zinc-400">
                <span className="font-semibold text-zinc-500">Keterangan:</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-none bg-rose-500" />
                  <span>≤ 1 Hari / Lewat</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-none bg-orange-500" />
                  <span>2-3 Hari</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-none bg-amber-400" />
                  <span>4-5 Hari</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-none bg-emerald-500" />
                  <span>{">"} 5 Hari</span>
                </span>
              </div>
            </div>

            {/* WhatsApp Bot Instructions Box */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-4 rounded-none shadow-none space-y-2 text-xs text-zinc-400">
              <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                <Info className="size-4 text-indigo-400" />
                <span>Info WhatsApp Bot Ilkom B:</span>
              </div>
              <p className="leading-relaxed">
                Rekan mahasiswa Ilkom B dapat mengecek tugas langsung di grup kelas atau japri bot:
              </p>
              <div className="font-mono text-[11px] space-y-1 bg-zinc-950 p-2.5 border border-zinc-800/80 text-zinc-300 rounded-none">
                <div>• <code className="text-indigo-400">!tugas list</code> : Daftar semua tugas aktif</div>
                <div>• <code className="text-indigo-400">!tugas mepet</code> : Tugas sisa ≤ 3 hari</div>
                <div>• <code className="text-indigo-400">!tugas menu</code> : Panduan perintah bot</div>
              </div>
            </div>
          </div>

          {/* ── Right Column: Read-Only Task Cards (7 cols) ── */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Daftar Tugas Kuliah</span>
                <span className="text-xs font-mono font-normal text-zinc-400">
                  ({filteredTasks.length} ditampilkan)
                </span>
              </h2>
              {onlyUrgent && (
                <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                  <Flame className="size-3.5" />
                  <span>Mode Mepet Aktif</span>
                </span>
              )}
            </div>

            {filteredTasks.length === 0 ? (
              <div className="border border-zinc-800 bg-zinc-900/40 p-8 text-center rounded-none shadow-none space-y-3">
                <div className="size-12 rounded-none bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-zinc-500">
                  <CheckCircle2 className="size-6 text-emerald-500" />
                </div>
                <h3 className="text-base font-bold text-zinc-200">
                  {selectedDate
                    ? "Tidak ada tugas jatuh tempo pada tanggal ini"
                    : onlyUrgent
                    ? "Aman! Tidak ada tugas dengan deadline mepet (≤ 3 hari)"
                    : "Belum ada tugas kuliah aktif"}
                </h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  {selectedDate || onlyUrgent || searchQuery
                    ? "Coba ubah kata kunci pencarian atau hapus filter tanggal untuk melihat semua tugas."
                    : "Semua tugas kuliah telah selesai atau belum ada tugas baru yang ditambahkan oleh Admin Komunitas."}
                </p>
                {(selectedDate || onlyUrgent || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(null);
                      setOnlyUrgent(false);
                      setSearchQuery("");
                    }}
                    className="h-8 px-4 text-xs font-semibold rounded-none border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors shadow-none cursor-pointer"
                  >
                    Tampilkan Semua Tugas
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTasks.map((task, idx) => {
                  const courseName = task.course_name || task.subject_name || "Mata Kuliah";
                  const taskTitle = task.name || task.title || "Tugas Kuliah";
                  const diffDays = getTaskDeadlineDiffDays(task);
                  const deadlineStr = formatWitaDateStr(task.deadline);
                  const submission = task.submission_url || task.submission_link || "E-Learning Undiksha";
                  const isUrl = /^https?:\/\//i.test(submission.trim());

                  // Urgency badge styling
                  let urgencyBadge = null;
                  if (diffDays < 0) {
                    urgencyBadge = (
                      <span className="px-2 py-0.5 rounded-none text-[11px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                        <AlertTriangle className="size-3" />
                        <span>Lewat Tenggat</span>
                      </span>
                    );
                  } else if (diffDays === 0) {
                    urgencyBadge = (
                      <span className="px-2 py-0.5 rounded-none text-[11px] font-mono font-bold bg-rose-600/20 text-rose-300 border border-rose-600/40 flex items-center gap-1 animate-pulse">
                        <Flame className="size-3" />
                        <span>Tenggat Hari Ini!</span>
                      </span>
                    );
                  } else if (diffDays === 1) {
                    urgencyBadge = (
                      <span className="px-2 py-0.5 rounded-none text-[11px] font-mono font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                        <Flame className="size-3" />
                        <span>Deadline Besok</span>
                      </span>
                    );
                  } else if (diffDays <= 3) {
                    urgencyBadge = (
                      <span className="px-2 py-0.5 rounded-none text-[11px] font-mono font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <Clock className="size-3" />
                        <span>Sisa {diffDays} hari</span>
                      </span>
                    );
                  } else if (diffDays !== Number.MAX_SAFE_INTEGER) {
                    urgencyBadge = (
                      <span className="px-2 py-0.5 rounded-none text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {diffDays} hari lagi
                      </span>
                    );
                  }

                  return (
                    <article
                      key={task.id || idx}
                      className="border border-zinc-800 bg-zinc-900/60 p-5 rounded-none shadow-none space-y-3.5 transition-all hover:border-zinc-700"
                    >
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                        <span className="px-2.5 py-1 rounded-none text-xs font-mono font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
                          {courseName}
                        </span>
                        {urgencyBadge}
                      </div>

                      {/* Title & Instructions */}
                      <div className="space-y-1.5">
                        <h3 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight leading-snug">
                          {taskTitle}
                        </h3>
                        {task.description && (
                          <div className="text-xs sm:text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed bg-zinc-950/60 p-3 border border-zinc-800/60 rounded-none">
                            <span className="text-[11px] font-mono uppercase text-zinc-500 block mb-1">
                              Ketentuan / Deskripsi:
                            </span>
                            {task.description}
                          </div>
                        )}
                      </div>

                      {/* Metadata Row: Deadline & Submission LMS (Purely Read-Only) */}
                      <div className="pt-2 border-t border-zinc-800/80 grid sm:grid-cols-2 gap-3 text-xs">
                        {/* Waktu Tenggat */}
                        <div className="space-y-1">
                          <span className="text-zinc-500 font-mono text-[11px] uppercase block">
                            Waktu Tenggat:
                          </span>
                          <div className="flex items-center gap-1.5 font-mono text-zinc-200">
                            <Clock className="size-3.5 text-zinc-400 shrink-0" />
                            <span>{deadlineStr}</span>
                          </div>
                        </div>

                        {/* Tempat Pengumpulan */}
                        <div className="space-y-1">
                          <span className="text-zinc-500 font-mono text-[11px] uppercase block">
                            Tempat Pengumpulan / LMS:
                          </span>
                          {isUrl ? (
                            <a
                              href={submission.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2 break-all cursor-pointer transition-colors"
                            >
                              <ExternalLink className="size-3.5 shrink-0" />
                              <span>{submission.trim()}</span>
                            </a>
                          ) : (
                            <div className="flex items-center gap-1.5 text-zinc-200">
                              <GraduationCap className="size-3.5 text-zinc-400 shrink-0" />
                              <span className="font-medium">{submission}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer Minimalis ── */}
      <footer className="border-t border-zinc-800 bg-zinc-950 px-4 sm:px-6 py-6 mt-12 text-center text-xs text-zinc-500 space-y-2">
        <p>
          &copy; {new Date().getFullYear()} Ruang Kerja Kelas Ilmu Komputer 2024 (Ilkom B) • Universitas Pendidikan Ganesha
        </p>
        <p className="text-[11px] text-zinc-600">
          Halaman ini bersifat publik dan hanya dapat dibaca (read-only) untuk seluruh mahasiswa. Pembaruan data dikelola oleh Admin Komunitas.
        </p>
      </footer>
    </div>
  );
}
