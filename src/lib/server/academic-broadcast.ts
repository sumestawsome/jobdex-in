import "server-only";

import { getAdminDb, FieldValue } from "@/lib/server/firebase-admin";
import { sendWhatsAppMessage } from "@/lib/server/whatsapp";
import { sendGreenApiTextMessage } from "@/lib/server/green-api";
import type { Task, UserProfile } from "@/types";
import type { ClassWorkspaceGateways, ClassWorkspaceAdmin } from "@/types/workspace";
import { getTaskDeadlineDiffDays } from "@/lib/task-risk";

export const DEFAULT_CLASS_GROUP_ID = "120363411033795051@g.us"; // Coba JobdexIn (Broadcast Only)
export const DEFAULT_CLASS_DISCUSSION_GROUP_ID = "120363432766465224@g.us"; // CONTOH KELAS (Diskusi & Command)
export const DEFAULT_CLASS_WORKSPACE_ID = "ws_ilkom_2024";
export const DEFAULT_CLASS_WORKSPACE_NAME = "Kelas Ilmu Komputer 2024";

export type ClassWorkspaceConfig = {
  id: string;
  name: string;
  groupId: string;
  announcementGroupId: string;
  discussionGroupId: string;
  gateways?: ClassWorkspaceGateways;
  authorized_admins?: {
    admin_1?: ClassWorkspaceAdmin;
    admin_2?: ClassWorkspaceAdmin;
    super_admin?: ClassWorkspaceAdmin;
    [key: string]: ClassWorkspaceAdmin | undefined;
  };
};

/**
 * Checks whether a task belongs to an academic class workspace.
 */
export function isAcademicClassTask(task: Partial<Task> | null | undefined): boolean {
  if (!task) return false;
  if (task.type === "tugas_kuliah") return true;
  const tAny = task as Record<string, unknown>;
  if (tAny.workspace_type === "kelas" || tAny.org_type === "kelas" || tAny.type === "kelas") return true;
  if (task.workspace_id === DEFAULT_CLASS_WORKSPACE_ID || task.workspace_id?.startsWith("ws_kelas_")) return true;
  if (task.org_id === DEFAULT_CLASS_WORKSPACE_ID || task.organization_id === DEFAULT_CLASS_WORKSPACE_ID) return true;
  if (tAny.orgId === DEFAULT_CLASS_WORKSPACE_ID) return true;
  return false;
}

/**
 * Formats a Date/Timestamp in Indonesian format with WITA timezone (UTC+8).
 * Example: "Sabtu, 31 Oktober 2026 (23:59 WITA)"
 */
export function formatWitaDate(dateObj: unknown): string {
  if (!dateObj) return "-";
  const d =
    typeof dateObj === "object" && dateObj !== null && "toDate" in dateObj
      ? (dateObj as { toDate: () => Date }).toDate()
      : dateObj instanceof Date
      ? dateObj
      : new Date(dateObj as string | number);

  if (isNaN(d.getTime())) return "-";

  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  // Adjust to WITA (UTC+8)
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const witaDate = new Date(utc + 3600000 * 8);

  const dayName = days[witaDate.getDay()];
  const dateNum = witaDate.getDate();
  const monthName = months[witaDate.getMonth()];
  const year = witaDate.getFullYear();
  const hours = String(witaDate.getHours()).padStart(2, "0");
  const minutes = String(witaDate.getMinutes()).padStart(2, "0");

  return `${dayName}, ${dateNum} ${monthName} ${year} (${hours}:${minutes} WITA)`;
}

/**
 * Normalizes phone numbers to standard Indonesian format (e.g. 628...).
 */
function normalizePhoneNumber(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/\D/g, "")
    .replace(/^0/, "62")
    .replace(/^8/, "628");
}

/**
 * Retrieves configuration for a class workspace.
 */
