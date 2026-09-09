import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { requireCoordinatorAuth, AuthRoleError } from "@/lib/server/auth";
import { isUniqueDivisionInOrmawa, generateSlug } from "@/lib/workspace-schema";
import type { Division } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/divisions/[divisionId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ divisionId: string }> }
) {
  try {
    const { divisionId } = await params;
    const db = getAdminDb();
    const docSnap = await db.collection("divisions").doc(divisionId).get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { ok: false, error: "Divisi tidak ditemukan." },
        { status: 404 }
      );
    }

    const dData = docSnap.data() as Division;
    const division = {
      ...dData,
      id: docSnap.id,
    };

    return NextResponse.json({ ok: true, division });
  } catch (error) {
    console.error("[api/divisions/[divisionId]] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal mengambil data divisi." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/divisions/[divisionId]
 * Memperbarui data divisi pokok
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ divisionId: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    let callerProfile = null;
    if (process.env.NODE_ENV === "production" || authHeader) {
      const authCtx = await requireCoordinatorAuth(request);
      callerProfile = authCtx.profile;
    }

    const { divisionId } = await params;
    const body = await request.json();
    const db = getAdminDb();
    const divRef = db.collection("divisions").doc(divisionId);
    const divSnap = await divRef.get();

    if (!divSnap.exists) {
      return NextResponse.json(
        { ok: false, error: "Divisi tidak ditemukan." },
        { status: 404 }
      );
    }

    const currentData = divSnap.data() as Division;
    const orgId = currentData.organization_id || currentData.org_id || "";

    if (callerProfile && callerProfile.role !== "super_admin") {
      const callerOrg = callerProfile.organization_id || callerProfile.org_id || ((callerProfile as unknown as Record<string, unknown>).orgId as string);
      if (callerOrg && orgId && callerOrg !== orgId) {
        return NextResponse.json(
          { ok: false, error: "Akses ditolak: Anda tidak memiliki izin memodifikasi divisi milik organisasi lain." },
          { status: 403 }
        );
      }
    }

    // Jika nama diubah, pastikan tidak duplikat dengan divisi lain pada ormawa yang sama
    if (body.name && body.name.trim() !== currentData.name) {
      const existingSnap = await db
        .collection("divisions")
        .where("organization_id", "==", orgId)
        .get();

      const existingDivisions: Array<{ id: string; name: string; org_id?: string; organization_id?: string }> = [];
      if (!existingSnap.empty) {
        existingSnap.forEach((doc) => {
          existingDivisions.push({
            id: doc.id,
            name: doc.data().name || "",
            organization_id: doc.data().organization_id,
            org_id: doc.data().org_id,
          });
        });
      }

      if (!isUniqueDivisionInOrmawa(body.name.trim(), orgId, existingDivisions, divisionId)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Divisi dengan nama "${body.name.trim()}" sudah ada di ormawa ini.`,
          },
          { status: 409 }
        );
      }
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (body.name) {
      updatePayload.name = body.name.trim();
      updatePayload.slug = body.slug || generateSlug(body.name.trim());
    }
    if (body.description !== undefined) {
      updatePayload.description = body.description;
    }
    if (body.is_active !== undefined) {
      updatePayload.is_active = Boolean(body.is_active);
    }
    if (body.is_core !== undefined) {
      updatePayload.is_core = Boolean(body.is_core);
    }
    if (body.coordinator_id !== undefined) {
      updatePayload.coordinator_id = body.coordinator_id;
    }

    await divRef.update(updatePayload);

    return NextResponse.json({
      ok: true,
      message: "Divisi pokok berhasil diperbarui.",
      division: {
        ...currentData,
        ...updatePayload,
        id: divisionId,
      },
    });
  } catch (error) {
    if (error instanceof AuthRoleError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Gagal memperbarui divisi.";
    const status = message.includes("Token") ? 401 : 500;
    console.error("[api/divisions/[divisionId]] Gagal memperbarui divisi:", error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

/**
 * DELETE /api/divisions/[divisionId]
 * Menghapus divisi pokok
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ divisionId: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    let callerProfile = null;
    if (process.env.NODE_ENV === "production" || authHeader) {
      const authCtx = await requireCoordinatorAuth(request);
      callerProfile = authCtx.profile;
    }

    const { divisionId } = await params;
    const db = getAdminDb();
    const divRef = db.collection("divisions").doc(divisionId);
    const divSnap = await divRef.get();

    if (!divSnap.exists) {
      return NextResponse.json(
        { ok: false, error: "Divisi tidak ditemukan." },
        { status: 404 }
      );
    }

    const divData = divSnap.data() as Division;
    const divOrg = divData.organization_id || divData.org_id || "";

    if (callerProfile && callerProfile.role !== "super_admin") {
      const callerOrg = callerProfile.organization_id || callerProfile.org_id || ((callerProfile as unknown as Record<string, unknown>).orgId as string);
      if (callerOrg && divOrg && callerOrg !== divOrg) {
        return NextResponse.json(
          { ok: false, error: "Akses ditolak: Anda tidak memiliki izin menghapus divisi milik organisasi lain." },
          { status: 403 }
        );
      }
    }

    // Periksa apakah ada task yang masih terikat dengan divisi ini
    const tasksSnap = await db
      .collection("tasks")
      .where("division_id", "==", divisionId)
      .limit(1)
      .get();

    if (!tasksSnap.empty) {
      // Jika ada task yang terkait, nonaktifkan divisi alih-alih menghapus permanen
      await divRef.update({
        is_active: false,
        updated_at: new Date(),
      });

      return NextResponse.json({
        ok: true,
        message: "Divisi dinonaktifkan karena masih terdapat tugas yang terhubung.",
        deactivated: true,
      });
    }

    await divRef.delete();

    return NextResponse.json({
      ok: true,
      message: "Divisi berhasil dihapus.",
      deleted: true,
    });
  } catch (error) {
    if (error instanceof AuthRoleError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Gagal menghapus divisi.";
    const status = message.includes("Token") ? 401 : 500;
    console.error("[api/divisions/[divisionId]] Gagal menghapus divisi:", error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
