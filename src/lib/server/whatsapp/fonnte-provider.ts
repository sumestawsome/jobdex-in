import "server-only";
import type { WhatsAppSendPayload, WhatsAppSendResult } from "./provider";
import { normalizeWhatsAppGroupId, isGroupRecipient } from "./index";

export type FonnteCredentials = {
  token: string;
  apiUrl?: string;
  defaultCountryCode?: string;
};

export async function sendViaFonnte(
  payload: WhatsAppSendPayload,
  credentials?: FonnteCredentials
): Promise<WhatsAppSendResult> {
  const token = credentials?.token || process.env.FONNTE_API_TOKEN;
  let apiUrl = credentials?.apiUrl || process.env.FONNTE_API_URL || "https://api.fonnte.com/send";
  if (!apiUrl.endsWith("/send")) {
    apiUrl = `${apiUrl.replace(/\/$/, "")}/send`;
  }
  const defaultCountryCode = credentials?.defaultCountryCode || process.env.FONNTE_DEFAULT_COUNTRY_CODE || "62";

  if (!token) {
    throw new Error("Konfigurasi FONNTE_API_TOKEN tidak ditemukan.");
  }

  let recipient = payload.target;

  if (!recipient) {
    if (payload.type === "group") {
      recipient = process.env.FONNTE_DEFAULT_GROUP_ID || process.env.WHATSAPP_DEFAULT_GROUP_ID || "";
    } else {
      recipient = process.env.FONNTE_DEFAULT_TARGET || "";
    }
  }

  // Safeguard: Redirect group messages to test group in development or testing environment if target not explicitly provided
  if (!payload.target && (process.env.NODE_ENV === "development" || process.env.TESTING === "true")) {
    // If test target is configured, route there, otherwise route to a default test group ID
    if (payload.type === "group" || isGroupRecipient(recipient)) {
      recipient = process.env.FONNTE_DEFAULT_GROUP_ID || process.env.WHATSAPP_DEFAULT_GROUP_ID || "120363406824082148";
    } else {
      recipient = process.env.FONNTE_TEST_TARGET || recipient;
    }
  }

  if (!recipient) {
    throw new Error("Penerima WhatsApp belum diatur (target kosong).");
  }

  // Normalize group/personal target
  const isGroup = payload.type === "group" || isGroupRecipient(recipient);
  if (isGroup) {
    recipient = normalizeWhatsAppGroupId(recipient, "fonnte");
  } else {
    recipient = recipient.replace(/[^\d]/g, "").replace(/^0/, "62");
  }

  let responseStatus = 200;
  let responseText = "";
  let responseOk = false;

  console.info(`[FONNTE Dispatch] Sending to ${recipient} (isGroup: ${isGroup}, messageLen: ${payload.message?.length || 0})`);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: recipient,
        message: payload.message,
        countryCode: defaultCountryCode,
      }),
    });
    responseStatus = response.status;
    responseOk = response.ok;
    responseText = await response.text();
  } catch (fetchErr: unknown) {
    const errorMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.error(`[FONNTE Dispatch Error] Network fetch failed to ${recipient}:`, errorMsg);
    throw new Error(`FONNTE network fetch error: ${errorMsg}`);
  }

  let resData: { status?: boolean; reason?: string; message?: string } | null = null;
  try {
    resData = JSON.parse(responseText);
  } catch {
    resData = null;
  }

  if (!responseOk || (resData && resData.status === false)) {
    const errorDetail = resData?.reason || resData?.message || responseText || "Unknown error";
    console.error(`[FONNTE Dispatch Failed] HTTP ${responseStatus} to ${recipient}:`, errorDetail);
    throw new Error(`FONNTE gagal mengirim notifikasi (${responseStatus}): ${errorDetail}`);
  }

  console.info(`[FONNTE Dispatch Success] Delivered to ${recipient}`);

  return {
    ok: true,
    provider: "fonnte",
    target: recipient,
    responseText: responseText.slice(0, 1000),
    response: resData,
  };
}
