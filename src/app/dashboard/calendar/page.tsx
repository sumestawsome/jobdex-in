"use client";

import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { TaskCalendar } from "@/components/calendar/task-calendar";
import { LoadingState } from "@/components/ui/loading-state";
import { ActiveWorkspaceBanner } from "@/components/workspace/active-workspace-banner";

export default function CalendarPage() {
  const { userProfile } = useAuth();
  const { activeCampus } = useWorkspace();

  if (!userProfile) {
    return <LoadingState title="Memuat kalender..." />;
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full pb-16">
      {/* ── Active Workspace Isolation Banner ────────────────────────────────── */}
      <ActiveWorkspaceBanner
        description={`${activeCampus.name} • Memantau deadline dan jadwal rilis tugas kepanitiaan`}
      />

      {/* ── Header Section ──────────────────────────────────────────────────── */}
      <header className="pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Kalender Deadline & Rilis
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          Visualisasi sisa waktu dan tingkat risiko tugas berdasarkan tanggal batas akhir (deadline).
        </p>
      </header>

      {/* ── Main Calendar Grid & Detail ─────────────────────────────────────── */}
      <TaskCalendar profile={userProfile} />
    </div>
  );
}
