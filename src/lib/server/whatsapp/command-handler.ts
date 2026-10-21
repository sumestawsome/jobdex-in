import "server-only";
import { NextResponse } from "next/server";
import { AI_SYSTEM_PROMPT } from "@/lib/ai-prompts";
import { buildAIContext } from "@/lib/server/ai-context";
import { FieldValue, getAdminDb } from "@/lib/server/firebase-admin";
import { GEMINI_EMPTY_ANSWER_FALLBACK } from "@/lib/server/gemini";
import { generateText } from "@/lib/server/ai-provider";
import { getTaskDeadlineDiffDays } from "@/lib/task-risk";
import {
  findEventByGroupId,
  getEventsWithGroupId,
  linkGroupToEvent,
  resolveTaskNotificationTarget,
  getGroupIdVariants,
} from "@/lib/server/group-routing";
import {
  getWhatsAppRecipient,
  getWhatsAppRecipientType,
  isWhatsAppGroupRecipient,
  sendWhatsAppMessage as baseSendWhatsAppMessage,
  WhatsAppRateLimitError,
  getAllowedGroupIds,
  getWhatsAppRecipient as getDefaultGroupId,
  isGroupRecipient,
  formatWhatsAppText,
} from "@/lib/server/whatsapp";
import {
  extractJobDexQuestion,
} from "@/lib/server/wablas-webhook-parser";
import { parseWhatsAppCommand, isTaskCommandLike } from "@/lib/server/whatsapp-command-parser";
import { buildWhatsAppCommandPreview } from "@/lib/server/whatsapp-command-preview";
import {
  confirmPreviewCommand,
  cancelPreviewCommand,
  sanitizePinFromMessage,
} from "@/lib/server/whatsapp-command-executor";
import { findOrmawaGatewayByToken } from "@/lib/server/ormawa-whatsapp-gateway";
import {
  handleDeadlineQuery,
  handleApproveTaskCommand,
  handleUpdateTaskStatusCommand,
  handleEditTaskCommand,
  handleConfirmEditTaskCommand,
  handleCancelEditTaskCommand,
  handleArchiveTaskCommand,
  handleConfirmArchiveCommand,
  handleChecklistCommand,
  handleTugasSayaCommand,
  handleDetailTaskCommand,
  handleUploadHasilCommand,
  handleMintaRevisiCommand,
  handleCekChecklistCommand,
  handleTambahCatatanCommand,
  handleGantiPicCommand,
  handleBriefingCommand,
  handleSiapaBelumUpdateCommand,
} from "@/lib/server/whatsapp-task-command-executor";
import type { UserProfile, Event, Task, NormalizedIncomingWhatsAppMessage } from "@/types";
import { USER_ROLE_LABELS } from "@/lib/roles";
import { WA_LABEL } from "@/lib/server/whatsapp-labels";
import {
  isReferenceSearchQuestion,
  searchDesignReferencesFromQuestion,
} from "@/lib/server/reference-search";
import {
  findFaqMatch,
  incrementFaqHitCount,
} from "@/lib/server/faq-matcher";

export { findFaqMatch } from "@/lib/server/faq-matcher";

function isGroupAllowedByVariants(incomingGroupId: string, allowedGroupIds: string[]): boolean {
  if (!incomingGroupId) return false;
  const incomingVariants = getGroupIdVariants(incomingGroupId);
  const allowedVariants = allowedGroupIds.flatMap(getGroupIdVariants);

  return incomingVariants.some((id) => allowedVariants.includes(id));
}

async function isGroupAllowedForJobDex(groupId: string): Promise<boolean> {
  if (!groupId) return false;

  // 1. Sandbox Group is always allowed
  const variants = getGroupIdVariants(groupId);
  if (variants.some((v) => v.includes("120363406824082148"))) {
    return true;
  }

  // 2. Allowed Group IDs from environment
  const allowed = getAllowedGroupIds();
  if (isGroupAllowedByVariants(groupId, allowed)) {
    return true;
  }

  try {
    const db = getAdminDb();
    // 3. Check Events collection
    for (const variant of variants) {
      const snapshot = await db
        .collection("events")
        .where("whatsapp_group_id", "==", variant)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return true;
      }
    }

    // 4. Check Divisions collection
    for (const variant of variants) {
      const divSnapshot = await db
        .collection("divisions")
        .where("whatsapp_group_id", "==", variant)
        .limit(1)
        .get();

      if (!divSnapshot.empty) {
        return true;
      }
    }
  } catch (err) {
    console.error("Error in isGroupAllowedForJobDex:", err);
  }
  return false;
}

function getBotProfile() {
  return {
    id: "whatsapp_bot",
    organization_id: "main_org",
    name: "WhatsApp Bot",
    email: "",
    whatsapp_number: "",
    role: "super_admin",
    division_id: "humas_media_kreatif",
    avatar_url: "",
    is_active: true,
  } satisfies UserProfile;
}

async function baseCreateWhatsAppLog({
  message,
  status,
  response,
  errorMessage,
  recipient,
  isGroup,
  errorCode,
  cooldownUntil,
  rateLimitReason,
  provider,
}: {
  message: string;
  status: string;
  response?: string;
  errorMessage?: string;
  recipient?: string;
  isGroup?: boolean;
  errorCode?: string | number;
  cooldownUntil?: Date | null;
  rateLimitReason?: string;
  provider?: string;
}) {
  const logRef = getAdminDb().collection("whatsapp_logs").doc();

  await logRef.set({
    id: logRef.id,
    organization_id: "main_org",
    event_type: "whatsapp_ai_bot_reply",
    message_content: message,
    recipient: recipient ?? getWhatsAppRecipient(),
    recipient_type: isGroup !== undefined ? (isGroup ? "group" : "personal") : getWhatsAppRecipientType(),
    is_group: isGroup !== undefined ? isGroup : isWhatsAppGroupRecipient(),
    status,
    send_status: status,
    error_code: errorCode || null,
    error_message: errorMessage || null,
    cooldown_until: cooldownUntil || null,
    message_length: message.length,
    rate_limit_reason: rateLimitReason || null,
    ...(response ? { wablas_response: response } : {}),
    retry_count: 0,
    created_at: FieldValue.serverTimestamp(),
    provider: provider || process.env.WHATSAPP_PROVIDER || "wablas",
    target_type: isGroup ? "group" : "phone",
  });
}

function sanitizePayload(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizePayload);
  }

  const record = obj as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = ["token", "secret", "authorization", "api_key", "apikey", "password", "credential"];

  for (const key of Object.keys(record)) {
    const isSensitive = sensitiveKeys.some(
      (s) => key.toLowerCase().includes(s)
    );
    if (isSensitive) {
      sanitized[key] = "[STRIPPED]";
    } else {
      sanitized[key] = sanitizePayload(record[key]);
    }
  }

  return sanitized;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizePhone(value: string): string {
  return value
    .replace(/\@s\.whatsapp\.net$/i, "")
    .replace(/\@c\.us$/i, "")
    .replace(/\D/g, "")
    .replace(/^0/, "62")
    .replace(/^8/, "628");
}

async function resolveWebhookOrmawaId(
  incoming: NormalizedIncomingWhatsAppMessage,
  payload: unknown
): Promise<string | null> {
  const db = getAdminDb();

  // 1. Cek payload webhook jika membawa token gateway (Fonnte / Wablas)
  if (payload && typeof payload === "object") {
    const pObj = payload as Record<string, unknown>;
    const token =
      typeof pObj.token === "string"
        ? pObj.token.trim()
        : typeof pObj.secret === "string"
        ? pObj.secret.trim()
        : "";
    if (token) {
      const gw = await findOrmawaGatewayByToken(token);
      if (gw?.org_id) return gw.org_id;
    }

    if (typeof pObj.org_id === "string" && pObj.org_id) {
      return pObj.org_id;
    }
    if (typeof pObj.orgId === "string" && pObj.orgId) {
      return pObj.orgId;
    }
  }

  // 2. Cek berdasarkan nomor WhatsApp pengirim
  if (incoming.sender) {
    const cleanSender = normalizePhone(incoming.sender);
    const usersSnap = await db.collection("users").get();
    for (const doc of usersSnap.docs) {
      const u = doc.data() as Record<string, unknown>;
      const phones = [u.whatsapp, u.whatsapp_number, u.phone, u.phone_number];
      for (const p of phones) {
        if (p && normalizePhone(String(p)) === cleanSender) {
          const userOrgId = (u.org_id || u.orgId || u.organization_id) as string | undefined;
          if (userOrgId && userOrgId !== "main_org") {
            return userOrgId;
          }
          break;
        }
      }
    }
  }

  // 3. Cek berdasarkan grup ID (apakah grup terhubung ke event/divisi/ormawa tertentu)
  if (incoming.groupId) {
    const groupVariants = getGroupIdVariants(incoming.groupId);
    // Cek events
    const eventsSnap = await db.collection("events").get();
    for (const doc of eventsSnap.docs) {
      const ev = doc.data() as Record<string, unknown>;
      if (ev.whatsapp_group_id && groupVariants.includes(String(ev.whatsapp_group_id))) {
        const evOrgId = (ev.org_id || ev.orgId || ev.organization_id) as string | undefined;
        if (evOrgId && evOrgId !== "main_org") return evOrgId;
      }
    }
    // Cek ormawas
    const ormawasSnap = await db.collection("ormawas").get();
    for (const doc of ormawasSnap.docs) {
      const o = doc.data() as Record<string, unknown>;
      if (o.whatsapp_group_id && groupVariants.includes(String(o.whatsapp_group_id))) {
        return doc.id;
      }
    }
  }

  return null;
}

function getNestedProperty(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function extractCandidates(payload: unknown): Record<string, string> {
  const candidates: Record<string, string> = {};
  
  if (!payload || typeof payload !== "object") return candidates;

  const root = getRecord(payload);
  const data = getRecord(root?.data);
  const keyObj = getRecord(root?.key);
  const dataKeyObj = getRecord(data?.key);

  const getStr = (val: unknown): string => {
    if (typeof val === "string") return val;
    if (typeof val === "number") return String(val);
    return "";
  };

  // Root level candidates
  candidates["sender"] = getStr(root?.sender);
  candidates["from"] = getStr(root?.from);
  candidates["phone"] = getStr(root?.phone);
  candidates["author"] = getStr(root?.author);
  candidates["participant"] = getStr(root?.participant);
  candidates["sender_number"] = getStr(root?.sender_number);
  candidates["phone_number"] = getStr(root?.phone_number);
  candidates["key.participant"] = getStr(keyObj?.participant);
  candidates["key.remoteJid"] = getStr(keyObj?.remoteJid);

  // Data level candidates
  candidates["data.sender"] = getStr(data?.sender);
  candidates["data.from"] = getStr(data?.from);
  candidates["data.phone"] = getStr(data?.phone);
  candidates["data.author"] = getStr(data?.author);
  candidates["data.participant"] = getStr(data?.participant);
  candidates["data.key.participant"] = getStr(dataKeyObj?.participant);
  candidates["data.key.remoteJid"] = getStr(dataKeyObj?.remoteJid);

  // Group participants candidates (extract from root or data.group)
  const group = getRecord(root?.group) ?? getRecord(data?.group);
  const participants = getArray(group?.participants);

  const allSenders: string[] = [];
  for (let i = 0; i < participants.length; i++) {
    const p = getRecord(participants[i]);
    if (p) {
      const rawSender = getString(p.sender);
      const s = normalizePhone(rawSender);
      const isLid = rawSender.toLowerCase().includes("@lid");
      
      candidates[`group.participants[${i}].sender`] = s;
      
      if (s && !isLid) {
        allSenders.push(s);
      }
    }
  }
  candidates["group_participant_senders"] = allSenders.join(", ");

  return candidates;
}

function generateConfirmationCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function scrubPinFromPayload(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") {
    if (typeof obj === "string") {
      return sanitizePinFromMessage(obj);
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(scrubPinFromPayload);
  }
  
  const record = obj as Record<string, unknown>;
  const scrubbed: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    scrubbed[key] = scrubPinFromPayload(record[key]);
  }
  return scrubbed;
}

