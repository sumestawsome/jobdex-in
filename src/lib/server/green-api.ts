import "server-only";

export type GreenApiCredentials = {
  idInstance?: string;
  apiTokenInstance?: string;
  baseUrl?: string;
};

/**
 * Normalizes a target string or chatId to Green-API chatId format:
 * - Group: {groupId}@g.us
 * - Personal: {phone}@c.us
 */
export function formatGreenApiChatId(target: string, isGroup?: boolean): string {
  const clean = target.trim();
  if (!clean) return "";

  if (isGroup || clean.endsWith("@g.us") || clean.includes("-") || clean.startsWith("120363")) {
    const rawGroup = clean.replace(/@g\.us$/i, "").replace(/@c\.us$/i, "");
    return `${rawGroup}@g.us`;
  }

  // Personal phone number
  const cleanPhone = clean
    .replace(/@c\.us$/i, "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/[^\d]/g, "")
    .replace(/^0/, "62");

  return `${cleanPhone}@c.us`;
}

/**
 * Extracts and sanitizes Green-API configuration.
 * Reads from process.env.GREEN_API_ID_INSTANCE || process.env.NEXT_PUBLIC_GREEN_API_ID_INSTANCE
 * and process.env.GREEN_API_TOKEN_INSTANCE.
 */
export function getGreenApiConfig(credentials?: GreenApiCredentials) {
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
    "https://api.green-api.com"
  ).trim();

  // Bersihkan format markdown jika terisi e.g. [https://...](https://...)
  baseUrl = baseUrl.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\/$/, "");

  return { idInstance, apiTokenInstance, baseUrl };
}

/**
 * Sends a text message via Green-API HTTP REST endpoint:
 * POST /waInstance{idInstance}/sendMessage/{apiTokenInstance}
 */
export async function sendGreenApiTextMessage(
  chatId: string,
  message: string,
  credentials?: GreenApiCredentials
): Promise<{ ok: boolean; idMessage?: string; error?: string }> {
  const { idInstance, apiTokenInstance, baseUrl } = getGreenApiConfig(credentials);

  if (!idInstance || !apiTokenInstance) {
    const missing: string[] = [];
    if (!idInstance) missing.push("GREEN_API_ID_INSTANCE (or NEXT_PUBLIC_GREEN_API_ID_INSTANCE)");
    if (!apiTokenInstance) missing.push("GREEN_API_TOKEN_INSTANCE");

    console.error(
      `[GREEN-API Fallback Warning] Failed to dispatch text message to ${chatId}: missing runtime environment variables [${missing.join(", ")}]. ` +
      `Pastikan variabel GREEN_API_ID_INSTANCE dan GREEN_API_TOKEN_INSTANCE telah diisi di .env.local atau Vercel Environment Variables.`
    );
    return {
      ok: false,
      error: `Konfigurasi GREEN-API belum lengkap: [${missing.join(", ")}] undefined di runtime.`,
    };
  }

  const formattedChatId = formatGreenApiChatId(chatId);
  if (!formattedChatId) {
    return { ok: false, error: "Target chatId tidak valid atau kosong." };
  }

  const endpoint = `${baseUrl}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId: formattedChatId,
        message,
      }),
    });

    const text = await response.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorMsg = (data?.message as string) || (data?.error as string) || text || `HTTP ${response.status}`;
      console.error(`[GREEN-API] Send text failed (${response.status}) to ${formattedChatId}:`, errorMsg);
      return { ok: false, error: errorMsg };
    }

    const idMessage = (data?.idMessage as string) || undefined;
    console.log(`[GREEN-API] Message delivered to ${formattedChatId}, idMessage: ${idMessage || "ok"}`);
    return { ok: true, idMessage };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[GREEN-API] Network error sending to ${formattedChatId}:`, errorMsg);
    return { ok: false, error: errorMsg };
  }
}

/**
 * Sends a media file or voice audio attachment via Green-API:
 * POST /waInstance{idInstance}/sendFileByUrl/{apiTokenInstance}
 */
export async function sendGreenApiFile(
  chatId: string,
  urlFile: string,
  fileName: string,
  caption?: string,
  credentials?: GreenApiCredentials
): Promise<{ ok: boolean; idMessage?: string; error?: string }> {
  const { idInstance, apiTokenInstance, baseUrl } = getGreenApiConfig(credentials);

  if (!idInstance || !apiTokenInstance) {
    const missing: string[] = [];
    if (!idInstance) missing.push("GREEN_API_ID_INSTANCE (or NEXT_PUBLIC_GREEN_API_ID_INSTANCE)");
    if (!apiTokenInstance) missing.push("GREEN_API_TOKEN_INSTANCE");

    console.error(
      `[GREEN-API Fallback Warning] Failed to dispatch file to ${chatId}: missing runtime environment variables [${missing.join(", ")}].`
    );
    return {
      ok: false,
      error: `Konfigurasi GREEN-API belum lengkap: [${missing.join(", ")}] undefined di runtime.`,
    };
  }

  const formattedChatId = formatGreenApiChatId(chatId);
  const endpoint = `${baseUrl}/waInstance${idInstance}/sendFileByUrl/${apiTokenInstance}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId: formattedChatId,
        urlFile,
        fileName,
        caption: caption || "",
      }),
    });

    const text = await response.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorMsg = (data?.message as string) || (data?.error as string) || text || `HTTP ${response.status}`;
      return { ok: false, error: errorMsg };
    }

    return { ok: true, idMessage: (data?.idMessage as string) || undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Checks Green-API instance status via GET /waInstance{idInstance}/getStateInstance/{apiTokenInstance}
 */
export async function checkGreenApiInstanceStatus(
  credentials?: GreenApiCredentials
): Promise<{ ok: boolean; stateInstance?: string; error?: string }> {
  const { idInstance, apiTokenInstance, baseUrl } = getGreenApiConfig(credentials);

  if (!idInstance || !apiTokenInstance) {
    return { ok: false, error: "ID Instance dan Token Instance Green-API harus diisi." };
  }

  const endpoint = `${baseUrl}/waInstance${idInstance}/getStateInstance/${apiTokenInstance}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
    });

    const text = await response.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorMsg = (data?.message as string) || (data?.error as string) || text || `HTTP ${response.status}`;
      return { ok: false, error: errorMsg };
    }

    const stateInstance = String(data?.stateInstance || "unknown");
    return { ok: true, stateInstance };
  } catch (err) {
    const isTimeout =
      (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) ||
      String(err).toLowerCase().includes("abort") ||
      String(err).toLowerCase().includes("timeout");
    return {
      ok: false,
      error: isTimeout ? "Permintaan cek status timeout (15 detik)." : (err instanceof Error ? err.message : String(err)),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

