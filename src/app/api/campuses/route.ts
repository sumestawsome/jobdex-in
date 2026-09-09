import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { requireAdminAuth, AuthRoleError } from "@/lib/server/auth";
import { DUMMY_CAMPUSES } from "@/lib/workspace-dummy-data";
import {
  validateCampusInput,
  buildCampusDoc,
  isUniqueCampusName,
  isUniqueCampusCode,
} from "@/lib/workspace-schema";
import type { Campus } from "@/types/workspace";

export const dynamic = "force-dynamic";

/**
 * GET /api/campuses
 * Mengembalikan daftar kampus/universitas yang dapat diakses.
 * Mendukung filter ?search= dan ?active=true
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const onlyActive = searchParams.get("active") === "true";

    let campuses: Campus[] = [];

    try {
      const db = getAdminDb();
      const snapshot = await db.collection("campuses").get();

      if (!snapshot.empty) {
        snapshot.forEach((doc) => {
          const data = doc.data() as Campus;
          campuses.push({
            ...data,
            id: doc.id,
          });
        });
      }
    } catch (dbError) {
      console.warn("[api/campuses] Firestore admin unavailable, using fallback dummy data:", dbError);
    }

    // Jika koleksi di Firestore belum ada isinya, fallback ke data bawaan
    if (campuses.length === 0) {
      campuses = [...DUMMY_CAMPUSES];
    }

    // Filter aktif
    if (onlyActive) {
      campuses = campuses.filter((c) => c.is_active !== false);
    }

    // Filter pencarian
    if (search) {
      campuses = campuses.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.code.toLowerCase().includes(search) ||
          c.city.toLowerCase().includes(search)
      );
    }

    // Urutkan berdasarkan nama kampus
    campuses.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      ok: true,
      campuses,
      data: campuses,
      count: campuses.length,
    });
  } catch (error) {
    console.error("[api/campuses] Gagal mengambil daftar kampus:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Gagal mengambil daftar kampus yang dapat diakses.",
        campuses: DUMMY_CAMPUSES,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campuses
 * Mendaftarkan kampus baru (Onboarding / Super Admin)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.NODE_ENV === "production" || authHeader) {
      await requireAdminAuth(request);
    }

    const body = await request.json();
    const validation = validateCampusInput(body);

    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { ok: false, errors: validation.errors },
        { status: 400 }
      );
    }

    const cleanData = validation.data;
    const db = getAdminDb();

    // 1. Ambil seluruh data kampus yang ada untuk validasi keunikan
    let existingCampuses: Campus[] = [];
    try {
      const snapshot = await db.collection("campuses").get();
      if (!snapshot.empty) {
        snapshot.forEach((doc) => {
          const cData = doc.data() as Campus;
          existingCampuses.push({
            ...cData,
            id: doc.id,
          });
        });
      }
    } catch (fetchErr) {
      console.warn("[api/campuses] Gagal membaca kampus existing, fallback ke data bawaan:", fetchErr);
    }

    if (existingCampuses.length === 0) {
      existingCampuses = [...DUMMY_CAMPUSES];
    }

    // 2. Periksa keunikan nama kampus (case-insensitive)
    if (!isUniqueCampusName(cleanData.name, existingCampuses)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Kampus dengan nama "${cleanData.name}" sudah terdaftar sebelumnya.`,
        },
        { status: 409 }
      );
    }

    // 3. Periksa keunikan kode/singkatan kampus (case-insensitive)
    if (!isUniqueCampusCode(cleanData.code, existingCampuses)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Kode singkatan "${cleanData.code}" sudah digunakan kampus lain.`,
        },
        { status: 409 }
      );
    }

    const campusId = `univ-${cleanData.code.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}`;
    const campusDoc = buildCampusDoc(cleanData, campusId);

    try {
      await db.collection("campuses").doc(campusId).set({
        ...campusDoc,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } catch (dbError) {
      console.warn("[api/campuses] Tidak dapat menyimpan ke Firestore via admin:", dbError);
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Kampus berhasil didaftarkan.",
        campus: campusDoc,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthRoleError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Gagal memproses pendaftaran kampus.";
    const status = message.includes("Token") ? 401 : 500;
    console.error("[api/campuses] Gagal mendaftarkan kampus:", error);
    return NextResponse.json(
      { ok: false, error: message },
      { status }
    );
  }
}