async function handleJobdeskSummary(
  incoming: NormalizedIncomingWhatsAppMessage,
  senderUserProfile: UserProfile | null,
  matchedEvent: Event | null,
  matchedDivision: { id: string; name?: string } | null
): Promise<string> {
  const db = getAdminDb();
  let tasksQuery = db.collection("tasks").where("is_archived", "==", false);
  let contextName = "";
  let isEventContext = false;

  if (matchedEvent) {
    tasksQuery = tasksQuery.where("event_id", "==", matchedEvent.id);
    contextName = matchedEvent.name;
    isEventContext = true;
  } else if (matchedDivision) {
    tasksQuery = tasksQuery.where("division_id", "==", matchedDivision.id);
    contextName = matchedDivision.name || "Divisi";
  } else {
    // Default/fallback
    if (senderUserProfile) {
      if (senderUserProfile.role === "koordinator_divisi") {
        tasksQuery = tasksQuery.where("division_id", "==", senderUserProfile.division_id);
        contextName = `Divisi (${senderUserProfile.division_id})`;
      } else if (senderUserProfile.role === "koordinator_acara") {
        tasksQuery = tasksQuery.where("coordinator_id", "==", senderUserProfile.id);
        contextName = "Acara Saya";
      } else {
        tasksQuery = tasksQuery.where("pic_id", "==", senderUserProfile.id);
        contextName = "Tugas Saya";
      }
    } else {
      contextName = "Global / Umum";
    }
  }

  const tasksSnap = await tasksQuery.get();
  
  const picIds = new Set<string>();
  let totalTasks = 0;
  let approvedCount = 0;
  let belumDimulaiCount = 0;
  let revisiCount = 0;
  let overdueCount = 0;
  let inProgressCount = 0;

  const priorityTasks: Task[] = [];

  tasksSnap.forEach((doc) => {
    const task = { id: doc.id, ...doc.data() } as Task;
    totalTasks++;
    if (task.pic_id) {
      picIds.add(task.pic_id);
    }

    if (task.status === "approved") {
      approvedCount++;
    } else {
      const diffDays = getTaskDeadlineDiffDays(task);
      if (diffDays < 0) {
        overdueCount++;
      }
      
      if (task.status === "belum_dimulai") {
        belumDimulaiCount++;
      } else if (task.status === "perlu_revisi" || task.status === "revisi_dikerjakan") {
        revisiCount++;
      } else {
        inProgressCount++;
      }

      if (task.priority === "tinggi" || task.priority === "kritis" || diffDays < 0) {
        priorityTasks.push(task);
      }
    }
  });

  const progressPercent = totalTasks > 0 ? Math.round((approvedCount / totalTasks) * 100) : 0;
  const lines: string[] = [];

  if (isEventContext) {
    lines.push(`[*JobDex.in* Ringkasan Job Desk ${contextName}]`, "");
    lines.push(`Progress acara: ${progressPercent}%`);
    lines.push(`Total anggota: ${picIds.size}`);
    lines.push("");
    lines.push("Ringkasan task:");
    lines.push(`• Approved: ${approvedCount}`);
    lines.push(`• Belum dimulai: ${belumDimulaiCount}`);
    if (revisiCount > 0) lines.push(`• Revisi: ${revisiCount}`);
    if (overdueCount > 0) lines.push(`• Overdue: ${overdueCount}`);
    lines.push(`• In Progress: ${inProgressCount}`);
    lines.push("");

    if (priorityTasks.length > 0) {
      lines.push("Task yang perlu perhatian:");
      const sortedPriorityTasks = priorityTasks.sort((a, b) => getTaskDeadlineDiffDays(a) - getTaskDeadlineDiffDays(b));
      
      const usersSnap = await db.collection("users").get();
      const usersMap = new Map<string, string>();
      usersSnap.forEach(d => usersMap.set(d.id, d.data().name || "-"));

      sortedPriorityTasks.slice(0, 3).forEach((task, idx) => {
        const picName = task.pic_id ? (usersMap.get(task.pic_id) || "-") : "-";
        let deadlineStr = "-";
        if (task.deadline) {
          const deadlineDate = task.deadline && typeof task.deadline === "object" && "toDate" in task.deadline
            ? (task.deadline as { toDate: () => Date }).toDate()
            : task.deadline instanceof Date
            ? task.deadline
            : null;
          if (deadlineDate) {
            deadlineStr = deadlineDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
          }
        }
        lines.push(`${idx + 1}. ${task.name} — PIC: ${picName} — Deadline: ${deadlineStr}`);
      });
      lines.push("");
    }

    lines.push("Ketik:");
    lines.push("!jobdex detail jobdesk");
    lines.push("untuk melihat daftar lebih lengkap.");
  } else {
    lines.push(`[*JobDex.in* Ringkasan Job Desk ${contextName}]`, "");
    lines.push(`Total tugas: ${totalTasks}`);
    lines.push(`Total PIC: ${picIds.size}`);
    lines.push("");
    lines.push("Ringkasan task:");
    lines.push(`• Approved: ${approvedCount}`);
    lines.push(`• Belum dimulai: ${belumDimulaiCount}`);
    if (revisiCount > 0) lines.push(`• Revisi: ${revisiCount}`);
    if (overdueCount > 0) lines.push(`• Overdue: ${overdueCount}`);
    lines.push(`• In Progress: ${inProgressCount}`);
    lines.push("");

    if (priorityTasks.length > 0) {
      lines.push("Task yang perlu perhatian:");
      const sortedPriorityTasks = priorityTasks.sort((a, b) => getTaskDeadlineDiffDays(a) - getTaskDeadlineDiffDays(b));
      
      const usersSnap = await db.collection("users").get();
      const usersMap = new Map<string, string>();
      usersSnap.forEach(d => usersMap.set(d.id, d.data().name || "-"));

      sortedPriorityTasks.slice(0, 3).forEach((task, idx) => {
        const picName = task.pic_id ? (usersMap.get(task.pic_id) || "-") : "-";
        let deadlineStr = "-";
        if (task.deadline) {
          const deadlineDate = task.deadline && typeof task.deadline === "object" && "toDate" in task.deadline
            ? (task.deadline as { toDate: () => Date }).toDate()
            : task.deadline instanceof Date
            ? task.deadline
            : null;
          if (deadlineDate) {
            deadlineStr = deadlineDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
          }
        }
        lines.push(`${idx + 1}. ${task.name} — PIC: ${picName} — Deadline: ${deadlineStr}`);
      });
      lines.push("");
    }
  }

  return lines.join("\n");
}

