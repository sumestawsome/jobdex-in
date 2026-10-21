"use client";

import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { TaskCalendar } from "@/components/calendar/task-calendar";
import { LoadingState } from "@/components/ui/loading-state";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function CalendarPage() {
  const { userProfile } = useAuth();
  const { activeWorkspace, activeCampus, activeOrmawa } = useWorkspace();

  if (!userProfile) {
    return <LoadingState title="Memuat kalender..." />;
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full pb-16">
      {/* ── Active Workspace Isolation Banner ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[#e1e2e3] bg-white shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#242424] text-white font-bold text-xs shrink-0 shadow-xs">
            {activeWorkspace.campus_code}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#242424] truncate">
                {activeOrmawa.name}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f7f0] border border-[#a3e6cd] px-2 py-0.5 text-[10px] font-semibold text-[#19a874]">
                <span className="size-1.5 rounded-full bg-[#19a874] animate-pulse" />
                Aktif
              </span>
            </div>
            <p className="text-xs text-[#898989] truncate mt-0.5">
              {activeCampus.name} • Memantau deadline dan jadwal rilis tugas
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/workspace"
          className="text-xs font-semibold text-[#242424] hover:underline inline-flex items-center gap-1 shrink-0"
        >
          <span>Ganti Ruang Kerja</span>
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {/* ── Header Section ──────────────────────────────────────────────────── */}
      <header className="pb-2 border-b border-[#e1e2e3]">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#242424]">
          Kalender Deadline & Rilis
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[#898989]">
          Visualisasi sisa waktu dan tingkat risiko tugas berdasarkan tanggal batas akhir (deadline).
        </p>
      </header>

      {/* ── Main Calendar Grid & Detail ─────────────────────────────────────── */}
      <TaskCalendar profile={userProfile} />
    </div>
  );
}
