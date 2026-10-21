import { USER_ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/types";

type RoleBadgeProps = {
  role?: UserRole | null;
};

const roleStyleMap: Record<UserRole, string> = {
  super_admin: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  koordinator_divisi: "bg-lime-50 text-lime-800 border-lime-300 dark:bg-lime-950/40 dark:text-lime-300 dark:border-lime-800",
  koordinator_acara: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  anggota: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
};

export function RoleBadge({ role }: RoleBadgeProps) {
  if (!role) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200 shadow-none">
        Profil belum lengkap
      </span>
    );
  }

  const roleStyle = roleStyleMap[role] || "bg-zinc-100 text-zinc-700 border-zinc-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-semibold border shadow-none ${roleStyle}`}>
      {USER_ROLE_LABELS[role]}
    </span>
  );
}
