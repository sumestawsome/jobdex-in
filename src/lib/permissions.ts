import { USER_ROLES } from "@/lib/roles";
import type { Event, Task, UserProfile, UserRole } from "@/types";
import type { ActiveWorkspace, ClassWorkspaceDoc } from "@/types/workspace";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
import { DUMMY_ORMAWAS } from "@/lib/workspace-dummy-data";

export type WorkspaceLike =
  | ActiveWorkspace
  | ClassWorkspaceDoc
  | {
      id?: string;
      org_id?: string;
      type?: string;
      workspace_type?: string;
      org_type?: string;
      authorized_admins?: Record<string, { phone?: string; name?: string; role?: string } | undefined>;
    }
  | Record<string, unknown>
  | string
  | null;

export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  return normalizeWhatsAppNumber(String(phone));
}

function getRole(input: UserProfile | UserRole | null | undefined) {
  if (!input) {
    return null;
  }

  return typeof input === "string" ? input : input.role;
}

export function isSuperAdmin(input: UserProfile | UserRole | null | undefined) {
  return getRole(input) === USER_ROLES.SUPER_ADMIN;
}

export function isKoordinatorDivisi(
  input: UserProfile | UserRole | null | undefined,
) {
  return getRole(input) === USER_ROLES.KOORDINATOR_DIVISI;
}

export function isKoordinatorAcara(
  input: UserProfile | UserRole | null | undefined,
) {
  return getRole(input) === USER_ROLES.KOORDINATOR_ACARA;
}

function getWorkspaceId(workspace?: WorkspaceLike): string {
  if (!workspace) return "";
  if (typeof workspace === "string") return workspace;
  const ws = workspace as unknown as Record<string, unknown>;
  return String(ws.id || ws.org_id || "");
}

function getWorkspaceType(workspace?: WorkspaceLike): string {
  if (!workspace || typeof workspace === "string") return "";
  const ws = workspace as unknown as Record<string, unknown>;
  return String(ws.type || ws.workspace_type || ws.org_type || "").toLowerCase();
}

type AdminContactMap = Record<string, { phone?: string; name?: string; role?: string } | undefined>;

function getAuthorizedAdmins(workspace?: WorkspaceLike): AdminContactMap | undefined {
  if (!workspace || typeof workspace === "string") return undefined;
  const ws = workspace as unknown as Record<string, unknown>;
  return ws.authorized_admins as AdminContactMap | undefined;
}

/**
 * Strict Class Community Admin RBAC validation.
 * Pengguna HANYA dianggap Admin Komunitas Kelas jika:
 * 1. Pengguna adalah `super_admin`, ATAU
 * 2. `user.workspace_roles?.[workspace.id] === 'korti'`, ATAU
 * 3. Nomor WhatsApp pengguna (`user.whatsapp_number` / `user.phone`) terdaftar di `workspace.authorized_admins.admin_1.phone` atau `admin_2.phone`.
 *
 * Jika nomor WhatsApp pengguna tidak cocok (seperti akun Sila), peran aktifnya di ruang kerja tersebut WAJIB dikunci ke `anggota` (read-only).
 */
