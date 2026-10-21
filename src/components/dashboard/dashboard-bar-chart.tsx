"use client";

import type { EventTaskCount } from "@/lib/dashboard-data";

type Props = {
  data: EventTaskCount[];
};

export function DashboardBarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-slate-400 dark:text-slate-500">
        Belum ada data tugas per acara.
      </div>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-2.5">
      {data.map((ev) => {
        const widthPct = (ev.total / maxTotal) * 100;
        const donePct = ev.total > 0 ? (ev.done / ev.total) * 100 : 0;

        return (
          <div key={ev.eventId} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[60%]"
                title={ev.eventName}
              >
                {ev.eventName}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-none">
                {ev.done}/{ev.total} selesai
              </span>
            </div>
            {/* Track */}
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              {/* Total width bar */}
              <div
                className="h-full rounded-full relative overflow-hidden"
                style={{ width: `${widthPct}%`, backgroundColor: "#e2e8f0" }}
              >
                {/* Done overlay */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 bg-[#242424] dark:bg-white"
                  style={{
                    width: `${donePct}%`,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
