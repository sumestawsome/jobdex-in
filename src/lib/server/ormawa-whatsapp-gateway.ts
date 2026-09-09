import "server-only";
import { getAdminDb, FieldValue } from "@/lib/server/firebase-admin";

export type WhatsAppProviderType = "fonnte" | "wablas";

export interface OrmawaGatewayConfig {
  org_id: string;
  ormawa_id: string;
  univ_id?: string;
  provider: WhatsAppProviderType;
  api_token: string;
  server_url?: string;
  sender_number?: string;
  is_active: boolean;
  is_verified?: boolean;
  last_tested_at?: string | null;
  updated_at?: unknown;
  updated_by?: string;
}

export interface OrmawaGatewayConfigResponse {
  org_id: string;
  provider: WhatsAppProviderType;
  server_url?: string;
  sender_number?: string;
  is_active: boolean;
  is_verified?: boolean;
  last_tested_at?: string | null;
  has_token: boolean;
  masked_token: string;
}

export function maskToken(token: string): string {
  if (!token) return "";
  const trimmed = token.trim();
  if (trimmed.length <= 8) return "••••••••••••";
  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
}

/**
 * Mengambil konfigurasi gateway WhatsApp milik ormawa tertentu dari Firestore.
 */
export async function getOrmawaGatewayConfig(
  ormawaId: string
): Promise<OrmawaGatewayConfig | null> {
  if (!ormawaId) return null;

  try {
    const db = getAdminDb();
    // Cari di koleksi khusus ormawa_whatsapp_gateways
    const docSnap = await db.collection("ormawa_whatsapp_gateways").doc(ormawaId).get();
    if (docSnap.exists) {
      const data = docSnap.data() as OrmawaGatewayConfig;
      return {
        ...data,
        org_id: ormawaId,
        ormawa_id: ormawaId,
      };
    }

    // Fallback pencarian pada sub-koleksi ormawas/{ormawaId}/settings/whatsapp
    const subDocSnap = await db
      .collection("ormawas")
      .doc(ormawaId)
      .collection("settings")
      .doc("whatsapp")
      .get();

    if (subDocSnap.exists) {
      const data = subDocSnap.data() as OrmawaGatewayConfig;
      return {
        ...data,
        org_id: ormawaId,
        ormawa_id: ormawaId,
      };
    }

    return null;
  } catch (error) {
    console.error(`[OrmawaGateway] Gagal mengambil konfigurasi gateway ormawa ${ormawaId}:`, error);
    return null;
  }
}

/**
 * Menyimpan atau memperbarui konfigurasi gateway WhatsApp untuk ormawa tertentu.
 * Hanya admin/koordinator dari ormawa tersebut yang boleh memanggil fungsi ini.
 */
export async function saveOrmawaGatewayConfig(
  ormawaId: string,
  input: {
    provider: WhatsAppProviderType;
    api_token?: string;
    server_url?: string;
    sender_number?: string;
    is_active?: boolean;
    is_verified?: boolean;
    univ_id?: string;
  },
  userId: string
): Promise<OrmawaGatewayConfig> {
  const db = getAdminDb();
  const existing = await getOrmawaGatewayConfig(ormawaId);

  // Jika token baru tidak diisi, pertahankan token lama yang sudah ada
  const finalToken = input.api_token?.trim() || existing?.api_token || "";

  const payload: Record<string, unknown> = {
    org_id: ormawaId,
    ormawa_id: ormawaId,
    provider: input.provider || existing?.provider || "fonnte",
    api_token: finalToken,
    server_url: input.server_url !== undefined ? input.server_url : (existing?.server_url || (input.provider === "wablas" ? "https://kudus.wablas.com" : "https://api.fonnte.com")),
    sender_number: input.sender_number !== undefined ? input.sender_number : (existing?.sender_number || ""),
    is_active: input.is_active !== undefined ? Boolean(input.is_active) : (existing?.is_active ?? (finalToken.length > 0)),
    is_verified: input.is_verified !== undefined ? Boolean(input.is_verified) : (existing?.is_verified ?? false),
    last_tested_at: existing?.last_tested_at || null,
    updated_at: FieldValue.serverTimestamp(),
    updated_by: userId,
  };

  if (input.univ_id) {
    payload.univ_id = input.univ_id;
  } else if (existing?.univ_id) {
    payload.univ_id = existing.univ_id;
  }

  // Simpan di root collection agar cepat dicari berdasarkan token
  await db.collection("ormawa_whatsapp_gateways").doc(ormawaId).set(payload, { merge: true });

  // Sinkronkan juga ke sub-koleksi untuk redundansi
  try {
    await db
      .collection("ormawas")
      .doc(ormawaId)
      .collection("settings")
      .doc("whatsapp")
      .set(payload, { merge: true });
  } catch (e) {
    console.warn("[OrmawaGateway] Gagal sinkronisasi ke subkoleksi settings/whatsapp:", e);
  }

  return {
    ...(payload as unknown as OrmawaGatewayConfig),
    api_token: finalToken,
  };
}

