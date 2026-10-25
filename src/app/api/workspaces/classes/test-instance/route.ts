import { NextResponse, type NextRequest } from "next/server";
import { requireAdminAuth, AuthRoleError } from "@/lib/server/auth";
import { checkGreenApiInstanceStatus } from "@/lib/server/green-api";

export const runtime = "nodejs";

/**
 * POST /api/workspaces/classes/test-instance
 * Checks Green-API instance connection state for Super Admin
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth(request);
  } catch (authErr) {
    if (authErr instanceof AuthRoleError) {
      return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.statusCode });
    }
    return NextResponse.json({ ok: false, error: "Akses ditolak. Sesi Super Admin diperlukan." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Format payload JSON tidak valid." }, { status: 400 });
  }

  const idInstance = String(body.idInstance || body.id_instance || "").trim();
  const apiTokenInstance = String(body.apiTokenInstance || body.token_instance || body.api_token_instance || "").trim();

  if (!idInstance || !apiTokenInstance) {
    return NextResponse.json(
      { ok: false, error: "ID Instance dan Token Instance Green-API wajib diisi untuk pengetesan." },
      { status: 400 }
    );
  }

  const result = await checkGreenApiInstanceStatus({
    idInstance,
    apiTokenInstance,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || "Gagal menghubungi server Green-API." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    stateInstance: result.stateInstance,
    isAuthorized: result.stateInstance === "authorized",
    message:
      result.stateInstance === "authorized"
        ? "Instance Green-API terhubung dan terotorisasi (WhatsApp aktif)."
        : `Status instance: ${result.stateInstance}. Pastikan QR code sudah dipindai.`,
  });
}
