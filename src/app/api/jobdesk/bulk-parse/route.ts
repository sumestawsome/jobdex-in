import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireCoordinatorAuth, AuthRoleError } from "@/lib/server/auth";
import { parseBulkJobdeskText } from "@/lib/server/ai-bulk-jobdesk-parser";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobdesk/bulk-parse
 *
 * Menerima teks mentah daftar jobdesk panitia dan mengekstrak tugas pra-acara / pasca-acara
 * serta memetakan PIC secara fuzzy menggunakan AI Gemini Flash.
 *
 * Payload:
 * {
 *   "text": string,
 *   "event_id"?: string,
 *   "division_id"?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validasi Autentikasi Admin / Koordinator
    const authHeader = request.headers.get("authorization");
    if (process.env.NODE_ENV === "production" || authHeader) {
      await requireCoordinatorAuth(request, [
        "super_admin",
        "koordinator_divisi",
        "koordinator_acara",
      ]);
    }

    // 2. Parse & Validasi Request Body
    const body = await request.json().catch(() => ({}));
    const rawText = body.text || body.rawText || body.raw_text;
    const eventId = body.event_id || body.eventId;
    const divisionId = body.division_id || body.divisionId;

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return NextResponse.json(
        { ok: false, error: "Teks daftar jobdesk panitia wajib diisi." },
        { status: 400 }
      );
    }

    // 3. Eksekusi Parsing AI & Fuzzy Member Matching
    const result = await parseBulkJobdeskText(
      rawText.trim(),
      typeof eventId === "string" ? eventId.trim() : undefined,
      typeof divisionId === "string" ? divisionId.trim() : undefined
    );

    // 4. Return Output JSON Terstruktur
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

    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan saat memproses parsing jobdesk.";
    const status = message.toLowerCase().includes("token") ? 401 : 500;
    console.error("[api/jobdesk/bulk-parse] Error:", error);

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
