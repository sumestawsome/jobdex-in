import "server-only";

import { getAdminDb } from "@/lib/server/firebase-admin";
import type { Task, Event } from "@/types";
import { normalizeWhatsAppGroupId } from "@/lib/server/whatsapp";

type DivisionWithWhatsApp = {
  id?: string;
  name?: string;
  whatsapp_group_id?: string;
  whatsapp_group_name?: string;
  whatsapp_group_verified?: boolean;
};

export type TaskNotificationTarget = {
  targetType: "event_group" | "division_group" | "default_group" | "personal";
  recipient: string;
  reason: string;
  eventId?: string;
  divisionId?: string;
  groupName?: string;
};

export type GroupRouteTarget = {
  groupId: string;
  groupType: "event_group" | "division_group" | "default_group";
  groupName?: string;
  linkedEventId?: string;
  linkedDivisionId?: string;
  fallbackReason?: string;
};

function getDefaultGroupId() {
  const provider = (process.env.WHATSAPP_PROVIDER || "wablas") as "fonnte" | "wablas";
  let rawGroupId = "";
  if (provider === "fonnte") {
    rawGroupId = process.env.FONNTE_DEFAULT_GROUP_ID || process.env.WHATSAPP_DEFAULT_GROUP_ID || "";
  } else {
    rawGroupId = process.env.WABLAS_DEFAULT_GROUP_ID || process.env.WABLAS_GROUP_ID || process.env.WHATSAPP_DEFAULT_GROUP_ID || "";
  }
  return normalizeWhatsAppGroupId(rawGroupId, provider);
}

async function getEventForTask(task: Task, eventsCache?: Map<string, Event>) {
  if (!task.event_id) {
    return undefined;
  }

  if (eventsCache) {
    return eventsCache.get(task.event_id);
  }

  const db = getAdminDb();
  const eventDoc = await db.collection("events").doc(task.event_id).get();

  if (!eventDoc.exists) {
    return undefined;
  }

  return { id: eventDoc.id, ...eventDoc.data() } as Event;
}

async function getDivisionForTask(
  task: Task,
  divisionsCache?: Map<string, DivisionWithWhatsApp>,
) {
  if (!task.division_id) {
    return undefined;
  }

  if (divisionsCache) {
    return divisionsCache.get(task.division_id);
  }

  const db = getAdminDb();
  const divisionDoc = await db.collection("divisions").doc(task.division_id).get();

  if (!divisionDoc.exists) {
    return undefined;
  }

  return { id: divisionDoc.id, ...divisionDoc.data() } as DivisionWithWhatsApp;
}

function logNotificationRouting(task: Task, event: Event | undefined, target: TaskNotificationTarget) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info("[Notification routing]", {
    task: task.id,
    task_name: task.name,
    type: task.type,
    event: event?.name || task.event_id || null,
    target: target.targetType,
    group_id: target.recipient,
    reason: target.reason,
  });
}

/**
 * Resolves the WhatsApp target for task-level group notifications.
 * Priority: verified event group > division group > default group.
 */
export async function resolveTaskNotificationTarget(
  task: Task,
  eventsCache?: Map<string, Event>,
  divisionsCache?: Map<string, DivisionWithWhatsApp>,
): Promise<TaskNotificationTarget | null> {
  const provider = (process.env.WHATSAPP_PROVIDER || "wablas") as "fonnte" | "wablas";
  const defaultGroupId = getDefaultGroupId();

  // Support Academic / Class Workspaces
  const isClassTask =
    task.type === ("tugas_kuliah" as Task["type"]) ||
    task.workspace_id === "ws_ilkom_2024" ||
    task.org_id === "ws_ilkom_2024" ||
    task.organization_id === "ws_ilkom_2024";

  if (isClassTask) {
    const classGroupId = "120363411033795051@g.us";
    const target = {
      targetType: "default_group",
      recipient: normalizeWhatsAppGroupId(classGroupId, provider),
      reason: "class workspace announcement community",
      groupName: "Kelas Ilmu Komputer 2024",
    } satisfies TaskNotificationTarget;
    logNotificationRouting(task, undefined, target);
    return target;
  }

  const isEventTask = Boolean(task.event_id || task.type === "acara");
  const event = await getEventForTask(task, eventsCache);

  if (isEventTask && event?.whatsapp_group_id && event.whatsapp_group_verified === true) {
    const target = {
      targetType: "event_group",
      recipient: normalizeWhatsAppGroupId(event.whatsapp_group_id, provider),
      reason: "event whatsapp group verified",
      eventId: event.id,
      divisionId: task.division_id,
      groupName: event.whatsapp_group_name || event.name,
    } satisfies TaskNotificationTarget;
    logNotificationRouting(task, event, target);
    return target;
  }

  const division = await getDivisionForTask(task, divisionsCache);

  if (division?.whatsapp_group_id && division.whatsapp_group_verified !== false) {
    const target = {
      targetType: "division_group",
      recipient: normalizeWhatsAppGroupId(division.whatsapp_group_id, provider),
      reason: isEventTask
        ? event?.whatsapp_group_id
          ? "event whatsapp group not verified"
          : "event whatsapp group missing"
        : "division whatsapp group available",
      eventId: task.event_id,
      divisionId: task.division_id,
      groupName: division.whatsapp_group_name || division.name,
    } satisfies TaskNotificationTarget;
    logNotificationRouting(task, event, target);
    return target;
  }

  if (defaultGroupId) {
    const target = {
      targetType: "default_group",
      recipient: defaultGroupId,
      reason: isEventTask
        ? event?.whatsapp_group_id
          ? "event whatsapp group not verified and division group missing"
          : "event whatsapp group missing and division group missing"
        : "division group missing",
      eventId: task.event_id,
      divisionId: task.division_id,
    } satisfies TaskNotificationTarget;
    logNotificationRouting(task, event, target);
    return target;
  }

  return null;
}

