import "server-only";

import { buildWhatsAppMessage, type WhatsAppEventType } from "@/lib/notification-templates";
import { FieldValue, getAdminDb } from "@/lib/server/firebase-admin";
import {
  resolveTaskNotificationTarget,
  type TaskNotificationTarget,
} from "@/lib/server/group-routing";
import {
  sendWhatsAppMessage,
} from "@/lib/server/whatsapp";
import type { Task, TaskStatus, UserProfile, WhatsAppLogStatus } from "@/types";

type NotifyTaskEventInput = {
  eventType: WhatsAppEventType;
  taskId: string;
  actorId: string;
  status?: TaskStatus;
  note?: string;
  stuckNotes?: string;
  revisionNotes?: string;
  uploadUrl?: string;
  thumbnailUrl?: string;
};

async function getUserProfile(userId: string) {
  if (!userId) {
    return null;
  }

  const snapshot = await getAdminDb().collection("users").doc(userId).get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as UserProfile;
}

async function createWhatsAppLog({
  task,
  eventType,
  message,
  status,
  target,
  provider,
  wablasResponse,
  errorMessage,
}: {
  task: Task;
  eventType: WhatsAppEventType;
  message: string;
  status: WhatsAppLogStatus;
  target?: TaskNotificationTarget | null;
  provider?: string;
  wablasResponse?: string;
  errorMessage?: string;
}) {
  const logRef = getAdminDb().collection("whatsapp_logs").doc();

  await logRef.set({
    id: logRef.id,
    organization_id: task.organization_id || "main_org",
    task_id: task.id,
    event_type: eventType,
    message_content: message,
    recipient: target?.recipient || "",
    recipient_group_id: target?.recipient || "",
    recipient_type: target?.targetType === "personal" ? "personal" : "group",
    is_group: target?.targetType !== "personal",
    target_group_type: target?.targetType || null,
    target_reason: target?.reason || null,
    linked_event_id: target?.eventId || null,
    linked_division_id: target?.divisionId || null,
    status,
    ...(wablasResponse ? { wablas_response: wablasResponse } : {}),
    ...(errorMessage ? { error_message: errorMessage } : {}),
    retry_count: 0,
    created_at: FieldValue.serverTimestamp(),
    provider: provider || process.env.WHATSAPP_PROVIDER || "wablas",
    target_type: target?.targetType === "personal" ? "phone" : "group",
  });
}

export async function notifyTaskEvent(input: NotifyTaskEventInput) {
  const db = getAdminDb();
  const taskSnapshot = await db.collection("tasks").doc(input.taskId).get();

  if (!taskSnapshot.exists) {
    throw new Error("Task tidak ditemukan untuk notifikasi.");
  }

  const task = {
    id: taskSnapshot.id,
    ...taskSnapshot.data(),
  } as Task;

  const [actor, pic, coordinator] = await Promise.all([
    getUserProfile(input.actorId),
    getUserProfile(task.pic_id),
    getUserProfile(task.coordinator_id),
  ]);

  const message = buildWhatsAppMessage(input.eventType, {
    task,
    actor,
    pic,
    coordinator,
    status: input.status,
    note: input.note,
    stuckNotes: input.stuckNotes,
    revisionNotes: input.revisionNotes,
    uploadUrl: input.uploadUrl,
    thumbnailUrl: input.thumbnailUrl,
  });
  const target = await resolveTaskNotificationTarget(task);

  try {
    if (!target) {
      throw new Error("Target WhatsApp untuk notifikasi task tidak ditemukan.");
    }

    const taskOrgId = task.org_id || task.orgId || task.organization_id;
    const result = await sendWhatsAppMessage({
      target: target.recipient,
      message,
      type: target.targetType === "personal" ? "phone" : "group",
      org_id: taskOrgId,
    });

    if (result.skipped) {
      await createWhatsAppLog({
        task,
        eventType: input.eventType,
        message,
        status: "skipped",
        target,
        provider: result.provider,
        errorMessage: result.error || "Gateway WhatsApp ormawa belum dikonfigurasi.",
      });
      return { sent: false, target, skipped: true, reason: result.error };
    }

    await createWhatsAppLog({
      task,
      eventType: input.eventType,
      message,
      status: "sent",
      target,
      provider: result.provider,
      wablasResponse: result.responseText,
    });

    return { sent: true, target };
  } catch (error) {
    await createWhatsAppLog({
      task,
      eventType: input.eventType,
      message,
      status: "failed",
      target,
      provider: process.env.WHATSAPP_PROVIDER || "wablas",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Notifikasi WhatsApp gagal dikirim.",
    });

    return { sent: false, target };
  }
}
