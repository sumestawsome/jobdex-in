import "server-only";
import { sendViaWablas } from "./wablas-provider";
import { sendViaFonnte } from "./fonnte-provider";
import { sendViaGreenApi } from "./green-api-provider";
import { getWhatsAppSystemSettings } from "../whatsapp-settings";
import { getOrmawaGatewayConfig } from "../ormawa-whatsapp-gateway";
import type { WhatsAppSendPayload, WhatsAppSendResult, WhatsAppProviderName, WhatsAppSendTarget } from "./provider";
import { formatWhatsAppText } from "./formatting";

export { formatWhatsAppText };

export class WhatsAppRateLimitError extends Error {
  status: "skipped_min_interval" | "skipped_hourly_limit" | "skipped_cooldown" | "rate_limited" | "failed";
  cooldownUntil: Date | null;

  constructor(
    status: "skipped_min_interval" | "skipped_hourly_limit" | "skipped_cooldown" | "rate_limited" | "failed",
    message: string,
    cooldownUntil: Date | null = null
  ) {
    super(message);
    this.name = "WhatsAppRateLimitError";
    this.status = status;
    this.cooldownUntil = cooldownUntil;
  }
}

export type { WhatsAppProviderName, WhatsAppSendTarget, WhatsAppSendPayload, WhatsAppSendResult };

export function isGroupRecipient(target: string): boolean {
  if (!target) return false;
  return target.endsWith("@g.us") || target.includes("-") || target.startsWith("120363");
}

export function normalizeWhatsAppGroupId(groupId: string, provider: "fonnte" | "wablas" | "green-api"): string {
  const trimmed = groupId.trim();

  if (!trimmed) return "";

  if (provider === "fonnte" || provider === "green-api") {
    if (trimmed.endsWith("@g.us")) return trimmed;
    return `${trimmed}@g.us`;
  }

  if (provider === "wablas") {
    return trimmed.replace(/@g\.us$/i, "");
  }

  return trimmed;
}

export function getAllowedGroupIds(): string[] {
  const provider = (process.env.WHATSAPP_PROVIDER || "fonnte") as "fonnte" | "wablas" | "green-api";
  const allowedStr =
    process.env.WHATSAPP_ALLOWED_GROUP_IDS ||
    process.env.FONNTE_ALLOWED_GROUP_IDS ||
    process.env.WABLAS_ALLOWED_GROUP_IDS ||
    "";
    
  const allowed = allowedStr
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => normalizeWhatsAppGroupId(id, provider));

  const defaultId = getWhatsAppRecipient();
  if (defaultId && !allowed.includes(defaultId)) {
    allowed.push(defaultId);
  }
  return allowed;
}

