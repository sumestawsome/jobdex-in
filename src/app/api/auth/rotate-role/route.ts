import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { requireAdminAuth, setUserCustomClaims, AuthRoleError } from "@/lib/server/auth";
import type { UserProfile, UserRole } from "@/types";

const VALID_ROLES: UserRole[] = [
  "super_admin",
  "koordinator_divisi",
  "koordinator_acara",
  "anggota",
];

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAdminAuth(request);
    const body = await request.json().catch(() => ({}));

    const targetUid = body.target_uid as string;
    const newRole = body.new_role as UserRole;
    const divisionId = (body.division_id as string) || "";
    const reason = (body.reason as string) || "Rotasi peran oleh admin";

    if (!targetUid) {
      return NextResponse.json(
        { ok: false, error: "target_uid wajib diisi." },
        { status: 400 },
      );
    }

    if (!newRole || !VALID_ROLES.includes(newRole)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Peran baru tidak valid. Pilihan: ${VALID_ROLES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(targetUid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { ok: false, error: "Pengguna tidak ditemukan." },
        { status: 404 },
      );
    }

    const userData = userSnap.data() as UserProfile;
    const currentRole = userData.role || "anggota";

    // Mencegah super admin mengunci diri sendiri jika tidak ada super admin aktif lain
    if (targetUid === authContext.uid && newRole !== "super_admin") {
      const superAdminsSnap = await db
        .collection("users")
        .where("role", "==", "super_admin")
        .where("is_active", "==", true)
        .get();

      if (superAdminsSnap.size <= 1) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Tidak dapat menurunkan peran Anda sendiri karena Anda adalah satu-satunya Super Admin yang aktif.",
          },
          { status: 400 },
        );
      }
    }

    const targetOrgId =
      userData.org_id || userData.orgId || userData.organization_id || "main_org";
    const targetUnivId =
      userData.univ_id || userData.univId || userData.campus_id || userData.campusId || "";
    const targetDivisionId = divisionId || userData.division_id || "";

    // 1. Perbarui dokumen pengguna di Firestore
    const userUpdatePayload: Record<string, unknown> = {
      role: newRole,
      updated_at: new Date(),
    };
    if (divisionId) {
      userUpdatePayload.division_id = divisionId;
    }
    await userRef.update(userUpdatePayload);

    // 2. Perbarui dokumen relasi ormawa_members jika ada
    if (targetOrgId) {
      const memRef = db.collection("ormawa_members").doc(`${targetUid}_${targetOrgId}`);
      const memSnap = await memRef.get();
      if (memSnap.exists) {
        await memRef.set(
          {
            role: newRole,
            ...(divisionId ? { division_id: divisionId } : {}),
            updated_at: new Date(),
          },
          { merge: true },
        );
      }
    }

    // 3. Pasang Custom Claims baru di Firebase Auth
    await setUserCustomClaims(targetUid, {
      role: newRole,
      org_id: targetOrgId,
      univ_id: targetUnivId,
      division_id: targetDivisionId,
    });

    // 4. Catat riwayat audit rotasi peran
    await db.collection("role_rotation_logs").add({
      target_uid: targetUid,
      target_name: userData.name || "",
      target_email: userData.email || "",
      from_role: currentRole,
      to_role: newRole,
      division_id: targetDivisionId,
      changed_by_uid: authContext.uid,
      changed_by_name: authContext.profile.name || "Super Admin",
      reason,
      created_at: new Date(),
    });

    return NextResponse.json({
      ok: true,
      message: `Peran berhasil dirotasi dari ${currentRole} menjadi ${newRole}.`,
      target_uid: targetUid,
      from_role: currentRole,
      to_role: newRole,
      division_id: targetDivisionId,
    });
  } catch (error) {
    if (error instanceof AuthRoleError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.statusCode },
      );
    }
    const message =
      error instanceof Error ? error.message : "Gagal melakukan rotasi peran.";
    const status = message.includes("Token") ? 401 : 500;
    console.error("[api/auth/rotate-role] Gagal rotasi peran:", error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
