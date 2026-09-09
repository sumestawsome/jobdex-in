import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { DUMMY_ORMAWAS } from "@/lib/workspace-dummy-data";
import type { Ormawa } from "@/types/workspace";

export const dynamic = "force-dynamic";

/**
 * GET /api/campuses/[campusId]/ormawas
 * Mengambil daftar ormawa di bawah kampus spesifik via parameter URL.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campusId: string }> }
) {
  try {
    const { campusId } = await params;
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type") || "";
    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const onlyActive = searchParams.get("active") === "true";

    let ormawas: Ormawa[] = [];

    try {
      const db = getAdminDb();
      const snapshot = await db
        .collection("ormawas")
        .where("campus_id", "==", campusId)
        .get();

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
      console.warn("[api/campuses/campusId/ormawas] Firestore admin query failed:", dbError);
    }

    if (ormawas.length === 0) {
      ormawas = DUMMY_ORMAWAS.filter(
        (o) => o.campus_id === campusId || o.univ_id === campusId
      );
    }

    if (typeFilter) {
      ormawas = ormawas.filter((o) => o.type.toUpperCase() === typeFilter.toUpperCase());
    }

    if (onlyActive) {
      ormawas = ormawas.filter((o) => o.is_active !== false);
    }

    if (search) {
      ormawas = ormawas.filter(
        (o) =>
          o.name.toLowerCase().includes(search) ||
          o.short_name.toLowerCase().includes(search)
      );
    }

    ormawas.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      ok: true,
      campusId,
      ormawas,
      data: ormawas,
      count: ormawas.length,
    });
  } catch (error) {
    console.error("[api/campuses/campusId/ormawas] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal mengambil daftar ormawa kampus." },
      { status: 500 }
    );
  }
}
