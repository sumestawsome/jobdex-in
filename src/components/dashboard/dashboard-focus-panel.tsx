"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Loader2,
  CheckCircle2,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import type { FocusItem } from "@/lib/dashboard-data";

type Props = {
  items: FocusItem[];
};

const KIND_CONFIG = {
  overdue: {
    label: "Overdue",
    icon: AlertTriangle,
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
  },
  stuck: {
    label: "Stuck",
    icon: AlertTriangle,
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-600 dark:text-orange-400",
    badge: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300",
  },
  h1: {
    label: "H-1",
    icon: Clock,
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
  },
  approval: {
    label: "Menunggu Approval",
    icon: CheckCircle2,
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-200 dark:border-violet-800",
    text: "text-violet-600 dark:text-violet-400",
    badge: "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300",
  },
  revision: {
    label: "Perlu Revisi",
    icon: RotateCcw,
    bg: "bg-sky-50 dark:bg-sky-950/30",
    border: "border-sky-200 dark:border-sky-800",
    text: "text-sky-600 dark:text-sky-400",
    badge: "bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300",
  },
};

function deadlineLabel(item: FocusItem): string {
  if (item.diffDays === null) return "—";
  if (item.diffDays < 0) return `Overdue ${Math.abs(item.diffDays)}h`;
  if (item.diffDays === 0) return "Hari ini";
  return `H-${item.diffDays}`;
}

export function DashboardFocusPanel({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
        <Loader2 className="size-7 text-slate-300 dark:text-slate-600" />
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Tidak ada item yang perlu perhatian hari ini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const cfg = KIND_CONFIG[item.kind];
        const Icon = cfg.icon;
        return (
          <Link
            key={item.id}
            href={`/dashboard/tasks/${item.taskId}`}
            className="flex items-center gap-3 px-3.5 py-3 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150 group shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          >
            <div className={`flex items-center justify-center rounded-md p-1.5 ${cfg.bg}`}>
              <Icon className={`size-3.5 shrink-0 ${cfg.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-slate-700 dark:group-hover:text-slate-200">
                {item.taskName}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {item.picName} · {item.eventOrDivision}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-none">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                {deadlineLabel(item)}
              </span>
              <ArrowRight className="size-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
