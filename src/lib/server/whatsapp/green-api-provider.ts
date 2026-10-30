import "server-only";
import type { WhatsAppSendPayload, WhatsAppSendResult } from "./provider";
import { isGroupRecipient } from "./index";

export type GreenApiCredentials = {
  idInstance?: string;
  apiTokenInstance?: string;
  baseUrl?: string;
};

/**
 * Normalizes target to Green-API chatId format:
 * - Group: {groupId}@g.us
 * - Personal: {phone}@c.us
 */
export function formatGreenApiChatId(target: string, isGroup?: boolean): string {
  const clean = target.trim();
  if (!clean) return "";

  if (isGroup || clean.includes("@g.us") || isGroupRecipient(clean)) {
    const rawGroup = clean.replace(/@g\.us$/i, "").replace(/@c\.us$/i, "");
    return `${rawGroup}@g.us`;
  }

  // Personal phone
  const cleanPhone = clean
    .replace(/@c\.us$/i, "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/[^\d]/g, "")
    .replace(/^0/, "62");

  return `${cleanPhone}@c.us`;
}

/**
 * Sends text message via Green-API HTTP REST endpoint:
 * POST /waInstance{idInstance}/sendMessage/{apiTokenInstance}
 */
export async function sendViaGreenApi(
  payload: WhatsAppSendPayload,
  credentials?: GreenApiCredentials
): Promise<WhatsAppSendResult> {
  const idInstance = (
    credentials?.idInstance ||
    process.env.GREEN_API_ID_INSTANCE ||
    process.env.NEXT_PUBLIC_GREEN_API_ID_INSTANCE ||
    ""
  ).trim();
  const apiTokenInstance = (
    credentials?.apiTokenInstance ||
    process.env.GREEN_API_TOKEN_INSTANCE ||
    ""
  ).trim();
  let baseUrl = (
    credentials?.baseUrl ||
    process.env.GREEN_API_BASE_URL ||
    "https://7107.api.greenapi.com"
  ).trim();

  // Bersihkan format markdown jika user memasukkan link markdown [url](url)
  baseUrl = baseUrl.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\/$/, "");

  if (!idInstance || !apiTokenInstance) {
    const missing: string[] = [];
    if (!idInstance) missing.push("GREEN_API_ID_INSTANCE (or NEXT_PUBLIC_GREEN_API_ID_INSTANCE)");
    if (!apiTokenInstance) missing.push("GREEN_API_TOKEN_INSTANCE");
    console.error(`[GREEN-API Provider Error] Missing runtime environment variables: [${missing.join(", ")}]`);
    throw new Error(`Konfigurasi GREEN_API belum lengkap: [${missing.join(", ")}] undefined di runtime.`);
  }

  let recipient = payload.target;
  if (!recipient) {
    if (payload.type === "group") {
      recipient = process.env.WHATSAPP_DEFAULT_GROUP_ID || "120363408538187919@g.us";
    } else {
      recipient = process.env.FONNTE_DEFAULT_TARGET || "6285119459703";
    }
  }

  const isGroup = payload.type === "group" || isGroupRecipient(recipient);
  const chatId = formatGreenApiChatId(recipient, isGroup);

  if (!chatId) {
    throw new Error("Penerima WhatsApp belum diatur (chatId kosong).");
  }

  const apiUrl = `${baseUrl}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;

  console.info(`[GREEN-API Dispatch] Sending to ${chatId} (messageLen: ${payload.message?.length || 0})`);

  let responseStatus = 200;
  let responseText = "";
  let responseOk = false;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId,
        message: payload.message,
      }),
    });

    responseStatus = response.status;
    responseOk = response.ok;
    responseText = await response.text();
  } catch (fetchErr: unknown) {
    const errorMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.error(`[GREEN-API Dispatch Error] Network fetch failed to ${chatId}:`, errorMsg);
    throw new Error(`GREEN-API network fetch error: ${errorMsg}`);
  }

  let resData: { idMessage?: string; error?: string } | null = null;
  try {
    resData = JSON.parse(responseText);
  } catch {
    resData = null;
  }

  if (!responseOk) {
    const errorDetail = resData?.error || responseText || "Unknown error";
    console.error(`[GREEN-API Dispatch Failed] HTTP ${responseStatus} to ${chatId}:`, errorDetail);
    throw new Error(`GREEN-API gagal mengirim pesan (${responseStatus}): ${errorDetail}`);
  }

  console.info(`[GREEN-API Dispatch Success] Delivered to ${chatId}, idMessage: ${resData?.idMessage || "unknown"}`);

  return {
    ok: true,
    provider: "green-api",
    target: chatId,
    responseText,
    response: resData,
  };
}

/**
 * Sends media/file/voice note by URL via Green-API:
 * POST /waInstance{idInstance}/sendFileByUrl/{apiTokenInstance}
 */
export async function sendFileViaGreenApi(
  chatId: string,
  urlFile: string,
  fileName: string,
  caption?: string,
  credentials?: GreenApiCredentials
): Promise<{ ok: boolean; idMessage?: string; error?: string }> {
  const idInstance = (
    credentials?.idInstance ||
    process.env.GREEN_API_ID_INSTANCE ||
    process.env.NEXT_PUBLIC_GREEN_API_ID_INSTANCE ||
    ""
  ).trim();
  const apiTokenInstance = (
    credentials?.apiTokenInstance ||
    process.env.GREEN_API_TOKEN_INSTANCE ||
    ""
  ).trim();
  let baseUrl = (
    credentials?.baseUrl ||
    process.env.GREEN_API_BASE_URL ||
    "https://7107.api.greenapi.com"
  ).trim();

  baseUrl = baseUrl.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\/$/, "");

  if (!idInstance || !apiTokenInstance) {
    const missing: string[] = [];
    if (!idInstance) missing.push("GREEN_API_ID_INSTANCE (or NEXT_PUBLIC_GREEN_API_ID_INSTANCE)");
    if (!apiTokenInstance) missing.push("GREEN_API_TOKEN_INSTANCE");
    return { ok: false, error: `Konfigurasi GREEN-API tidak lengkap: [${missing.join(", ")}] undefined.` };
  }

  const apiUrl = `${baseUrl}/waInstance${idInstance}/sendFileByUrl/${apiTokenInstance}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chatId,
      urlFile,
      fileName,
      caption: caption || "",
    }),
  });

  const responseText = await response.text();
  let resData: { idMessage?: string; error?: string } | null = null;
  try {
    resData = JSON.parse(responseText);
  } catch {
    resData = null;
  }

  if (!response.ok) {
    return { ok: false, error: resData?.error || responseText };
  }

  return { ok: true, idMessage: resData?.idMessage };
}