export function isClassAdmin(
  user: UserProfile | null | undefined,
  workspace?: WorkspaceLike,
): boolean {
  if (!user) return false;

  // 1. Super admin check
  if (
    user.role === "super_admin" ||
    (user as unknown as Record<string, unknown>).is_super_admin === true ||
    (user as unknown as Record<string, unknown>).super_admin === true
  ) {
    return true;
  }

  // Resolve workspace ID & authorized_admins
  const workspaceId = getWorkspaceId(workspace);
  let authorizedAdmins = getAuthorizedAdmins(workspace);

  // Fallback to dummy ormawas if authorized_admins is not provided directly
  if (!authorizedAdmins && workspaceId) {
    const matchedDummy = DUMMY_ORMAWAS.find((o) => o.id === workspaceId);
    if (matchedDummy && (matchedDummy as unknown as Record<string, unknown>).authorized_admins) {
      authorizedAdmins = (matchedDummy as unknown as Record<string, unknown>).authorized_admins as AdminContactMap;
    }
  }

  // Default fallback to ws_ilkom_2024 dummy data if workspace not specified or matches ws_ilkom_2024
  if (!authorizedAdmins && (!workspaceId || workspaceId === "ws_ilkom_2024")) {
    const ilkomDummy = DUMMY_ORMAWAS.find((o) => o.id === "ws_ilkom_2024");
    if (ilkomDummy && (ilkomDummy as unknown as Record<string, unknown>).authorized_admins) {
      authorizedAdmins = (ilkomDummy as unknown as Record<string, unknown>).authorized_admins as AdminContactMap;
    }
  }

  // 2. Check user.workspace_roles?.[workspace.id] === 'korti'
  if (workspaceId && user.workspace_roles) {
    const assignedRole = user.workspace_roles[workspaceId];
    if (assignedRole === "korti" || assignedRole === "admin_komunitas") {
      return true;
    }
  }

  // 3. Check WhatsApp number against authorized_admins (admin_1, admin_2, super_admin)
  const rawUserPhone =
    user.whatsapp_number ||
    (user as unknown as Record<string, unknown>).phone ||
    (user as unknown as Record<string, unknown>).whatsappNumber;
  const userPhone = normalizePhoneNumber(rawUserPhone as string | undefined);

  if (userPhone && authorizedAdmins) {
    const admin1Phone = normalizePhoneNumber(authorizedAdmins.admin_1?.phone);
    const admin2Phone = normalizePhoneNumber(authorizedAdmins.admin_2?.phone);
    const superAdminPhone = normalizePhoneNumber(authorizedAdmins.super_admin?.phone);

    if (
      (admin1Phone && userPhone === admin1Phone) ||
      (admin2Phone && userPhone === admin2Phone) ||
      (superAdminPhone && userPhone === superAdminPhone)
    ) {
      return true;
    }
  }

  return false;
}

export function isKorti(
  input: UserProfile | UserRole | null | undefined,
  workspace?: WorkspaceLike,
) {
  if (!input) return false;
  if (typeof input === "string") {
    return input === "korti" || input === "admin_komunitas" || input === "super_admin";
  }
  return isClassAdmin(input, workspace);
}

export const isAdminKomunitas = isKorti;

export function getEffectiveWorkspaceRole(
  user: UserProfile | null | undefined,
  workspace?: WorkspaceLike,
): string {
  if (!user) return "anggota";
  if (user.role === "super_admin") return "super_admin";

  const wsId = getWorkspaceId(workspace);
  const rawType = getWorkspaceType(workspace);
  const isClass = rawType === "kelas" || wsId === "ws_ilkom_2024" || wsId.startsWith("ws_kelas_");

  if (isClass) {
    return isClassAdmin(user, workspace || wsId) ? "korti" : "anggota";
  }

  if (wsId && user.workspace_roles?.[wsId]) {
    return user.workspace_roles[wsId];
  }

  return user.role || "anggota";
}

export function isKoordinator(
  input: UserProfile | UserRole | null | undefined,
  workspaceId?: string,
) {
  return isSuperAdmin(input) || isKoordinatorDivisi(input) || isKoordinatorAcara(input) || isKorti(input, workspaceId);
}

export function isAnggota(input: UserProfile | UserRole | null | undefined) {
  return getRole(input) === USER_ROLES.ANGGOTA;
}

export function canManageMembers(
  input: UserProfile | UserRole | null | undefined,
) {
  return isSuperAdmin(input) || isKoordinatorDivisi(input);
}

export function canCreateEvent(
  input: UserProfile | UserRole | null | undefined,
) {
  return isKoordinator(input);
}

export function canManageEvent(
  profile: UserProfile | null | undefined,
  event: Event | null | undefined,
  eventRole?: string,
) {
  if (!profile || !event) {
    return false;
  }

  const role = getRole(profile);
  const normalizedRole = eventRole?.toLowerCase().replace(/\s+/g, "_");

  if (role === "super_admin") {
    return true;
  }

  // Event coordinator can manage
  if (normalizedRole === "koordinator_acara" || event.coordinator_id === profile.id) {
    return true;
  }

  // Koordinator divisi can manage unless their event role is anggota_acara or sekretaris_acara
  if (role === "koordinator_divisi") {
    return normalizedRole !== "anggota_acara" && normalizedRole !== "sekretaris_acara";
  }

  return false;
}

