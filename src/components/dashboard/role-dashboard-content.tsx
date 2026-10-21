"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { getDashboardData, type DashboardData } from "@/lib/dashboard-data";
import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  AlertCircle,
  Calendar,
  Clock,
  Activity,
  RefreshCw,
  Download,
  Plus,
  ArrowRight,
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toJsDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (typeof val === "object" && "toDate" in (val as object)) {
    return (val as { toDate: () => Date }).toDate();
  }
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function diffDaysFromToday(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function formatIndonesianDate(): string {
  const now = new Date();
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} • Periode Semester Ganjil 2026/2027`;
}

export function RoleDashboardContent() {
  const { userProfile } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filter queue state: all | stuck | approval | revision
  const [activeQueueFilter, setActiveQueueFilter] = useState<"all" | "stuck" | "approval" | "revision">("all");

  // Mini calendar month offset from current date
  const [calMonthOffset, setCalMonthOffset] = useState(0);

  // Loading indicator for task approval
  const [approvingTaskId, setApprovingTaskId] = useState<string | null>(null);

  // Simple toast feedback
  const [toastText, setToastText] = useState<string | null>(null);

  const showToast = useCallback((text: string) => {
    setToastText(text);
    const timer = setTimeout(() => {
      setToastText(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const loadData = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const result = await getDashboardData(userProfile, undefined, {
        org_id: activeWorkspace.org_id,
        campus_id: activeWorkspace.campus_id,
      });
      setData(result);
    } catch (err) {
      console.error("[Dashboard] Load failed:", err);
      showToast("Gagal memuat data dari Firestore");
    } finally {
      setLoading(false);
    }
  }, [userProfile, activeWorkspace.org_id, activeWorkspace.campus_id, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // ── Approval Handler (Updates Firestore directly) ──────────────────────────
  const handleApproveTask = async (taskId: string, title: string) => {
    try {
      setApprovingTaskId(taskId);
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status: "approved",
        updated_at: serverTimestamp(),
      });
      showToast(`Tugas "${title}" disetujui (Approved)`);
      // Re-fetch to update all metrics and queue synchronously
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("[Dashboard] Gagal menyetujui tugas:", err);
      showToast("Gagal menyimpan perubahan ke Firestore");
    } finally {
      setApprovingTaskId(null);
    }
  };

  const handleRequestRevision = async (taskId: string, title: string) => {
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status: "perlu_revisi",
        updated_at: serverTimestamp(),
      });
      showToast(`Tugas "${title}" ditandai Perlu Revisi`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("[Dashboard] Gagal memperbarui status tugas:", err);
      showToast("Gagal mengubah status tugas");
    }
  };

  // ── Derived Urgent Queue (Live Firestore Tasks) ────────────────────────────
  const urgentTasks = useMemo(() => {
    if (!data?.focusItems || data.focusItems.length === 0) {
      return [];
    }

    return data.focusItems.map((item) => {
      let category: "stuck" | "approval" | "revision" = "stuck";
      let categoryLabel = "Stuck / Butuh Bantuan";
      let actionSecondary: string | null = "Bantu Tim";
      let actionPrimary: string | null = "Review Draft";

      if (item.kind === "approval") {
        category = "approval";
        categoryLabel = "Menunggu Approval";
        actionSecondary = "Minta Revisi";
        actionPrimary = "Setujui Desain";
      } else if (item.kind === "revision") {
        category = "revision";
        categoryLabel = "Perlu Revisi";
        actionSecondary = "Lihat Catatan";
        actionPrimary = null;
      } else if (item.kind === "stuck") {
        category = "stuck";
        categoryLabel = "Stuck / Butuh Bantuan";
        actionSecondary = "Bantu Tim";
        actionPrimary = "Review Draft";
      } else {
        // overdue or h1
        category = "stuck";
        categoryLabel = "Batas Waktu Kritis";
        actionSecondary = "Hubungi PIC";
        actionPrimary = "Cek Progres";
      }

      const initials = (item.picName || "AN")
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

      let deadlineText = "Batas waktu segera";
      let deadlineUrgent = false;

      if (item.diffDays !== null) {
        if (item.diffDays < 0) {
          deadlineText = `Terlewat ${Math.abs(item.diffDays)} hari`;
          deadlineUrgent = true;
        } else if (item.diffDays === 0) {
          deadlineText = "Deadline Hari Ini";
          deadlineUrgent = true;
        } else if (item.diffDays === 1) {
          deadlineText = "Deadline Besok (H-1)";
          deadlineUrgent = true;
        } else {
          deadlineText = `Deadline H-${item.diffDays}`;
          deadlineUrgent = item.diffDays <= 2;
        }
      }

      return {
        id: item.id,
        taskId: item.taskId,
        category,
        categoryLabel,
        eventOrDivision: item.eventOrDivision || "Divisi Humas & Media Kreatif",
        title: item.taskName,
        pic: { initials, name: item.picName },
        deadline: deadlineText,
        deadlineUrgent,
        actionSecondary,
        actionPrimary,
      };
    });
  }, [data]);

  // Filtered queue
  const filteredTasks = useMemo(() => {
    if (activeQueueFilter === "all") return urgentTasks;
    return urgentTasks.filter((t) => t.category === activeQueueFilter);
  }, [urgentTasks, activeQueueFilter]);

  const queueCounts = useMemo(() => {
    return {
      all: urgentTasks.length,
      stuck: urgentTasks.filter((t) => t.category === "stuck").length,
      approval: urgentTasks.filter((t) => t.category === "approval").length,
      revision: urgentTasks.filter((t) => t.category === "revision").length,
    };
  }, [urgentTasks]);

  // ── Derived Events Progress ────────────────────────────────────────────────
  const eventsList = useMemo(() => {
    if (!data?.eventTaskCounts || data.eventTaskCounts.length === 0) {
      return [];
    }
    return data.eventTaskCounts.map((evt) => ({
      name: evt.eventName,
      coordinator: "Koordinator Acara",
      totalTasks: evt.total,
      doneTasks: evt.done,
      ratio: `${evt.done} / ${evt.total} Selesai (${evt.progress}%)`,
      percentage: evt.progress,
    }));
  }, [data]);

  // ── Derived Timeline Feed ──────────────────────────────────────────────────
  const timelineFeed = useMemo(() => {
    if (!data?.recentActivity || data.recentActivity.length === 0) {
      return [];
    }
    return data.recentActivity.map((act) => {
      let dotColorClass = "bg-primary";
      if (act.kind === "approved") dotColorClass = "bg-success";
      else if (act.kind === "stuck") dotColorClass = "bg-danger";
      else if (act.kind === "revision") dotColorClass = "bg-warning";

      const timeDiffMin = Math.max(1, Math.round((Date.now() - act.time.getTime()) / 60000));
      let timeAgo = `${timeDiffMin} menit yang lalu`;
      if (timeDiffMin >= 1440) {
        timeAgo = `${Math.floor(timeDiffMin / 1440)} hari yang lalu`;
      } else if (timeDiffMin >= 60) {
        timeAgo = `${Math.floor(timeDiffMin / 60)} jam yang lalu`;
      }

      return {
        id: act.id,
        dotColorClass,
        actor: "Tim Humas & Media",
        action: act.text,
        timeAgo,
      };
    });
  }, [data]);

  // ── Calendar & Deadlines calculation ───────────────────────────────────────
  const { currentMonthYear, calendarDays, upcomingDeadlines } = useMemo(() => {
    const now = new Date();
    const viewDate = new Date(now.getFullYear(), now.getMonth() + calMonthOffset, 1);
    const viewYear = viewDate.getFullYear();
    const viewMonth = viewDate.getMonth();

    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const monthYearLabel = `${monthNames[viewMonth]} ${viewYear}`;

    // Monday-based day of week: 0 for Monday, ..., 6 for Sunday
    const firstDayOfWeek = (viewDate.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    // Map deadline days in this view month from real tasks
    const deadlineDaySet = new Set<number>();
    const allTasks = data?.allTasks || [];

    allTasks.forEach((t) => {
      const d = toJsDate(t.deadline);
      if (d && d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        deadlineDaySet.add(d.getDate());
      }
    });

    const isCurrentActualMonth =
      now.getFullYear() === viewYear && now.getMonth() === viewMonth;
    const todayDate = now.getDate();

    const days: Array<{
      day: number;
      isCurrentMonth: boolean;
      hasEvent: boolean;
      isToday: boolean;
    }> = [];

    // Prev month trailing days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        hasEvent: false,
        isToday: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        isCurrentMonth: true,
        hasEvent: deadlineDaySet.has(d),
        isToday: isCurrentActualMonth && d === todayDate,
      });
    }

    // Next month leading days to complete grid rows
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        day: d,
        isCurrentMonth: false,
        hasEvent: false,
        isToday: false,
      });
    }

    // Real upcoming deadlines list under calendar (sorted nearest first)
    const upcoming = allTasks
      .filter((t) => t.deadline && t.status !== "approved")
      .map((t) => {
        const d = toJsDate(t.deadline)!;
        const diff = diffDaysFromToday(d);
        let timeLabel = "";
        let isUrgent = false;

        if (diff < 0) {
          timeLabel = `Terlewat ${Math.abs(diff)}h`;
          isUrgent = true;
        } else if (diff === 0) {
          timeLabel = "Hari Ini";
          isUrgent = true;
        } else if (diff === 1) {
          timeLabel = "Besok";
          isUrgent = true;
        } else {
          timeLabel = `${d.getDate()} ${monthNames[d.getMonth()].slice(0, 3)}`;
          isUrgent = diff <= 3;
        }

        const picName = (t.pic_id ? data?.usersMap?.[t.pic_id]?.name : null) || "Tim Humas";
        const meta = `${t.event_id ? "PDK 2026" : "Divisi Humas"} • ${picName}`;

        return {
          id: t.id,
          time: timeLabel,
          isUrgent,
          title: t.name,
          meta,
          diff,
        };
      })
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 4);

    return {
      currentMonthYear: monthYearLabel,
      calendarDays: days,
      upcomingDeadlines: upcoming,
    };
  }, [data, calMonthOffset]);

  // ── Metrics dynamic numbers ────────────────────────────────────────────────
  const activeEventsCount = data?.summary?.activeEvents ?? 0;
  const activeEventNames = data?.summary?.activeEventNames || [];
  const activeJobsCount = data?.summary?.activeJobs ?? 0;
  const activeJobsDivisionCount = data?.summary?.activeJobsDivisionCount ?? 0;
  const activeJobsEventCount = data?.summary?.activeJobsEventCount ?? 0;
  const needsAttentionCount = data?.summary?.needsAttention ?? 0;
  const stuckCount = data?.summary?.stuckCount ?? 0;
  const approvalCount = data?.summary?.approvalCount ?? 0;
  const revisionCount = data?.summary?.revisionCount ?? 0;
  const completedTotalCount = data?.summary?.completedTotal ?? 0;

  // Subtext strings
  const activeEventsSubtext =
    activeEventNames.length > 0 ? activeEventNames.join(", ") : "Tidak ada acara aktif";

  const activeJobsSubtext =
    activeJobsCount > 0
      ? `${activeJobsDivisionCount} tugas divisi, ${activeJobsEventCount} tugas acara`
      : "Tidak ada tugas aktif";

  const needsAttentionSubtext =
    needsAttentionCount > 0
      ? `${stuckCount} butuh bantuan, ${approvalCount} approval, ${revisionCount} revisi`
      : "Semua tugas berjalan lancar";

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full pb-12">
      {/* ── 1. Header & Topbar ───────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Ringkasan Divisi &amp; Progres Job Desk
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {formatIndonesianDate()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Label Statis Divisi Humas & Media Kreatif */}
          <div className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 shadow-none">
            <span className="size-2 rounded-none bg-primary shrink-0" />
            <span>Divisi Humas &amp; Media Kreatif</span>
          </div>

          {/* Tombol Segarkan */}
          <button
            type="button"
            onClick={() => {
              setRefreshKey((k) => k + 1);
              showToast("Data dashboard berhasil dimuat ulang");
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-none transition-colors disabled:opacity-50 active:translate-y-px"
          >
            <RefreshCw className={`size-3.5 text-zinc-600 dark:text-zinc-400 ${loading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>

          {/* Tombol Ekspor PDF */}
          <button
            type="button"
            onClick={() => {
              window.print();
              showToast("Mempersiapkan dokumen cetak...");
            }}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-none transition-colors active:translate-y-px"
          >
            <Download className="size-3.5" />
            <span>Ekspor PDF</span>
          </button>

          {/* Tombol + Buat Job Desk Baru */}
          <Link
            href="/dashboard/tasks"
            className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold rounded-none bg-primary hover:bg-primary-hover text-primary-foreground shadow-none transition-colors active:translate-y-px"
          >
            <Plus className="size-3.5" />
            <span>+ Buat Job Desk Baru</span>
          </Link>
        </div>
      </header>

      {/* ── 2. Bar Metrik KPI 4 Kolom ────────────────────────────────────────── */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-none"
        aria-label="Statistik Kunci"
      >
        {/* Kartu 1: Total Acara Aktif */}
        <div className="p-5 border-b sm:border-b-0 sm:border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Total Acara Aktif
            </span>
            <span className="font-semibold text-[10px] px-2 py-0.5 rounded-none bg-indigo-50 dark:bg-indigo-950/40 text-primary border border-indigo-200 dark:border-indigo-900">
              {activeEventsCount} Aktif
            </span>
          </div>
          <div>
            <div className="text-[28px] font-bold tracking-tight text-zinc-900 dark:text-white leading-none">
              {activeEventsCount}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 truncate" title={activeEventsSubtext}>
              {activeEventsSubtext}
            </p>
          </div>
        </div>

        {/* Kartu 2: Total Job Desk Aktif */}
        <div className="p-5 border-b sm:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Total Job Desk Aktif
            </span>
            <span className="font-semibold text-[10px] px-2 py-0.5 rounded-none bg-indigo-50 dark:bg-indigo-950/40 text-primary border border-indigo-200 dark:border-indigo-900">
              {activeJobsCount} Tugas
            </span>
          </div>
          <div>
            <div className="text-[28px] font-bold tracking-tight text-zinc-900 dark:text-white leading-none">
              {activeJobsCount}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 truncate" title={activeJobsSubtext}>
              {activeJobsSubtext}
            </p>
          </div>
        </div>

        {/* Kartu 3: Perlu Tindakan Segera */}
        <div className="p-5 border-b sm:border-b-0 sm:border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Perlu Tindakan Segera
            </span>
            <span className="font-semibold text-[10px] px-2 py-0.5 rounded-none bg-amber-50 dark:bg-amber-950/40 text-warning border border-amber-200 dark:border-amber-900">
              Perhatian
            </span>
          </div>
          <div>
            <div className="text-[28px] font-bold tracking-tight text-danger leading-none">
              {needsAttentionCount}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 truncate" title={needsAttentionSubtext}>
              {needsAttentionSubtext}
            </p>
          </div>
        </div>

        {/* Kartu 4: Selesai */}
        <div className="p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Selesai
            </span>
            <span className="font-semibold text-[10px] px-2 py-0.5 rounded-none bg-emerald-50 dark:bg-emerald-950/40 text-success border border-emerald-200 dark:border-emerald-900">
              +{completedTotalCount} Selesai
            </span>
          </div>
          <div>
            <div className="text-[28px] font-bold tracking-tight text-zinc-900 dark:text-white leading-none">
              {completedTotalCount}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              Total job desk telah disetujui &amp; terarsip
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. Split Grid Konten Utama (1fr vs 380px) ────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] 2xl:grid-cols-[1fr_380px] gap-6 items-start">
        {/* ════ KOLOM KIRI (1fr) ════ */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Panel 1: Antrean Tindakan & Job Desk Mendesak */}
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-none">
            {/* Header Panel */}
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="size-4 text-danger shrink-0" />
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Antrean Tindakan &amp; Job Desk Mendesak
                </h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-none bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                {queueCounts.all} Tugas
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveQueueFilter("all")}
                className={`text-xs font-medium px-3 py-1 rounded-none transition-colors whitespace-nowrap ${
                  activeQueueFilter === "all"
                    ? "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-semibold shadow-none"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Semua ({queueCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setActiveQueueFilter("approval")}
                className={`text-xs font-medium px-3 py-1 rounded-none transition-colors whitespace-nowrap ${
                  activeQueueFilter === "approval"
                    ? "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-semibold shadow-none"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Menunggu Approval ({queueCounts.approval})
              </button>
              <button
                type="button"
                onClick={() => setActiveQueueFilter("stuck")}
                className={`text-xs font-medium px-3 py-1 rounded-none transition-colors whitespace-nowrap ${
                  activeQueueFilter === "stuck"
                    ? "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-semibold shadow-none"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Butuh Bantuan ({queueCounts.stuck})
              </button>
              <button
                type="button"
                onClick={() => setActiveQueueFilter("revision")}
                className={`text-xs font-medium px-3 py-1 rounded-none transition-colors whitespace-nowrap ${
                  activeQueueFilter === "revision"
                    ? "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-semibold shadow-none"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Perlu Revisi ({queueCounts.revision})
              </button>
            </div>

            {/* List Tugas Mendesak */}
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredTasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  Tidak ada tugas yang memerlukan tindakan pada kategori ini.
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <article
                    key={task.id}
                    className="p-5 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Meta Top: Status Tag + Event Tag */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {task.category === "stuck" && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-none bg-red-50 dark:bg-red-950/40 text-danger border border-red-200 dark:border-red-900">
                            {task.categoryLabel}
                          </span>
                        )}
                        {task.category === "approval" && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-none bg-indigo-50 dark:bg-indigo-950/40 text-primary border border-indigo-200 dark:border-indigo-900">
                            {task.categoryLabel}
                          </span>
                        )}
                        {task.category === "revision" && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-none bg-amber-50 dark:bg-amber-950/40 text-warning border border-amber-200 dark:border-amber-900">
                            {task.categoryLabel}
                          </span>
                        )}
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                          {task.eventOrDivision}
                        </span>
                      </div>

                      {/* Judul Tugas */}
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 leading-snug">
                        {task.title}
                      </h3>

                      {/* Detail PIC & Deadline */}
                      <div className="flex items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="size-5 rounded-none bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-semibold flex items-center justify-center shrink-0">
                            {task.pic.initials}
                          </span>
                          <span>{task.pic.name}</span>
                        </div>
                        <span className="text-zinc-300 dark:text-zinc-600">•</span>
                        <span
                          className={
                            task.deadlineUrgent
                              ? "text-danger font-semibold"
                              : "text-zinc-500 dark:text-zinc-400"
                          }
                        >
                          {task.deadline}
                        </span>
                      </div>
                    </div>

                    {/* Tombol Aksi */}
                    <div className="flex items-center gap-2 shrink-0 sm:self-center">
                      {task.category === "approval" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRequestRevision(task.taskId, task.title)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-none transition-colors active:translate-y-px"
                          >
                            Minta Revisi
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveTask(task.taskId, task.title)}
                            disabled={approvingTaskId === task.taskId}
                            className="px-3 py-1.5 text-xs font-semibold rounded-none bg-primary hover:bg-primary-hover text-primary-foreground shadow-none transition-colors active:translate-y-px disabled:opacity-50 inline-flex items-center gap-1.5"
                          >
                            {approvingTaskId === task.taskId ? (
                              <RefreshCw className="size-3 animate-spin" />
                            ) : (
                              <Check className="size-3" />
                            )}
                            <span>Setujui Desain</span>
                          </button>
                        </>
                      ) : (
                        <>
                          {task.actionSecondary && (
                            <Link
                              href={`/dashboard/tasks/${task.taskId}`}
                              className="px-3 py-1.5 text-xs font-semibold rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-none transition-colors active:translate-y-px inline-block"
                            >
                              {task.actionSecondary}
                            </Link>
                          )}
                          {task.actionPrimary && (
                            <Link
                              href={`/dashboard/tasks/${task.taskId}`}
                              className="px-3 py-1.5 text-xs font-semibold rounded-none bg-primary hover:bg-primary-hover text-primary-foreground shadow-none transition-colors active:translate-y-px inline-block"
                            >
                              {task.actionPrimary}
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          {/* Panel 2: Progres Acara & Pembagian Beban Kerja */}
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-none">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="size-4 text-zinc-900 dark:text-zinc-100 shrink-0" />
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Progres Acara &amp; Pembagian Beban Kerja
                </h2>
              </div>
              <Link
                href="/dashboard/events"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <span>Kelola Acara</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {eventsList.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  Belum ada acara aktif terdaftar.
                </div>
              ) : (
                eventsList.map((evt, i) => (
                  <div
                    key={i}
                    className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                        {evt.name}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {evt.coordinator} • {evt.totalTasks} Job Desk Terdaftar
                      </p>
                    </div>
                    <div className="w-full sm:w-[150px] flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        {evt.ratio}
                      </span>
                      <div className="w-full h-1.5 rounded-none bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-none bg-primary transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(0, evt.percentage))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* ════ KOLOM KANAN (380px) ════ */}
        <div className="flex flex-col gap-6">
          {/* Panel 1: Jadwal Rilis & Publikasi (Mini Calendar) */}
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-none">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-zinc-900 dark:text-zinc-100" />
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Jadwal Rilis &amp; Publikasi
                </h2>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-none bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                {currentMonthYear}
              </span>
            </div>

            {/* Mini Calendar Widget */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                  {currentMonthYear}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCalMonthOffset((v) => v - 1)}
                    className="size-6 inline-flex items-center justify-center rounded-none hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 transition-colors"
                    aria-label="Bulan sebelumnya"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalMonthOffset((v) => v + 1)}
                    className="size-6 inline-flex items-center justify-center rounded-none hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 transition-colors"
                    aria-label="Bulan berikutnya"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Day Labels */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"].map((dayName) => (
                  <div
                    key={dayName}
                    className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 py-1"
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarDays.map((item, idx) => (
                  <div
                    key={idx}
                    className={`
                      relative h-8 flex items-center justify-center text-xs font-medium rounded-none transition-colors
                      ${
                        item.isToday
                          ? "bg-primary text-primary-foreground font-bold shadow-none"
                          : item.isCurrentMonth
                          ? "text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                          : "text-zinc-400 dark:text-zinc-600 cursor-default"
                      }
                    `}
                  >
                    <span>{item.day}</span>
                    {item.hasEvent && (
                      <span
                        className={`absolute bottom-1 size-1 rounded-none ${
                          item.isToday ? "bg-white" : "bg-primary"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Deadlines Snippet */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-3 bg-zinc-50 dark:bg-zinc-950">
              {upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-2">
                  Tidak ada jadwal rilis / deadline terdekat.
                </p>
              ) : (
                upcomingDeadlines.map((up) => (
                  <div key={up.id} className="flex items-start gap-2.5 text-xs">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-none border whitespace-nowrap ${
                        up.isUrgent
                          ? "bg-red-50 dark:bg-red-950/40 text-danger border-red-200 dark:border-red-900"
                          : "bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      {up.time}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {up.title}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {up.meta}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Panel 2: Aktivitas & Log Otomatis */}
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-none">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-zinc-900 dark:text-zinc-100" />
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Aktivitas &amp; Log Otomatis
                </h2>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-none bg-emerald-50 dark:bg-emerald-950/40 text-success border border-emerald-200 dark:border-emerald-900">
                Live
              </span>
            </div>

            {/* Vertical Timeline Feed */}
            <div className="p-5 flex flex-col gap-4">
              {timelineFeed.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-2">
                  Belum ada catatan aktivitas terbaru.
                </p>
              ) : (
                timelineFeed.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 relative">
                    <span className={`size-2 rounded-none mt-1.5 shrink-0 ${item.dotColorClass}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
                        <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{item.actor}</strong> {item.action}
                      </p>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 block">
                        {item.timeAgo}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ── Toast Feedback ───────────────────────────────────────────────────── */}
      {toastText && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-none border border-zinc-700 bg-zinc-900 text-white text-xs font-semibold shadow-none animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="size-4 text-emerald-400" />
          <span>{toastText}</span>
        </div>
      )}
    </div>
  );
}
