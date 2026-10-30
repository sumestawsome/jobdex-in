import "server-only";

export type WablasIncomingMessage = {
  message: string;
  sender: string;
  groupId: string;
  senderName: string;
  messageType: string;
  isGroup: boolean;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function stringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function booleanValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      return ["true", "1", "yes", "group"].includes(value.toLowerCase());
    }
  }

  return false;
}

export function parseWablasIncomingPayload(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const messageData = asRecord(root.messageData);
  const candidate = Object.keys(data).length ? data : Object.keys(messageData).length ? messageData : root;
  const message = stringValue(
    candidate.message,
    candidate.text,
    candidate.body,
    candidate.caption,
    root.message,
    root.text,
    root.body,
  );
  const sender = stringValue(
    candidate.sender,
    candidate.from,
    candidate.phone,
    candidate.number,
    root.sender,
    root.from,
    root.phone,
  );
  const groupId = stringValue(
    candidate.group_id,
    candidate.groupId,
    candidate.chat_id,
    candidate.chatId,
    candidate.phone,
    candidate.from,
    root.group_id,
    root.groupId,
    root.chat_id,
    root.chatId,
    root.phone,
    root.from,
  );
  const senderName = stringValue(
    candidate.name,
    candidate.pushName,
    candidate.sender_name,
    root.name,
    root.pushName,
    root.sender_name,
  );
  const messageType = stringValue(candidate.type, candidate.message_type, root.type, root.message_type) || "text";
  const isGroup = booleanValue(
    candidate.isGroup,
    candidate.is_group,
    candidate.from_group,
    root.isGroup,
    root.is_group,
    root.from_group,
  );

  return {
    message,
    sender,
    groupId,
    senderName,
    messageType,
    isGroup,
  } satisfies WablasIncomingMessage;
}

export function extractJobDexQuestion(message: string, isBotMentioned = false) {
  let clean = (message || "").trim();
  // Strip LID or phone mention if present
  clean = clean.replace(/^@\d+\s*/, "").replace(/^@(?:jobde[xs](?:\.in)?|bot)\b\s*/i, "").trim();

  // Strip !jobdex, !jobdesk, jobdex, jobdesk
  if (/^(?:[!/])?jobde[xs]\b/i.test(clean)) {
    return clean.replace(/^(?:[!/])?jobde[xs]\b/i, "").trim();
  }

  // Jika bot di-mention atau ditandai, seluruh teks yang tersisa adalah pertanyaan/perintah
  if (isBotMentioned) {
    return clean;
  }

  return "";
}
