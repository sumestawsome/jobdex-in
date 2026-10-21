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
  const isGroupBool = 
    rawGroupId.includes("@g.us") ||
    rawGroupId.startsWith("120363") ||
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

  if (isGroup && rawGroupId) {
    finalGroupId = normalizeWhatsAppGroupId(rawGroupId, "fonnte");
    // If the sender is empty, fallback to rawGroupId
    if (!finalSender) {
      finalSender = rawGroupId;
    }
  } else {
    // Personal chat: sender is rawGroupId (or sender if populated)
    finalSender = finalSender || rawGroupId;
  }

  // Clean the sender phone number from any suffix
  finalSender = finalSender.replace(/@s\.whatsapp\.net$/i, "").replace(/@c\.us$/i, "");

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


  const keys = Object.keys(root);
  if (!message) {
    console.warn("[fonnte webhook] ignored payload without message", { keys });
    return null;
  }

  return {
    provider: "fonnte",
    message,
    sender: finalSender,
    senderName: senderName || undefined,
    groupId: finalGroupId,
    isGroup,
    rawMessageId: rawMessageId || undefined,
    timestamp: (typeof timestamp === "string" || typeof timestamp === "number") ? timestamp : undefined,
  } satisfies NormalizedIncomingWhatsAppMessage;
}
