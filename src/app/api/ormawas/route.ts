import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { requireCoordinatorAuth, AuthRoleError } from "@/lib/server/auth";
import { DUMMY_ORMAWAS } from "@/lib/workspace-dummy-data";
import {
  validateOrmawaInput,
  buildOrmawaDoc,
  isUniqueOrmawaInCampus,
} from "@/lib/workspace-schema";
import type { Ormawa } from "@/types/workspace";

export const dynamic = "force-dynamic";

/**
 * GET /api/ormawas
 * Mengambil daftar ormawa berdasarkan ID kampus / universitas.
 * Parameter query: ?campusId=... atau ?campus_id=... atau ?univ_id=...
 * Filter opsional: ?type=BEM|DPM|HMJ|UKM|LAINNYA, ?search=..., ?active=true
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campusId =
      searchParams.get("campusId") ||
      searchParams.get("campus_id") ||
      searchParams.get("univ_id") ||
      "";
    const typeFilter = searchParams.get("type") || "";
    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const onlyActive = searchParams.get("active") === "true";

    let ormawas: Ormawa[] = [];

    try {
      const db = getAdminDb();
      let queryRef: FirebaseFirestore.Query = db.collection("ormawas");

      if (campusId) {
        queryRef = queryRef.where("campus_id", "==", campusId);
      }

      const snapshot = await queryRef.get();
      if (!snapshot.empty) {
        snapshot.forEach((doc) => {
          const data = doc.data() as Ormawa;
          ormawas.push({
            ...data,
            id: doc.id,
          });
        });
      }
    } catch (dbError) {
      console.warn("[api/ormawas] Firestore admin query failed, using fallback dummy data:", dbError);
    }

    // Jika koleksi Firestore belum ada isinya, gunakan data bawaan
    if (ormawas.length === 0) {
      if (campusId) {
        ormawas = DUMMY_ORMAWAS.filter(
          (o) => o.campus_id === campusId || o.univ_id === campusId
        );
      } else {
        ormawas = [...DUMMY_ORMAWAS];
      }
    }

    // Filter tipe
    if (typeFilter) {
      ormawas = ormawas.filter((o) => o.type.toUpperCase() === typeFilter.toUpperCase());
    }

    // Filter aktif
    if (onlyActive) {
      ormawas = ormawas.filter((o) => o.is_active !== false);
    }

    // Filter pencarian
    if (search) {
      ormawas = ormawas.filter(
        (o) =>
          o.name.toLowerCase().includes(search) ||
          o.short_name.toLowerCase().includes(search) ||
          o.description.toLowerCase().includes(search)
      );
    }

    // Urutkan berdasarkan nama
    ormawas.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      ok: true,
      campusId: campusId || null,
      ormawas,
      data: ormawas,
      count: ormawas.length,
    });
  } catch (error) {
    console.error("[api/ormawas] Gagal mengambil daftar ormawa:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Gagal mengambil daftar ormawa.",
        ormawas: [],
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ormawas
 * Mendaftarkan ormawa baru di bawah sebuah kampus.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.NODE_ENV === "production" || authHeader) {
      await requireCoordinatorAuth(request);
    }

    const body = await request.json();
    const validation = validateOrmawaInput(body);

    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { ok: false, errors: validation.errors },
        { status: 400 }
      );
    }

    const cleanData = validation.data;
    const db = getAdminDb();

    // 1. Ambil daftar ormawa yang sudah ada pada kampus terkait untuk validasi keunikan
    let existingOrmawas: Ormawa[] = [];
    try {
      const snap = await db
        .collection("ormawas")
        .where("campus_id", "==", cleanData.campus_id)
        .get();

      if (!snap.empty) {
        snap.forEach((doc) => {
          const oData = doc.data() as Ormawa;
          existingOrmawas.push({
            ...oData,
            id: doc.id,
          });
        });
      }
    } catch (fetchErr) {
      console.warn("[api/ormawas] Gagal membaca ormawa existing, fallback ke data bawaan:", fetchErr);
    }

    if (existingOrmawas.length === 0) {
      existingOrmawas = DUMMY_ORMAWAS.filter(
        (o) => o.campus_id === cleanData.campus_id || o.univ_id === cleanData.campus_id
      );
    }

    // 2. Periksa keunikan nama ormawa pada kampus yang sama
    const duplicateName = existingOrmawas.find(
      (o) => o.name.trim().toLowerCase() === cleanData.name.trim().toLowerCase()
    );
    if (duplicateName) {
      return NextResponse.json(
        {
          ok: false,
          error: `Ormawa dengan nama "${cleanData.name}" sudah terdaftar di kampus ini.`,
        },
        { status: 409 }
      );
    }

    // 3. Periksa keunikan singkatan/short_name ormawa pada kampus yang sama
    const duplicateShortName = existingOrmawas.find(
      (o) => o.short_name.trim().toLowerCase() === cleanData.short_name.trim().toLowerCase()
    );
    if (duplicateShortName) {
      return NextResponse.json(
        {
          ok: false,
          error: `Ormawa dengan singkatan "${cleanData.short_name}" sudah terdaftar di kampus ini.`,
        },
        { status: 409 }
      );
    }

    const ormawaId = `org-${cleanData.short_name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}`;
    const ormawaDoc = buildOrmawaDoc(cleanData, ormawaId);

    try {
      await db.collection("ormawas").doc(ormawaId).set({
        ...ormawaDoc,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Update ormawa_count pada dokumen kampus
      const campusRef = db.collection("campuses").doc(cleanData.campus_id);
      const campusSnap = await campusRef.get();
      if (campusSnap.exists) {
        const currentCount = (campusSnap.data()?.ormawa_count as number) || 0;
        await campusRef.update({
          ormawa_count: currentCount + 1,
          updated_at: new Date(),
        });
      }
    } catch (dbError) {
      console.warn("[api/ormawas] Gagal menyimpan ormawa ke Firestore admin:", dbError);
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Ormawa berhasil didaftarkan.",
        ormawa: ormawaDoc,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthRoleError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Gagal memproses pendaftaran ormawa.";
    const status = message.includes("Token") ? 401 : 500;
    console.error("[api/ormawas] Gagal memproses pendaftaran ormawa:", error);
    return NextResponse.json(
      { ok: false, error: message },
      { status }
    );
  }
}
