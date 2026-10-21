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
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-[#e1e2e3] bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#e1e2e3] bg-[#f7f7f8]">
                <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Nama Acara</th>
                <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Ruang Kerja</th>
                <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Tanggal</th>
                <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Koordinator</th>
                <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Status</th>
                <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Progress</th>
                <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Anggota</th>
                <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e1e2e3]">
              {events.map((event) => (
                <tr key={event.id} className="align-middle hover:bg-[#f7f7f8] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#242424] text-xs">{event.name}</p>
                    <p className="mt-0.5 line-clamp-2 max-w-xs text-[11px] text-[#898989]">
                      {event.description || "-"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <WorkspaceBadge
                      campusId={event.campus_id || event.univ_id}
                      orgId={event.org_id || event.organization_id}
                    />
                  </td>
                  <td className="px-4 py-3 text-[#6b7280]">
                    {formatEventDate(event.event_date)}
                  </td>
                  <td className="px-4 py-3 text-[#6b7280]">
                    {usersById.get(event.coordinator_id)?.name ??
                      "Koordinator belum ditentukan"}
                  </td>
                  <td className="px-4 py-3">
                    <EventStatusBadge status={event.status} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#242424]">
                    {event.progress_percentage ?? 0}%
                  </td>
                  <td className="px-4 py-3 text-[#6b7280]">
                    {memberCounts[event.id] ?? 0} orang
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/dashboard/events/${event.id}`}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-[11px] font-semibold transition-all shadow-2xs"
                      >
                        <Eye className="size-3 text-[#898989]" />
                        <span>Detail</span>
                      </Link>
                      {canManageEvent(userProfile, event, userRoles?.[event.id]) && (
                        <button
                          type="button"
                          onClick={() => onEdit(event)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-[11px] font-semibold transition-all shadow-2xs cursor-pointer"
                        >
                          <Pencil className="size-3 text-[#898989]" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="grid gap-3.5 md:hidden">
        {events.map((event) => (
          <div
            key={event.id}
            className="rounded-xl border border-[#e1e2e3] bg-white p-4 shadow-2xs space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-[#242424] text-sm">{event.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-[#898989]">
                  {event.description || "-"}
                </p>
              </div>
              <EventStatusBadge status={event.status} />
            </div>

            <div className="text-xs space-y-1.5 border-t border-[#e1e2e3] pt-2.5">
              <div className="flex justify-between">
                <span className="text-[#898989]">Ruang Kerja:</span>
                <WorkspaceBadge
                  campusId={event.campus_id || event.univ_id}
                  orgId={event.org_id || event.organization_id}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-[#898989]">Tanggal:</span>
                <span className="font-medium text-[#242424]">{formatEventDate(event.event_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#898989]">Koordinator:</span>
                <span className="font-medium text-[#242424]">
                  {usersById.get(event.coordinator_id)?.name ?? "Belum ditentukan"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#898989]">Anggota:</span>
                <span className="font-medium text-[#242424]">{memberCounts[event.id] ?? 0} orang</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#898989]">Progress:</span>
                <span className="font-bold text-[#242424]">{event.progress_percentage ?? 0}%</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#e1e2e3] flex items-center gap-2">
              <Link
                href={`/dashboard/events/${event.id}`}
                className="flex-1 inline-flex items-center justify-center gap-1 h-8 rounded-lg border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-xs font-semibold shadow-2xs"
              >
                <Eye className="size-3.5 text-[#898989]" />
                <span>Detail</span>
              </Link>
              {canManageEvent(userProfile, event, userRoles?.[event.id]) && (
                <button
                  type="button"
                  onClick={() => onEdit(event)}
                  className="flex-1 inline-flex items-center justify-center gap-1 h-8 rounded-lg border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  <Pencil className="size-3.5 text-[#898989]" />
                  <span>Edit</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
