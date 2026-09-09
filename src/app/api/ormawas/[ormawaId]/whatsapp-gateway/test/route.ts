import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthContext, AuthRoleError } from "@/lib/server/auth";
import {
  testSendOrmawaWhatsApp,
  type WhatsAppProviderType,
} from "@/lib/server/ormawa-whatsapp-gateway";

export const dynamic = "force-dynamic";

/**
 * POST /api/ormawas/[ormawaId]/whatsapp-gateway/test
 * Mengirim pesan uji coba ke nomor tujuan menggunakan gateway WhatsApp milik ormawa.
 * HANYA ADMIN / KOORDINATOR ormawa terkait atau super_admin yang berhak menguji.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ormawaId: string }> }
) {
  try {
    const { ormawaId } = await params;
    if (!ormawaId) {
      return NextResponse.json(
        { ok: false, error: "ID Ormawa wajib disertakan." },
        { status: 400 }
      );
    }

    // 1. Verifikasi Autentikasi Pengguna
    let authContext;
    try {
      authContext = await getServerAuthContext(request);
    } catch (authError) {
      const msg = authError instanceof Error ? authError.message : "Autentikasi gagal.";
      return NextResponse.json({ ok: false, error: msg }, { status: 401 });
    }

    // 2. Proteksi Wewenang Multi-Tenant (Hanya Admin Ormawa Terkait)
    const isSuperAdmin = authContext.role === "super_admin";
    const isOrmawaCoordinator =
      (authContext.role === "koordinator_divisi" || authContext.role === "koordinator_acara") &&
      authContext.org_id === ormawaId;

    if (!isSuperAdmin && !isOrmawaCoordinator) {
      return NextResponse.json(
        {
          ok: false,
          error: "Akses ditolak. Hanya admin atau koordinator dari ormawa ini yang berhak melakukan uji kirim gateway WhatsApp.",
        },
        { status: 403 }
      );
    }

    // 3. Validasi Body Request
    const body = await request.json().catch(() => ({}));
    const targetNumber = typeof body.targetNumber === "string" ? body.targetNumber.trim() : "";
    const token = typeof body.token === "string" ? body.token.trim() : (typeof body.api_token === "string" ? body.api_token.trim() : undefined);
    const provider = body.provider as WhatsAppProviderType | undefined;
    const serverUrl = typeof body.serverUrl === "string" ? body.serverUrl.trim() : undefined;
    const simulate = body.simulate as "auto" | "force_success" | "force_error" | undefined;

    if (!targetNumber) {
      return NextResponse.json(
        { ok: false, error: "Nomor WhatsApp tujuan uji coba wajib diisi." },
        { status: 400 }
      );
    }

    // 4. Eksekusi Uji Kirim
    const result = await testSendOrmawaWhatsApp(ormawaId, {
      targetNumber,
      token,
      provider,
      serverUrl,
      simulate,
    });

    return NextResponse.json(result, { status: result.statusCode || (result.ok ? 200 : 400) });
  } catch (error) {
    if (error instanceof AuthRoleError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
    }
    console.error("[api/ormawas/whatsapp-gateway/test] POST Error:", error);
    return NextResponse.json(
      { ok: false, error: "Terjadi kesalahan pada server saat melakukan pengujian gateway WhatsApp." },
      { status: 500 }
    );
  }
}
