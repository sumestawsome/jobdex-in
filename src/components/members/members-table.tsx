"use client";

import { Eye, Pencil, UserCheck, UserX } from "lucide-react";
import { MemberStatusBadge } from "@/components/members/member-status-badge";
import { WorkspaceBadge } from "@/components/workspace/workspace-badge";
import { getDivisionRoleLabel, getInitials, getRoleBadgeStyle } from "@/components/members/member-card";
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

export function MembersTable({
  members,
  eventRolesByUser = {},
  onView,
  onEdit,
  onToggleStatus,
}: MembersTableProps) {
  return (
    <div className="overflow-hidden rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Nama</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Ruang Kerja</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Email</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">WhatsApp</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Peran (Dual Role)</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Divisi</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Status</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Bergabung</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Aksi</th>
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
                        <div className="size-7 rounded-none border border-zinc-200 dark:border-zinc-700 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-[10px] shrink-0">
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
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-none border whitespace-nowrap shadow-none ${getRoleBadgeStyle(member.role)}`}>
                        {getDivisionRoleLabel(member.role)}
                      </span>
                      {/* Badge 2 (Kepanitiaan Acara Aktif) */}
                      {eventRole && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-none bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 whitespace-nowrap shadow-none">
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
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-none bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[11px] font-semibold transition-all shadow-none border border-indigo-700 dark:border-indigo-500 cursor-pointer"
                      >
                        <Eye className="size-3 text-white/90" />
                        <span>Detail</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(member)}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-none bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-zinc-950 text-[11px] font-semibold transition-all shadow-none border border-amber-600 dark:border-amber-400 cursor-pointer"
                      >
                        <Pencil className="size-3 text-zinc-950/80" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleStatus(member)}
                        className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-none text-[11px] font-semibold transition-all shadow-none cursor-pointer ${
                          member.is_active
                            ? "bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white border border-rose-700 dark:border-rose-500"
                            : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white border border-emerald-700 dark:border-emerald-500"
                        }`}
                      >
                        {member.is_active ? (
                          <>
                            <UserX className="size-3 text-white/90" />
                            <span>Nonaktif</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="size-3 text-white/90" />
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
  );
}