export function canCreateTask(
  profile: UserProfile | UserRole | null | undefined,
  eventRole?: string,
  workspaceId?: string,
  workspace?: WorkspaceLike,
) {
  if (!profile) return false;
  const role = getRole(profile);

  if (role === "super_admin") return true;

  const targetWs = workspace || (workspaceId ? { id: workspaceId, org_id: workspaceId } : undefined);
  const targetWsId = workspaceId || getWorkspaceId(workspace);
  const rawType = getWorkspaceType(workspace);

  const isClass =
    targetWsId === "ws_ilkom_2024" ||
    targetWsId.startsWith("ws_kelas_") ||
    rawType === "kelas";

  if (isClass) {
    if (typeof profile === "object") {
      return isClassAdmin(profile, targetWs || targetWsId);
    }
    return role === "korti" || role === "admin_komunitas";
  }

  if (
    typeof profile === "object" &&
    targetWsId &&
    (profile.workspace_roles?.[targetWsId] === "super_admin" ||
      profile.workspace_roles?.[targetWsId] === "koordinator_divisi" ||
      profile.workspace_roles?.[targetWsId] === "koordinator_acara")
  ) {
    return true;
  }

  const normalizedRole = eventRole?.toLowerCase().replace(/\s+/g, "_");
  if (normalizedRole === "koordinator_acara" || normalizedRole === "sekretaris_acara") {
    return true;
  }

  if (role === "koordinator_divisi") {
    return normalizedRole !== "anggota_acara";
  }

  return false;
}

export function canManageTask(
  profile: UserProfile | null | undefined,
  task: Task | null | undefined,
  eventRole?: string,
  workspace?: WorkspaceLike,
) {
  if (!profile || !task) {
    return false;
  }

  const role = getRole(profile);
  const normalizedRole = eventRole?.toLowerCase().replace(/\s+/g, "_");

  if (role === "super_admin") return true;

  if (task.type === ("tugas_kuliah" as Task["type"])) {
    const taskWs = workspace || task.workspace_id || task.org_id || task.organization_id;
    if (isClassAdmin(profile, taskWs)) return true;
    if (task.coordinator_id === profile.id || task.created_by === profile.id) return true;
    return false;
  }

  if (task.type === "acara") {
    if (normalizedRole === "koordinator_acara" || normalizedRole === "sekretaris_acara" || task.coordinator_id === profile.id) {
      return true;
    }
    if (role === "koordinator_divisi") {
      return normalizedRole !== "anggota_acara" && normalizedRole !== "sekretaris_acara";
    }
  } else {
    // Division tasks
    if (role === "koordinator_divisi") return true;
  }

  return false;
}

export function canReadTask(
  profile: UserProfile | null | undefined,
  task: Task | null | undefined,
  eventRole?: string,
) {
  if (!profile || !task) {
    return false;
  }

  return canManageTask(profile, task, eventRole) || task.pic_id === profile.id;
}

export function canApproveTask(
  input: UserProfile | UserRole | null | undefined,
  eventRole?: string,
) {
  if (!input) return false;
  const role = getRole(input);
  const normalizedRole = eventRole?.toLowerCase().replace(/\s+/g, "_");

  if (role === "super_admin") return true;

  if (normalizedRole) {
    if (normalizedRole === "koordinator_acara" || normalizedRole === "sekretaris_acara") return true;
    if (role === "koordinator_divisi") {
      return normalizedRole !== "anggota_acara" && normalizedRole !== "sekretaris_acara";
    }
    return false;
  }

  return isSuperAdmin(input) || isKoordinatorDivisi(input) || isKoordinatorAcara(input);
}