/**
 * Resolves the WhatsApp group target for a task's reminder.
 * Priority: event group > division group > default group
 */
export async function resolveTaskReminderTarget(
  task: Task,
  eventsCache?: Map<string, Event>,
  divisionsCache?: Map<string, DivisionWithWhatsApp>,
): Promise<GroupRouteTarget | null> {
  const target = await resolveTaskNotificationTarget(task, eventsCache, divisionsCache);

  if (!target || target.targetType === "personal") {
    return null;
  }

  return {
    groupId: target.recipient,
    groupType: target.targetType,
    groupName: target.groupName,
    linkedEventId: target.eventId,
    linkedDivisionId: target.divisionId,
    fallbackReason: target.targetType === "default_group" ? target.reason : undefined,
  };
}

/**
 * Groups tasks by their resolved WhatsApp target group.
 * Returns a Map where key = groupId, value = tasks and metadata
 */
export async function groupTasksByTarget(
  tasks: Task[],
  eventsCache?: Map<string, Event>,
  divisionsCache?: Map<string, DivisionWithWhatsApp>,
): Promise<Map<string, { target: GroupRouteTarget; tasks: Task[] }>> {
  const groups = new Map<string, { target: GroupRouteTarget; tasks: Task[] }>();
  const skipped: { task: Task; reason: string }[] = [];

  for (const task of tasks) {
    const target = await resolveTaskReminderTarget(task, eventsCache, divisionsCache);

    if (!target) {
      skipped.push({ task, reason: "missing_group_target" });
      continue;
    }

    const existing = groups.get(target.groupId);
    if (existing) {
      existing.tasks.push(task);
    } else {
      groups.set(target.groupId, { target, tasks: [task] });
    }
  }

  if (skipped.length > 0) {
    console.warn(
      `[GroupRouting] Skipped ${skipped.length} tasks with no group target:`,
      skipped.map((s) => ({ taskId: s.task.id, taskName: s.task.name, reason: s.reason }))
    );
  }

  return groups;
}

/**
 * Find events that have a WhatsApp group ID assigned
 */
export async function getEventsWithGroupId(): Promise<Event[]> {
  const db = getAdminDb();
  const snapshot = await db.collection("events").get();
  const events: Event[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data() as Event;
    if (data.whatsapp_group_id) {
      events.push({ ...data, id: doc.id });
    }
  });

  return events;
}

/**
 * Helper to generate all variants of a WhatsApp group ID
 */
export function getGroupIdVariants(groupId: string): string[] {
  const trimmed = groupId.trim();
  const numberOnly = trimmed.replace(/@g\.us$/i, "");

  return Array.from(
    new Set([
      trimmed,
      numberOnly,
      `${numberOnly}@g.us`,
    ].filter(Boolean))
  );
}

/**
 * Find event linked to a specific WhatsApp group ID
 */
export async function findEventByGroupId(groupId: string): Promise<Event | null> {
  if (!groupId) return null;

  const db = getAdminDb();
  const variants = getGroupIdVariants(groupId);

  for (const variant of variants) {
    const snapshot = await db
      .collection("events")
      .where("whatsapp_group_id", "==", variant)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Event;
    }
  }

  return null;
}


/**
 * Link a WhatsApp group to an event
 */
export async function linkGroupToEvent(
  eventId: string,
  groupId: string,
  groupName: string,
  linkedBy: string,
  source: "manual" | "webhook_detected" | "admin_input" = "webhook_detected"
): Promise<void> {
  const db = getAdminDb();
  const { FieldValue } = await import("@/lib/server/firebase-admin");

  await db.collection("events").doc(eventId).update({
    whatsapp_group_id: groupId,
    whatsapp_group_name: groupName || "",
    whatsapp_group_verified: true,
    whatsapp_group_linked_at: FieldValue.serverTimestamp(),
    whatsapp_group_linked_by: linkedBy,
    whatsapp_group_updated_at: FieldValue.serverTimestamp(),
    whatsapp_group_updated_by: linkedBy,
    whatsapp_group_source: source,
    updated_at: FieldValue.serverTimestamp(),
  });
}
