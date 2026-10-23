"use client";

import { Eye, Pencil, UserCheck, UserX } from "lucide-react";
import { MemberStatusBadge } from "@/components/members/member-status-badge";
import { WorkspaceBadge } from "@/components/workspace/workspace-badge";
import type { UserProfile } from "@/types";

type MemberCardProps = {
  member: UserProfile;
  eventRole?: string;
  onView: (member: UserProfile) => void;
  onEdit: (member: UserProfile) => void;
  onToggleStatus: (member: UserProfile) => void;
};

export function getDivisionRoleLabel(role?: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "koordinator_divisi":
      return "Koordinator Divisi";
    case "koordinator_acara":
      return "Koordinator Acara";
    default:
      return "Anggota";
  }
}

export function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatDate(value: unknown): string {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format((value as { toDate: () => Date }).toDate());
}

export function MemberCard({
  member,
  eventRole,
  onView,
  onEdit,
  onToggleStatus,
}: MemberCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-none transition-all hover:border-zinc-400 dark:hover:border-zinc-700 gap-4">
      <div>
        {/* Top: Avatar & Name & Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {member.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.avatar_url}
                alt={member.name || "User"}
                className="size-11 rounded-none border border-zinc-200 dark:border-zinc-700 object-cover shrink-0"
              />
            ) : (
              <div className="size-11 rounded-none border border-zinc-200 dark:border-zinc-700 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-sm shrink-0">
                {getInitials(member.name)}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm leading-snug truncate">
                {member.name || "-"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                {member.email || "-"}
              </p>
            </div>
          </div>
          <MemberStatusBadge isActive={member.is_active} />
        </div>

        {/* Dual-Role Badges & Workspace */}
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-none bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 shadow-none">
            {getDivisionRoleLabel(member.role)}
          </span>
          {eventRole && (
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-none bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 shadow-none">
              {eventRole}
            </span>
          )}
          <WorkspaceBadge
            campusId={member.campus_id || member.univ_id}
            orgId={member.org_id || member.organization_id}
          />
        </div>

        {/* Member Details */}
        <dl className="mt-3 space-y-2 text-xs border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Divisi</dt>
            <dd className="font-semibold text-zinc-900 dark:text-zinc-100 text-right truncate">
              {member.division_id || "Humas & Media Kreatif"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">WhatsApp</dt>
            <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
              {member.whatsapp_number || "-"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Bergabung</dt>
            <dd className="font-medium text-zinc-700 dark:text-zinc-300">
              {formatDate(member.created_at)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onView(member)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-none bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold shadow-none transition-all border border-indigo-700 dark:border-indigo-500 cursor-pointer"
        >
          <Eye className="size-3.5 text-white/90" />
          <span>Detail</span>
        </button>

        <button
          type="button"
          onClick={() => onEdit(member)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-none bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-zinc-950 text-xs font-semibold shadow-none transition-all border border-amber-600 dark:border-amber-400 cursor-pointer"
        >
          <Pencil className="size-3.5 text-zinc-950/80" />
          <span>Edit</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleStatus(member)}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-none text-xs font-semibold shadow-none transition-all cursor-pointer ${
            member.is_active
              ? "bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white border border-rose-700 dark:border-rose-500"
              : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white border border-emerald-700 dark:border-emerald-500"
          }`}
        >
          {member.is_active ? (
            <>
              <UserX className="size-3.5 text-white/90" />
              <span>Nonaktif</span>
            </>
          ) : (
            <>
              <UserCheck className="size-3.5 text-white/90" />
              <span>Aktifkan</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