export async function executeWhatsAppWebhook(
  incoming: NormalizedIncomingWhatsAppMessage,
  payload: unknown
): Promise<NextResponse> {
  console.log("[whatsapp command] incoming", {
    provider: incoming.provider,
    isGroup: incoming.isGroup,
    groupId: incoming.groupId,
    hasSender: Boolean(incoming.sender),
    messagePreview: incoming.message?.slice(0, 40),
  });

  const message = incoming.message || "";
  const trimmed = message.trim();
  const stripped = trimmed.replace(/^[*_~`]+|[*_~`]+$/g, "").trim();
  const isJobdexPrefixed = /^[!/]jobde[xs]/i.test(stripped);

  // Di grup WhatsApp, abaikan pesan yang bukan untuk bot (tidak berawalan !jobdex) agar tidak spam obrolan panitia
  if (incoming.isGroup && !isJobdexPrefixed) {
    console.log("[whatsapp command] step: non_jobdex_group_message_ignored", {
      isGroup: incoming.isGroup,
      messagePreview: trimmed.slice(0, 30),
    });
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "non_jobdex_group_message",
    });
  }

  // --- Penanganan Langsung: Perintah !jobdex Tunggal (Tanpa Argumen) ---
  const cleanAfterPrefix = stripped.replace(/^[!/]jobde[xs]\b/i, "").trim();
  if (isJobdexPrefixed && cleanAfterPrefix === "") {
    console.log("[whatsapp command] step: empty_jobdex_greeting");
    const singleJobdexReply = [
      "Halo! Ada yang bisa JobDex bantu? 🙌",
      "Ketik `!jobdex bantuan` untuk daftar perintah lengkap, atau `!jobdex tugas saya` untuk cek tugas aktif kamu."
    ].join("\n");

    const replyTarget = incoming.isGroup
      ? (incoming.groupId || getDefaultGroupId())
      : (incoming.sender || incoming.groupId || getDefaultGroupId());
    const isGroupTarget = incoming.isGroup || isGroupRecipient(replyTarget);

    console.log("[whatsapp command] step: empty_jobdex_sending_reply", {
      target: replyTarget,
      isGroup: isGroupTarget,
      provider: incoming.provider,
    });

    const sendResult = await baseSendWhatsAppMessage({
      target: replyTarget,
      message: singleJobdexReply,
      type: isGroupTarget ? "group" : "phone",
    });

    await baseCreateWhatsAppLog({
      message: singleJobdexReply,
      status: sendResult.ok ? "sent" : "failed",
      response: sendResult.responseText,
      recipient: replyTarget,
      isGroup: isGroupTarget,
      provider: sendResult.provider,
    });

    console.log("[whatsapp command] step: empty_jobdex_greeting_completed", {
      ok: sendResult.ok,
      target: replyTarget,
    });
    return NextResponse.json({ ok: true, commandType: "empty_jobdex_greeting" });
  }

  console.log("[whatsapp command] step: parse_command_start");
  let parsedCommand = parseWhatsAppCommand(incoming.message || "");
  if (parsedCommand.intent === "unknown") {
    console.log("[whatsapp command] step: parse_command_natural_fallback");
    const { parseWhatsAppCommandNatural } = await import("@/lib/server/whatsapp-command-parser");
    const naturalParsed = await parseWhatsAppCommandNatural(incoming.message || "");
    if (naturalParsed.intent !== "unknown") {
      parsedCommand = naturalParsed;
    }
  }
  const intent = parsedCommand.intent;

  console.log("[whatsapp command] step: command_detected", {
    command: intent,
    provider: incoming.provider,
    groupId: incoming.groupId,
  });

  const question = extractJobDexQuestion(incoming.message);
  const db = getAdminDb();
  const detectedOrgId = await resolveWebhookOrmawaId(incoming, payload);

  const sendWhatsAppMessage = async (message: string, customPhone?: string) => {
    const formattedMessage = formatWhatsAppText(message);
    const defaultTarget = incoming.isGroup
      ? (incoming.groupId || getDefaultGroupId())
      : (incoming.sender || incoming.groupId || getDefaultGroupId());
    const target = customPhone || defaultTarget;
    const isGroup = incoming.isGroup || isGroupRecipient(target);
    const type = isGroup ? "group" : "phone";
    const cleanCmd = stripped.replace(/^[!/]jobde[xs]\b/i, "").trim().toLowerCase();

    console.log("[whatsapp command] step: before_send_message", {
      sendReason: "standard_reply",
      target,
      type,
      commandType: cleanCmd || "unknown",
    });

    console.log("[whatsapp command] reply target", {
      target,
      type,
      provider: process.env.WHATSAPP_PROVIDER,
    });

    try {
      const result = await baseSendWhatsAppMessage({
        target,
        message: formattedMessage,
        type,
        org_id: detectedOrgId || undefined,
      });

      if (result.skipped) {
        console.warn(
          `[whatsapp command] Balasan bot dilewati: gateway ormawa (${detectedOrgId}) belum diatur.`
        );
        await createWhatsAppLog({
          message: formattedMessage,
          status: "skipped",
          errorMessage: result.error || "Gateway WhatsApp ormawa belum dikonfigurasi.",
          recipient: target,
          isGroup,
          provider: result.provider,
        });
        return result;
      }

      console.log("[whatsapp command] reply send result", {
        ok: result.ok,
        provider: result.provider,
        target: result.target,
        error: result.error || null,
      });
      return result;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[whatsapp command] failed to send reply", {
        provider: process.env.WHATSAPP_PROVIDER,
        target,
        error: errMsg,
      });
      console.log("[whatsapp command] reply send result", {
        ok: false,
        provider: process.env.WHATSAPP_PROVIDER,
        target,
        error: errMsg,
      });
      throw err;
    }
  };

  const createWhatsAppLog = async (args: {
    message: string;
    status: "sent" | "failed" | "skipped";
    response?: string;
    errorMessage?: string;
    recipient?: string;
    isGroup?: boolean;
    provider?: string;
  }) => {
    const recipient = args.recipient || incoming.groupId || getDefaultGroupId();
    const isGroup = args.isGroup ?? isGroupRecipient(recipient);
    return baseCreateWhatsAppLog({
      ...args,
      recipient,
      isGroup,
      provider: args.provider,
    });
  };

  const resolveTaskCommandReplyRecipient = async (taskId?: string) => {
    if (!taskId) {
      return incoming.groupId || getDefaultGroupId();
    }

    const taskDoc = await getAdminDb().collection("tasks").doc(taskId).get();
    if (!taskDoc.exists) {
      return incoming.groupId || getDefaultGroupId();
    }

    const task = { id: taskDoc.id, ...taskDoc.data() } as Task;
    const target = await resolveTaskNotificationTarget(task);

    return target?.recipient || incoming.groupId || getDefaultGroupId();
  };

  const sendTaskCommandReply = async (
    replyMessage: string,
    result: { success: boolean; taskId?: string },
  ) => {
    const formattedReply = formatWhatsAppText(replyMessage);
    const recipient = result.success
      ? await resolveTaskCommandReplyRecipient(result.taskId)
      : incoming.groupId || getDefaultGroupId();
    
    // Detect if recipient is a group ID or a phone number
    const isGroup = isGroupRecipient(recipient);
    const type = isGroup ? "group" : "phone";

    console.log("[whatsapp command] before send", {
      sendReason: "task_command_reply",
      target: recipient,
      type,
      commandType: intent,
    });

    console.log("[whatsapp command] reply target", {
      target: recipient,
      type,
      provider: process.env.WHATSAPP_PROVIDER,
    });

    let taskOrgId: string | undefined = undefined;
    if (result.taskId) {
      const tSnap = await getAdminDb().collection("tasks").doc(result.taskId).get();
      if (tSnap.exists) {
        const tData = tSnap.data() as Record<string, unknown>;
        taskOrgId = (tData.org_id || tData.orgId || tData.organization_id) as string | undefined;
      }
    }

    try {
      const sendResult = await baseSendWhatsAppMessage({
        target: recipient,
        message: formattedReply,
        type,
        org_id: taskOrgId || detectedOrgId || undefined,
      });

      if (sendResult.skipped) {
        console.warn(
          `[whatsapp command] Balasan tugas dilewati: gateway ormawa belum diatur.`
        );
        await createWhatsAppLog({
          message: formattedReply,
          status: "skipped",
          errorMessage: sendResult.error || "Gateway WhatsApp ormawa belum dikonfigurasi.",
          recipient,
          isGroup,
          provider: sendResult.provider,
        });
        return;
      }

      console.log("[whatsapp command] reply send result", {
        ok: sendResult.ok,
        provider: sendResult.provider,
        target: sendResult.target,
        error: sendResult.error || null,
      });

      await createWhatsAppLog({
        message: formattedReply,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
        recipient,
        isGroup,
        provider: sendResult.provider,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[whatsapp command] failed to send reply", {
        provider: process.env.WHATSAPP_PROVIDER,
        target: recipient,
        error: errMsg,
      });
      console.log("[whatsapp command] reply send result", {
        ok: false,
        provider: process.env.WHATSAPP_PROVIDER,
        target: recipient,
        error: errMsg,
      });
      throw err;
    }
  };

  // --- Bare & Help Command Handling (Fase 27A.2.5) ---
  const cleanQuery = stripped.replace(/^[!/]jobde[xs]\b/i, "").trim().toLowerCase();

  const helpMenuReply = [
    "✨ *Halo rekan-rekan Forkom KIP!*",
    "JobDex siap bantu pantau tugas & koordinasi kepanitiaan.",
    "",
    "Perintah yang sering dipakai:",
    "• `!jobdex tugas saya` → Cek job desk yang kamu pegang",
    "• `!jobdex jobdesk` → Rekap tugas acara / divisi",
    "• `!jobdex progress` → Ringkasan progres kerjaan",
    "• `!jobdex bantuan` → Daftar perintah lengkap panitia",
    "",
    "Mau tanya bebas seputar kepanitiaan atau draf tugas? Tulis aja langsung yaa, AI siap bantu! 🙌",
    "👉 Cek dashboard: https://jobdexin.sumestawsome.xyz/dashboard/tasks",
  ].join("\n");

  const singleJobdexReply = [
    "Halo! Ada yang bisa JobDex bantu? 🙌",
    "Ketik `!jobdex bantuan` untuk daftar perintah lengkap, atau `!jobdex tugas saya` untuk cek tugas aktif kamu."
  ].join("\n");

  if (cleanQuery === "") {
    console.log("[whatsapp command] step: clean_query_empty_greeting");
    const sendResult = await sendWhatsAppMessage(singleJobdexReply);
    await createWhatsAppLog({
      message: singleJobdexReply,
      status: "sent",
      response: sendResult.responseText,
    });
    return NextResponse.json({ ok: true, commandType: "empty_jobdex_greeting" });
  }

  if (cleanQuery === "help" || cleanQuery === "menu" || cleanQuery === "bantuan") {
    console.log("[whatsapp command] step: help_menu");
    console.log("[whatsapp command] resolved command", {
      rawQuery: message,
      normalizedQuery: cleanQuery,
      commandType: "help_menu",
      contextType: incoming.isGroup ? "group" : "personal",
      groupId: incoming.groupId || null,
    });

    console.log("[whatsapp command] handled", {
      commandType: "help_menu",
      handled: true,
      stopFurtherProcessing: true,
    });

    const sendResult = await sendWhatsAppMessage(helpMenuReply);
    await createWhatsAppLog({
      message: helpMenuReply,
      status: "sent",
      response: sendResult.responseText,
    });
    return NextResponse.json({ ok: true });
  }

  // --- Jobdesk Summary Aliases (Fase 27A.2.5) ---
  const JOBDESK_ALIASES = [
    "jobdesc",
    "jobdesk",
    "job desk",
    "job desc",
    "tugas",
    "task",
    "tasks",
    "daftar tugas",
    "info jobdesc",
    "info jobdesk",
    "info tugas"
  ];

  if (JOBDESK_ALIASES.includes(cleanQuery)) {
    // Resolve context event or division
    const matchedEvent = await findEventByGroupId(incoming.groupId || "");
    
    let matchedDivision = null;
    if (!matchedEvent && incoming.groupId) {
      const groupVariants = getGroupIdVariants(incoming.groupId);
      const divisionsSnap = await db.collection("divisions").get();
      for (const doc of divisionsSnap.docs) {
        const d = doc.data();
        if (d.whatsapp_group_id) {
          const dVariants = getGroupIdVariants(d.whatsapp_group_id);
          if (dVariants.some(dv => groupVariants.includes(dv))) {
            matchedDivision = { id: doc.id, ...d };
            break;
          }
        }
      }
    }

    console.log("[whatsapp command] resolved command", {
      rawQuery: message,
      normalizedQuery: cleanQuery,
      commandType: "jobdesk_summary",
      contextType: incoming.isGroup ? (matchedEvent ? "event" : (matchedDivision ? "division" : "default")) : "personal",
      groupId: incoming.groupId || null,
    });

    let senderUserProfile: UserProfile | null = null;
    const resolvedSenderNumber = incoming.sender ? incoming.sender.replace(/@s\.whatsapp\.net$/i, "").replace(/@c\.us$/i, "") : "";
    if (resolvedSenderNumber) {
      const usersSnap = await db.collection("users").get();
      for (const doc of usersSnap.docs) {
        const u = doc.data() as UserProfile;
        const fieldsToCheck = [
          (u as Record<string, unknown>).whatsapp,
          u.whatsapp_number,
          (u as Record<string, unknown>).phone,
          (u as Record<string, unknown>).phone_number
        ];
        let matched = false;
        for (const f of fieldsToCheck) {
          if (f && f.toString().replace(/\D/g, "") === resolvedSenderNumber.replace(/\D/g, "")) {
            senderUserProfile = { ...u, id: doc.id };
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
    }

    const replyText = await handleJobdeskSummary(incoming, senderUserProfile, matchedEvent, matchedDivision);
    
    console.log("[whatsapp command] handled", {
      commandType: "jobdesk_summary",
      handled: true,
      stopFurtherProcessing: true,
    });

    const sendResult = await sendWhatsAppMessage(replyText);
    await createWhatsAppLog({
      message: replyText,
      status: "sent",
      response: sendResult.responseText,
    });
    return NextResponse.json({ ok: true });
  }

  // --- Log resolved command for all other intents ---
  const matchedEventForLog = await findEventByGroupId(incoming.groupId || "");
  let matchedDivisionForLog = null;
  if (!matchedEventForLog && incoming.groupId) {
    const groupVariantsForLog = getGroupIdVariants(incoming.groupId);
    const divisionsSnapForLog = await db.collection("divisions").get();
    for (const doc of divisionsSnapForLog.docs) {
      const d = doc.data();
      if (d.whatsapp_group_id) {
        const dVariants = getGroupIdVariants(d.whatsapp_group_id);
        if (dVariants.some(dv => groupVariantsForLog.includes(dv))) {
          matchedDivisionForLog = { id: doc.id, ...d };
          break;
        }
      }
    }
  }

  console.log("[whatsapp command] resolved command", {
    rawQuery: message,
    normalizedQuery: cleanQuery,
    commandType: intent,
    contextType: incoming.isGroup ? (matchedEventForLog ? "event" : (matchedDivisionForLog ? "division" : "default")) : "personal",
    groupId: incoming.groupId || null,
  });

  interface EvaluatedCandidate {
    source: string;
    raw: string;
    normalized: string;
    accepted: boolean;
    reason: string;
  }

  const rootObj = getRecord(payload) || {};
  const dataPayloadObj = getRecord(rootObj.data) || {};

  const group = getRecord(rootObj.group) ?? getRecord(dataPayloadObj.group);
  const participants = getArray(group?.participants);

  const devicePhoneEnv = process.env.WABLAS_DEVICE_PHONE || "6287798799068";
  const deviceSender = normalizePhone(devicePhoneEnv);

  const allowedGroupIds = getAllowedGroupIds();
  const defaultGroupId = getDefaultGroupId();

  const groupOwnerRaw = getString(
    getNestedProperty(payload, "group.owner") || 
    getNestedProperty(payload, "data.group.owner") ||
    getNestedProperty(payload, "raw_body_sanitized.group.owner")
  );
  const groupOwner = groupOwnerRaw ? normalizePhone(groupOwnerRaw) : "";

  const candidatesList: { source: string; raw: string; normalized: string }[] = [];

  // 1. Group sender fields (Tugas 2)
  const priorityPaths = [
    "group.sender",
    "data.group.sender",
    "raw_body_sanitized.group.sender",
    "body.group.sender",
    "body.data.group.sender"
  ];
  for (const path of priorityPaths) {
    const rawVal = getString(getNestedProperty(payload, path));
    if (rawVal) {
      candidatesList.push({
        source: path,
        raw: rawVal,
        normalized: normalizePhone(rawVal)
      });
    }
  }

  // 2. Group participants
  for (let i = 0; i < participants.length; i++) {
    const participant = getRecord(participants[i]);
    if (participant) {
      const rawSender = getString(participant.sender);
      if (rawSender) {
        candidatesList.push({
          source: `group.participants[${i}].sender`,
          raw: rawSender,
          normalized: normalizePhone(rawSender)
        });
      }
    }
  }

  // 3. Fallbacks
  const fallbackPaths = [
    "participant",
    "author",
    "key.participant",
    "data.participant",
    "data.author",
    "data.key.participant",
    "sender",
    "from",
    "phone",
    "sender_number",
    "phone_number",
    "key.remoteJid",
    "data.sender",
    "data.from",
    "data.phone",
    "data.key.remoteJid"
  ];
  for (const path of fallbackPaths) {
    const rawVal = getString(getNestedProperty(payload, path));
    if (rawVal) {
      candidatesList.push({
        source: path,
        raw: rawVal,
        normalized: normalizePhone(rawVal)
      });
    }
  }

  // 4. incoming.sender and incoming.groupId as fallback candidates
  if (incoming.sender) {
    candidatesList.push({
      source: "incoming.sender",
      raw: incoming.sender,
      normalized: normalizePhone(incoming.sender)
    });
  }
  if (incoming.groupId) {
    candidatesList.push({
      source: "incoming.groupId",
      raw: incoming.groupId,
      normalized: normalizePhone(incoming.groupId)
    });
  }

  const evaluatedCandidates: EvaluatedCandidate[] = [];
  const seenCandidates = new Set<string>();

  for (const cand of candidatesList) {
    const key = `${cand.source}:${cand.normalized}`;
    if (seenCandidates.has(key)) continue;
    seenCandidates.add(key);

    let accepted = true;
    let reason = "valid_candidate";

    if (!cand.normalized) {
      accepted = false;
      reason = "empty";
    } else if (cand.normalized === deviceSender) {
      if (isJobdexPrefixed) {
        console.log("[whatsapp command] step: bot_self_test_candidate_accepted", { candidate: cand.normalized });
        accepted = true;
        reason = "bot_self_test_allowed";
      } else {
        accepted = false;
        reason = "wablas_device_phone";
      }
    } else if (groupOwner && cand.normalized === groupOwner && incoming.isGroup) {
      accepted = false;
      reason = "group_owner";
    } else if (cand.normalized === defaultGroupId || allowedGroupIds.includes(cand.normalized)) {
      accepted = false;
      reason = "group_id";
    } else if (cand.normalized.startsWith("120363")) {
      accepted = false;
      reason = "group_id";
    } else if (cand.raw.toLowerCase().includes("@lid")) {
      accepted = false;
      reason = "contains_lid";
    }

    evaluatedCandidates.push({
      source: cand.source,
      raw: cand.raw,
      normalized: cand.normalized,
      accepted,
      reason
    });
  }

  const selectedSenderObj = evaluatedCandidates.find((c) => c.accepted);
  let resolvedSenderNumber = "";
  let senderSource = "";

  if (selectedSenderObj) {
    resolvedSenderNumber = selectedSenderObj.normalized;
    senderSource = selectedSenderObj.source;
    if (priorityPaths.includes(selectedSenderObj.source)) {
      selectedSenderObj.reason = "group_sender_priority";
    } else if (selectedSenderObj.source.startsWith("group.participants")) {
      selectedSenderObj.reason = "group_participant";
    } else {
      selectedSenderObj.reason = "fallback_priority";
    }
  } else {
    const normalizedIncomingSender = normalizePhone(incoming.sender);
    if (normalizedIncomingSender === deviceSender && !isJobdexPrefixed) {
      resolvedSenderNumber = "";
      senderSource = "fallback_rejected_device";
    } else {
      resolvedSenderNumber = normalizedIncomingSender;
      senderSource = normalizedIncomingSender === deviceSender ? "fallback_bot_self_test" : "fallback";
    }
  }

  if (resolvedSenderNumber === deviceSender && !isJobdexPrefixed) {
    resolvedSenderNumber = "";
  }
  if (resolvedSenderNumber === defaultGroupId || allowedGroupIds.includes(resolvedSenderNumber) || resolvedSenderNumber.startsWith("120363")) {
    resolvedSenderNumber = "";
  }

  // Firestore user lookup with multi-field normalized check (Tugas 5)
  console.log("[whatsapp command] step: user_lookup", { resolvedSenderNumber });
  let senderUserProfile: UserProfile | null = null;
  let isSenderMatched = false;

  if (resolvedSenderNumber) {
    const usersSnap = await getAdminDb().collection("users").get();
    for (const doc of usersSnap.docs) {
      const u = doc.data() as UserProfile;
      const fieldsToCheck = [
        (u as Record<string, unknown>).whatsapp,
        u.whatsapp_number,
        (u as Record<string, unknown>).phone,
        (u as Record<string, unknown>).phone_number
      ];
      for (const f of fieldsToCheck) {
        if (f) {
          const norm = normalizePhone(String(f));
          if (norm === resolvedSenderNumber) {
            senderUserProfile = { ...u, id: doc.id };
            isSenderMatched = true;
            break;
          }
        }
      }
      if (isSenderMatched) break;
    }
  }

  if (resolvedSenderNumber === deviceSender && isJobdexPrefixed && !senderUserProfile) {
    console.log("[whatsapp command] step: assign_bot_superadmin_for_self_test");
    senderUserProfile = getBotProfile();
    isSenderMatched = true;
  }

  console.log("[whatsapp command] step: group_validation_start");
  const isGroupIdAllowed = await isGroupAllowedForJobDex(incoming.groupId || "");
  const isSenderAllowed = await isGroupAllowedForJobDex(incoming.sender);
  const isGroupOrSenderAllowed = !incoming.isGroup || isGroupIdAllowed || isSenderAllowed;

  const groupVariants = getGroupIdVariants(incoming.groupId || "");
  const matchedEvent = await findEventByGroupId(incoming.groupId || "");

  console.log("[whatsapp command] sender auth", {
    senderMasked: incoming.sender ? `${incoming.sender.slice(0, 4)}***` : null,
    hasMatchedUser: Boolean(senderUserProfile),
    role: senderUserProfile?.role || null,
  });

  console.log("[whatsapp command] group validation", {
    incomingGroupId: incoming.groupId,
    allowed: isGroupOrSenderAllowed,
    allowedCount: allowedGroupIds.length,
  });

  console.log("[whatsapp command] event lookup", {
    incomingGroupId: incoming.groupId,
    groupVariants,
    matchedEventId: matchedEvent?.id || null,
    matchedEventName: matchedEvent?.name || null,
  });

  // WRITE DEEP DEBUG TO FIRESTORE COLLECTION "wablas_incoming_debug" (scrub PIN!)
  let debugRefId = "";
  try {
    const debugRef = getAdminDb().collection("wablas_incoming_debug").doc();
    debugRefId = debugRef.id;
    const sanitizedBody = scrubPinFromPayload(sanitizePayload(payload));
    const candidatesDump = extractCandidates(payload);
    
    const available_top_level_keys = Object.keys(payload && typeof payload === "object" ? payload : {});
    const available_data_keys = dataPayloadObj ? Object.keys(dataPayloadObj) : [];

    const isSelectedSenderDevice = resolvedSenderNumber === deviceSender;
    const isSelectedSenderGroupId = 
      resolvedSenderNumber === defaultGroupId || 
      allowedGroupIds.includes(resolvedSenderNumber) || 
      resolvedSenderNumber.startsWith("120363");

    await debugRef.set({
      created_at: FieldValue.serverTimestamp(),
      raw_body_sanitized: JSON.parse(JSON.stringify(sanitizedBody)),
      extracted_candidates: candidatesDump,
      raw_sender_candidates: evaluatedCandidates,
      selected_sender: resolvedSenderNumber,
      normalized_sender: resolvedSenderNumber,
      matched_user_id: senderUserProfile?.id ?? "",
      matched_user_name: senderUserProfile?.name ?? "",
      matched_user_role: senderUserProfile?.role ?? "",
      sender_source: senderSource,
      group_id: incoming.groupId || "",
      message_text: sanitizePinFromMessage(incoming.message || ""),
      group_participant_senders: candidatesDump["group_participant_senders"] || "",
      available_top_level_keys,
      available_data_keys,
      intent_debug: null,
      incoming_group_id: incoming.groupId || "",
      allowed_group_ids: allowedGroupIds,
      is_allowed_group: isGroupIdAllowed,
      reply_target_group_id: incoming.groupId || defaultGroupId,
      is_jobdex_command: true,
      is_group_message: incoming.isGroup,
      is_sender_matched: isSenderMatched,
      is_selected_sender_device_phone: isSelectedSenderDevice,
      is_selected_sender_group_id: isSelectedSenderGroupId,
      provider: incoming.provider,
    });
  } catch (debugError) {
    console.error("Failed to write wablas incoming debug log:", debugError);
  }

  if (!incoming.message || !question) {
    console.log("[whatsapp command] step: empty_or_no_question");
    console.log("[whatsapp command] handled", {
      commandType: "empty_or_no_question",
      handled: true,
      stopFurtherProcessing: true,
    });
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!isGroupOrSenderAllowed) {
    console.log("[whatsapp command] step: unauthorized_group_or_sender", {
      groupId: incoming.groupId,
      sender: incoming.sender,
      intent,
    });
    // Jika tidak allowed/verified, hanya izinkan command claim terbatas:
    // - cek_grup
    // - hubungkan_grup_acara
    if (intent !== "cek_grup" && intent !== "hubungkan_grup_acara") {
      console.log("[whatsapp command] step: notifying_unlinked_group");
      const unlinkedMsg = [
        "⚠️ *Grup Belum Terhubung ke JobDex.in*",
        "",
        "Grup WhatsApp ini belum dihubungkan ke event/divisi mana pun di JobDex.",
        "Ketik `!jobdex cek grup` untuk melihat ID grup ini, lalu hubungkan melalui menu Pengaturan Event di dashboard.",
      ].join("\n");

      const sendResult = await sendWhatsAppMessage(unlinkedMsg);
      await createWhatsAppLog({
        message: unlinkedMsg,
        status: "sent",
        response: sendResult.responseText,
      });

      console.log("[whatsapp command] handled", {
        commandType: "unauthorized_group_or_sender",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true, ignored: true, reason: "unauthorized_group_notified" });
    }
  }

  // --- Event & Division Context Verification (Fase 27A.2.4 REVISED) ---
  if (incoming.isGroup) {
    const isHelperCommand = [
      "cek_grup",
      "hubungkan_grup_acara",
      "cek_pengirim",
      "cek_role",
      "event_grup",
      "bantuan_task",
      "template_help",
      "progress_question",
      "confirm_command",
      "cancel_command",
      "confirm_edit",
      "cancel_edit",
      "confirm_archive",
    ].includes(intent);

    if (!isHelperCommand) {
      let matchedDivision = null;
      const divisionsSnap = await getAdminDb().collection("divisions").get();
      for (const doc of divisionsSnap.docs) {
        const d = doc.data();
        if (d.whatsapp_group_id && incoming.groupId) {
          const dVariants = getGroupIdVariants(d.whatsapp_group_id);
          if (dVariants.some(dv => groupVariants.includes(dv))) {
            matchedDivision = { id: doc.id, ...d };
            break;
          }
        }
      }

      const isRequestingSpecificEventContext = 
        cleanQuery.includes("acara") || 
        cleanQuery.includes("event") || 
        cleanQuery.includes("raker") || 
        cleanQuery.includes("panitia");

      if (isRequestingSpecificEventContext && !matchedEvent && !matchedDivision) {
        console.log("[whatsapp command] step: unlinked_group_warning");
        const warningReply = [
          "Grup ini sudah terhubung ke JobDex.in, tapi belum cocok dengan event mana pun.",
          "Coba cek ID WhatsApp Group Acara di dashboard."
        ].join("\n");

        const sendResult = await sendWhatsAppMessage(warningReply);
        await createWhatsAppLog({
          message: warningReply,
          status: "sent",
          response: sendResult.responseText,
        });
        console.log("[whatsapp command] handled", {
          commandType: "unlinked_group_warning",
          handled: true,
          stopFurtherProcessing: true,
        });
        return NextResponse.json({ ok: true });
      }
    }
  }

  const senderLabel = senderUserProfile 
    ? `${senderUserProfile.name} (${resolvedSenderNumber})` 
    : resolvedSenderNumber || incoming.sender;

  try {
    const isTaskLike = isTaskCommandLike(incoming.message || "");
    const isRefSearch = isReferenceSearchQuestion(question);

    const updateDebugIntent = async (
      routedTo: "task_command" | "task_help" | "reference_search" | "gemini_fallback" | "deepseek_fallback" | "instant_faq_match",
      parsedTaskIntent: string | null,
      refQuery: string | null = null
    ) => {
      if (!debugRefId) return;
      try {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          intent_debug: {
            is_task_command_like: isTaskLike,
            parsed_task_intent: parsedTaskIntent,
            is_reference_search: isRefSearch,
            routed_to: routedTo,
            reference_query: refQuery,
          }
        });
      } catch (err) {
        console.error("Failed to update intent_debug in wablas_incoming_debug:", err);
      }
    };

    const isCekPengirim = intent === "cek_pengirim";

    // Tugas 8: Cek Pengirim Command
    if (isCekPengirim) {
      console.log("[whatsapp command] step: execute_cek_pengirim");
      const replyMessage = [
        WA_LABEL.debugPengirim,
        "",
        `Nomor terdeteksi: ${resolvedSenderNumber || "Tidak terdeteksi"}`,
        `Sumber: ${senderSource || "Tidak diketahui"}`,
        `User: ${senderUserProfile ? senderUserProfile.name : "Tidak terdaftar"}`,
        `Role: ${senderUserProfile ? (USER_ROLE_LABELS[senderUserProfile.role] || senderUserProfile.role) : "Tidak terdaftar"}`,
        `Group ID: ${incoming.groupId || "Personal Chat"}`
      ].join("\n");

      await updateDebugIntent("task_command", "cek_pengirim");

      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: "sent",
        response: sendResult.responseText,
      });
      console.log("[whatsapp command] handled", {
        commandType: "cek_pengirim",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // Tugas 8b: Cek Role Command
    if (intent === "cek_role") {
      console.log("[whatsapp command] step: execute_cek_role");
      const replyMessage = [
        WA_LABEL.cekRole,
        "",
        `Halo ${senderUserProfile ? senderUserProfile.name : "Pengguna"},`,
        `Nomor terdeteksi: ${resolvedSenderNumber || "Tidak terdeteksi"}`,
        `Role Anda saat ini: ${senderUserProfile ? (USER_ROLE_LABELS[senderUserProfile.role] || senderUserProfile.role) : "Tidak terdaftar"}`
      ].join("\n");

      await updateDebugIntent("task_command", "cek_role");

      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: "sent",
        response: sendResult.responseText,
      });
      console.log("[whatsapp command] handled", {
        commandType: "cek_role",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    const authMode = "sender_identity";
    const pinRequired = false;
    const isBantuan = intent === "bantuan_task" || intent === "template_help";
    const requiresAuth = intent !== "unknown" && !isBantuan && !isCekPengirim;

    if (requiresAuth && !isSenderMatched) {
      console.log("[whatsapp command] step: auth_required_unmatched_user", {
        resolvedSenderNumber,
        incomingSender: incoming.sender,
        intent,
      });
      const replyMessage = [
        "👋 *Halo rekan!*",
        "",
        `Nomor WhatsApp kamu terdeteksi: ${resolvedSenderNumber || incoming.sender}`,
        "",
        "Nomor ini belum terdaftar di akun panitia JobDex.in.",
        "Silakan hubungi koordinator atau admin untuk menambahkan nomor WhatsApp ke profil akun kamu yaa! 🙌",
        "👉 Cek dashboard: https://jobdexin.sumestawsome.xyz/dashboard/tasks",
      ].join("\n");

      await updateDebugIntent("task_help", intent || "unauthorized");

      if (debugRefId) {
        try {
          await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
            auth_mode: authMode,
            pin_required: pinRequired,
            sender_user_id: "",
            sender_user_role: "",
            authorization_result: "unmatched_user",
            command_intent: intent,
            target_task_id: "",
            target_task_name: "",
          });
        } catch (err) {
          console.error("Failed to update debug unmatched:", err);
        }
      }

      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: "failed",
        response: sendResult.responseText,
      });
      console.log("[whatsapp command] handled", {
        commandType: "auth_failed",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    const senderUserId = senderUserProfile?.id || "";
    const senderUserRole = senderUserProfile?.role || "";
    let authorizationResult = "allowed";
    let targetTaskId = "";
    let targetTaskName = "";

    // 1. Bantuan Task Command — Role-aware (Fix E)
    if (intent === "bantuan_task") {
      console.log("[whatsapp command] step: execute_bantuan_task");
      const userRole = senderUserProfile?.role || "anggota";
      const isAdmin = userRole === "super_admin";
      const isKoordinator = userRole === "koordinator_divisi" || userRole === "koordinator_acara";

      const linesAnggota = [
        "📋 Command untuk Anggota:",
        "- !jobdex tugas saya",
        "- !jobdex detail task [nama task]",
        "- !jobdex update status [nama task] menjadi [status]",
        "- !jobdex upload hasil [nama task]",
        "  link: [URL]",
        "  catatan: [CATATAN]",
        "- !jobdex cek checklist [nama task]",
        "- !jobdex checklist [nama task] redaksi selesai",
        "- !jobdex tambah catatan [nama task]",
        "  catatan: [CATATAN]",
        "- !jobdex cari [keyword]",
        "- !jobdex cek role saya",
      ];

      const linesKoordinator = [
        "",
        "👤 Tambahan untuk Koordinator:",
        "- !jobdex briefing",
        "- !jobdex siapa belum update",
        "- !jobdex deadline dekat",
        "- !jobdex minta revisi [nama task]",
        "  catatan: [CATATAN]",
        "- !jobdex approve task [nama task]",
        "- !jobdex ganti PIC [nama task] ke [nama]",
        "- !jobdex tambah jobdesk",
        "- !jobdex tambah banyak jobdesk",
        "- !jobdex tambah referensi",
        "- !jobdex edit task [nama task]",
        "- !jobdex archive task [nama task]",
        "- !jobdex hubungkan grup acara [nama acara]",
      ];

      const linesAdmin = [
        "",
        "🔑 Tambahan untuk Super Admin:",
        "- !jobdex tambah acara",
        "- !jobdex siapa yang stuck",
        "- !jobdex siapa yang menunggu approval",
        "- !jobdex cek pengirim",
        "- !jobdex cek grup",
        "- !jobdex event grup",
      ];

      const footer = [
        "",
        "Format lengkap: !jobdex format jobdesk",
        "Referensi: !jobdex format referensi",
      ];

      const lines = [
        WA_LABEL.bantuan,
        "",
        `Halo ${senderUserProfile?.name || "Pengguna"},`,
        ...linesAnggota,
        ...(isKoordinator || isAdmin ? linesKoordinator : []),
        ...(isAdmin ? linesAdmin : []),
        ...footer,
      ];

      const replyMessage = lines.join("\n");

      await updateDebugIntent("task_command", "bantuan_task");

      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: "sent",
        response: sendResult.responseText,
      });
      console.log("[whatsapp command] handled", {
        commandType: "bantuan_task",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // Handlers for WhatsApp Group Routing (Fase 19C)
    if (intent === "cek_grup") {
      console.log("[whatsapp command] step: execute_cek_grup");
      const groupSubject = group ? (getString(group.subject) || getString(group.name)) : "";
      const linkedEvent = await findEventByGroupId(incoming.groupId || "");
      const linkedEventName = linkedEvent ? linkedEvent.name : "-";

      let linkedDivisionName = "-";
      const divisionsSnap = await getAdminDb().collection("divisions").get();
      for (const doc of divisionsSnap.docs) {
        const d = doc.data();
        if (d.whatsapp_group_id && incoming.groupId) {
          const dVariants = getGroupIdVariants(d.whatsapp_group_id);
          const incVariants = getGroupIdVariants(incoming.groupId);
          if (dVariants.some(dv => incVariants.includes(dv))) {
            linkedDivisionName = d.name || "-";
            break;
          }
        }
      }

      const isConnected = !!linkedEvent || linkedDivisionName !== "-";
      const statusText = isConnected ? "Terhubung" : "Belum terhubung";

      const replyMessage = [
        WA_LABEL.debugGrup,
        "",
        `Group ID: ${incoming.groupId || "Personal Chat"}`,
        `Group Name: ${groupSubject || "-"}`,
        `Terhubung ke event: ${linkedEventName}`,
        `Terhubung ke divisi: ${linkedDivisionName}`,
        `Status: ${statusText}`
      ].join("\n");

      await updateDebugIntent("task_command", "cek_grup");

      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: "sent",
        response: sendResult.responseText,
      });

      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: "",
          target_task_name: "",
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "cek_grup",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    if (intent === "event_grup") {
      console.log("[whatsapp command] step: execute_event_grup");
      const events = await getEventsWithGroupId();
      let replyMessage = "";
      if (events.length === 0) {
        replyMessage = [
          WA_LABEL.grupAcara,
          "",
          "Belum ada acara yang memiliki grup WhatsApp khusus."
        ].join("\n");
      } else {
        const listLines = events.map((e, index) => {
          return `${index + 1}. ${e.name}\n   Group ID: ${e.whatsapp_group_id}\n   Status: Terhubung`;
        });
        replyMessage = [
          WA_LABEL.grupAcara,
          "",
          "Daftar acara yang memiliki grup WhatsApp khusus:",
          "",
          ...listLines
        ].join("\n");
      }

      await updateDebugIntent("task_command", "event_grup");

      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: "sent",
        response: sendResult.responseText,
      });

      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: "",
          target_task_name: "",
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "event_grup",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    if (intent === "hubungkan_grup_acara") {
      console.log("[whatsapp command] step: execute_hubungkan_grup_acara");
      const eventName = String(parsedCommand.fields.event_name || "").trim();
      
      if (!incoming.isGroup || !incoming.groupId) {
        const replyMessage = [
          WA_LABEL.grupAcara,
          "",
          "Command ini hanya dapat dijalankan di dalam grup WhatsApp."
        ].join("\n");

        await updateDebugIntent("task_command", "hubungkan_grup_acara");
        const sendResult = await sendWhatsAppMessage(replyMessage);
        await createWhatsAppLog({
          message: replyMessage,
          status: "failed",
          response: sendResult.responseText,
        });
        console.log("[whatsapp command] handled", {
          commandType: "hubungkan_grup_acara_not_group",
          handled: true,
          stopFurtherProcessing: true,
        });
        return NextResponse.json({ ok: true });
      }

      // Find event by name
      const eventsSnap = await getAdminDb().collection("events").get();
      let matchedEvent: Event | null = null;
      for (const doc of eventsSnap.docs) {
        const e = doc.data() as Event;
        if (e.name.toLowerCase() === eventName.toLowerCase()) {
          matchedEvent = { ...e, id: doc.id };
          break;
        }
      }

      if (!matchedEvent) {
        const replyMessage = [
          WA_LABEL.grupAcara,
          "",
          `Acara dengan nama "${eventName}" tidak ditemukan.`
        ].join("\n");

        await updateDebugIntent("task_command", "hubungkan_grup_acara");
        const sendResult = await sendWhatsAppMessage(replyMessage);
        await createWhatsAppLog({
          message: replyMessage,
          status: "failed",
          response: sendResult.responseText,
        });
        console.log("[whatsapp command] handled", {
          commandType: "hubungkan_grup_acara_event_not_found",
          handled: true,
          stopFurtherProcessing: true,
        });
        return NextResponse.json({ ok: true });
      }

      // Check authorization
      let isAllowed = false;
      if (senderUserProfile) {
        if (senderUserProfile.role === "super_admin") {
          isAllowed = true;
        } else if (senderUserProfile.role === "koordinator_acara") {
          if (matchedEvent.coordinator_id === senderUserProfile.id) {
            isAllowed = true;
          }
        } else if (senderUserProfile.role === "koordinator_divisi") {
          // Check if user is coordinator of any division with tasks in this event
          const userDivisionsSnap = await getAdminDb()
            .collection("divisions")
            .where("coordinator_id", "==", senderUserProfile.id)
            .get();
          
          const divisionIds = userDivisionsSnap.docs.map(doc => doc.id);
          if (divisionIds.length > 0) {
            const eventTasksSnap = await getAdminDb()
              .collection("tasks")
              .where("event_id", "==", matchedEvent.id)
              .get();
            
            const hasTaskInDivision = eventTasksSnap.docs.some(doc => {
              const taskData = doc.data();
              return divisionIds.includes(taskData.division_id);
            });
            if (hasTaskInDivision) {
              isAllowed = true;
            }
          }
        }
      }

      if (!isAllowed) {
        authorizationResult = "denied";
        const replyMessage = [
          WA_LABEL.accessDenied,
          "",
          "Maaf, Anda tidak memiliki izin untuk menghubungkan grup WhatsApp ke acara ini. Pindai/hubungkan hanya diperbolehkan untuk Super Admin, Koordinator Acara terkait, or Koordinator Divisi terkait."
        ].join("\n");

        await updateDebugIntent("task_command", "hubungkan_grup_acara");
        const sendResult = await sendWhatsAppMessage(replyMessage);
        await createWhatsAppLog({
          message: replyMessage,
          status: "failed",
          response: sendResult.responseText,
        });

        if (debugRefId) {
          await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
            auth_mode: authMode,
            pin_required: pinRequired,
            sender_user_id: senderUserId,
            sender_user_role: senderUserRole,
            authorization_result: authorizationResult,
            command_intent: intent,
            target_task_id: "",
            target_task_name: "",
          });
        }

        console.log("[whatsapp command] handled", {
          commandType: "hubungkan_grup_acara_unauthorized",
          handled: true,
          stopFurtherProcessing: true,
        });
        return NextResponse.json({ ok: true });
      }

      // Link group to event
      const groupSubject = group ? (getString(group.subject) || getString(group.name)) : "";
      await linkGroupToEvent(
        matchedEvent.id,
        incoming.groupId,
        groupSubject || matchedEvent.name,
        senderUserProfile!.id,
        "webhook_detected"
      );

      const replyMessage = [
        WA_LABEL.grupAcara,
        "",
        "Grup ini berhasil dihubungkan ke acara:",
        matchedEvent.name,
        "",
        `Group ID: ${incoming.groupId}`,
        "Mulai sekarang reminder untuk task acara ini akan diarahkan ke grup ini."
      ].join("\n");

      await updateDebugIntent("task_command", "hubungkan_grup_acara");
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: "sent",
        response: sendResult.responseText,
      });

      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: "allowed",
          command_intent: intent,
          target_task_id: "",
          target_task_name: "",
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "hubungkan_grup_acara",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 2. Read-only Deadline & Risk Queries
    if (intent === "deadline_query") {
      const queryType = String(parsedCommand.fields.query_type || "dekat");
      // Fix A: teruskan user ke handler untuk scope filter berdasarkan role
      const replyMessage = await handleDeadlineQuery(queryType, senderUserProfile!);

      await updateDebugIntent("task_command", "deadline_query");

      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: "sent",
        response: sendResult.responseText,
      });
      console.log("[whatsapp command] handled", {
        commandType: "deadline_query",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 2b. Template Help — static response tanpa AI (Fix F)
    if (intent === "template_help") {
      const rawQuestion = parsedCommand.rawText.toLowerCase();
      let helpContent: string;

      if (rawQuestion.includes("referensi")) {
        helpContent = [
          "Format tambah referensi:",
          "",
          "!jobdex tambah referensi",
          "judul: [Nama referensi]",
          "jenis: [poster/feed/story/banner/dll]",
          "acara: [Nama acara] (jika scope acara)",
          "tahun: [2025]",
          "link drive: [URL Drive]",
          "link canva: [URL Canva] (opsional)",
          "catatan: [Catatan tambahan]",
        ].join("\n");
      } else if (rawQuestion.includes("acara")) {
        helpContent = [
          "Format tambah acara:",
          "",
          "!jobdex tambah acara",
          "nama: [Nama acara]",
          "tanggal: [dd Bulan yyyy]",
          "koordinator: [Nama koordinator]",
          "deskripsi: [Deskripsi singkat]",
        ].join("\n");
      } else {
        // Default: format jobdesk
        helpContent = [
          "Format tambah jobdesk:",
          "",
          "!jobdex tambah jobdesk",
          "judul: [Nama task]",
          "tipe: divisi / acara",
          "pic: [Nama pelaksana]",
          "deadline: [dd Bulan yyyy]",
          "prioritas: rendah / sedang / tinggi / kritis",
          "acara: [Nama acara] (jika tipe acara)",
          "deskripsi: [Deskripsi singkat]",
          "redaksi: [Teks redaksi/copywriting]",
          "referensi: [URL referensi]",
          "warna: [Warna palette]",
          "arahan visual: [Arahan desain]",
          "",
          "Contoh bulk: !jobdex bantuan koordinator",
        ].join("\n");
      }

      const replyMessage = [WA_LABEL.bantuan, "", helpContent].join("\n");
      await updateDebugIntent("task_help", "template_help");
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({ message: replyMessage, status: "sent", response: sendResult.responseText });
      console.log("[whatsapp command] handled", {
        commandType: "template_help",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 3. Tugas Saya
    if (intent === "tugas_saya") {
      const variation = String(parsedCommand.fields.variation || "all");
      const result = await handleTugasSayaCommand(senderUserProfile!, variation);
      
      await updateDebugIntent("task_command", "tugas_saya");

      const replyMessage = result.replyText;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
      });
      console.log("[whatsapp command] handled", {
        commandType: "tugas_saya",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    if (intent === "briefing") {
      const result = await handleBriefingCommand(senderUserProfile!, incoming.groupId);
      await updateDebugIntent("task_command", "briefing");

      const replyMessage = result.replyText;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
      });
      console.log("[whatsapp command] handled", {
        commandType: "briefing",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    if (intent === "siapa_belum_update") {
      const result = await handleSiapaBelumUpdateCommand(senderUserProfile!);
      await updateDebugIntent("task_command", "siapa_belum_update");

      const replyMessage = result.replyText;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
      });
      console.log("[whatsapp command] handled", {
        commandType: "siapa_belum_update",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 4. Detail Task
    if (intent === "detail_task") {
      const taskName = String(parsedCommand.fields.task_name || "");
      const isCode = parsedCommand.fields.is_code === "true";
      const result = await handleDetailTaskCommand(taskName, isCode, senderUserProfile!);

      if (result.replyText.startsWith(WA_LABEL.accessDenied)) {
        authorizationResult = "denied";
      }
      targetTaskId = result.taskId || "";
      targetTaskName = result.taskName || "";

      await updateDebugIntent("task_command", "detail_task");

      const replyMessage = result.replyText;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
      });

      // Update deep debug metadata
      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: targetTaskId,
          target_task_name: targetTaskName,
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "detail_task",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 5. Upload Hasil
    if (intent === "upload_hasil") {
      const taskName = String(parsedCommand.fields.task_name || "");
      const isCode = parsedCommand.fields.is_code === "true";
      const link = String(parsedCommand.fields.link || "");
      const catatan = String(parsedCommand.fields.catatan || "");
      const result = await handleUploadHasilCommand(taskName, isCode, link, catatan, senderUserProfile!);

      if (result.replyText.startsWith(WA_LABEL.accessDenied)) {
        authorizationResult = "denied";
      }
      targetTaskId = result.taskId || "";
      targetTaskName = result.taskName || "";

      await updateDebugIntent("task_command", "upload_hasil");

      const replyMessage = result.replyText;
      await sendTaskCommandReply(replyMessage, result);

      // Update deep debug metadata
      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: targetTaskId,
          target_task_name: targetTaskName,
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "upload_hasil",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 6. Minta Revisi
    if (intent === "minta_revisi") {
      const taskName = String(parsedCommand.fields.task_name || "");
      const isCode = parsedCommand.fields.is_code === "true";
      const catatan = String(parsedCommand.fields.catatan || "");
      const result = await handleMintaRevisiCommand(taskName, isCode, catatan, senderUserProfile!);

      if (result.replyText.startsWith(WA_LABEL.accessDenied)) {
        authorizationResult = "denied";
      }
      targetTaskId = result.taskId || "";
      targetTaskName = result.taskName || "";

      await updateDebugIntent("task_command", "minta_revisi");

      const replyMessage = result.replyText;
      await sendTaskCommandReply(replyMessage, result);

      // Update deep debug metadata
      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: targetTaskId,
          target_task_name: targetTaskName,
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "minta_revisi",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 7. Cek Checklist
    if (intent === "cek_checklist") {
      const taskName = String(parsedCommand.fields.task_name || "");
      const isCode = parsedCommand.fields.is_code === "true";
      const result = await handleCekChecklistCommand(taskName, isCode, senderUserProfile!);

      if (result.replyText.startsWith(WA_LABEL.accessDenied)) {
        authorizationResult = "denied";
      }
      targetTaskId = result.taskId || "";
      targetTaskName = result.taskName || "";

      await updateDebugIntent("task_command", "cek_checklist");

      const replyMessage = result.replyText;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
      });

      // Update deep debug metadata
      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: targetTaskId,
          target_task_name: targetTaskName,
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "cek_checklist",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 8. Tambah Catatan
    if (intent === "tambah_catatan") {
      const taskName = String(parsedCommand.fields.task_name || "");
      const isCode = parsedCommand.fields.is_code === "true";
      const catatan = String(parsedCommand.fields.catatan || "");
      const result = await handleTambahCatatanCommand(taskName, isCode, catatan, senderUserProfile!);

      if (result.replyText.startsWith(WA_LABEL.accessDenied)) {
        authorizationResult = "denied";
      }
      targetTaskId = result.taskId || "";
      targetTaskName = result.taskName || "";

      await updateDebugIntent("task_command", "tambah_catatan");

      const replyMessage = result.replyText;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
      });

      // Update deep debug metadata
      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: targetTaskId,
          target_task_name: targetTaskName,
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "tambah_catatan",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 9. Ganti PIC
    if (intent === "ganti_pic") {
      const taskName = String(parsedCommand.fields.task_name || "");
      const isCode = parsedCommand.fields.is_code === "true";
      const picName = String(parsedCommand.fields.pic_name || "");
      const result = await handleGantiPicCommand(taskName, isCode, picName, senderUserProfile!);

      if (result.replyText.startsWith(WA_LABEL.accessDenied)) {
        authorizationResult = "denied";
      }
      targetTaskId = result.taskId || "";
      targetTaskName = result.taskName || "";

      await updateDebugIntent("task_command", "ganti_pic");

      const replyMessage = result.replyText;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
      });

      // Update deep debug metadata
      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: targetTaskId,
          target_task_name: targetTaskName,
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "ganti_pic",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 10. Confirm Command & Cancel Command
    if (intent === "confirm_command" || intent === "cancel_command") {
      const code = String(parsedCommand.fields.code || "").toUpperCase();

      let result;
      if (intent === "confirm_command") {
        result = await confirmPreviewCommand(code, senderUserProfile!);
      } else {
        result = await cancelPreviewCommand(code, senderUserProfile!);
      }

      await updateDebugIntent("task_command", intent);

      const replyMessage = result.replyText;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
      });

      console.log("[whatsapp command] handled", {
        commandType: intent,
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 11. Confirm Edit & Cancel Edit & Confirm Archive
    if (intent === "confirm_edit" || intent === "cancel_edit" || intent === "confirm_archive") {
      const code = String(parsedCommand.fields.code || "").toUpperCase();

      let result;
      if (intent === "confirm_edit") {
        result = await handleConfirmEditTaskCommand(code, senderUserProfile!);
      } else if (intent === "cancel_edit") {
        result = await handleCancelEditTaskCommand(code, senderUserProfile!);
      } else {
        result = await handleConfirmArchiveCommand(code, senderUserProfile!);
      }

      if (result.replyText.startsWith(WA_LABEL.accessDenied)) {
        authorizationResult = "denied";
      }
      targetTaskId = result.taskId || "";
      targetTaskName = result.taskName || "";

      await updateDebugIntent("task_command", intent);

      const replyMessage = result.replyText;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
      });

      // Update deep debug metadata
      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: targetTaskId,
          target_task_name: targetTaskName,
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: intent,
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 12. Approve Task
    if (intent === "approve_task") {
      const taskName = String(parsedCommand.fields.task_name || "");
      const isCode = parsedCommand.fields.is_code === "true";

      const result = await handleApproveTaskCommand(taskName, senderUserProfile!, isCode);

      if (result.replyText.startsWith(WA_LABEL.accessDenied)) {
        authorizationResult = "denied";
      }
      targetTaskId = result.taskId || "";
      targetTaskName = result.taskName || "";

      await updateDebugIntent("task_command", "approve_task");

      const replyMessage = result.replyText;
      await sendTaskCommandReply(replyMessage, result);

      // Update deep debug metadata
      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: targetTaskId,
          target_task_name: targetTaskName,
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "approve_task",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 13. Update Status
    if (intent === "update_status") {
      const taskName = String(parsedCommand.fields.task_name || "");
      const statusVal = String(parsedCommand.fields.status || "");
      const notes = String(parsedCommand.fields.notes || "");
      const isCode = parsedCommand.fields.is_code === "true";

      if (!statusVal || !taskName) {
        const replyMessage = [
          WA_LABEL.task,
          "",
          "Format update status belum lengkap.",
          "",
          "Gunakan:",
          "!jobdex update status [nama task] menjadi [status]"
        ].join("\n");

        await updateDebugIntent("task_help", "update_status");

        const sendResult = await sendWhatsAppMessage(replyMessage);
        await createWhatsAppLog({
          message: replyMessage,
          status: "failed",
          response: sendResult.responseText,
        });
        console.log("[whatsapp command] handled", {
          commandType: "update_status_incomplete",
          handled: true,
          stopFurtherProcessing: true,
        });
        return NextResponse.json({ ok: true });
      }

      const result = await handleUpdateTaskStatusCommand(taskName, senderUserProfile!, isCode, statusVal, notes);

      if (result.replyText.startsWith(WA_LABEL.accessDenied)) {
        authorizationResult = "denied";
      }
      targetTaskId = result.taskId || "";
      targetTaskName = result.taskName || "";

      await updateDebugIntent("task_command", "update_status");

      const replyMessage = result.replyText;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
      });

      // Update deep debug metadata
      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: targetTaskId,
          target_task_name: targetTaskName,
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "update_status",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 14. Edit Task
    if (intent === "edit_task") {
      const taskName = String(parsedCommand.fields.task_name || "");
      const isCode = parsedCommand.fields.is_code === "true";

      if (!taskName) {
        const replyMessage = [
          WA_LABEL.task,
          "",
          "Format edit task belum lengkap.",
          "",
          "Gunakan:",
          "!jobdex edit task [nama task]",
          "deadline: 5 Juni 2026"
        ].join("\n");

        await updateDebugIntent("task_help", "edit_task");

        const sendResult = await sendWhatsAppMessage(replyMessage);
        await createWhatsAppLog({
          message: replyMessage,
          status: "failed",
          response: sendResult.responseText,
        });
        console.log("[whatsapp command] handled", {
          commandType: "edit_task_incomplete",
          handled: true,
          stopFurtherProcessing: true,
        });
        return NextResponse.json({ ok: true });
      }

      const changesPayload: Record<string, string> = { ...parsedCommand.fields, rawText: incoming.message };
      delete changesPayload.task_name;
      delete changesPayload.pin;
      delete changesPayload.is_code;

      const result = await handleEditTaskCommand(taskName, senderUserProfile!, isCode, changesPayload);

      if (result.replyText.startsWith(WA_LABEL.accessDenied)) {
        authorizationResult = "denied";
      }
      targetTaskId = result.taskId || "";
      targetTaskName = result.taskName || "";

      await updateDebugIntent("task_command", "edit_task");

      const replyMessage = result.replyText;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
      });

      // Update deep debug metadata
      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: targetTaskId,
          target_task_name: targetTaskName,
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "edit_task",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 15. Archive Task
    if (intent === "archive_task") {
      const taskName = String(parsedCommand.fields.task_name || "");
      const isCode = parsedCommand.fields.is_code === "true";

      if (!taskName) {
        const replyMessage = [
          WA_LABEL.task,
          "",
          "Format archive task belum lengkap.",
          "",
          "Gunakan:",
          "!jobdex archive task [nama task]"
        ].join("\n");

        await updateDebugIntent("task_help", "archive_task");

        const sendResult = await sendWhatsAppMessage(replyMessage);
        await createWhatsAppLog({
          message: replyMessage,
          status: "failed",
          response: sendResult.responseText,
        });
        console.log("[whatsapp command] handled", {
          commandType: "archive_task_incomplete",
          handled: true,
          stopFurtherProcessing: true,
        });
        return NextResponse.json({ ok: true });
      }

      const result = await handleArchiveTaskCommand(taskName, senderUserProfile!, isCode);

      if (result.replyText.startsWith(WA_LABEL.accessDenied)) {
        authorizationResult = "denied";
      }
      targetTaskId = result.taskId || "";
      targetTaskName = result.taskName || "";

      await updateDebugIntent("task_command", "archive_task");

      const replyMessage = result.replyText;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
      });

      // Update deep debug metadata
      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: targetTaskId,
          target_task_name: targetTaskName,
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "archive_task",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // 16. Checklist Task
    if (intent === "checklist_task") {
      const taskName = String(parsedCommand.fields.task_name || "");
      const item = String(parsedCommand.fields.item || "");
      const isCode = parsedCommand.fields.is_code === "true";

      if (!taskName || !item) {
        const replyMessage = [
          WA_LABEL.task,
          "",
          "Format checklist task belum lengkap.",
          "",
          "Gunakan:",
          "!jobdex checklist [nama task] [item] selesai"
        ].join("\n");

        await updateDebugIntent("task_help", "checklist_task");

        const sendResult = await sendWhatsAppMessage(replyMessage);
        await createWhatsAppLog({
          message: replyMessage,
          status: "failed",
          response: sendResult.responseText,
        });
        console.log("[whatsapp command] handled", {
          commandType: "checklist_task_incomplete",
          handled: true,
          stopFurtherProcessing: true,
        });
        return NextResponse.json({ ok: true });
      }

      const result = await handleChecklistCommand(taskName, senderUserProfile!, isCode, item);

      if (result.replyText.startsWith(WA_LABEL.accessDenied)) {
        authorizationResult = "denied";
      }
      targetTaskId = result.taskId || "";
      targetTaskName = result.taskName || "";

      await updateDebugIntent("task_command", "checklist_task");

      const replyMessage = result.replyText;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: result.success ? "sent" : "failed",
        response: sendResult.responseText,
      });

      // Update deep debug metadata
      if (debugRefId) {
        await getAdminDb().collection("wablas_incoming_debug").doc(debugRefId).update({
          auth_mode: authMode,
          pin_required: pinRequired,
          sender_user_id: senderUserId,
          sender_user_role: senderUserRole,
          authorization_result: authorizationResult,
          command_intent: intent,
          target_task_id: targetTaskId,
          target_task_name: targetTaskName,
        });
      }

      console.log("[whatsapp command] handled", {
        commandType: "checklist_task",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
      return NextResponse.json({ ok: true });
    }

    const isStructured =
      intent === "create_task_preview" ||
      intent === "create_event_preview" ||
      intent === "bulk_create_task_preview" ||
      intent === "create_reference_preview";

    if (isStructured) {
      // 3. Build command preview (with resolved sender profile!)
      const previewResult = await buildWhatsAppCommandPreview(parsedCommand, senderUserProfile, incoming.groupId);

      // Generate Preview ID & instruction if preview is valid
      let confirmationCode = "";
      let status = "failed";
      let expiresAt: Date | null = null;
      let replyMessage = previewResult.previewText;

      if (previewResult.isValid) {
        confirmationCode = generateConfirmationCode();
        status = "pending";
        expiresAt = new Date(Date.now() + 30 * 60 * 1000);

        const oldNote = "Preview ini belum disimpan ke database.";
        const oldNote2 = "Preview ini belum dijalankan.";
        const isReference = parsedCommand.intent === "create_reference_preview";
        const confirmCmd = isReference 
          ? `!jobdex konfirmasi referensi ${confirmationCode}` 
          : `!jobdex konfirmasi ${confirmationCode}`;

        const instruction = [
          `Preview ID: ${confirmationCode}`,
          `Untuk menyimpan ke database, balas:`,
          confirmCmd
        ].join("\n");

        if (replyMessage.includes(oldNote)) {
          replyMessage = replyMessage.replace(oldNote, `${instruction}\n\nCatatan:\n${oldNote}`);
        } else if (replyMessage.includes(oldNote2)) {
          replyMessage = replyMessage.replace(oldNote2, `${instruction}\n\nCatatan:\n${oldNote2}`);
        } else {
          replyMessage = replyMessage + `\n\n${instruction}`;
        }
      }

      const scrubbedFields: Record<string, string> = {};
      for (const key of Object.keys(parsedCommand.fields || {})) {
        scrubbedFields[key] = sanitizePinFromMessage(parsedCommand.fields[key]);
      }

      const scrubbedItems = (parsedCommand.items || []).map((item) => {
        const cleaned: Record<string, string> = {};
        for (const key of Object.keys(item)) {
          cleaned[key] = sanitizePinFromMessage(item[key]);
        }
        return cleaned;
      });

      // 4. Save preview log to Firestore collection ai_command_previews
      const previewLogRef = getAdminDb().collection("ai_command_previews").doc();
      await previewLogRef.set({
        id: previewLogRef.id,
        source: "whatsapp",
        raw_message: sanitizePinFromMessage(incoming.message),
        parsed_intent: parsedCommand.intent,
        parsed_fields: scrubbedFields,
        parsed_items: scrubbedItems,
        preview_text: replyMessage,
        whatsapp_sender: senderLabel,
        whatsapp_group_id: incoming.groupId || "",
        created_at: FieldValue.serverTimestamp(),
        confirmation_code: confirmationCode,
        status: status,
        expires_at: expiresAt || null,
      });

      // 5. Send preview reply to WhatsApp group
      const sendResult = await sendWhatsAppMessage(replyMessage);
      
      await createWhatsAppLog({
        message: replyMessage,
        status: "sent",
        response: sendResult.responseText,
      });

      await updateDebugIntent("task_command", parsedCommand.intent);
      console.log("[whatsapp command] handled", {
        commandType: parsedCommand.intent,
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // --- Fase 14A: Reference Search Intent Detection ---
    if (isReferenceSearchQuestion(question)) {
      const searchResult = await searchDesignReferencesFromQuestion(question);

      const aiLogRef = getAdminDb().collection("ai_logs").doc();
      await aiLogRef.set({
        id: aiLogRef.id,
        organization_id: "main_org",
        asked_by: "whatsapp_bot",
        question: sanitizePinFromMessage(question),
        context_summary: "Reference search query - Firestore collection matched directly.",
        answer: searchResult,
        model_used: "firestore-reference-search",
        source: "whatsapp",
        whatsapp_sender: senderLabel,
        whatsapp_group_id: incoming.groupId || process.env.WABLAS_GROUP_ID || "",
        created_at: FieldValue.serverTimestamp(),
      });

      const replyMessage = searchResult;
      const sendResult = await sendWhatsAppMessage(replyMessage);
      await createWhatsAppLog({
        message: replyMessage,
        status: "sent",
        response: sendResult.responseText,
      });

      await updateDebugIntent("reference_search", null, question);
      console.log("[whatsapp command] handled", {
        commandType: "reference_search",
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true });
    }

    // Identifikasi nomor pengirim (normalisasi format: e.g. 6285119459703)
    const effectiveSenderPhone = (
      resolvedSenderNumber ||
      (incoming.sender ? incoming.sender.replace(/[^\d]/g, "").replace(/^0/, "62") : "")
    ).replace(/[^\d]/g, "").replace(/^0/, "62");

    const rawQuestion = sanitizePinFromMessage(
      question || incoming.message.replace(/^!jobdex/i, "").trim() || incoming.message
    );

    // --- Fase 14B: Instant FAQ Knowledge Matcher (105 FAQ Dokumen) ---
    // Pencocokan instan tanpa memanggil DeepSeek API (0 token cost & respon seketika)
    const faqCandidateQuery = question || incoming.message;
    const faqMatch = await findFaqMatch(faqCandidateQuery);

    if (faqMatch) {
      const matchedFaq = faqMatch.faq;
      console.log("[whatsapp command] step: instant_faq_match", {
        faqId: matchedFaq.id,
        canonicalQuestion: matchedFaq.canonical_question,
        score: faqMatch.score,
        patternMatched: faqMatch.patternMatched,
        matchedKeywords: faqMatch.matchedKeywordsCount,
      });

      // Tambah hit_count (+1) di Firestore
      await incrementFaqHitCount(matchedFaq.id);

      // Pastikan formatWhatsAppText (*bold* bukan **bold**) diaplikasikan ke jawaban FAQ
      const formattedAnswer = formatWhatsAppText(matchedFaq.answer);

      // Simpan log ke ai_logs untuk audit dan analitik
      const aiLogRef = getAdminDb().collection("ai_logs").doc();
      await aiLogRef.set({
        id: aiLogRef.id,
        organization_id: detectedOrgId || "main_org",
        asked_by: "whatsapp_bot",
        sender_phone: effectiveSenderPhone || "unknown",
        question: sanitizePinFromMessage(faqCandidateQuery),
        context_summary: `Instant FAQ Match: [${matchedFaq.id}] ${matchedFaq.canonical_question}`,
        answer: formattedAnswer,
        model_used: "instant_faq_match",
        source: "whatsapp",
        whatsapp_sender: senderLabel,
        whatsapp_group_id: incoming.groupId || "",
        created_at: FieldValue.serverTimestamp(),
      });

      console.log("[whatsapp command] step: instant_faq_sending_reply");
      const sendResult = await sendWhatsAppMessage(formattedAnswer);
      await createWhatsAppLog({
        message: formattedAnswer,
        status: "sent",
        response: sendResult.responseText,
      });

      await updateDebugIntent("instant_faq_match", null, faqCandidateQuery);
      console.log("[whatsapp command] handled", {
        commandType: "instant_faq_match",
        faqId: matchedFaq.id,
        handled: true,
        stopFurtherProcessing: true,
      });
      return NextResponse.json({ ok: true, faqId: matchedFaq.id });
    }

    // --- Fallback: DeepSeek AI Assistant with Live Project Context & Daily Rate Limiting ---
    console.log("[WhatsApp AI Assistant] Processing natural question with live context:", rawQuestion);

    // 2. Pengecekan Kuota (Super Admin: 6285119459703 atau role super_admin bypass kuota)
    const isSuperAdminPhone =
      effectiveSenderPhone === "6285119459703" ||
      effectiveSenderPhone === "085119459703" ||
      effectiveSenderPhone.endsWith("85119459703");
    const isSuperAdmin =
      isSuperAdminPhone ||
      senderUserProfile?.role === "super_admin";

    const tz = process.env.APP_TIMEZONE || "Asia/Jakarta";
    let currentDate = new Date().toISOString().slice(0, 10);
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      currentDate = `${v.year}-${v.month}-${v.day}`;
    } catch {
      // fallback
    }

    if (!isSuperAdmin && effectiveSenderPhone) {
      const usageDocRef = db
        .collection("ai_daily_usage")
        .doc(`${effectiveSenderPhone}_${currentDate}`);
      const usageDoc = await usageDocRef.get();
      const currentUsage = usageDoc.exists ? Number(usageDoc.data()?.count || 0) : 0;

      if (currentUsage >= 5) {
        const quotaExceededMessage = [
          "Waduh, jatah 5 tanya-jawab AI kamu buat hari ini udah abis nih! 😅",
          "",
          "Istirahat dulu yaa, kita lanjut ngobrol lagi besok. Tapi kalau mau cek tugas atau update kerjaan lewat perintah biasa (`!jobdex tugas saya`), tetep bisa dipakai kapan aja kok! ✌️",
        ].join("\n");

        const sendResult = await sendWhatsAppMessage(quotaExceededMessage);
        await createWhatsAppLog({
          message: quotaExceededMessage,
          status: "sent",
          response: sendResult.responseText,
        });

        console.log("[whatsapp command] handled", {
          commandType: "ai_rate_limited",
          phone: effectiveSenderPhone,
          handled: true,
          stopFurtherProcessing: true,
        });
        return NextResponse.json({ ok: true, rateLimited: true });
      }

      // Tambahkan counter pemakaian di Firestore (+1)
      await usageDocRef.set(
        {
          phone: effectiveSenderPhone,
          date: currentDate,
          count: FieldValue.increment(1),
          last_used: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    // 3. Ambil konteks acara aktif dan tugas saat ini
    const { contextSummary } = await buildAIContext({
      profile: getBotProfile(),
    });

    const deepseekSystemPrompt = [
      "Peranmu murni sebagai asisten internal JobDex.in untuk kepanitiaan dan ormawa Forkom KIP Undiksha.",
      "",
      "BATASAN KETAT:",
      "- Kamu HANYA boleh menjawab hal-hal seputar tugas, kepanitiaan, alur desain/revisi, pembagian job desk, jadwal acara, dan fitur JobDex.in.",
      "- JANGAN PERNAH membuatkan kode pemrograman (seperti HTML, CSS, JavaScript, Python), menulis esai di luar ormawa, atau menjawab topik umum yang tidak ada kaitannya dengan kegiatan kepanitiaan mahasiswa.",
      "- Jika pengguna meminta hal di luar topik tersebut, tolak dengan gaya santai, sopan, dan ramah ala mahasiswa:",
      '  "Waduh, aku fokus bantuin job desk dan kepanitiaan ormawa aja nih! 😅 Kalau butuh info soal tugas, deadline, atau desain, baru tanyain ke aku yaa!"',
      "",
      "ATURAN FORMAT BALASAN WHATSAPP (SANGAT PENTING):",
      "- Gaya bicaramu ramah, santai, solutif, khas mahasiswa aktif, tidak kaku, dan langsung ke inti.",
      "- Gunakan format WhatsApp: *teks* untuk tebal (JANGAN gunakan markdown **teks**).",
      "- Jangan gunakan header markdown (#, ##, ###). Gunakan teks tebal *Judul*.",
      "- Hindari spasi dan baris kosong yang berlebihan.",
      "- Jika anggota ingin membuat tugas tapi infonya kurang (misal belum ada deadline atau PIC), tanyakan kekurangannya dengan santai.",
    ].join("\n");

    const deepseekUserPrompt = [
      "RINGKASAN KONTEKS ACARA & TUGAS AKTIF SAAT INI (JOBDEX.IN):",
      contextSummary,
      "",
      "PESAN/PERTANYAAN ANGGOTA:",
      rawQuestion,
    ].join("\n");

    let answer = "";
    let modelUsed = "deepseek-chat";

    // 4. Panggil DeepSeek API (endpoint: https://api.deepseek.com/chat/completions)
    console.log("[whatsapp command] step: execute_ai_fallback_starting");
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY?.trim();
    const deepseekBaseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");

    if (deepseekApiKey) {
      try {
        console.info(`[WhatsApp DeepSeek] Calling DeepSeek API at ${deepseekBaseUrl}/chat/completions...`);
        const dsRes = await fetch(`${deepseekBaseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${deepseekApiKey}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: deepseekSystemPrompt },
              { role: "user", content: deepseekUserPrompt },
            ],
            max_tokens: 800,
            temperature: 0.6,
          }),
        });

        if (dsRes.ok) {
          const dsData = await dsRes.json();
          answer = dsData.choices?.[0]?.message?.content?.trim() || "";
        } else {
          const errText = await dsRes.text();
          console.warn(`[WhatsApp DeepSeek] API error status ${dsRes.status}:`, errText);
        }
      } catch (dsErr) {
        console.error("[WhatsApp DeepSeek] API fetch error:", dsErr);
      }
    }

    // Fallback gracefully jika DeepSeek gagal atau kunci belum terisi
    if (!answer) {
      try {
        console.info("[WhatsApp DeepSeek Fallback] Falling back to generateText...");
        const aiResult = await generateText({
          systemPrompt: deepseekSystemPrompt,
          prompt: deepseekUserPrompt,
          feature: "whatsapp_deepseek_fallback",
          modelTier: "fast",
        });
        answer = aiResult.text;
        modelUsed = aiResult.model;
      } catch (aiErr) {
        console.error("[WhatsApp AI Assistant] Error generating fallback response:", aiErr);
        answer = "Waduh, koneksi ke asisten AI lagi bermasalah nih. Tapi kamu tetep bisa pakai perintah biasa kayak `!jobdex tugas saya` ya! ✌️";
      }
    }

    if (!answer || answer.trim() === "") {
      answer = "Waduh, koneksi ke asisten AI lagi bermasalah nih. Tapi kamu tetep bisa pakai perintah biasa kayak `!jobdex tugas saya` ya! ✌️";
    }

    // Bersihkan dan rapikan formatting respon dengan WhatsApp Markdown Formatter
    answer = formatWhatsAppText(answer);

    const aiLogRef = getAdminDb().collection("ai_logs").doc();
    await aiLogRef.set({
      id: aiLogRef.id,
      organization_id: detectedOrgId || "main_org",
      asked_by: "whatsapp_bot",
      sender_phone: effectiveSenderPhone || "unknown",
      question: rawQuestion,
      context_summary: contextSummary.slice(0, 12000),
      answer,
      model_used: modelUsed,
      source: "whatsapp",
      whatsapp_sender: senderLabel,
      whatsapp_group_id: incoming.groupId || "",
      created_at: FieldValue.serverTimestamp(),
    });

    const replyMessage = formatWhatsAppText(answer);
    console.log("[whatsapp command] step: execute_ai_fallback_sending_reply", { model: modelUsed });
    const sendResult = await sendWhatsAppMessage(replyMessage);
    await createWhatsAppLog({
      message: replyMessage,
      status: "sent",
      response: sendResult.responseText,
    });

    await updateDebugIntent("deepseek_fallback", null);
    console.log("[whatsapp command] step: execute_ai_fallback_completed");
    console.log("[whatsapp command] handled", {
      commandType: "deepseek_ai_fallback",
      model: modelUsed,
      handled: true,
      stopFurtherProcessing: true,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.log("[whatsapp command] step: catch_error_safe_reply_starting", {
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof WhatsAppRateLimitError) {
      try {
        await baseCreateWhatsAppLog({
          message: incoming.message || "",
          status: error.status,
          errorMessage: error.message,
          recipient: incoming.groupId || getDefaultGroupId(),
          isGroup: true,
          cooldownUntil: error.cooldownUntil,
          rateLimitReason: error.message,
        });
      } catch (logErr) {
        console.error("Failed to write rate limit log:", logErr);
      }

      return NextResponse.json({
        ok: false,
        error: error.message,
        status: error.status,
      });
    }

    const errorReply = "Waduh, koneksi ke asisten AI lagi bermasalah nih. Tapi kamu tetep bisa pakai perintah biasa kayak `!jobdex tugas saya` ya! ✌️";

    try {
      console.log("[whatsapp command] step: dispatching_safe_reply_fallback");
      const sendResult = await sendWhatsAppMessage(errorReply);
      await createWhatsAppLog({
        message: errorReply,
        status: "sent",
        response: sendResult.responseText,
      });
      console.log("[whatsapp command] step: safe_reply_fallback_dispatched");
    } catch (sendError) {
      console.error("[whatsapp command] Failed to dispatch safe-reply error:", sendError);
      let status = "failed";
      let errorMsg = sendError instanceof Error ? sendError.message : "Gagal mengirim error reply ke WhatsApp.";
      let cooldownUntil: Date | null = null;
      
      if (sendError instanceof WhatsAppRateLimitError) {
        status = sendError.status;
        errorMsg = sendError.message;
        cooldownUntil = sendError.cooldownUntil;
      }

      await baseCreateWhatsAppLog({
        message: errorReply,
        status,
        errorMessage: errorMsg,
        recipient: incoming.groupId || getDefaultGroupId(),
        isGroup: true,
        cooldownUntil,
      });
    }

    return NextResponse.json({
      ok: true,
      handled: true,
      fallbackUsed: true,
      error:
        error instanceof Error
          ? error.message
          : "Webhook AI gagal diproses.",
    });
  }
}
