"use client";

import Link from "next/link";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { WorkspaceBadge } from "@/components/workspace/workspace-badge";
import { formatEventDate } from "@/lib/firebase/events";
import { canManageEvent } from "@/lib/permissions";
import type { Event, UserProfile } from "@/types";
import { Eye, Pencil } from "lucide-react";

type EventCardProps = {
  event: Event;
  usersById: Map<string, UserProfile>;
  memberCount: number;
  userProfile?: UserProfile | null;
  userRole?: string;
  onEdit: (event: Event) => void;
};

export function EventCard({
  event,
  usersById,
  memberCount,
  userProfile,
  userRole,
  onEdit,
}: EventCardProps) {
  const coordinatorName =
    usersById.get(event.coordinator_id)?.name ?? "Belum ditentukan";
  const progress = Math.min(100, Math.max(0, event.progress_percentage ?? 0));
  const canEdit = canManageEvent(userProfile, event, userRole);

  return (
    <div className="flex flex-col justify-between rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-none transition-all hover:border-zinc-400 dark:hover:border-zinc-700 gap-4">
      <div>
        {/* Badges Bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <EventStatusBadge status={event.status} />
          <WorkspaceBadge
            campusId={event.campus_id || event.univ_id}
            orgId={event.org_id || event.organization_id}
          />
        </div>

        {/* Event Title & Description */}
        <h3 className="mt-3 text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
          {event.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
          {event.description || "Tidak ada deskripsi"}
        </p>

        {/* Event Meta List */}
        <dl className="mt-3 space-y-2 text-xs border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Tanggal</dt>
            <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatEventDate(event.event_date)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Koordinator</dt>
            <dd className="font-semibold text-zinc-900 dark:text-zinc-100 text-right truncate max-w-[180px]">
              {coordinatorName}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Anggota Panitia</dt>
            <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
              {memberCount} orang
            </dd>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-xs">
              <dt className="text-zinc-500 dark:text-zinc-400">Progress Acara</dt>
              <dd className="font-bold text-zinc-900 dark:text-zinc-100">{progress}%</dd>
            </div>
            <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-none overflow-hidden border border-zinc-200 dark:border-zinc-700">
              <div
                className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-none transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </dl>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
        <Link
          href={`/dashboard/events/${event.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-none bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold shadow-none transition-all border border-indigo-700 dark:border-indigo-500"
        >
          <Eye className="size-3.5 text-white/90" />
          <span>Detail</span>
        </Link>
        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit(event)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-none bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-zinc-950 text-xs font-semibold shadow-none transition-all border border-amber-600 dark:border-amber-400 cursor-pointer"
          >
            <Pencil className="size-3.5 text-zinc-950/80" />
            <span>Edit</span>
          </button>
        )}
      </div>
    </div>
  );
}
