import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { requireCoordinatorAuth, AuthRoleError } from "@/lib/server/auth";
import {
  validateDivisionInput,
  buildDivisionDoc,
  isUniqueDivisionInOrmawa,
} from "@/lib/workspace-schema";
import type { Division } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/divisions
 * Mengambil daftar divisi pokok berdasarkan org_id dan campus_id
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId =
      searchParams.get("orgId") ||
      searchParams.get("org_id") ||
      searchParams.get("organization_id") ||
      "";
    const campusId =
      searchParams.get("campusId") ||
      searchParams.get("campus_id") ||
      searchParams.get("univ_id") ||
      "";
    const onlyCore = searchParams.get("core") === "true";
    const onlyActive = searchParams.get("active") === "true";
    const search = (searchParams.get("search") || "").toLowerCase().trim();

    const db = getAdminDb();
    let queryRef: FirebaseFirestore.Query = db.collection("divisions");

    if (orgId) {
      queryRef = queryRef.where("organization_id", "==", orgId);
    }

    const snapshot = await queryRef.get();
    let divisions: Division[] = [];

    if (!snapshot.empty) {
      snapshot.forEach((doc) => {
        const d = doc.data() as Division;
        divisions.push({
          ...d,
          id: doc.id,
        });
      });
    }

    if (campusId) {
      divisions = divisions.filter((d) => {
        const dCampus = d.campus_id || d.univ_id || d.campusId || d.univId;
        return !dCampus || dCampus === campusId;
      });
    }

    if (onlyCore) {
      divisions = divisions.filter((d) => d.is_core !== false);
    }

    if (onlyActive) {
      divisions = divisions.filter((d) => d.is_active !== false);
    }

    if (search) {
      divisions = divisions.filter(
        (d) =>
          d.name.toLowerCase().includes(search) ||
          d.description.toLowerCase().includes(search) ||
          d.slug.toLowerCase().includes(search)
      );
    }

    divisions.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      ok: true,
      divisions,
      count: divisions.length,
    });
  } catch (error) {
    console.error("[api/divisions] Gagal mengambil daftar divisi:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal mengambil daftar divisi.", divisions: [] },
      { status: 500 }
    );
  }
}

/**
 * POST /api/divisions
 * Menambahkan divisi pokok baru pada sebuah ormawa
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    let callerProfile = null;
    if (process.env.NODE_ENV === "production" || authHeader) {
      const authCtx = await requireCoordinatorAuth(request);
      callerProfile = authCtx.profile;
    }

    const body = await request.json();
    const validation = validateDivisionInput(body);

    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { ok: false, errors: validation.errors },
        { status: 400 }
      );
    }

    const cleanData = validation.data;

    // Cegah koordinator ormawa lain membuat divisi di ormawa yang bukan haknya
    if (callerProfile && callerProfile.role !== "super_admin") {
      const callerOrg = callerProfile.organization_id || callerProfile.org_id || ((callerProfile as unknown as Record<string, unknown>).orgId as string);
      if (callerOrg && cleanData.org_id && callerOrg !== cleanData.org_id) {
        return NextResponse.json(
          { ok: false, error: "Akses ditolak: Anda hanya dapat menambahkan divisi pada ormawa Anda sendiri." },
          { status: 403 }
        );
      }
    }

    const db = getAdminDb();

    // 1. Ambil daftar divisi yang sudah ada pada ormawa terkait
    const existingSnap = await db
      .collection("divisions")
      .where("organization_id", "==", cleanData.org_id)
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

    // 2. Periksa keunikan nama divisi di dalam ormawa yang sama
    if (!isUniqueDivisionInOrmawa(cleanData.name, cleanData.org_id, existingDivisions)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Divisi dengan nama "${cleanData.name}" sudah terdaftar pada ormawa ini.`,
        },
        { status: 409 }
      );
    }

    const divisionId = `div-${cleanData.slug}-${Date.now().toString(36)}`;
    const divisionDoc = buildDivisionDoc(cleanData, divisionId);

    try {
      await db.collection("divisions").doc(divisionId).set({
        ...divisionDoc,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } catch (dbError) {
      console.warn("[api/divisions] Gagal menyimpan ke Firestore:", dbError);
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Divisi pokok berhasil ditambahkan.",
        division: divisionDoc,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthRoleError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Gagal menambahkan divisi pokok.";
    const status = message.includes("Token") ? 401 : 500;
    console.error("[api/divisions] Gagal menambahkan divisi:", error);
    return NextResponse.json(
      { ok: false, error: message },
      { status }
    );
  }
}
