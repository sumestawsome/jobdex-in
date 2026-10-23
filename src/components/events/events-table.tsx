"use client";

import Link from "next/link";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { WorkspaceBadge } from "@/components/workspace/workspace-badge";
import { Eye, Pencil } from "lucide-react";
import type { Event, UserProfile } from "@/types";
import { formatEventDate } from "@/lib/firebase/events";
import { canManageEvent } from "@/lib/permissions";

type EventsTableProps = {
  events: Event[];
  usersById: Map<string, UserProfile>;
  memberCounts: Record<string, number>;
  userProfile?: UserProfile | null;
  userRoles?: Record<string, string>;
  onEdit: (event: Event) => void;
};

export function EventsTable({
  events,
  usersById,
  memberCounts,
  userProfile,
  userRoles,
  onEdit,
}: EventsTableProps) {
  return (
    <div className="overflow-hidden rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Nama Acara</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Ruang Kerja</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Tanggal</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Koordinator</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Status</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Progress</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Anggota</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {events.map((event) => {
              const progress = Math.min(100, Math.max(0, event.progress_percentage ?? 0));
              return (
                <tr key={event.id} className="align-middle hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">{event.name}</p>
                    <p className="mt-0.5 line-clamp-2 max-w-xs text-[11px] text-zinc-500 dark:text-zinc-400">
                      {event.description || "-"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <WorkspaceBadge
                      campusId={event.campus_id || event.univ_id}
                      orgId={event.org_id || event.organization_id}
                    />
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {formatEventDate(event.event_date)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {usersById.get(event.coordinator_id)?.name ??
                      "Koordinator belum ditentukan"}
                  </td>
                  <td className="px-4 py-3">
                    <EventStatusBadge status={event.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-28 space-y-1">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {progress}%
                      </span>
                      <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-none overflow-hidden border border-zinc-200 dark:border-zinc-700">
                        <div
                          className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-none transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {memberCounts[event.id] ?? 0} orang
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/dashboard/events/${event.id}`}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-none bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[11px] font-semibold transition-all shadow-none border border-indigo-700 dark:border-indigo-500"
                      >
                        <Eye className="size-3 text-white/90" />
                        <span>Detail</span>
                      </Link>
                      {canManageEvent(userProfile, event, userRoles?.[event.id]) && (
                        <button
                          type="button"
                          onClick={() => onEdit(event)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-none bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-zinc-950 text-[11px] font-semibold transition-all shadow-none border border-amber-600 dark:border-amber-400 cursor-pointer"
                        >
                          <Pencil className="size-3 text-zinc-950/80" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
