"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
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
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden jd-neo-table">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Nama Acara</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Ruang Kerja</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Tanggal</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Koordinator</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Progress</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Anggota</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((event) => (
                <tr key={event.id} className="align-middle hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900 dark:text-white">{event.name}</p>
                    <p className="mt-1 line-clamp-2 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                      {event.description || "-"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <WorkspaceBadge
                      campusId={event.campus_id || event.univ_id}
                      orgId={event.org_id || event.organization_id}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {formatEventDate(event.event_date)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {usersById.get(event.coordinator_id)?.name ??
                      "Koordinator belum ditemukan"}
                  </td>
                  <td className="px-4 py-3">
                    <EventStatusBadge status={event.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {event.progress_percentage ?? 0}%
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {memberCounts[event.id] ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button asChild size="sm" variant="info">
                        <Link href={`/dashboard/events/${event.id}`} className="flex items-center gap-1.5">
                          <Eye className="size-3.5" />
                          <span>Detail</span>
                        </Link>
                      </Button>
                      {canManageEvent(userProfile, event, userRoles?.[event.id]) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="warning"
                          onClick={() => onEdit(event)}
                        >
                          <Pencil className="size-3.5" />
                          <span>Edit</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List View */}
      <div className="block md:hidden space-y-3">
        {events.map((event) => (
          <div key={event.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3 m-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-bold text-base text-slate-900 dark:text-white">
                    {event.name}
                  </p>
                  <WorkspaceBadge
                    campusId={event.campus_id || event.univ_id}
                    orgId={event.org_id || event.organization_id}
                  />
                </div>
                <p className="text-xs opacity-75 mt-0.5 font-semibold">{formatEventDate(event.event_date)}</p>
              </div>
              <EventStatusBadge status={event.status} />
            </div>
            
            {event.description ? (
              <p className="text-xs opacity-70 line-clamp-2 leading-relaxed font-medium">{event.description}</p>
            ) : null}
            
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-2 border-t border-dashed border-neutral-300 dark:border-neutral-700 text-xs">
              <span className="opacity-60">Koordinator:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {usersById.get(event.coordinator_id)?.name ?? "Belum ada"}
              </span>
              <span className="mx-0.5 opacity-30">|</span>
              <span className="opacity-60">Progress:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{event.progress_percentage ?? 0}%</span>
              <span className="mx-0.5 opacity-30">|</span>
              <span className="opacity-60">Anggota:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{memberCounts[event.id] ?? 0}</span>
            </div>
            
            <div className="flex gap-2 pt-3 border-t border-dashed border-neutral-300 dark:border-neutral-700">
              <Button asChild size="sm" variant="info" className="flex-1">
                <Link href={`/dashboard/events/${event.id}`} className="flex items-center justify-center gap-1.5">
                  <Eye className="size-3.5" />
                  <span>Detail</span>
                </Link>
              </Button>
              {canManageEvent(userProfile, event, userRoles?.[event.id]) && (
                <Button
                  type="button"
                  size="sm"
                  variant="warning"
                  className="flex-1"
                  onClick={() => onEdit(event)}
                >
                  <Pencil className="size-3.5" />
                  <span>Edit</span>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
