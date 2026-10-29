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
 * Normalizes the incoming webhook payload from Fonnte.
 * Supports root-level fields, choices[0] array structure, and multiple field names.
 */
export function normalizeFonnteWebhookPayload(payload: unknown): NormalizedIncomingWhatsAppMessage | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const firstChoice = Array.isArray(root.choices) && root.choices[0]
    ? root.choices[0] as Record<string, unknown>
    : {};
  const data = Object.keys(firstChoice).length ? firstChoice : root;

  // Read message content
  const message = pickString(
    data.message,
    data.text,
    data.body,
    data.chat,
    data.content,
    data.pesan,
    root.message,
    root.text,
    root.body,
    root.pesan
  );

  // Read group ID
  const rawGroupId = pickString(
    data.group_id,
    data.groupId,
    data.group,
    data.remoteJid,
    data.from,
    data.sender,
    root.group_id,
    root.groupId,
    root.group,
    root.remoteJid,
    root.from,
    root.sender
  );

  // Read sender phone / member
  const sender = pickString(
    data.member,
    data.participant,
    data.phone,
    data.number,
    data.sender_number,
    data.senderNumber,
    data.from_number,
    data.fromNumber,
    data.pengirim,
    root.member,
    root.participant,
    root.phone,
    root.number,
    root.pengirim
  );

  // Determine if it is a group message
  const isGroupVal = pickString(data.is_group, data.isGroup, data.isgroup, root.is_group, root.isGroup, root.isgroup);
  const rawSenderCandidate = pickString(data.sender, root.sender);
  const isGroupBool = 
    rawGroupId.includes("@g.us") ||
    rawGroupId.startsWith("120363") ||
    rawSenderCandidate.includes("@g.us") ||
    rawSenderCandidate.startsWith("1203") ||
    isGroupVal === "true" ||
    isGroupVal === "1" ||
    isGroupVal === "yes" ||
    isGroupVal === "group" ||
    (typeof data.isGroup === "boolean" && data.isGroup) ||
    (typeof data.isgroup === "boolean" && data.isgroup) ||
    (typeof root.isGroup === "boolean" && root.isGroup) ||
    (typeof root.isgroup === "boolean" && root.isgroup);

  const isGroup = Boolean(isGroupBool);

  let finalGroupId: string | undefined = undefined;
  let finalSender = sender;

  if (isGroup) {
    if (rawGroupId) {
      finalGroupId = normalizeWhatsAppGroupId(rawGroupId, "fonnte");
    } else if (rawSenderCandidate.includes("@g.us") || rawSenderCandidate.startsWith("1203")) {
      finalGroupId = normalizeWhatsAppGroupId(rawSenderCandidate, "fonnte");
    }

    // Jika pesan dari grup, ambil pengirim asli dari member / pengirim
    const groupMember = pickString(
      data.pengirim,
      data.member,
      data.participant,
      data.phone,
      data.number,
      data.sender_number,
      data.senderNumber,
      root.pengirim,
      root.member,
      root.participant,
      root.phone,
      root.number
    );

    if (groupMember) {
      finalSender = groupMember;
    } else if (!finalSender && (!rawSenderCandidate.includes("@g.us") && !rawSenderCandidate.startsWith("1203"))) {
      finalSender = rawSenderCandidate;
    }
  } else {
    // Personal chat: sender is rawGroupId (or sender if populated)
    finalSender = finalSender || rawSenderCandidate || rawGroupId;
  }

  // Clean the sender phone number to pure digits (62xxx)
  finalSender = finalSender
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/[\s\-\+\(\)]/g, "")
    .replace(/\D/g, "")
    .replace(/^0/, "62")
    .replace(/^8/, "628");

  // Read sender display name
  const senderName = pickString(
    data.name,
    data.pushname,
    data.username,
    data.pushName,
    data.sender_name,
    root.name,
    root.pushname,
    root.pushName,
    root.username
  );

  // Read raw message ID (abaikan 0, "0", null, undefined)
  const candidateId = pickString(
    data.id,
    data.inboxid,
    data.message_id,
    data.msg_id,
    root.id,
    root.inboxid,
    root.message_id
  );
  const rawMessageId =
    candidateId && candidateId !== "0" && candidateId !== "null" && candidateId !== "undefined"
      ? candidateId
      : undefined;

  const rawTimestamp = data.timestamp ?? root.timestamp;
  const timestamp =
    (typeof rawTimestamp === "string" || typeof rawTimestamp === "number") && String(rawTimestamp).trim() !== "0"
      ? String(rawTimestamp).trim()
      : undefined;


  // Read media URL / file URL / attachment (e.g. for voice notes / audio)
  const mediaUrl = pickString(
    data.url,
    data.file,
    data.attachment,
    data.media,
    data.audio,
    data.voice,
    data.link,
    root.url,
    root.file,
    root.attachment,
    root.media,
    root.audio,
    root.voice,
    root.link
  );

  // Read media extension / format
  const extension = pickString(
    data.extension,
    data.ext,
    data.filetype,
    root.extension,
    root.ext,
    root.filetype
  );

  const filename = pickString(
    data.filename,
    data.name_file,
    data.fileName,
    root.filename,
    root.name_file,
    root.fileName
  );

  const filetype = pickString(
    data.filetype,
    data.type,
    data.fileType,
    data.mime,
    data.mimetype,
    root.filetype,
    root.type,
    root.fileType,
    root.mime,
    root.mimetype
  );

  // Warning jika pesan non-text tapi URL media kosong
  const isNonTextMessage =
    message.trim().toLowerCase() === "non-text message" ||
    filetype.toLowerCase().includes("audio") ||
    filetype.toLowerCase().includes("voice");
  if (isNonTextMessage && !mediaUrl) {
    console.warn("[whatsapp audio] received non-text message but mediaUrl is empty", {
      sender: finalSender,
      message,
      filetype,
    });
  }

  const keys = Object.keys(root);
  const effectiveMessage = message || mediaUrl || "";
  if (!effectiveMessage) {
    console.warn("[fonnte webhook] ignored payload without message or media url", { keys });
    return null;
  }

  return {
    provider: "fonnte",
    message: effectiveMessage,
    sender: finalSender,
    senderName: senderName || undefined,
    groupId: finalGroupId,
    isGroup,
    rawMessageId: rawMessageId || undefined,
    timestamp: (typeof timestamp === "string" || typeof timestamp === "number") ? timestamp : undefined,
    url: mediaUrl || undefined,
    mediaUrl: mediaUrl || undefined,
    attachment: mediaUrl || undefined,
    filename: filename || undefined,
    filetype: filetype || undefined,
    messageType: filetype || undefined,
    extension: extension || undefined,
  } satisfies NormalizedIncomingWhatsAppMessage;
}