export async function getClassWorkspaceConfig(
  workspaceId: string = DEFAULT_CLASS_WORKSPACE_ID,
  customDb?: FirebaseFirestore.Firestore
): Promise<ClassWorkspaceConfig> {
  const db = customDb || getAdminDb();
  try {
    const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
    if (wsDoc.exists) {
      const data = wsDoc.data();
      const announcementGroupId =
        data?.whatsapp_announcement_group_id ||
        data?.whatsapp_settings?.announcement_group_id ||
        data?.whatsapp_settings?.group_id ||
        data?.whatsapp_group_id ||
        DEFAULT_CLASS_GROUP_ID;
      const discussionGroupId =
        data?.whatsapp_discussion_group_id ||
        data?.whatsapp_settings?.discussion_group_id ||
        DEFAULT_CLASS_DISCUSSION_GROUP_ID;
      const rawName = data?.name;
      const name =
        rawName && rawName !== "Ilkom B" && rawName !== "Ilmu Komputer Undiksha 2024"
          ? rawName
          : DEFAULT_CLASS_WORKSPACE_NAME;
      const gateways = (data?.whatsapp_settings?.gateways || undefined) as ClassWorkspaceGateways | undefined;
      const authorized_admins = (data?.authorized_admins || undefined) as Record<string, ClassWorkspaceAdmin> | undefined;

      return {
        id: workspaceId,
        name,
        groupId: announcementGroupId,
        announcementGroupId,
        discussionGroupId,
        gateways,
        authorized_admins,
      };
    }
  } catch (err) {
    console.warn(`[AcademicBroadcast] Failed to read workspace ${workspaceId}:`, err);
  }

  return {
    id: workspaceId,
    name: DEFAULT_CLASS_WORKSPACE_NAME,
    groupId: DEFAULT_CLASS_GROUP_ID,
    announcementGroupId: DEFAULT_CLASS_GROUP_ID,
    discussionGroupId: DEFAULT_CLASS_DISCUSSION_GROUP_ID,
  };
}

/**
 * Finds a class workspace dynamically from context:
 * 1. Checks matching Group ID (discussion group or announcement group)
 * 2. Checks matching Sender Phone in authorized_admins
 * 3. Falls back to DEFAULT_CLASS_WORKSPACE_ID
 */