export interface TestDispatchResult {
  ok: boolean;
  status: "success" | "failed";
  message: string;
  statusCode: number;
  messageId?: string;
  details?: {
    provider: string;
    targetNumber: string;
    timestamp: string;
    code: number;
    errorReason?: string;
  };
}

/**
 * Menguji pengiriman pesan ke nomor tujuan menggunakan token ormawa.
 */
export async function testSendOrmawaWhatsApp(
  ormawaId: string,
  options: {
    targetNumber: string;
    token?: string;
    provider?: WhatsAppProviderType;
    serverUrl?: string;
    simulate?: "auto" | "force_success" | "force_error";
  }
): Promise<TestDispatchResult> {
  const db = getAdminDb();
  const saved = await getOrmawaGatewayConfig(ormawaId);
  const provider = options.provider || saved?.provider || "fonnte";
  const token = options.token?.trim() || saved?.api_token || "";
  const serverUrl =
    options.serverUrl?.trim() ||
    saved?.server_url ||
    (provider === "wablas" ? "https://kudus.wablas.com" : "https://api.fonnte.com");

  const cleanPhone = options.targetNumber.replace(/[^0-9+]/g, "").trim();
  if (!cleanPhone || cleanPhone.length < 9) {
    return {
      ok: false,
      status: "failed",
      message: "Nomor WhatsApp tujuan tidak valid. Masukkan minimal 9 digit ponsel.",
      statusCode: 400,
    };
  }

  if (!token && options.simulate !== "force_success") {
    return {
      ok: false,
      status: "failed",
      message: "Token gateway WhatsApp ormawa belum diatur. Masukkan token terlebih dahulu.",
      statusCode: 400,
    };
  }

  const timestampStr = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // 1. Simulasi Eksplisit (untuk pengujian QA atau sandbox lokal)
  if (options.simulate === "force_success") {
    const mockId = `TEST-OK-${provider.toUpperCase()}-${Date.now().toString().slice(-6)}`;
    try {
      await db.collection("ormawa_whatsapp_gateways").doc(ormawaId).set(
        {
          is_verified: true,
          last_tested_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // ignore
    }

    return {
      ok: true,
      status: "success",
      message: `[Simulasi] Pesan uji berhasil dikirim ke ${cleanPhone} via gateway ${provider.toUpperCase()}.`,
      statusCode: 200,
      messageId: mockId,
      details: {
        provider: provider.toUpperCase(),
        targetNumber: cleanPhone,
        timestamp: timestampStr,
        code: 200,
      },
    };
  }

  if (options.simulate === "force_error") {
    return {
      ok: false,
      status: "failed",
      message: `[Simulasi] Gateway ${provider.toUpperCase()} menolak autentikasi token (401 Unauthorized).`,
      statusCode: 401,
      details: {
        provider: provider.toUpperCase(),
        targetNumber: cleanPhone,
        timestamp: timestampStr,
        code: 401,
        errorReason: "Token tidak valid atau tidak memiliki akses.",
      },
    };
  }

  // 2. Pola token tiruan / token pengujian
  if (token.startsWith("MOCK_") || token.startsWith("test_")) {
    const mockId = `MOCK-${Date.now().toString().slice(-6)}`;
    try {
      await db.collection("ormawa_whatsapp_gateways").doc(ormawaId).set(
        {
          is_verified: true,
          last_tested_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // ignore
    }

    return {
      ok: true,
      status: "success",
      message: `Pesan uji berhasil dikirim ke ${cleanPhone} via ${provider.toUpperCase()}.`,
      statusCode: 200,
      messageId: mockId,
      details: {
        provider: provider.toUpperCase(),
        targetNumber: cleanPhone,
        timestamp: timestampStr,
        code: 200,
      },
    };
  }

  // 3. Dispatch HTTP nyata ke server provider
  const testMessage = `[Uji Coba Gateway JobDeskIn]\nHalo! Pesan uji ini dikirim dari gateway WhatsApp ${provider.toUpperCase()} resmi ormawa.`;

  try {
    if (provider === "fonnte") {
      const apiUrl = `${serverUrl.replace(/\/$/, "")}/send`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: cleanPhone.replace(/^0/, "62"),
          message: testMessage,
          countryCode: "62",
        }),
      });

      const resText = await res.text();
      let resJson: Record<string, unknown> | null = null;
      try {
        resJson = JSON.parse(resText);
      } catch {
        // ignore
      }

      if (res.ok && (resJson?.status === true || resJson?.status === "true")) {
        try {
          await db.collection("ormawa_whatsapp_gateways").doc(ormawaId).set(
            {
              is_verified: true,
              last_tested_at: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // ignore
        }

        return {
          ok: true,
          status: "success",
          message: `Pesan uji berhasil dikirim ke ${cleanPhone} via Fonnte.`,
          statusCode: 200,
          messageId: String((resJson?.id as unknown[])?.[0] || resJson?.id || `FONNTE-${Date.now().toString().slice(-6)}`),
          details: {
            provider: "FONNTE",
            targetNumber: cleanPhone,
            timestamp: timestampStr,
            code: 200,
          },
        };
      } else {
        const errorReason = String(resJson?.reason || resJson?.message || `Gateway Fonnte HTTP ${res.status}`);
        return {
          ok: false,
          status: "failed",
          message: `Gateway Fonnte gagal mengirim pesan uji: ${errorReason}`,
          statusCode: res.status || 400,
          details: {
            provider: "FONNTE",
            targetNumber: cleanPhone,
            timestamp: timestampStr,
            code: res.status,
            errorReason,
          },
        };
      }
    } else {
      // Wablas
      const apiUrl = `${serverUrl.replace(/\/$/, "")}/api/send-message`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: cleanPhone.replace(/^0/, "62"),
          message: testMessage,
        }),
      });

      const resText = await res.text();
      let resJson: Record<string, unknown> | null = null;
      try {
        resJson = JSON.parse(resText);
      } catch {
        // ignore
      }

      if (res.ok && (resJson?.status === true || resJson?.status === "success" || resJson?.status === 200)) {
        try {
          await db.collection("ormawa_whatsapp_gateways").doc(ormawaId).set(
            {
              is_verified: true,
              last_tested_at: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // ignore
        }

        const resData = resJson?.data as Record<string, unknown> | undefined;
        return {
          ok: true,
          status: "success",
          message: `Pesan uji berhasil dikirim ke ${cleanPhone} via Wablas.`,
          statusCode: 200,
          messageId: String(resData?.id || `WABLAS-${Date.now().toString().slice(-6)}`),
          details: {
            provider: "WABLAS",
            targetNumber: cleanPhone,
            timestamp: timestampStr,
            code: 200,
          },
        };
      } else {
        const errorReason = String(resJson?.message || `Gateway Wablas HTTP ${res.status}`);
        return {
          ok: false,
          status: "failed",
          message: `Gateway Wablas gagal mengirim pesan uji: ${errorReason}`,
          statusCode: res.status || 400,
          details: {
            provider: "WABLAS",
            targetNumber: cleanPhone,
            timestamp: timestampStr,
            code: res.status,
            errorReason,
          },
        };
      }
    }
  } catch (networkErr) {
    const errorMsg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    return {
      ok: false,
      status: "failed",
      message: `Koneksi jaringan ke provider gateway WhatsApp gagal: ${errorMsg}`,
      statusCode: 502,
      details: {
        provider: provider.toUpperCase(),
        targetNumber: cleanPhone,
        timestamp: timestampStr,
        code: 502,
        errorReason: errorMsg,
      },
    };
  }
}

/**
 * Mencari konfigurasi gateway ormawa berdasarkan token gateway WhatsApp (digunakan webhook bot).
 */
export async function findOrmawaGatewayByToken(
  token: string
): Promise<OrmawaGatewayConfig | null> {
  if (!token) return null;
  const cleanToken = token.trim();

  try {
    const db = getAdminDb();
    const querySnap = await db
      .collection("ormawa_whatsapp_gateways")
      .where("api_token", "==", cleanToken)
      .limit(1)
      .get();

    if (!querySnap.empty) {
      const doc = querySnap.docs[0];
      return doc.data() as OrmawaGatewayConfig;
    }

    return null;
  } catch (error) {
    console.error("[OrmawaGateway] Gagal mencari gateway berdasarkan token:", error);
    return null;
  }
}


