import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireCoordinatorAuth, AuthRoleError } from "@/lib/server/auth";
import { parseBulkJobdeskText } from "@/lib/server/ai-bulk-jobdesk-parser";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobdesk/parse-voice
 *
 * Menerima transkrip rekaman suara/yapping jobdesk dan mengekstrak tugas pra-acara / pasca-acara
 * serta memetakan PIC secara fuzzy ke anggota acara.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.NODE_ENV === "production" || authHeader) {
      await requireCoordinatorAuth(request, [
        "super_admin",
        "koordinator_divisi",
        "koordinator_acara",
      ]);
    }

    const body = await request.json().catch(() => ({}));
    const rawText = body.text || body.transcript || body.rawText;
    const eventId = body.event_id || body.eventId;
    const divisionId = body.division_id || body.divisionId;

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return NextResponse.json(
        { ok: false, error: "Transkrip suara atau teks jobdesk wajib diisi." },
        { status: 400 }
      );
    }

    const result = await parseBulkJobdeskText(
      rawText.trim(),
      typeof eventId === "string" ? eventId.trim() : undefined,
      typeof divisionId === "string" ? divisionId.trim() : undefined
    );

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
      error instanceof Error ? error.message : "Terjadi kesalahan saat mengekstrak suara jobdesk.";
    const status = message.toLowerCase().includes("token") ? 401 : 500;
    console.error("[api/jobdesk/parse-voice] Error:", error);

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