export function canAccessAI(input: UserProfile | UserRole | null | undefined) {
  if (!input) return false;
  const role = typeof input === "string" ? input : input.role;
  return !!role; // All authenticated users with a role can access AI
}

export function canAccessAIFull(input: UserProfile | UserRole | null | undefined) {
  return isKoordinator(input);
}

export function isUserProfileComplete(profile: UserProfile | null | undefined) {
  return Boolean(
    profile?.id &&
      profile.organization_id &&
      profile.name &&
      profile.email &&
      profile.whatsapp_number &&
      profile.role &&
      profile.division_id &&
      typeof profile.is_active === "boolean",
  );
}

export function formatEventRole(role?: string): string {
  if (!role) return "Anggota acara";
  const lower = role.toLowerCase().replace(/\s+/g, "_");
  if (lower === "koordinator_acara" || lower === "koordinator") return "Koordinator acara";
  if (lower === "sekretaris_acara" || lower === "sekretaris") return "Sekretaris acara";
  if (lower === "anggota_acara" || lower === "anggota") return "Anggota acara";
  return role;
}

/**
 * Evaluates whether a user is allowed to access and view a class workspace.
 * If workspace is NOT 'kelas', returns true.
 * If workspace is 'kelas', returns true ONLY IF:
 * 1. User is `super_admin`, OR
 * 2. User is registered in `authorized_admins` of the class, OR
 * 3. User has `workspace_roles[workspace.id]`.
 * Otherwise returns false (e.g. Sila who is only member of Forkom KIP).
 */
export function isClassWorkspacePermitted(
  user: UserProfile | null | undefined,
  workspace?: WorkspaceLike,
): boolean {
  const wsId = getWorkspaceId(workspace);
  const rawType = getWorkspaceType(workspace);
  const isClass = rawType === "kelas" || wsId === "ws_ilkom_2024" || wsId.startsWith("ws_kelas_");

  if (!isClass) {
    return true;
  }

  if (!user) return false;

  // 1. Super admin check
  if (
    user.role === "super_admin" ||
    (user as unknown as Record<string, unknown>).is_super_admin === true ||
    (user as unknown as Record<string, unknown>).super_admin === true
  ) {
    return true;
  }

  // 2. Authorized admins check (phone number)
  const rawUserPhone =
    user.whatsapp_number ||
    (user as unknown as Record<string, unknown>).phone ||
    (user as unknown as Record<string, unknown>).whatsappNumber;
  const userPhone = normalizePhoneNumber(rawUserPhone as string | undefined);

  let authorizedAdmins = getAuthorizedAdmins(workspace);
  if (!authorizedAdmins && wsId) {
    const matchedDummy = DUMMY_ORMAWAS.find((o) => o.id === wsId);
    if (matchedDummy && (matchedDummy as unknown as Record<string, unknown>).authorized_admins) {
      authorizedAdmins = (matchedDummy as unknown as Record<string, unknown>).authorized_admins as AdminContactMap;
    }
  }
  if (!authorizedAdmins && (!wsId || wsId === "ws_ilkom_2024")) {
    const ilkomDummy = DUMMY_ORMAWAS.find((o) => o.id === "ws_ilkom_2024");
    if (ilkomDummy && (ilkomDummy as unknown as Record<string, unknown>).authorized_admins) {
      authorizedAdmins = (ilkomDummy as unknown as Record<string, unknown>).authorized_admins as AdminContactMap;
    }
  }

  if (userPhone && authorizedAdmins) {
    const admin1 = normalizePhoneNumber(authorizedAdmins.admin_1?.phone);
    const admin2 = normalizePhoneNumber(authorizedAdmins.admin_2?.phone);
    const superAdmin = normalizePhoneNumber(authorizedAdmins.super_admin?.phone);

    if (
      (admin1 && userPhone === admin1) ||
      (admin2 && userPhone === admin2) ||
      (superAdmin && userPhone === superAdmin)
    ) {
      return true;
    }
  }

  // 3. User has workspace_roles[workspace.id]
  if (wsId && user.workspace_roles && user.workspace_roles[wsId]) {
    return true;
  }

  return false;
}

