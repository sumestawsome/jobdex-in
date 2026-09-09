import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminAuth, AuthRoleError } from "@/lib/server/auth";
import { migrateLegacyDataToNewOrganizationStructure } from "@/lib/server/migration";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/migrate-organization
 * Menjalankan proses migrasi data lama ke struktur organisasi kampus & ormawa baru.
 * Khusus super_admin.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.NODE_ENV === "production" || authHeader) {
      await requireAdminAuth(request);
    }

    const result = await migrateLegacyDataToNewOrganizationStructure();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof AuthRoleError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.statusCode }
      );
    }
    const message = error instanceof Error ? error.message : "Gagal menjalankan migrasi.";
    const status = message.includes("Token") ? 401 : 500;
    console.error("[api/admin/migrate-organization] Gagal migrasi:", error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
