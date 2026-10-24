import type { UserRole } from "@/types";

export const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  KOORDINATOR_DIVISI: "koordinator_divisi",
  KOORDINATOR_ACARA: "koordinator_acara",
  ANGGOTA: "anggota",
  KORTI: "korti",
} as const satisfies Record<string, UserRole>;

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  koordinator_divisi: "Koordinator Divisi",
  koordinator_acara: "Koordinator Acara",
  anggota: "Anggota",
  korti: "Korti (Koordinator Tingkat)",
};

export const USER_ROLE_OPTIONS: Array<{
  value: UserRole;
  label: string;
}> = [
  {
    value: "super_admin",
    label: USER_ROLE_LABELS.super_admin,
  },
  {
    value: "korti",
    label: USER_ROLE_LABELS.korti,
  },
  {
    value: "koordinator_divisi",
    label: USER_ROLE_LABELS.koordinator_divisi,
  },
  {
    value: "koordinator_acara",
    label: USER_ROLE_LABELS.koordinator_acara,
  },
  {
    value: "anggota",
    label: USER_ROLE_LABELS.anggota,
  },
];
