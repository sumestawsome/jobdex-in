"use client";

import { Eye, Pencil, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/role-badge";
import { MemberStatusBadge } from "@/components/members/member-status-badge";
import { WorkspaceBadge } from "@/components/workspace/workspace-badge";
import type { UserProfile } from "@/types";

type MembersTableProps = {
  members: UserProfile[];
  onView: (member: UserProfile) => void;
  onEdit: (member: UserProfile) => void;
  onToggleStatus: (member: UserProfile) => void;
};

function formatDate(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format((value as { toDate: () => Date }).toDate());
}

export function MembersTable({
  members,
  onView,
  onEdit,
  onToggleStatus,
}: MembersTableProps) {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden jd-neo-table">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Nama</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Ruang Kerja</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Email</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">WhatsApp</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Role</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Divisi</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Bergabung</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => (
                <tr key={member.id} className="align-middle hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-50">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || "User")}&background=e0f2fe&color=0369a1&bold=true&rounded=true`}
                        alt={member.name || "User"}
                        className="size-8 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm shrink-0"
                      />
                      <span>{member.name || "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <WorkspaceBadge
                      campusId={member.campus_id || member.univ_id}
                      orgId={member.org_id || member.organization_id}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{member.email || "-"}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {member.whatsapp_number || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {member.division_id || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <MemberStatusBadge isActive={member.is_active} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {formatDate(member.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="info"
                        onClick={() => onView(member)}
                      >
                        <Eye className="size-3.5" />
                        <span>Detail</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="warning"
                        onClick={() => onEdit(member)}
                      >
                        <Pencil className="size-3.5" />
                        <span>Edit</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={member.is_active ? "destructive" : "success"}
                        onClick={() => onToggleStatus(member)}
                      >
                        {member.is_active ? (
                          <>
                            <UserX className="size-3.5" />
                            <span>Nonaktifkan</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="size-3.5" />
                            <span>Aktifkan</span>
                          </>
                        )}
                      </Button>
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
        {members.map((member) => (
          <div key={member.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3 m-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || "User")}&background=e0f2fe&color=0369a1&bold=true&rounded=true`}
                  alt={member.name || "User"}
                  className="size-10 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm shrink-0"
                />
                <div>
                  <p className="font-semibold text-base text-slate-900 dark:text-white">
                    {member.name || "-"}
                  </p>
                  <p className="text-xs opacity-70 truncate max-w-[180px] font-normal">{member.email || "-"}</p>
                </div>
              </div>
              <MemberStatusBadge isActive={member.is_active} />
            </div>
            
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-2 border-t border-dashed border-neutral-300 dark:border-neutral-700 text-xs">
              <RoleBadge role={member.role} />
              <WorkspaceBadge
                campusId={member.campus_id || member.univ_id}
                orgId={member.org_id || member.organization_id}
              />
              <span className="mx-0.5 opacity-30">|</span>
              <span className="opacity-60">Divisi:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                {member.division_id?.replace(/_/g, " ") || "-"}
              </span>
            </div>
            
            <div className="pt-3 border-t border-dashed border-neutral-300 dark:border-neutral-700 space-y-3">
              <p className="text-xs opacity-80 font-normal">
                WhatsApp: <span className="font-semibold">{member.whatsapp_number || "-"}</span>
              </p>
              
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="info"
                  className="flex-1 min-w-[70px]"
                  onClick={() => onView(member)}
                >
                  <Eye className="size-3.5" />
                  <span>Detail</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="warning"
                  className="flex-1 min-w-[70px]"
                  onClick={() => onEdit(member)}
                >
                  <Pencil className="size-3.5" />
                  <span>Edit</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={member.is_active ? "destructive" : "success"}
                  className="w-full sm:w-auto"
                  onClick={() => onToggleStatus(member)}
                >
                  {member.is_active ? (
                    <>
                      <UserX className="size-3.5" />
                      <span>Nonaktifkan</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="size-3.5" />
                      <span>Aktifkan</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
