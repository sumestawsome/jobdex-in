import "server-only";
import type { NormalizedIncomingWhatsAppMessage } from "@/types";
import { normalizeWhatsAppGroupId } from "@/lib/server/whatsapp";

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value).trim();
  }
  return "";
}

/**
 * Normalizes the incoming webhook payload from Green-API.
 * Handles `incomingMessageReceived`, extracting text, sender, group, and audio attachments.
 */
export function normalizeGreenApiWebhookPayload(
  payload: unknown
): NormalizedIncomingWhatsAppMessage | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const typeWebhook = pickString(root.typeWebhook);

  // Abaikan event status pesan terkirim/terbaca (outgoingMessageStatus, stateInstanceChanged, dll)
  if (typeWebhook && typeWebhook !== "incomingMessageReceived") {
    return null;
  }

  const senderData = (root.senderData && typeof root.senderData === "object"
    ? root.senderData
    : {}) as Record<string, unknown>;

  const messageData = (root.messageData && typeof root.messageData === "object"
    ? root.messageData
    : {}) as Record<string, unknown>;

  const textMessageData = (messageData.textMessageData && typeof messageData.textMessageData === "object"
    ? messageData.textMessageData
    : {}) as Record<string, unknown>;

  const extendedTextMessageData = (messageData.extendedTextMessageData && typeof messageData.extendedTextMessageData === "object"
    ? messageData.extendedTextMessageData
    : {}) as Record<string, unknown>;

  const fileMessageData = (messageData.fileMessageData && typeof messageData.fileMessageData === "object"
    ? messageData.fileMessageData
    : {}) as Record<string, unknown>;

  // Read message content
  const textMessage = pickString(
    textMessageData.textMessage,
    extendedTextMessageData.text,
    fileMessageData.caption,
    messageData.caption
  );

  // Read sender and chat IDs
  const rawChatId = pickString(senderData.chatId, root.chatId);
  const rawSender = pickString(senderData.sender, root.sender);

  const isGroup =
    rawChatId.endsWith("@g.us") ||
    rawChatId.startsWith("120363") ||
    rawChatId.includes("-");

  let finalGroupId: string | undefined = undefined;
  let finalSender = rawSender;

  if (isGroup) {
    finalGroupId = normalizeWhatsAppGroupId(rawChatId, "green-api");
    if (!finalSender) {
      finalSender = rawChatId;
    }
  } else {
    finalSender = finalSender || rawChatId;
  }

  // Bersihkan format nomor pengirim
  finalSender = finalSender
    .replace(/@c\.us$/i, "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/[^\d]/g, "");

  const senderName = pickString(senderData.senderName, senderData.senderContactName);

  // Read media URL / file URL / audio
  const mediaUrl = pickString(
    fileMessageData.downloadUrl,
    fileMessageData.urlFile,
    messageData.downloadUrl,
    messageData.urlFile
  );

  const filename = pickString(fileMessageData.fileName, messageData.fileName);
  const filetype = pickString(fileMessageData.mimeType, messageData.mimeType);
  const messageType = pickString(messageData.typeMessage);

  const isAudio =
    messageType === "audioMessage" ||
    messageType === "voiceMessage" ||
    filetype.toLowerCase().includes("audio") ||
    /\.(ogg|opus|mp3|m4a|wav|aac)(\?.*)?$/i.test(mediaUrl || filename);

  const effectiveMessage = textMessage || (isAudio ? "non-text message" : mediaUrl);

  if (!effectiveMessage && !mediaUrl) {
    console.warn("[green-api webhook] ignored payload without message text or media URL", {
      typeWebhook,
      idMessage: root.idMessage,
    });
    return null;
  }

  const rawId = pickString(root.idMessage, root.id);
  const timestamp = root.timestamp;

  return {
    provider: "green-api",
    message: effectiveMessage,
    sender: finalSender,
    senderName: senderName || undefined,
    groupId: finalGroupId,
    isGroup,
    rawMessageId: rawId || undefined,
    timestamp: typeof timestamp === "string" || typeof timestamp === "number" ? timestamp : undefined,
    url: mediaUrl || undefined,
    mediaUrl: mediaUrl || undefined,
    attachment: mediaUrl || undefined,
    filename: filename || undefined,
    filetype: filetype || (isAudio ? "audio/ogg" : undefined),
    messageType: messageType || undefined,
    extension: filename ? filename.split(".").pop() : isAudio ? "ogg" : undefined,
  } satisfies NormalizedIncomingWhatsAppMessage;
}