export async function findClassWorkspaceByContext(
  context: {
    groupId?: string | null;
    sender?: string | null;
    isGroup?: boolean;
    workspaceId?: string | null;
  },
  customDb?: FirebaseFirestore.Firestore
): Promise<ClassWorkspaceConfig> {
  const db = customDb || getAdminDb();

  // 1. Explicit workspaceId provided
  if (context.workspaceId) {
    return await getClassWorkspaceConfig(context.workspaceId, db);
  }

  try {
    const snap = await db.collection("workspaces").where("type", "==", "kelas").get();
    if (!snap.empty) {
      const cleanGroup = context.groupId ? context.groupId.replace(/\D/g, "") : "";
      const cleanSender = context.sender ? normalizePhoneNumber(context.sender) : "";

      // 2a. Match by Group ID
      if (cleanGroup) {
        for (const doc of snap.docs) {
          const data = doc.data();
          const discGroup = (
            data.whatsapp_settings?.discussion_group_id ||
            data.whatsapp_discussion_group_id ||
            ""
          ).replace(/\D/g, "");
          const annGroup = (
            data.whatsapp_settings?.announcement_group_id ||
            data.whatsapp_announcement_group_id ||
            data.whatsapp_group_id ||
            ""
          ).replace(/\D/g, "");
          if (cleanGroup === discGroup || cleanGroup === annGroup) {
            return await getClassWorkspaceConfig(doc.id, db);
          }
        }
      }

      // 2b. Match by Sender Phone (admin_1, admin_2, or super_admin)
      if (cleanSender) {
        for (const doc of snap.docs) {
          const data = doc.data();
          const admins = data.authorized_admins || {};
          const a1Phone = normalizePhoneNumber(admins.admin_1?.phone);
          const a2Phone = normalizePhoneNumber(admins.admin_2?.phone);
          const saPhone = normalizePhoneNumber(admins.super_admin?.phone);
          if (cleanSender === a1Phone || cleanSender === a2Phone || cleanSender === saPhone) {
            return await getClassWorkspaceConfig(doc.id, db);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[AcademicBroadcast] Error querying workspaces for context:", err);
  }

  // Fallback to default class workspace
  return await getClassWorkspaceConfig(DEFAULT_CLASS_WORKSPACE_ID, db);
}

/**
 * Dispatches broadcast messages to the class announcement group:
 * If custom dedicated Instance B (outbound broadcast) is configured, dispatches directly via Green-API without watermark.
 * Otherwise falls back to default system WhatsApp provider (Fonnte or Green-API default).
 */
export async function dispatchClassBroadcastMessage(
  wsConfig: ClassWorkspaceConfig,
  message: string
): Promise<{ ok: boolean; idMessage?: string; error?: string }> {
  const broadcastInstanceId = wsConfig.gateways?.broadcast_instance_id?.trim();
  const broadcastToken = wsConfig.gateways?.broadcast_token?.trim();

  if (broadcastInstanceId && broadcastToken) {
    console.log(
      `[AcademicBroadcast] Dispatching outbound broadcast via dedicated Instance B (${broadcastInstanceId}) to ${wsConfig.announcementGroupId}`
    );
    const result = await sendGreenApiTextMessage(wsConfig.announcementGroupId, message, {
      idInstance: broadcastInstanceId,
      apiTokenInstance: broadcastToken,
    });
    if (result.ok) {
      return result;
    }
    console.warn(
      `[AcademicBroadcast] Instance B dispatch failed (${result.error}), falling back to system provider`
    );
  }

  // Fallback to default system sender
  const fallback = await sendWhatsAppMessage({
    target: wsConfig.announcementGroupId,
    message,
    type: "group",
    org_id: wsConfig.id,
  });

  return {
    ok: fallback.ok,
    idMessage: fallback.responseText ? String(fallback.responseText) : undefined,
    error: fallback.error,
  };
}

export const DEFAULT_SUBMISSION_PLACE = "E-Learning Undiksha";
export const OFFICIAL_APP_URL = "https://jobdexin.sumestawsome.xyz";
export const PUBLIC_CLASS_SCHEDULE_URL = "https://jobdexin.sumestawsome.xyz/jadwal-tugas-ilkom-b";


/**
 * Resolves the application base URL, strictly avoiding localhost in WhatsApp broadcasts.
 */
export function resolveAppBaseUrl(overrideUrl?: string): string {
  if (overrideUrl && !overrideUrl.includes("localhost")) {
    return overrideUrl.replace(/\/+$/, "");
  }
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  if (envUrl && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/+$/, "");
  }
  return OFFICIAL_APP_URL;
}

/**
 * Resolves the submission text or link, defaulting to "E-Learning Undiksha" if empty or "-".
 */
export function resolveSubmissionText(rawSubmission?: string): string {
  const trimmed = rawSubmission?.trim();
  if (!trimmed || trimmed === "-") {
    return DEFAULT_SUBMISSION_PLACE;
  }
  return trimmed;
}

/**
 * Skenario 1 - Format pesan pengumuman tugas baru (Ilkom B Akrab)
 */
export function buildNewClassTaskMessage(params: {
  workspaceName?: string;
  courseName: string;
  taskName: string;
  deadlineFormatted: string;
  description: string;
  submissionUrl?: string;
  appUrl?: string;
}): string {
  const subLink = resolveSubmissionText(params.submissionUrl);
  const descText =
    params.description && params.description.trim()
      ? params.description.trim()
      : "Tidak ada ketentuan khusus.";
  const wsName = params.workspaceName || DEFAULT_CLASS_WORKSPACE_NAME;

  return [
    "📢 *PENGUMUMAN TUGAS KULIAH* ✨",
    `Halo rekan-rekan *${wsName}*!`,
    "",
    "Ada tugas baru nih, jangan lupa dicatat dan dibuat ya Guys! 🙌",
    `📚 *Mata Kuliah:* ${params.courseName || "Umum"}`,
    `📝 *Tugas:* ${params.taskName}`,
    `⏰ *Tenggat:* ${params.deadlineFormatted}`,
    "",
    "📌 *Ketentuan / Deskripsi:*",
    descText,
    "",
    "🔗 *Tempat Pengumpulan / LMS:*",
    subLink,
    "",
    "Yuk cicil dari sekarang biar gak keteteran pas deadline!",
    `👉 Cek kalender & jadwal lengkap: ${PUBLIC_CLASS_SCHEDULE_URL}`,
  ].join("\n");
}

/**
 * Format siaran penutupan tugas selesai ke Grup Pengumuman Komunitas
 */
export function buildClassTaskCompletedMessage(params: {
  courseName: string;
  taskTitle: string;
  workspaceName?: string;
}): string {
  const course = params.courseName || "Mata Kuliah";
  const title = params.taskTitle || "Tugas";
  const ws = params.workspaceName || DEFAULT_CLASS_WORKSPACE_NAME;

  return [
    "🎉 *TUGAS SELESAI / DITUTUP*",
    `Tugas *${course} - ${title}* telah selesai dikumpulkan. Terima kasih atas kerja samanya teman-teman ${ws}!`,
  ].join("\n");
}

/**
 * Skenario 2A - Format pengingat H-5
 */
export function buildH5ClassReminderMessage(params: {
  workspaceName?: string;
  courseName: string;
  taskName: string;
  deadlineFormatted: string;
  description?: string;
  submissionUrl?: string;
  appUrl?: string;
}): string {
  const subLink = resolveSubmissionText(params.submissionUrl);
  const wsName = params.workspaceName || DEFAULT_CLASS_WORKSPACE_NAME;

  return [
    "⏳ *PENGINGAT TUGAS KULIAH (H-5)* 📚",
    `Halo rekan-rekan *${wsName}*!`,
    "",
    "Mengingatkan untuk tugas yang perlu dicicil:",
    `📚 *Mata Kuliah:* ${params.courseName || "Umum"}`,
    `📝 *Tugas:* ${params.taskName}`,
    `⏰ *Tenggat:* ${params.deadlineFormatted} (5 hari lagi)`,
    "",
    "🔗 *Link Pengumpulan / LMS:*",
    subLink,
    "",
    "Yuk mulai dicicil dari sekarang biar santai pas mendekati deadline! 💪",
    `👉 Cek kalender & jadwal lengkap: ${PUBLIC_CLASS_SCHEDULE_URL}`,
  ].join("\n");
}

/**
 * Skenario 2B - Format pengingat H-3
 */
export function buildH3ClassReminderMessage(params: {
  workspaceName?: string;
  courseName: string;
  taskName: string;
  deadlineFormatted: string;
  submissionUrl?: string;
  appUrl?: string;
}): string {
  const subLink = resolveSubmissionText(params.submissionUrl);
  const wsName = params.workspaceName || DEFAULT_CLASS_WORKSPACE_NAME;

  return [
    "⚠️ *PENGINGAT PROGRES TUGAS (H-3)* 📌",
    `Halo rekan-rekan *${wsName}*!`,
    "",
    "Tenggat pengumpulan tugas tinggal 3 hari lagi:",
    `📚 *Mata Kuliah:* ${params.courseName || "Umum"}`,
    `📝 *Tugas:* ${params.taskName}`,
    `⏰ *Tenggat:* ${params.deadlineFormatted}`,
    "",
    "🔗 *Link Pengumpulan / LMS:*",
    subLink,
    "",
    "Bagaimana progres pengerjaannya? Segera cicil dan selesaikan sebelum tenggat ya! 🙌",
    `👉 Cek kalender & jadwal lengkap: ${PUBLIC_CLASS_SCHEDULE_URL}`,
  ].join("\n");
}

/**
 * Skenario 2C - Format pengingat H-1 (Urgent Reminder)
 */
export function buildH1ClassReminderMessage(params: {
  workspaceName?: string;
  courseName: string;
  taskName: string;
  deadlineFormatted: string;
  submissionUrl?: string;
  appUrl?: string;
}): string {
  const subLink = resolveSubmissionText(params.submissionUrl);
  const wsName = params.workspaceName || DEFAULT_CLASS_WORKSPACE_NAME;

  return [
    "⏰ *PENGINGAT DEADLINE BESOK!* 🔥",
    `Halo rekan-rekan *${wsName}*! Jangan lupa tugas berikut batas pengumpulannya besok ya:`,
    "",
    `📚 *Mata Kuliah:* ${params.courseName || "Umum"}`,
    `📝 *Tugas:* ${params.taskName}`,
    `🚨 *Deadline:* ${params.deadlineFormatted}`,
    "",
    "🔗 *Link Pengumpulan / LMS:*",
    subLink,
    "",
    "Pastikan file/link tugas sudah siap disubmit sebelum server LMS penuh. Semangat menyelesaikannya! 🚀",
    `👉 Cek kalender & jadwal lengkap: ${PUBLIC_CLASS_SCHEDULE_URL}`,
  ].join("\n");
}

/**
 * Skenario 2D - Format pengingat Hari H (Deadline Hari Ini)
 */
export function buildTodayClassReminderMessage(params: {
  workspaceName?: string;
  courseName: string;
  taskName: string;
  deadlineFormatted: string;
  submissionUrl?: string;
  appUrl?: string;
}): string {
  const subLink = resolveSubmissionText(params.submissionUrl);
  const wsName = params.workspaceName || DEFAULT_CLASS_WORKSPACE_NAME;

  return [
    "🚨 *PENGINGAT DEADLINE HARI INI!* ⏰",
    `Halo rekan-rekan *${wsName}*! Jangan lupa tugas berikut batas pengumpulannya HARI INI ya:`,
    "",
    `📚 *Mata Kuliah:* ${params.courseName || "Umum"}`,
    `📝 *Tugas:* ${params.taskName}`,
    `🚨 *Deadline:* ${params.deadlineFormatted}`,
    "",
    "🔗 *Link Pengumpulan / LMS:*",
    subLink,
    "",
    "Pastikan file/link tugas sudah siap disubmit sebelum tenggat waktu berakhir. Semangat menyelesaikannya! 🚀",
    `👉 Cek kalender & jadwal lengkap: ${PUBLIC_CLASS_SCHEDULE_URL}`,
  ].join("\n");
}

/**
 * Skenario 3A - Format perubahan tanggal deadline
 */
export function buildDeadlineChangedMessage(params: {
  workspaceName?: string;
  courseName: string;
  taskName: string;
  newDeadlineFormatted: string;
  oldDeadlineFormatted?: string;
  submissionUrl?: string;
  appUrl?: string;
}): string {
  const subLink = resolveSubmissionText(params.submissionUrl);
  const wsName = params.workspaceName || DEFAULT_CLASS_WORKSPACE_NAME;

  return [
    "⚠️ *INFO PERUBAHAN DEADLINE KULIAH* ⏰",
    `Halo rekan-rekan *${wsName}*!`,
    "",
    "Ada pembaruan jadwal pengumpulan tugas:",
    `📚 *Mata Kuliah:* ${params.courseName || "Umum"}`,
    `📝 *Tugas:* ${params.taskName}`,
    `🗓️ *Jadwal Baru:* ${params.newDeadlineFormatted}`,
    ...(params.oldDeadlineFormatted ? [`⏳ *Jadwal Sebelumnya:* ${params.oldDeadlineFormatted}`] : []),
    "",
    "📌 *Catatan:*",
    "Jadwal pengumpulan telah diperbarui oleh dosen/Admin Komunitas. Jangan sampai terlewat ya! 🙌",
    "",
    "🔗 *Link Pengumpulan / LMS:*",
    subLink,
    "",
    `👉 Cek kalender & jadwal lengkap: ${PUBLIC_CLASS_SCHEDULE_URL}`,
  ].join("\n");
}

/**
 * Skenario 3B - Format perubahan ketentuan / instruksi tugas
 */
export function buildDescriptionChangedMessage(params: {
  workspaceName?: string;
  courseName: string;
  taskName: string;
  deadlineFormatted: string;
  newDescription: string;
  submissionUrl?: string;
  appUrl?: string;
}): string {
  const subLink = resolveSubmissionText(params.submissionUrl);
  const wsName = params.workspaceName || DEFAULT_CLASS_WORKSPACE_NAME;

  return [
    "📝 *UPDATE KETENTUAN TUGAS KULIAH* 💡",
    `Halo rekan-rekan *${wsName}*!`,
    "",
    "Ada pembaruan ketentuan/instruksi tugas dari dosen/Admin Komunitas:",
    `📚 *Mata Kuliah:* ${params.courseName || "Umum"}`,
    `📝 *Tugas:* ${params.taskName}`,
    `⏰ *Tenggat:* ${params.deadlineFormatted}`,
    "",
    "📌 *Ketentuan Terbaru:*",
    params.newDescription,
    "",
    "🔗 *Link Pengumpulan / LMS:*",
    subLink,
    "",
    "Silakan cek instruksi terbaru agar pengerjaan sesuai arahan! 🙌",
    `👉 Cek kalender & jadwal lengkap: ${PUBLIC_CLASS_SCHEDULE_URL}`,
  ].join("\n");
}

/**
 * Helper to record log in notifications_log and whatsapp_logs
 */
async function recordAuditLog(
  db: FirebaseFirestore.Firestore,
  data: {
    workspaceId: string;
    taskId: string;
    triggerType: string;
    targetGroup: string;
    message: string;
    status: "sent" | "failed" | "skipped";
    errorMessage?: string;
  }
) {
  try {
    const logId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.collection("notifications_log").doc(logId).set({
      id: logId,
      workspace_id: data.workspaceId,
      task_id: data.taskId,
      trigger_type: data.triggerType,
      target_group: data.targetGroup,
      message_preview: data.message.slice(0, 200),
      status: data.status,
      error_message: data.errorMessage || null,
      sent_at: new Date().toISOString(),
      created_at: FieldValue.serverTimestamp(),
    });

    await db.collection("whatsapp_logs").add({
      organization_id: data.workspaceId,
      workspace_id: data.workspaceId,
      task_id: data.taskId,
      event_type: data.triggerType,
      message_content: data.message,
      recipient: data.targetGroup,
      recipient_group_id: data.targetGroup,
      recipient_type: "group",
      is_group: true,
      status: data.status,
      error_message: data.errorMessage || null,
      created_at: FieldValue.serverTimestamp(),
      provider: process.env.WHATSAPP_PROVIDER || "fonnte",
      target_type: "group",
    });
  } catch (err) {
    console.warn("[AcademicBroadcast] Failed to record audit log:", err);
  }
}

/**
 * Skenario 1 - Handler saat tugas baru dibuat oleh Korti
 */
export async function handleAcademicTaskCreated(
  taskId: string,
  actorId?: string,
  customDb?: FirebaseFirestore.Firestore
): Promise<{
  sent: boolean;
  skipped: boolean;
  reason: string;
  diffDays: number | null;
}> {
  const db = customDb || getAdminDb();
  const taskDoc = await db.collection("tasks").doc(taskId).get();

  if (!taskDoc.exists) {
    return { sent: false, skipped: true, reason: "task_not_found", diffDays: null };
  }

  const task = { id: taskDoc.id, ...taskDoc.data() } as Task;
  if (!isAcademicClassTask(task)) {
    return { sent: false, skipped: true, reason: "not_academic_task", diffDays: null };
  }

  const diffDays = getTaskDeadlineDiffDays(task);
  const targetWsId = task.workspace_id || task.org_id || DEFAULT_CLASS_WORKSPACE_ID;
  const wsConfig = await getClassWorkspaceConfig(targetWsId, db);

  // Skenario 1: Deadline Mepet (<= 3 Hari)
  if (diffDays !== Number.MAX_SAFE_INTEGER && diffDays <= 3) {
    const deadlineFormatted = formatWitaDate(task.deadline);
    const courseName = task.course_name || task.subject_name || "";
    const taskName = task.name || task.title || "Tugas Kuliah";
    const subUrl = task.submission_url || task.submission_link || "";

    const message = buildNewClassTaskMessage({
      workspaceName: wsConfig.name,
      courseName,
      taskName,
      deadlineFormatted,
      description: task.description || "",
      submissionUrl: subUrl,
    });

    try {
      const sendResult = await dispatchClassBroadcastMessage(wsConfig, message);

      // Tandai milestone yang sudah terlewati agar tidak dikirim ganda oleh cron
      const milestonesToMark = ["instant_created", "h5", "h3"];
      if (diffDays <= 1) {
        milestonesToMark.push("h1");
      }

      await db.collection("tasks").doc(taskId).update({
        reminders_sent: FieldValue.arrayUnion(...milestonesToMark),
        "notification_tracker.instant_created_sent": true,
        "notification_tracker.milestones_sent": milestonesToMark,
        "notification_tracker.last_sent_at": FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      await recordAuditLog(db, {
        workspaceId: targetWsId,
        taskId,
        triggerType: "instant_created",
        targetGroup: wsConfig.groupId,
        message,
        status: sendResult.ok ? "sent" : "skipped",
        errorMessage: sendResult.error,
      });

      return {
        sent: sendResult.ok,
        skipped: !sendResult.ok,
        reason: "instant_created_broadcast_sent",
        diffDays,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Gagal mengirim siaran WA";
      await recordAuditLog(db, {
        workspaceId: targetWsId,
        taskId,
        triggerType: "instant_created",
        targetGroup: wsConfig.groupId,
        message,
        status: "failed",
        errorMessage: errMsg,
      });
      return { sent: false, skipped: false, reason: errMsg, diffDays };
    }
  }

  // Skenario 1 (Normal): Deadline > 3 Hari, simpan tanpa membunyikan grup
  await db.collection("tasks").doc(taskId).update({
    "notification_tracker.instant_created_sent": false,
    "notification_tracker.milestones_sent": [],
    reminders_sent: [],
    updated_at: FieldValue.serverTimestamp(),
  });

  return {
    sent: false,
    skipped: true,
    reason: "normal_deadline_silent_saved",
    diffDays,
  };
}

/**
 * Skenario 3 - Handler saat tugas kelas diedit (Perubahan Deadline atau Deskripsi)
 */
export async function handleAcademicTaskUpdated(
  taskId: string,
  actorId?: string,
  changes?: {
    deadlineChanged?: boolean;
    descriptionChanged?: boolean;
    oldDeadline?: unknown;
    newDeadline?: unknown;
    oldDescription?: string;
    newDescription?: string;
  },
  customDb?: FirebaseFirestore.Firestore
): Promise<{
  sent: boolean;
  skipped: boolean;
  reason: string;
}> {
  const db = customDb || getAdminDb();
  const taskDoc = await db.collection("tasks").doc(taskId).get();

  if (!taskDoc.exists) {
    return { sent: false, skipped: true, reason: "task_not_found" };
  }

  const task = { id: taskDoc.id, ...taskDoc.data() } as Task;
  if (!isAcademicClassTask(task)) {
    return { sent: false, skipped: true, reason: "not_academic_task" };
  }

  const targetWsId = task.workspace_id || task.org_id || DEFAULT_CLASS_WORKSPACE_ID;
  const wsConfig = await getClassWorkspaceConfig(targetWsId, db);
  const courseName = task.course_name || task.subject_name || "";
  const taskName = task.name || task.title || "Tugas Kuliah";
  const subUrl = task.submission_url || task.submission_link || "";

  // 1. Kasus A: Tanggal Deadline Berubah
  if (changes?.deadlineChanged) {
    const newDeadlineFormatted = formatWitaDate(changes.newDeadline || task.deadline);
    const oldDeadlineFormatted = changes.oldDeadline ? formatWitaDate(changes.oldDeadline) : undefined;

    const message = buildDeadlineChangedMessage({
      workspaceName: wsConfig.name,
      courseName,
      taskName,
      newDeadlineFormatted,
      oldDeadlineFormatted,
      submissionUrl: subUrl,
    });

    try {
      const sendResult = await dispatchClassBroadcastMessage(wsConfig, message);

      // Hitung ulang milestone jika deadline diundur
      const diffDays = getTaskDeadlineDiffDays(task);
      const newMilestones: string[] = ["updated_deadline"];

      // Jika diundur jauh (> 3 hari), hilangkan H-3 dan H-1 agar cron bisa menyapa kembali
      if (diffDays !== Number.MAX_SAFE_INTEGER && diffDays <= 3) {
        newMilestones.push("h5");
      }

      await db.collection("tasks").doc(taskId).update({
        reminders_sent: FieldValue.arrayUnion(...newMilestones),
        "notification_tracker.last_edit_broadcast_at": FieldValue.serverTimestamp(),
        "notification_tracker.edit_count": FieldValue.increment(1),
        updated_at: FieldValue.serverTimestamp(),
      });

      await recordAuditLog(db, {
        workspaceId: targetWsId,
        taskId,
        triggerType: "deadline_changed",
        targetGroup: wsConfig.groupId,
        message,
        status: sendResult.ok ? "sent" : "skipped",
        errorMessage: sendResult.error,
      });

      return { sent: sendResult.ok, skipped: !sendResult.ok, reason: "deadline_changed_broadcast_sent" };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Gagal kirim siaran update deadline";
      await recordAuditLog(db, {
        workspaceId: targetWsId,
        taskId,
        triggerType: "deadline_changed",
        targetGroup: wsConfig.groupId,
        message,
        status: "failed",
        errorMessage: errMsg,
      });
      return { sent: false, skipped: false, reason: errMsg };
    }
  }

  // 2. Kasus B: Ketentuan / Deskripsi Berubah
  if (changes?.descriptionChanged) {
    const deadlineFormatted = formatWitaDate(task.deadline);
    const message = buildDescriptionChangedMessage({
      workspaceName: wsConfig.name,
      courseName,
      taskName,
      deadlineFormatted,
      newDescription: changes.newDescription || task.description || "",
      submissionUrl: subUrl,
    });

    try {
      const sendResult = await dispatchClassBroadcastMessage(wsConfig, message);

      await db.collection("tasks").doc(taskId).update({
        reminders_sent: FieldValue.arrayUnion("updated_description"),
        "notification_tracker.last_edit_broadcast_at": FieldValue.serverTimestamp(),
        "notification_tracker.edit_count": FieldValue.increment(1),
        updated_at: FieldValue.serverTimestamp(),
      });

      await recordAuditLog(db, {
        workspaceId: targetWsId,
        taskId,
        triggerType: "description_changed",
        targetGroup: wsConfig.groupId,
        message,
        status: sendResult.ok ? "sent" : "skipped",
        errorMessage: sendResult.error,
      });

      return { sent: sendResult.ok, skipped: !sendResult.ok, reason: "description_changed_broadcast_sent" };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Gagal kirim siaran update ketentuan";
      await recordAuditLog(db, {
        workspaceId: targetWsId,
        taskId,
        triggerType: "description_changed",
        targetGroup: wsConfig.groupId,
        message,
        status: "failed",
        errorMessage: errMsg,
      });
      return { sent: false, skipped: false, reason: errMsg };
    }
  }

  return { sent: false, skipped: true, reason: "no_critical_changes" };
}

/**
 * Skenario 2 - Handler Rutin Cron Job Jam 12:00 WITA
 * Memeriksa milestone H-5, H-3, dan H-1 untuk tugas kelas.
 */
export async function processAcademicCronReminders(
  customDb?: FirebaseFirestore.Firestore,
  options?: { force?: boolean; dryRun?: boolean }
): Promise<{
  checked: number;
  sent: number;
  skipped: number;
  errors: string[];
  tasks: Array<{ id: string; milestone: string; status: string; taskName: string }>;
}> {
  const db = customDb || getAdminDb();
  const force = options?.force || false;
  const dryRun = options?.dryRun || false;

  const results: Array<{ id: string; milestone: string; status: string; taskName: string }> = [];
  const errors: string[] = [];
  let sentCount = 0;
  let skippedCount = 0;

  try {
    const tasksSnap = await db
      .collection("tasks")
      .where("is_archived", "==", false)
      .get();

    const activeAcademicTasks: Task[] = [];
    tasksSnap.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() } as Task;
      if (
        isAcademicClassTask(data) &&
        data.status !== "approved" &&
        data.status !== ("selesai" as unknown as typeof data.status)
      ) {
        activeAcademicTasks.push(data);
      }
    });

    for (const task of activeAcademicTasks) {
      const diffDays = getTaskDeadlineDiffDays(task);
      if (diffDays === Number.MAX_SAFE_INTEGER) continue;

      const remindersSent = Array.isArray(task.reminders_sent) ? task.reminders_sent : [];
      const targetWsId = task.workspace_id || task.org_id || DEFAULT_CLASS_WORKSPACE_ID;
      const wsConfig = await getClassWorkspaceConfig(targetWsId, db);
      const courseName = task.course_name || task.subject_name || "";
      const taskName = task.name || task.title || "Tugas Kuliah";
      const deadlineFormatted = formatWitaDate(task.deadline);
      const subUrl = task.submission_url || task.submission_link || "";

      let targetMilestone: "today" | "h5" | "h3" | "h1" | null = null;
      let messageContent = "";

      // Hari H: diffDays === 0
      if (diffDays === 0) {
        if (force || !remindersSent.includes("today")) {
          targetMilestone = "today";
          messageContent = buildTodayClassReminderMessage({
            workspaceName: wsConfig.name,
            courseName,
            taskName,
            deadlineFormatted,
            submissionUrl: subUrl,
          });
        }
      }
      // H-1: diffDays === 1
      else if (diffDays === 1) {
        if (force || !remindersSent.includes("h1")) {
          targetMilestone = "h1";
          messageContent = buildH1ClassReminderMessage({
            workspaceName: wsConfig.name,
            courseName,
            taskName,
            deadlineFormatted,
            submissionUrl: subUrl,
          });
        }
      }
      // H-3: diffDays === 2 atau diffDays === 3
      else if (diffDays <= 3 && diffDays > 1) {
        if (force || !remindersSent.includes("h3")) {
          targetMilestone = "h3";
          messageContent = buildH3ClassReminderMessage({
            workspaceName: wsConfig.name,
            courseName,
            taskName,
            deadlineFormatted,
            submissionUrl: subUrl,
          });
        }
      }
      // H-5: diffDays === 4 atau diffDays === 5
      else if (diffDays <= 5 && diffDays > 3) {
        if (force || !remindersSent.includes("h5")) {
          targetMilestone = "h5";
          messageContent = buildH5ClassReminderMessage({
            workspaceName: wsConfig.name,
            courseName,
            taskName,
            deadlineFormatted,
            description: task.description || "",
            submissionUrl: subUrl,
          });
        }
      }

      if (!targetMilestone || !messageContent) {
        skippedCount++;
        continue;
      }

      if (dryRun) {
        results.push({
          id: task.id,
          taskName,
          milestone: targetMilestone,
          status: "dry_run",
        });
        sentCount++;
        continue;
      }

      try {
        const sendResult = await dispatchClassBroadcastMessage(wsConfig, messageContent);

        await db.collection("tasks").doc(task.id).update({
          reminders_sent: FieldValue.arrayUnion(targetMilestone),
          "notification_tracker.milestones_sent": FieldValue.arrayUnion(targetMilestone),
          "notification_tracker.last_sent_at": FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });

        await recordAuditLog(db, {
          workspaceId: targetWsId,
          taskId: task.id,
          triggerType: `cron_${targetMilestone}`,
          targetGroup: wsConfig.groupId,
          message: messageContent,
          status: sendResult.ok ? "sent" : "skipped",
          errorMessage: sendResult.error,
        });

        results.push({
          id: task.id,
          taskName,
          milestone: targetMilestone,
          status: sendResult.ok ? "sent" : "skipped",
        });
        sentCount++;
      } catch (sendErr) {
        const errMsg = sendErr instanceof Error ? sendErr.message : "Gagal kirim cron WA tugas kelas";
        errors.push(`Task ${task.id} (${targetMilestone}): ${errMsg}`);
        results.push({
          id: task.id,
          taskName,
          milestone: targetMilestone,
          status: "failed",
        });

        await recordAuditLog(db, {
          workspaceId: targetWsId,
          taskId: task.id,
          triggerType: `cron_${targetMilestone}`,
          targetGroup: wsConfig.groupId,
          message: messageContent,
          status: "failed",
          errorMessage: errMsg,
        });
      }
    }

    return {
      checked: activeAcademicTasks.length,
      sent: sentCount,
      skipped: skippedCount,
      errors,
      tasks: results,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal memproses cron tugas kelas";
    errors.push(msg);
    return {
      checked: 0,
      sent: sentCount,
      skipped: skippedCount,
      errors,
      tasks: results,
    };
  }
}
