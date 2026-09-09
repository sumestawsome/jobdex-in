import "server-only";
import { getAdminDb, FieldValue } from "../firebase-admin";
import { WhatsAppRateLimitError, normalizeWhatsAppGroupId, isGroupRecipient } from "./index";
import type { WhatsAppSendPayload, WhatsAppSendResult } from "./provider";

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

export type WablasCredentials = {
  apiUrl?: string;
  token: string;
  secret?: string;
  deviceId?: string;
};

export async function sendViaWablas(
  payload: WhatsAppSendPayload,
  credentials?: WablasCredentials
): Promise<WhatsAppSendResult> {
  const apiUrl = credentials?.apiUrl ? normalizeBaseUrl(credentials.apiUrl) : process.env.WABLAS_API_URL;
  const token = credentials?.token || process.env.WABLAS_API_TOKEN;
  const secret = credentials?.secret || process.env.WABLAS_SECRET_KEY;
  const deviceId = credentials?.deviceId || process.env.WABLAS_DEVICE_ID;

  if (process.env.WABLAS_ENABLED === "false" && !credentials?.token) {
    throw new Error("Wablas is disabled by WABLAS_ENABLED=false");
  }

  let recipient = payload.target;

  if (!recipient) {
    if (payload.type === "group") {
      recipient = process.env.WABLAS_DEFAULT_GROUP_ID || process.env.WABLAS_GROUP_ID || process.env.WHATSAPP_DEFAULT_GROUP_ID || "";
    }
  }

  const isGroup = payload.type === "group" || isGroupRecipient(recipient);

  // Safeguard: Redirect group messages to test group in development or testing environment if target not explicitly provided
  if (!payload.target && (process.env.NODE_ENV === "development" || process.env.TESTING === "true")) {
    if (isGroup) {
      recipient = "120363406824082148";
    }
  }

  if (!recipient) {
    throw new Error("Penerima WhatsApp belum diatur (target kosong).");
  }

  if (isGroup) {
    recipient = normalizeWhatsAppGroupId(recipient, "wablas");
  }

  if (!apiUrl || !token) {
    throw new Error("Konfigurasi Wablas belum lengkap (API URL atau token kosong).");
  }

  // --- Rate Limit Guard ---
  const minInterval = parseInt(process.env.WABLAS_MIN_SEND_INTERVAL_SECONDS || "60", 10);
  const cooldownMin = parseInt(process.env.WABLAS_RATE_LIMIT_COOLDOWN_MINUTES || "60", 10);
  const maxSendsHour = parseInt(process.env.WABLAS_MAX_SENDS_PER_HOUR || "25", 10);

  const db = getAdminDb();
  const stateRef = db.collection("whatsapp_rate_limit_state").doc("wablas_default");
  const stateDoc = await stateRef.get();

  const now = new Date();
  let lastSentAt: Date | null = null;
  let cooldownUntil: Date | null = null;
  let sentCountHour = 0;
  let sentCountHourWindowStart: Date | null = null;

  if (stateDoc.exists) {
    const data = stateDoc.data() || {};
    if (data.last_sent_at) lastSentAt = data.last_sent_at.toDate();
    if (data.cooldown_until) cooldownUntil = data.cooldown_until.toDate();
    sentCountHour = data.sent_count_hour || 0;
    if (data.sent_count_hour_window_start) sentCountHourWindowStart = data.sent_count_hour_window_start.toDate();
  }

  // 1. Cooldown Check
  if (cooldownUntil && cooldownUntil.getTime() > now.getTime()) {
    throw new WhatsAppRateLimitError("skipped_cooldown", "Skipped: Rate limit cooldown active.", cooldownUntil);
  }

  // 2. Minimum Interval Check
  if (lastSentAt && now.getTime() - lastSentAt.getTime() < minInterval * 1000) {
    throw new WhatsAppRateLimitError("skipped_min_interval", "Skipped: Minimum send interval not met.");
  }

  // 3. Hourly Limit Check
  let nextSentCountHour = sentCountHour + 1;
  let nextSentCountHourWindowStart = sentCountHourWindowStart || now;

  if (!sentCountHourWindowStart || now.getTime() - sentCountHourWindowStart.getTime() > 60 * 60 * 1000) {
    nextSentCountHourWindowStart = now;
    nextSentCountHour = 1;
  } else if (sentCountHour >= maxSendsHour) {
    throw new WhatsAppRateLimitError("skipped_hourly_limit", "Skipped: Hourly limit exceeded.");
  }

  const endpoint = apiUrl.includes("/send-message")
    ? apiUrl
    : `${normalizeBaseUrl(apiUrl)}/send-message`;
  const mentions = Array.from(new Set(payload.mentions ?? [])).filter(Boolean);
  const mentionMetadataEnabled =
    process.env.WABLAS_SEND_MENTION_METADATA?.toLowerCase() === "true";

  let responseStatus = 200;
  let responseText = "";
  let responseOk = false;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `${token}.${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: recipient,
        message: payload.message,
        isGroup: isGroup ? "true" : "false",
        ...(isGroup && mentionMetadataEnabled && mentions.length
          ? { mentions }
          : {}),
        ...(deviceId ? { device_id: deviceId } : {}),
      }),
    });
    responseStatus = response.status;
    responseOk = response.ok;
    responseText = await response.text();
  } catch (fetchErr: unknown) {
    const errorMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    throw new Error(`Wablas network fetch error: ${errorMsg}`);
  }

  // Check for Wablas Error 463 or rate limit keywords
  const lowerText = responseText.toLowerCase();
  const isRateLimit =
    responseStatus === 463 ||
    lowerText.includes("rate") ||
    lowerText.includes("overlimit") ||
    lowerText.includes("too fast") ||
    lowerText.includes("dropped") ||
    lowerText.includes("sending too fast") ||
    lowerText.includes("too many messages");

  if (isRateLimit) {
    const cooldownUntilTime = new Date(now.getTime() + cooldownMin * 60 * 1000);
    await stateRef.set({
      cooldown_until: cooldownUntilTime,
      last_error_code: responseStatus,
      last_error_message: responseText.slice(0, 1000),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });

    throw new WhatsAppRateLimitError("rate_limited", `Rate limited by Wablas: ${responseText}`, cooldownUntilTime);
  }

  if (!responseOk) {
    const safeBody = responseText ? `: ${responseText.slice(0, 500)}` : "";
    throw new Error(`Wablas gagal mengirim notifikasi (${responseStatus})${safeBody}`);
  }

  // Update success state
  await stateRef.set({
    last_sent_at: now,
    cooldown_until: null,
    sent_count_hour: nextSentCountHour,
    sent_count_hour_window_start: nextSentCountHourWindowStart,
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    ok: true,
    provider: "wablas",
    target: recipient,
    responseText: responseText.slice(0, 1000),
  };
}
