"use client";

import {
  CalendarDays,
  ClipboardList,
  AlertCircle,
  CheckCheck,
} from "lucide-react";
import type { SummaryCardData } from "@/lib/dashboard-data";

type Props = {
  data: SummaryCardData;
};

function MiniSparkline({ color }: { color: string }) {
  // Decorative sparkline SVG
  const points = [3, 8, 5, 12, 9, 7, 14, 10, 16, 11, 18].map((y, i) => `${i * 4},${20 - y}`).join(" ");
  return (
    <svg width="52" height="24" viewBox="0 0 44 24" className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashboardSummaryCards({ data }: Props) {
  const cards = [
    {
      label: "Acara Aktif",
      value: data.activeEvents,
      insight: data.activeEvents === 0
        ? "Tidak ada acara berlangsung"
        : `${data.activeEvents} acara sedang berjalan`,
      icon: CalendarDays,
      tag: "Aktif",
      tagClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      iconBg: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200",
      sparkColor: "#64748b",
    },
    {
      label: "Job Desk Aktif",
      value: data.activeJobs,
      insight: data.activeJobs === 0
        ? "Semua tugas selesai"
        : `${data.activeJobs} tugas berjalan`,
      icon: ClipboardList,
      tag: "Progres",
      tagClass: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60",
      iconBg: "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400",
      sparkColor: "#6349ea",
    },
    {
      label: "Butuh Perhatian",
      value: data.needsAttention,
      insight: data.needsAttention === 0
        ? "Semua tugas aman terkendali"
        : `${data.needsAttention} tugas butuh tindakan / overdue`,
      icon: AlertCircle,
      tag: data.needsAttention > 0 ? "Perhatian" : "Aman",
      tagClass: data.needsAttention > 0
        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60"
        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60",
      iconBg: data.needsAttention > 0
        ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
        : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400",
      sparkColor: data.needsAttention > 0 ? "#e94235" : "#19a874",
      valueColor: data.needsAttention > 0 ? "text-rose-600 dark:text-rose-400" : undefined,
    },
    {
      label: "Selesai Minggu Ini",
      value: data.completedThisWeek,
      insight: data.completedThisWeek === 0
        ? "Belum ada yang selesai minggu ini"
        : `${data.completedThisWeek} tugas selesai minggu ini`,
      icon: CheckCheck,
      tag: "Minggu Ini",
      tagClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400",
      sparkColor: "#19a874",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="relative overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150"
          >
            {/* Top row: icon + tag & sparkline */}
            <div className="flex items-center justify-between">
              <div className={`flex items-center justify-center rounded-lg w-8 h-8 sm:w-9 sm:h-9 ${card.iconBg}`}>
                <Icon className="size-4 sm:size-4.5" />
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full ${card.tagClass}`}>
                  {card.tag}
                </span>
                <MiniSparkline color={card.sparkColor} />
              </div>
            </div>

            {/* Value */}
            <div>
              <p className={`text-2xl sm:text-3xl font-bold leading-none tabular-nums tracking-tight ${card.valueColor || "text-slate-900 dark:text-slate-50"}`}>
                {card.value}
              </p>
              <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                {card.label}
              </p>
            </div>

            {/* Insight subtag */}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug border-t border-slate-100 dark:border-slate-800/80 pt-2.5 truncate">
              {card.insight}
            </p>
          </div>
        );
      })}
    </div>
  );
}