export async function sendWhatsAppMessage(payload: WhatsAppSendPayload): Promise<WhatsAppSendResult> {
  const provider = (payload.provider || process.env.WHATSAPP_PROVIDER || "fonnte") as WhatsAppProviderName;

  if (process.env.WHATSAPP_ENABLED === "false") {
    throw new Error("WhatsApp sending is disabled by WHATSAPP_ENABLED=false");
  }

  // --- WhatsApp Markdown Formatter (Fix Bold & Clean Formatting) ---
  const cleanedMessage = formatWhatsAppText(payload.message);
  let effectivePayload: WhatsAppSendPayload = {
    ...payload,
    message: cleanedMessage,
  };

  // --- Global WhatsApp Sandbox / Test Mode Guard ---
  try {
    const settings = await getWhatsAppSystemSettings();
    const isSandboxActive = Boolean(settings.isTestMode || settings.sandbox_mode);

    if (isSandboxActive) {
      const originalTarget = payload.target || "Grup/Nomor Personal";
      const sandboxTarget = (settings.testGroupId || settings.sandbox_group_id || "120363406824082148@g.us").trim();

      const sandboxBanner = [
        `🧪 *[SIMULASI SANDBOX]* (Dialihkan dari: ${originalTarget})`,
        "",
        cleanedMessage,
      ].join("\n");

      console.info(`[WHATSAPP SANDBOX] Intercepting dispatch: redirecting ${originalTarget} -> ${sandboxTarget}`);

      effectivePayload = {
        ...effectivePayload,
        target: sandboxTarget,
        message: formatWhatsAppText(sandboxBanner),
        type: "group",
      };
    }
  } catch (settingsErr) {
    console.warn("[WHATSAPP SANDBOX] Failed to check sandbox settings, proceeding with original payload:", settingsErr);
  }

  // --- Multi-Tenant BYO Gateway Ormawa Routing ---
  const orgId = effectivePayload.org_id || effectivePayload.orgId;
  if (orgId) {
    const ormawaGateway = await getOrmawaGatewayConfig(orgId);
    if (!ormawaGateway || !ormawaGateway.api_token || !ormawaGateway.is_active) {
      // Jika orgId adalah "main_org" atau ormawa default, fallback ke gateway global di .env
      if (orgId === "main_org" || orgId === "org-undiksha-forkom-kip" || !ormawaGateway) {
        console.info(`[WhatsApp Multi-Tenant] Ormawa ${orgId} menggunakan gateway global sistem dari .env.`);
      } else {
        console.warn(
          `[WhatsApp Multi-Tenant] Gateway ormawa ${orgId} belum diatur atau dinonaktifkan. Pengiriman dibatalkan demi mencegah kebocoran antar-ormawa.`
        );
        return {
          ok: false,
          provider: (ormawaGateway?.provider || "fonnte") as WhatsAppProviderName,
          target: effectivePayload.target,
          error: `Gateway WhatsApp ormawa (${orgId}) belum diatur. Pengiriman dibatalkan agar tidak menggunakan nomor ormawa lain.`,
          skipped: true,
          notConfigured: true,
        };
      }
    } else {
      // Gunakan gateway milik ormawa pemilik data
      if (ormawaGateway.provider === "fonnte") {
        return sendViaFonnte(effectivePayload, {
          token: ormawaGateway.api_token,
          apiUrl: ormawaGateway.server_url,
        });
      }

      if (ormawaGateway.provider === "wablas") {
        return sendViaWablas(effectivePayload, {
          token: ormawaGateway.api_token,
          apiUrl: ormawaGateway.server_url,
        });
      }

      if ((ormawaGateway.provider as string) === "green-api") {
        return sendViaGreenApi(effectivePayload, {
          apiTokenInstance: ormawaGateway.api_token,
          baseUrl: ormawaGateway.server_url,
        });
      }
    }
  }

  // Fallback ke gateway global sistem (hanya jika data tidak terikat ke ormawa spesifik)
  if (provider === "green-api") {
    return sendViaGreenApi(effectivePayload);
  }

  if (provider === "fonnte") {
    return sendViaFonnte(effectivePayload);
  }

  if (provider === "wablas") {
    if (process.env.WABLAS_ENABLED === "false") {
      throw new Error("Wablas is disabled by WABLAS_ENABLED=false");
    }
    return sendViaWablas(effectivePayload);
  }

  throw new Error(`Unsupported WhatsApp provider: ${provider}`);
}

export function getWhatsAppRecipient(): string {
  const provider = (process.env.WHATSAPP_PROVIDER || "fonnte") as "fonnte" | "wablas" | "green-api";
  let rawRecipient = "";

  if (provider === "green-api") {
    rawRecipient =
      process.env.GREEN_API_DEFAULT_GROUP_ID ||
      process.env.WHATSAPP_DEFAULT_GROUP_ID ||
      process.env.FONNTE_DEFAULT_GROUP_ID ||
      "";
  } else if (provider === "fonnte") {
    rawRecipient = 
      process.env.FONNTE_DEFAULT_GROUP_ID || 
      process.env.WHATSAPP_DEFAULT_GROUP_ID || 
      process.env.FONNTE_DEFAULT_TARGET || 
      "";
  } else {
    rawRecipient = 
      process.env.WABLAS_DEFAULT_GROUP_ID || 
      process.env.WABLAS_GROUP_ID || 
      process.env.WHATSAPP_DEFAULT_GROUP_ID || 
      "";
  }

  const isGroup = isGroupRecipient(rawRecipient);

  if (isGroup) {
    return normalizeWhatsAppGroupId(rawRecipient, provider);
  }

  return rawRecipient;
}

export function getWhatsAppRecipientType(): string {
  return isWhatsAppGroupRecipient() ? "group" : "personal";
}

export function isWhatsAppGroupRecipient(): boolean {
  const provider = process.env.WHATSAPP_PROVIDER || "wablas";
  if (provider === "fonnte") {
    const rawRecipient = process.env.FONNTE_DEFAULT_GROUP_ID || process.env.WHATSAPP_DEFAULT_GROUP_ID || "";
    return isGroupRecipient(rawRecipient);
  }
  return process.env.WABLAS_SEND_TO_GROUP?.toLowerCase() !== "false";
}
