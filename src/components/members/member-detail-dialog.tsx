"use client";

import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/role-badge";
import { X, Pencil } from "lucide-react";
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
    ["Organization ID", member.organization_id || "-"],
    ["Tanggal Bergabung", formatDate(member.created_at)],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-xs px-4 py-8">
      <div className="w-full max-w-2xl rounded-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-none">
        <div className="border-b border-zinc-200 dark:border-zinc-800 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Detail Anggota
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">{member.email}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="rounded-none shadow-none">
              <X className="h-4 w-4" />
              <span>Tutup</span>
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
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(member);
                }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-none bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-zinc-950 text-xs font-semibold shadow-none transition-all border border-amber-600 dark:border-amber-400 cursor-pointer"
              >
                <Pencil className="size-3 text-zinc-950/80" />
                <span>Rotasi Peran / Edit</span>
              </button>
            )}
          </div>
          <dl className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 py-3 sm:grid-cols-[170px_1fr]"
              >
                <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
                <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
