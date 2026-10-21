"use client";

import { Eye, Pencil, UserCheck, UserX } from "lucide-react";
import { MemberStatusBadge } from "@/components/members/member-status-badge";
import { WorkspaceBadge } from "@/components/workspace/workspace-badge";
import type { UserProfile } from "@/types";

type MembersTableProps = {
  members: UserProfile[];
  eventRolesByUser?: Record<string, string>;
  onView: (member: UserProfile) => void;
  onEdit: (member: UserProfile) => void;
  onToggleStatus: (member: UserProfile) => void;
};

function formatDate(value: unknown): string {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format((value as { toDate: () => Date }).toDate());
}

function getDivisionRoleLabel(role?: string): string {
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

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function MembersTable({
  members,
  eventRolesByUser = {},
  onView,
  onEdit,
  onToggleStatus,
}: MembersTableProps) {
  return (
    <>
      {/* ── Desktop Table View ──────────────────────────────────────────────── */}
      <div className="hidden md:block overflow-hidden rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                <th className="px-4 py-3 font-semibold text-zinc-500 uppercase tracking-wider text-[11px]">Nama</th>
                <th className="px-4 py-3 font-semibold text-zinc-500 uppercase tracking-wider text-[11px]">Ruang Kerja</th>
                <th className="px-4 py-3 font-semibold text-zinc-500 uppercase tracking-wider text-[11px]">Email</th>
                <th className="px-4 py-3 font-semibold text-zinc-500 uppercase tracking-wider text-[11px]">WhatsApp</th>
                <th className="px-4 py-3 font-semibold text-zinc-500 uppercase tracking-wider text-[11px]">Peran (Dual Role)</th>
                <th className="px-4 py-3 font-semibold text-zinc-500 uppercase tracking-wider text-[11px]">Divisi</th>
                <th className="px-4 py-3 font-semibold text-zinc-500 uppercase tracking-wider text-[11px]">Status</th>
                <th className="px-4 py-3 font-semibold text-zinc-500 uppercase tracking-wider text-[11px]">Bergabung</th>
                <th className="px-4 py-3 font-semibold text-zinc-500 uppercase tracking-wider text-[11px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {members.map((member) => {
                const eventRole = eventRolesByUser[member.id];

                return (
                  <tr key={member.id} className="align-middle hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      <div className="flex items-center gap-2.5">
                        {member.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={member.avatar_url}
                            alt={member.name || "User"}
                            className="size-7 rounded-none border border-zinc-200 dark:border-zinc-700 object-cover shrink-0"
                          />
                        ) : (
                          <div className="size-7 rounded-none border border-zinc-200 dark:border-zinc-700 bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                            {getInitials(member.name)}
                          </div>
                        )}
                        <span>{member.name || "-"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <WorkspaceBadge
                        campusId={member.campus_id || member.univ_id}
                        orgId={member.org_id || member.organization_id}
                      />
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{member.email || "-"}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {member.whatsapp_number || "-"}
                    </td>

                    {/* Dual-Role Badges Column */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5 items-start">
                        {/* Badge 1 (Divisi Permanen) */}
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-none bg-primary/10 text-primary border border-primary/20 whitespace-nowrap shadow-none">
                          {getDivisionRoleLabel(member.role)}
                        </span>
                        {/* Badge 2 (Kepanitiaan Acara Aktif) */}
                        {eventRole && (
                          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-none bg-secondary/10 text-secondary border border-secondary/20 whitespace-nowrap shadow-none">
                            {eventRole}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {member.division_id || "Humas & Media"}
                    </td>
                    <td className="px-4 py-3">
                      <MemberStatusBadge isActive={member.is_active} />
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {formatDate(member.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onView(member)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-[11px] font-semibold transition-colors shadow-none cursor-pointer"
                        >
                          <Eye className="size-3 text-zinc-500" />
                          <span>Detail</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(member)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-[11px] font-semibold transition-colors shadow-none cursor-pointer"
                        >
                          <Pencil className="size-3 text-zinc-500" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(member)}
                          className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-none border text-[11px] font-semibold transition-colors shadow-none cursor-pointer ${
                            member.is_active
                              ? "border-red-200 dark:border-red-900 bg-white dark:bg-zinc-900 text-danger hover:bg-red-50 dark:hover:bg-red-950/40"
                              : "border-emerald-200 dark:border-emerald-900 bg-white dark:bg-zinc-900 text-success hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          }`}
                        >
                          {member.is_active ? (
                            <>
                              <UserX className="size-3" />
                              <span>Nonaktif</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="size-3" />
                              <span>Aktifkan</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile Card View ─────────────────────────────────────────────────── */}
      <div className="grid gap-3.5 md:hidden">
        {members.map((member) => {
          const eventRole = eventRolesByUser[member.id];

          return (
            <div
              key={member.id}
              className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-none space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {member.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.avatar_url}
                      alt={member.name || "User"}
                      className="size-8 rounded-none border border-zinc-200 dark:border-zinc-700 object-cover shrink-0"
                    />
                  ) : (
                    <div className="size-8 rounded-none border border-zinc-200 dark:border-zinc-700 bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      {getInitials(member.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-xs leading-tight truncate">
                      {member.name || "-"}
                    </h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{member.email || "-"}</p>
                  </div>
                </div>
                <MemberStatusBadge isActive={member.is_active} />
              </div>

              <div className="text-xs space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Ruang Kerja:</span>
                  <WorkspaceBadge
                    campusId={member.campus_id || member.univ_id}
                    orgId={member.org_id || member.organization_id}
                  />
                </div>

                {/* Mobile Dual Role */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-zinc-500 text-xs">Peran:</span>
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-none bg-primary/10 text-primary border border-primary/20 whitespace-nowrap shadow-none">
                      {getDivisionRoleLabel(member.role)}
                    </span>
                    {eventRole && (
                      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-none bg-secondary/10 text-secondary border border-secondary/20 whitespace-nowrap shadow-none">
                        {eventRole}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Divisi:</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{member.division_id || "Humas & Media"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">WhatsApp:</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{member.whatsapp_number || "-"}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onView(member)}
                  className="flex-1 inline-flex items-center justify-center gap-1 h-8 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold shadow-none cursor-pointer transition-colors"
                >
                  <Eye className="size-3 text-zinc-500" />
                  <span>Detail</span>
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(member)}
                  className="flex-1 inline-flex items-center justify-center gap-1 h-8 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold shadow-none cursor-pointer transition-colors"
                >
                  <Pencil className="size-3 text-zinc-500" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleStatus(member)}
                  className={`flex-1 inline-flex items-center justify-center gap-1 h-8 rounded-none border text-xs font-semibold shadow-none cursor-pointer transition-colors ${
                    member.is_active
                      ? "border-red-200 dark:border-red-900 bg-white dark:bg-zinc-900 text-danger hover:bg-red-50 dark:hover:bg-red-950/40"
                      : "border-emerald-200 dark:border-emerald-900 bg-white dark:bg-zinc-900 text-success hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  }`}
                >
                  {member.is_active ? "Nonaktif" : "Aktifkan"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
