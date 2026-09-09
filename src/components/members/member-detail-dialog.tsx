"use client";

import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/role-badge";
import { X } from "lucide-react";
import { MemberStatusBadge } from "@/components/members/member-status-badge";
import type { UserProfile } from "@/types";

type MemberDetailDialogProps = {
  member: UserProfile | null;
  onClose: () => void;
  onEdit?: (member: UserProfile) => void;
  canEditRole?: boolean;
};

function formatDate(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
  }).format((value as { toDate: () => Date }).toDate());
}

export function MemberDetailDialog({
  member,
  onClose,
  onEdit,
  canEditRole,
}: MemberDetailDialogProps) {
  if (!member) {
    return null;
  }

  const rows = [
    ["Nama", member.name || "-"],
    ["Email", member.email || "-"],
    ["Nomor WhatsApp", member.whatsapp_number || "-"],
    ["Divisi", member.division_id || "-"],
    ["Organization", member.organization_id || "-"],
    ["Tanggal bergabung", formatDate(member.created_at)],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8">
      <div className="w-full max-w-2xl rounded-[8px] bg-white dark:bg-slate-900 shadow-xl">
        <div className="border-b border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">
                Detail anggota
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{member.email}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
              Tutup
            </Button>
          </div>
        </div>
        <div className="p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <RoleBadge role={member.role} />
              <MemberStatusBadge isActive={member.is_active} />
            </div>
            {onEdit && canEditRole && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(member);
                }}
                className="font-bold text-xs"
              >
                Rotasi Peran / Edit
              </Button>
            )}
          </div>
          <dl className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 py-3 sm:grid-cols-[170px_1fr]"
              >
                <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="text-sm font-semibold text-slate-950 dark:text-slate-50">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
