import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/server/firebase-admin";
import { canManageTask, canReadTask } from "@/lib/permissions";
import type { Task, UserProfile, UserRole } from "@/types";

export type ServerAuthContext = {
  uid: string;
  role: UserRole;
  org_id: string;
  univ_id: string;
  profile: UserProfile;
  claims: {
    role?: UserRole;
    org_id?: string;
    univ_id?: string;
    division_id?: string;
  };
};

export async function setUserCustomClaims(
  uid: string,
  claims: {
    role: UserRole;
    org_id?: string;
    univ_id?: string;
    division_id?: string;
  },
) {
  await getAdminAuth().setCustomUserClaims(uid, {
    role: claims.role,
    org_id: claims.org_id || "",
    univ_id: claims.univ_id || "",
    division_id: claims.division_id || "",
  });
}

export async function syncUserClaims(uid: string) {
  const userSnapshot = await getAdminDb().collection("users").doc(uid).get();
  if (!userSnapshot.exists) {
    throw new Error("Profil user tidak ditemukan.");
  }

  const data = userSnapshot.data() as UserProfile;
  const role = (data.role || "anggota") as UserRole;
  const org_id = data.org_id || data.orgId || data.organization_id || "main_org";
  const univ_id = data.univ_id || data.univId || data.campus_id || data.campusId || "";
  const division_id = data.division_id || "";

  await setUserCustomClaims(uid, {
    role,
    org_id,
    univ_id,
    division_id,
  });

  return { role, org_id, univ_id, division_id };
}

export async function getServerAuthContext(request: NextRequest): Promise<ServerAuthContext> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    throw new Error("Token login tidak ditemukan.");
  }

  const decodedToken = await getAdminAuth().verifyIdToken(token);
  const uid = decodedToken.uid;

  // Custom Claims sebagai sumber peran terverifikasi
  let role = decodedToken.role as UserRole | undefined;
  let org_id = (decodedToken.org_id || decodedToken.organization_id) as string | undefined;
  let univ_id = (decodedToken.univ_id || decodedToken.campus_id) as string | undefined;
  let division_id = decodedToken.division_id as string | undefined;

  const userSnapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .get();

  if (!userSnapshot.exists) {
    throw new Error("Profil user tidak ditemukan.");
  }

  const profile = {
    id: userSnapshot.id,
    ...userSnapshot.data(),
  } as UserProfile;

  if (!profile.is_active) {
    throw new Error("Akun Anda dinonaktifkan.");
  }

  // Jika token belum memiliki custom claims (user lama atau sebelum klaim terpasang), sinkronkan otomatis
  if (!role) {
    role = profile.role || "anggota";
    org_id = profile.org_id || profile.orgId || profile.organization_id || "main_org";
    univ_id = profile.univ_id || profile.univId || profile.campus_id || profile.campusId || "";
    division_id = profile.division_id || "";

    try {
      await setUserCustomClaims(uid, {
        role,
        org_id,
        univ_id,
        division_id,
      });
    } catch (e) {
      console.warn("Gagal auto-set custom claims:", e);
    }
  } else {
    // Pastikan profile.role yang dipakai server konsisten dengan verified custom claims
    profile.role = role;
  }

  return {
    uid,
    role: role || profile.role || "anggota",
    org_id: org_id || profile.org_id || profile.organization_id || "main_org",
    univ_id: univ_id || profile.univ_id || profile.campus_id || "",
    profile,
    claims: {
      role,
      org_id,
      univ_id,
      division_id,
    },
  };
}

export async function canUploadTaskResult(profile: UserProfile, task: Task) {
  if (task.pic_id === profile.id) {
    return true;
  }
  let eventRole: string | undefined = undefined;
  if (task.type === "acara" && task.event_id) {
    const memberDoc = await getAdminDb()
      .collection("events")
      .doc(task.event_id)
      .collection("event_members")
      .doc(profile.id)
      .get();
    if (memberDoc.exists) {
      eventRole = memberDoc.data()?.role_in_event;
    }
  }
  return canManageTask(profile, task, eventRole);
}

export function canTriggerTaskNotification(profile: UserProfile, task: Task) {
  return canReadTask(profile, task);
}

export class AuthRoleError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = "AuthRoleError";
    this.statusCode = statusCode;
  }
}

/**
 * Memastikan permintaan berasal dari user dengan peran super_admin terverifikasi.
 */
export async function requireAdminAuth(request: NextRequest): Promise<ServerAuthContext> {
  const authContext = await getServerAuthContext(request);
  if (authContext.role !== "super_admin") {
    throw new AuthRoleError("Akses ditolak. Tindakan ini memerlukan peran Super Admin.", 403);
  }
  return authContext;
}

/**
 * Memastikan permintaan berasal dari koordinator (super_admin, koordinator_divisi, koordinator_acara).
 */
export async function requireCoordinatorAuth(
  request: NextRequest,
  allowedRoles: UserRole[] = ["super_admin", "koordinator_divisi", "koordinator_acara"],
): Promise<ServerAuthContext> {
  const authContext = await getServerAuthContext(request);
  if (!allowedRoles.includes(authContext.role)) {
    throw new AuthRoleError(
      "Akses ditolak. Tindakan administratif memerlukan hak koordinator atau admin.",
      403,
    );
  }
  return authContext;
}

/**
 * Middleware wrapper untuk API Route Next.js yang membatasi eksekusi hanya untuk peran tertentu.
 */
export function withRoleMiddleware(
  allowedRoles: UserRole[],
  handler: (request: NextRequest, context: ServerAuthContext) => Promise<NextResponse>,
) {
  return async (request: NextRequest) => {
    try {
      const authContext = await getServerAuthContext(request);
      if (!allowedRoles.includes(authContext.role)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Akses ditolak. Peran Anda tidak memiliki izin untuk aksi administratif ini.",
          },
          { status: 403 },
        );
      }
      return await handler(request, authContext);
    } catch (error) {
      if (error instanceof AuthRoleError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
      }
      const message = error instanceof Error ? error.message : "Autentikasi gagal.";
      const status = message.includes("Token") ? 401 : 403;
      return NextResponse.json({ ok: false, error: message }, { status });
    }
  };
}
