import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthContext, AuthRoleError } from "@/lib/server/auth";
import {
  getOrmawaGatewayConfig,
  saveOrmawaGatewayConfig,
  maskToken,
  type WhatsAppProviderType,
} from "@/lib/server/ormawa-whatsapp-gateway";

export const dynamic = "force-dynamic";

/**
 * GET /api/ormawas/[ormawaId]/whatsapp-gateway
 * Mengambil konfigurasi gateway WhatsApp milik ormawa.
 * HANYA ADMIN / KOORDINATOR ormawa terkait atau super_admin yang dapat mengakses.
 * Token selalu dikembalikan dalam bentuk tersamar (masked).
 */
export async function GET(
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

    // 2. Proteksi Wewenang & Multi-Tenant (Hanya Admin Ormawa Terkait)
    const isSuperAdmin = authContext.role === "super_admin";
    const isOrmawaCoordinator =
      (authContext.role === "koordinator_divisi" || authContext.role === "koordinator_acara") &&
      authContext.org_id === ormawaId;

    if (!isSuperAdmin && !isOrmawaCoordinator) {
      return NextResponse.json(
        {
          ok: false,
          error: "Akses ditolak. Hanya admin atau koordinator dari ormawa ini yang berhak melihat konfigurasi gateway WhatsApp.",
        },
        { status: 403 }
      );
    }

    // 3. Ambil data dari Firestore
    const config = await getOrmawaGatewayConfig(ormawaId);

    const gatewayResponse = {
      org_id: ormawaId,
      provider: config?.provider || "fonnte",
      server_url: config?.server_url || "https://api.fonnte.com",
      sender_number: config?.sender_number || "",
      is_active: config?.is_active ?? false,
      is_verified: config?.is_verified ?? false,
      last_tested_at: config?.last_tested_at || null,
      has_token: Boolean(config?.api_token),
      masked_token: maskToken(config?.api_token || ""),
    };

    return NextResponse.json({
      ok: true,
      gateway: gatewayResponse,
    });
  } catch (error) {
    if (error instanceof AuthRoleError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
    }
    console.error("[api/ormawas/whatsapp-gateway] GET Error:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal mengambil konfigurasi gateway WhatsApp ormawa." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ormawas/[ormawaId]/whatsapp-gateway
 * Menyimpan konfigurasi token gateway WhatsApp untuk ormawa terkait.
 * HANYA ADMIN / KOORDINATOR ormawa terkait atau super_admin yang dapat mengubah.
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

    // 2. Proteksi Wewenang & Multi-Tenant (Hanya Admin Ormawa Terkait)
    const isSuperAdmin = authContext.role === "super_admin";
    const isOrmawaCoordinator =
      (authContext.role === "koordinator_divisi" || authContext.role === "koordinator_acara") &&
      authContext.org_id === ormawaId;

    if (!isSuperAdmin && !isOrmawaCoordinator) {
      return NextResponse.json(
        {
          ok: false,
          error: "Akses ditolak. Hanya admin atau koordinator dari ormawa ini yang berhak menyimpan konfigurasi gateway WhatsApp.",
        },
        { status: 403 }
      );
    }

    // 3. Validasi Payload Request
    const body = await request.json().catch(() => ({}));
    const provider = (body.provider || "fonnte") as WhatsAppProviderType;

    if (provider !== "fonnte" && provider !== "wablas") {
      return NextResponse.json(
        { ok: false, error: "Provider tidak didukung. Pilih 'fonnte' atau 'wablas'." },
        { status: 400 }
      );
    }

    const api_token = typeof body.api_token === "string" ? body.api_token.trim() : undefined;
    const server_url = typeof body.server_url === "string" ? body.server_url.trim() : undefined;
    const sender_number = typeof body.sender_number === "string" ? body.sender_number.trim() : undefined;
    const is_active = typeof body.is_active === "boolean" ? body.is_active : undefined;

    const existing = await getOrmawaGatewayConfig(ormawaId);
    if (!existing?.api_token && (!api_token || api_token.length === 0)) {
      return NextResponse.json(
        { ok: false, error: "API Token gateway WhatsApp wajib diisi." },
        { status: 400 }
      );
    }

    // 4. Simpan ke Firestore
    const saved = await saveOrmawaGatewayConfig(
      ormawaId,
      {
        provider,
        api_token,
        server_url,
        sender_number,
        is_active,
        univ_id: authContext.univ_id,
      },
      authContext.uid
    );

    return NextResponse.json({
      ok: true,
      message: `Konfigurasi gateway WhatsApp ormawa berhasil disimpan (${provider.toUpperCase()}).`,
      gateway: {
        org_id: ormawaId,
        provider: saved.provider,
        server_url: saved.server_url,
        sender_number: saved.sender_number,
        is_active: saved.is_active,
        is_verified: saved.is_verified ?? false,
        last_tested_at: saved.last_tested_at || null,
        has_token: Boolean(saved.api_token),
        masked_token: maskToken(saved.api_token || ""),
      },
    });
  } catch (error) {
    if (error instanceof AuthRoleError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
    }
    console.error("[api/ormawas/whatsapp-gateway] POST Error:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal menyimpan konfigurasi gateway WhatsApp ormawa." },
      { status: 500 }
    );
  }
}
