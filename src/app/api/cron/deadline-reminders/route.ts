import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import {
  getWhatsAppRecipient,
  sendWhatsAppMessage,
  WhatsAppRateLimitError,
} from "@/lib/server/whatsapp";
import {
  buildDigestReminderMessage,
  buildEmptyEventReminderMessage,
  buildReminderDigest,
  checkDigestAlreadySentToday,
  createTaskReminderDigestLog,
  getDedicatedOrmawaGroupId,
  getDigestDateKey,
  getTaskIdsAlreadyInDigestToday,
  logWhatsAppDigestDispatch,
  normalizeMentionPhone,
  processSmartFollowupReminders,
} from "@/lib/server/deadline-reminders";
import { groupTasksByTarget, isKnownClassGroupId } from "@/lib/server/group-routing";
import type { GroupRouteTarget } from "@/lib/server/group-routing";
import type { ReminderDigest } from "@/lib/server/deadline-reminders";
import { processAcademicCronReminders, isAcademicClassTask } from "@/lib/server/academic-broadcast";
import type { Task, UserProfile, Event } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Max execution timeout for Vercel Serverless

function isCompletedTask(data: Partial<Task>) {
  return (
    data.status === "approved" ||
    data.status === ("selesai" as Task["status"]) ||
    data.approval_status === "approved"
  );
}

/**
 * Lightweight background purge for ephemeral documents:
 * - Expired ai_cache (expires_at < now, limit 100)
 * - Old whatsapp_inbound_logs (> 1 day old, limit 100)
 */
async function purgeExpiredEphemeralData(db: FirebaseFirestore.Firestore) {
  try {
    const now = new Date();
    const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
    const oneDayAgoDate = new Date(oneDayAgoMs);

    const [expiredAiCache, oldLogsMs, oldLogsDate] = await Promise.all([
      db.collection("ai_cache").where("expires_at", "<", now).limit(100).get().catch(() => null),
      db.collection("whatsapp_inbound_logs").where("created_at_ms", "<", oneDayAgoMs).limit(100).get().catch(() => null),
      db.collection("whatsapp_inbound_logs").where("created_at", "<", oneDayAgoDate).limit(100).get().catch(() => null),
    ]);

    const batch = db.batch();
    let deleteCount = 0;

    if (expiredAiCache && !expiredAiCache.empty) {
      expiredAiCache.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });
    }

    const seenLogDocIds = new Set<string>();
    if (oldLogsMs && !oldLogsMs.empty) {
      oldLogsMs.forEach((doc) => {
        seenLogDocIds.add(doc.id);
        batch.delete(doc.ref);
        deleteCount++;
      });
    }

    if (oldLogsDate && !oldLogsDate.empty) {
      oldLogsDate.forEach((doc) => {
        if (!seenLogDocIds.has(doc.id)) {
          seenLogDocIds.add(doc.id);
          batch.delete(doc.ref);
          deleteCount++;
        }
      });
    }

    if (deleteCount > 0) {
      await batch.commit();
      console.log(`[Cron Ephemeral Purge] Successfully deleted ${deleteCount} expired documents.`);
    }
  } catch (err) {
    console.warn("[Cron Ephemeral Purge] Non-fatal error during cleanup:", err);
  }
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const secretQuery = searchParams.get("secret")?.trim() || searchParams.get("key")?.trim();
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const secretHeader = authHeader && authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : authHeader?.trim() || null;
  const expectedSecret = process.env.CRON_SECRET?.trim();

  // Authorization check: support Authorization: Bearer <secret> OR ?secret=<secret>
  const isAuthorized = Boolean(
    expectedSecret &&
    (secretQuery === expectedSecret || secretHeader === expectedSecret)
  );

  if (!isAuthorized) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized: Invalid or missing secret.",
        details: "Expected Vercel Cron header 'Authorization: Bearer <CRON_SECRET>' or query parameter '?secret=<CRON_SECRET>'",
      },
      { status: 401 }
    );
  }

  // Query parameter overrides for manual testing
  const force = searchParams.get("force") === "true" || searchParams.get("force") === "1";
  const dryRun = searchParams.get("dryRun") === "true" || searchParams.get("dryRun") === "1";
  const skipSmart = searchParams.get("skipSmart") === "true" || searchParams.get("skipSmart") === "1";
  const targetGroupIdParam = searchParams.get("targetGroupId")?.trim() || null;

  const db = getAdminDb();
  const globalDefaultGroupId = targetGroupIdParam || getWhatsAppRecipient();

  const skipped = {
    alreadyInDigestToday: 0,
    completed: 0,
    archived: 0,
    rateLimited: 0,
  };
  const errors: string[] = [];

  try {
    const tasksSnapshot = await db.collection("tasks").get();
    const checkedTasks = tasksSnapshot.size;
    const activeOrmawaTasks: Task[] = [];
    let academicTasksCount = 0;

    tasksSnapshot.forEach((doc) => {
      const data = doc.data() as Partial<Task>;

      if (data.is_archived) {
        skipped.archived++;
        return;
      }

      if (isCompletedTask(data)) {
        skipped.completed++;
      }

      // Filter out academic / class tasks completely from Ormawa handling
      if (data.type === "tugas_kuliah" || isAcademicClassTask(data)) {
        academicTasksCount++;
        return;
      }

      // Only include valid Ormawa tasks (type 'divisi' or 'acara', and belonging to Ormawa)
      if (data.type === "divisi" || data.type === "acara") {
        const wsId = String(data.workspace_id || data.org_id || data.organization_id || "");
        if (wsId === "ws_ilkom_2024" || wsId.startsWith("ws_kelas_")) {
          academicTasksCount++;
          return;
        }

        activeOrmawaTasks.push({ id: doc.id, ...data } as Task);
      }
    });

    // Check if Ormawa workspace has a dedicated WhatsApp group configured in the database
    const dedicatedOrmawaGroupId = await getDedicatedOrmawaGroupId(db);

    const [usersSnapshot, eventsSnapshot, divisionsSnapshot] =
      await Promise.all([
        db.collection("users").get(),
        db.collection("events").get(),
        db.collection("divisions").get(),
      ]);

    const usersMap = new Map<string, UserProfile>();
    usersSnapshot.forEach((doc) => {
      usersMap.set(doc.id, { id: doc.id, ...doc.data() } as UserProfile);
    });

    const eventsMap = new Map<string, { name?: string }>();
    const eventsFullMap = new Map<string, Event>();
    eventsSnapshot.forEach((doc) => {
      eventsMap.set(doc.id, doc.data() as { name?: string });
      eventsFullMap.set(doc.id, { id: doc.id, ...doc.data() } as Event);
    });

    const divisionsMap = new Map<
      string,
      {
        name?: string;
        whatsapp_group_id?: string;
        whatsapp_group_name?: string;
        whatsapp_group_verified?: boolean;
      }
    >();
    divisionsSnapshot.forEach((doc) => {
      divisionsMap.set(doc.id, doc.data() as {
        name?: string;
        whatsapp_group_id?: string;
        whatsapp_group_name?: string;
        whatsapp_group_verified?: boolean;
      });
    });

    // Populate eventsCache for group routing
    const eventsCache = new Map<string, Event>();
    eventsSnapshot.forEach((doc) => {
      eventsCache.set(doc.id, { id: doc.id, ...doc.data() } as Event);
    });

    // Group Ormawa tasks using the routing helper
    const taskGroups = await groupTasksByTarget(activeOrmawaTasks, eventsCache, divisionsMap);

    // Collect active events with a configured WhatsApp group that have no active tasks (Condition 1)
    const emptyEvents: Event[] = [];
    eventsCache.forEach((event) => {
      const isActive = event.status === "persiapan" || event.status === "berlangsung";
      const hasGroup = Boolean(event.whatsapp_group_id && event.whatsapp_group_id.trim());
      const hasNoActiveTasks = !activeOrmawaTasks.some((t) => t.event_id === event.id);

      if (isActive && hasGroup && hasNoActiveTasks) {
        emptyEvents.push(event);
      }
    });

    // If targetGroupId is explicitly provided in testing:
    if (targetGroupIdParam) {
      const matchingEmptyEvent = emptyEvents.find(
        (e) => e.whatsapp_group_id === targetGroupIdParam
      );

      if (matchingEmptyEvent) {
        // Targeted testing for a specific empty event: do not inject foreign tasks into this group
        taskGroups.clear();
      } else {
        const allActiveTasksForTest: Task[] = [];
        for (const groupData of taskGroups.values()) {
          allActiveTasksForTest.push(...groupData.tasks);
        }
        taskGroups.clear();
        if (allActiveTasksForTest.length > 0 || activeOrmawaTasks.length > 0) {
          taskGroups.set(targetGroupIdParam, {
            target: {
              groupId: targetGroupIdParam,
              groupType: "default_group",
              groupName: "Test Group Override",
            },
            tasks: allActiveTasksForTest.length > 0 ? allActiveTasksForTest : activeOrmawaTasks,
          });
        }
      }
    }

    const emptyEventsToProcess = targetGroupIdParam
      ? emptyEvents.filter((e) => e.whatsapp_group_id === targetGroupIdParam)
      : emptyEvents;

    if (taskGroups.size === 0 && emptyEventsToProcess.length === 0 && !globalDefaultGroupId) {
      return NextResponse.json(
        { ok: false, error: "No target WhatsApp groups configured and default group ID is empty." },
        { status: 500 }
      );
    }

    // 1. Process smart personal/escalation reminders (unless skipSmart or dryRun)
    let smartSent = 0;
    let smartFailed = 0;
    let smartErrors: { target: string; reason: string }[] = [];

    if (!skipSmart && !dryRun && !targetGroupIdParam) {
      try {
        const smartResult = await processSmartFollowupReminders(sendWhatsAppMessage);
        smartSent = smartResult.sent;
        smartFailed = smartResult.failed;
        smartErrors = smartResult.errors;
      } catch (err) {
        console.error("Failed to process smart follow-up reminders:", err);
        const errMsg = err instanceof Error ? err.message : "unknown error";
        smartFailed++;
        smartErrors.push({ target: "smart-reminders-engine", reason: errMsg });
        errors.push(`Smart Reminders: ${errMsg}`);
      }
    }

    const digestDateKey = getDigestDateKey();
    const sentMentionedPhones = new Set<string>();

    const categoriesSum = {
      overdue: 0,
      today: 0,
      h_1: 0,
      h_2_h_3: 0,
      h_5_h_7: 0,
      waitingApproval: 0,
      stuck: 0,
    };

    const eligibleTaskIds = new Set<string>();

    // 2. Pre-calculate digests for counting and aggregation
    const groupDigests: Array<{
      targetGroupId: string;
      target: GroupRouteTarget;
      digest: ReminderDigest;
    }> = [];

    for (const [targetGroupId, groupData] of taskGroups.entries()) {
      const { target, tasks: groupTasks } = groupData;
      const digest = buildReminderDigest(
        groupTasks,
        usersMap,
        eventsMap,
        divisionsMap
      );

      if (digest.taskIds.length > 0) {
        groupDigests.push({ targetGroupId, target, digest });

        for (const taskId of digest.taskIds) {
          eligibleTaskIds.add(taskId);
        }

        categoriesSum.overdue += digest.categories.overdue;
        categoriesSum.today += digest.categories.today;
        categoriesSum.h_1 += digest.categories.h_1;
        categoriesSum.h_2_h_3 += digest.categories.h_2_h_3;
        categoriesSum.h_5_h_7 += digest.categories.h_5_h_7;
        categoriesSum.waitingApproval += digest.categories.waitingApproval;
        categoriesSum.stuck += digest.categories.stuck;
      }
    }

    const eligibleTasksCount = eligibleTaskIds.size;

    // 3. Process Group Digests concurrently with Promise.allSettled
    const groupResults: Array<{
      targetGroupId: string;
      groupName?: string;
      taskCount: number;
      newTaskCount: number;
      status: "sent" | "failed" | "skipped" | "dry_run";
      reason?: string;
      messagePreview?: string;
      fullMessage?: string;
    }> = [];

    let digestSentCount = 0;
    let digestFailedCount = 0;
    let digestTaskCount = 0;
    let newTaskIdsInDigest = 0;
    let alreadyInDigestToday = 0;
    const digestErrors: { target: string; reason: string }[] = [];

    const groupPromises = groupDigests.map(async ({ targetGroupId, target, digest }) => {
      // Guard against sending Ormawa digest to class groups or fallback default groups without dedicated Ormawa group
      if (!targetGroupIdParam) {
        // 1. Never send Ormawa digests to a known class group
        if (isKnownClassGroupId(targetGroupId)) {
          groupResults.push({
            targetGroupId,
            groupName: target.groupName || "Grup Kelas Terisolasi",
            taskCount: digest.taskIds.length,
            newTaskCount: 0,
            status: "skipped",
            reason: "no_dedicated_ormawa_group",
          });
          return;
        }

        // 2. If target is default_group and Ormawa does not have a dedicated group configured in database: SKIP
        if (target.groupType === "default_group" && !dedicatedOrmawaGroupId) {
          groupResults.push({
            targetGroupId,
            groupName: target.groupName || "Ormawa Default Group",
            taskCount: digest.taskIds.length,
            newTaskCount: 0,
            status: "skipped",
            reason: "no_dedicated_ormawa_group",
          });
          await logWhatsAppDigestDispatch({
            organizationId: digest.tasks[0]?.task.organization_id ?? "main_org",
            recipient: targetGroupId,
            messageContent: `[Digest Skipped: no_dedicated_ormawa_group for ${digest.taskIds.length} tasks]`,
            status: "skipped",
            taskIds: digest.taskIds,
            categories: digest.categories,
            mentionedPhones: digest.mentionedPhones,
            errorMessage: "skipped: no_dedicated_ormawa_group",
            provider: process.env.WHATSAPP_PROVIDER || "fonnte",
          });
          return;
        }
      }

      // Check anti-spam: tasks already sent today in this group (unless force is true)
      let newTaskIds = digest.taskIds;
      if (!force && !dryRun) {
        const alreadySentTaskIds = await getTaskIdsAlreadyInDigestToday({
          groupId: targetGroupId,
          digestDateKey,
        });
        newTaskIds = digest.taskIds.filter((taskId: string) => !alreadySentTaskIds.has(taskId));

        if (newTaskIds.length === 0) {
          alreadyInDigestToday += digest.taskIds.length;
          groupResults.push({
            targetGroupId,
            groupName: target.groupName,
            taskCount: digest.taskIds.length,
            newTaskCount: 0,
            status: "skipped",
            reason: "All tasks already in digest today. Use ?force=true to override.",
          });
          return;
        }
      }

      let coordUser: UserProfile | undefined;
      let secUser: UserProfile | undefined;

      if (target.linkedEventId) {
        const ev = eventsFullMap.get(target.linkedEventId);
        if (ev) {
          coordUser = ev.coordinator_id ? usersMap.get(ev.coordinator_id) : undefined;
          secUser = ev.secretary_id ? usersMap.get(ev.secretary_id) : undefined;

          if (!coordUser || !secUser) {
            try {
              const membersSnap = await db
                .collection("events")
                .doc(ev.id)
                .collection("event_members")
                .get();

              membersSnap.forEach((mDoc) => {
                const mData = mDoc.data();
                const role = (mData.role_in_event || "").toLowerCase();
                const uId = mData.user_id || mDoc.id;
                if (!coordUser && (role.includes("koor") || role.includes("ketua"))) {
                  coordUser = usersMap.get(uId);
                }
                if (!secUser && (role.includes("sekretaris") || role.includes("sekre"))) {
                  secUser = usersMap.get(uId);
                }
              });
            } catch (err) {
              console.warn(`Could not fetch event_members for ${ev.id}:`, err);
            }
          }
        }
      }

      const coordPhone = normalizeMentionPhone(coordUser?.whatsapp_number);
      const secPhone = normalizeMentionPhone(secUser?.whatsapp_number);

      // Jika ada tugas tanpa tenggat, pastikan nomor WhatsApp Koordinator & Sekretaris masuk ke daftar mention
      if (digest.noDeadlineTasks && digest.noDeadlineTasks.length > 0) {
        if (coordPhone) digest.mentionedPhones.push(coordPhone);
        if (secPhone) digest.mentionedPhones.push(secPhone);
        digest.mentionedPhones = Array.from(new Set(digest.mentionedPhones));
      }

      const isOfficialOrmawa = Boolean(
        dedicatedOrmawaGroupId && targetGroupId === dedicatedOrmawaGroupId
      );
      const messageContent = buildDigestReminderMessage(digest, new Date(), 20, {
        targetGroupId,
        groupName: target.groupName,
        groupType: target.groupType,
        isOfficialOrmawaGroup: isOfficialOrmawa,
        allGroupTasks: digest.allTasks,
        eventCoordinator: coordUser ? { name: coordUser.name, phone: coordPhone } : undefined,
        eventSecretary: secUser ? { name: secUser.name, phone: secPhone } : undefined,
        usersMap,
      });

      // Dry-Run Mode
      if (dryRun) {
        groupResults.push({
          targetGroupId,
          groupName: target.groupName,
          taskCount: digest.taskIds.length,
          newTaskCount: newTaskIds.length,
          status: "dry_run",
          messagePreview: messageContent.slice(0, 200),
          fullMessage: messageContent,
        });
        digestTaskCount += digest.taskIds.length;
        newTaskIdsInDigest += newTaskIds.length;
        for (const phone of digest.mentionedPhones) {
          sentMentionedPhones.add(phone);
        }
        return;
      }

      // Live Send
      try {
        const digestOrgId = digest.tasks[0]?.task.org_id || digest.tasks[0]?.task.orgId || digest.tasks[0]?.task.organization_id;
        const dispatchResult = await sendWhatsAppMessage({
          target: targetGroupId,
          message: messageContent,
          type: "group",
          mentions: digest.mentionedPhones,
          org_id: digestOrgId,
        });

        if (dispatchResult.skipped) {
          await logWhatsAppDigestDispatch({
            organizationId: digestOrgId ?? "main_org",
            recipient: targetGroupId,
            messageContent,
            status: "skipped",
            taskIds: digest.taskIds,
            categories: digest.categories,
            mentionedPhones: digest.mentionedPhones,
            errorMessage: dispatchResult.error || "Gateway WhatsApp ormawa belum dikonfigurasi.",
            provider: dispatchResult.provider,
          });
          return;
        }

        const whatsappLogId = await logWhatsAppDigestDispatch({
          organizationId: digestOrgId ?? "main_org",
          recipient: targetGroupId,
          messageContent,
          status: "sent",
          taskIds: digest.taskIds,
          categories: digest.categories,
          mentionedPhones: digest.mentionedPhones,
          wablasResponse: dispatchResult.responseText,
          provider: dispatchResult.provider,
        });

        await createTaskReminderDigestLog({
          digestType: digest.digestType,
          groupId: targetGroupId,
          digestDateKey,
          taskIds: digest.taskIds,
          allCurrentTaskIds: digest.taskIds,
          newTaskIds: newTaskIds,
          categories: digest.categories,
          mentionedPhones: digest.mentionedPhones,
          status: "sent",
          messageContent,
          whatsappLogId,
          target_group_id: target.groupId,
          target_group_type: target.groupType,
          linked_event_id: target.linkedEventId || undefined,
          linked_division_id: target.linkedDivisionId || undefined,
          fallback_reason: target.fallbackReason || undefined,
        });

        digestSentCount++;
        digestTaskCount += digest.taskIds.length;
        newTaskIdsInDigest += newTaskIds.length;
        for (const phone of digest.mentionedPhones) {
          sentMentionedPhones.add(phone);
        }

        groupResults.push({
          targetGroupId,
          groupName: target.groupName,
          taskCount: digest.taskIds.length,
          newTaskCount: newTaskIds.length,
          status: "sent",
          messagePreview: messageContent.slice(0, 150),
        });
      } catch (error: unknown) {
        let status = "failed";
        let cooldownUntil: Date | null = null;
        let rateLimitReason: string | undefined;
        const errorMessage =
          error instanceof Error ? error.message : "Gagal mengirim digest.";

        digestFailedCount++;
        digestErrors.push({ target: targetGroupId, reason: errorMessage });

        if (error instanceof WhatsAppRateLimitError) {
          status = error.status;
          cooldownUntil = error.cooldownUntil;
          rateLimitReason = error.message;
          skipped.rateLimited++;
        } else {
          errors.push(`Group ${targetGroupId}: ${errorMessage}`);
        }

        const whatsappLogId = await logWhatsAppDigestDispatch({
          organizationId: digest.tasks[0]?.task.organization_id ?? "main_org",
          recipient: targetGroupId,
          messageContent,
          status,
          taskIds: digest.taskIds,
          categories: digest.categories,
          mentionedPhones: digest.mentionedPhones,
          errorMessage,
          cooldownUntil,
          rateLimitReason,
          provider: process.env.WHATSAPP_PROVIDER || "wablas",
        });

        await createTaskReminderDigestLog({
          digestType: digest.digestType,
          groupId: targetGroupId,
          digestDateKey,
          taskIds: digest.taskIds,
          allCurrentTaskIds: digest.taskIds,
          newTaskIds: newTaskIds,
          categories: digest.categories,
          mentionedPhones: digest.mentionedPhones,
          status: "failed",
          messageContent,
          whatsappLogId,
          target_group_id: target.groupId,
          target_group_type: target.groupType,
          linked_event_id: target.linkedEventId || undefined,
          linked_division_id: target.linkedDivisionId || undefined,
          fallback_reason: target.fallbackReason || undefined,
        });

        groupResults.push({
          targetGroupId,
          groupName: target.groupName,
          taskCount: digest.taskIds.length,
          newTaskCount: newTaskIds.length,
          status: "failed",
          reason: errorMessage,
        });
      }
    });

    // 4. Process Empty Event Digests (Condition 1: Event baru & belum ada job desk sama sekali)
    const emptyEventPromises = emptyEventsToProcess.map(async (emptyEvent) => {
      const targetGroupId = emptyEvent.whatsapp_group_id!;
      const groupName = emptyEvent.name;

      // Anti-spam check: don't resend empty event reminder today unless force=true or dryRun=true
      if (!force && !dryRun) {
        const alreadySentToday = await checkDigestAlreadySentToday({
          digestType: "EMPTY_EVENT_DIGEST",
          groupId: targetGroupId,
          digestDateKey,
        });

        if (alreadySentToday) {
          groupResults.push({
            targetGroupId,
            groupName,
            taskCount: 0,
            newTaskCount: 0,
            status: "skipped",
            reason: "Empty event reminder already sent today. Use ?force=true to override.",
          });
          return;
        }
      }

      // Resolve Koordinator & Sekretaris
      let coordUser = emptyEvent.coordinator_id ? usersMap.get(emptyEvent.coordinator_id) : undefined;
      let secUser = emptyEvent.secretary_id ? usersMap.get(emptyEvent.secretary_id) : undefined;

      if (!coordUser || !secUser) {
        try {
          const membersSnap = await db
            .collection("events")
            .doc(emptyEvent.id)
            .collection("event_members")
            .get();

          membersSnap.forEach((mDoc) => {
            const mData = mDoc.data();
            const role = (mData.role_in_event || "").toLowerCase();
            const uId = mData.user_id || mDoc.id;
            if (!coordUser && (role.includes("koor") || role.includes("ketua"))) {
              coordUser = usersMap.get(uId);
            }
            if (!secUser && (role.includes("sekretaris") || role.includes("sekre"))) {
              secUser = usersMap.get(uId);
            }
          });
        } catch (err) {
          console.warn(`Could not fetch event_members for ${emptyEvent.id}:`, err);
        }
      }

      const coordName = coordUser?.name || "Koordinator Acara";
      const coordPhone = normalizeMentionPhone(coordUser?.whatsapp_number);
      const coordDisplay = coordPhone ? `@${coordPhone} (${coordName})` : coordName;

      const secName = secUser?.name || "Sekretaris Acara";
      const secPhone = normalizeMentionPhone(secUser?.whatsapp_number);
      const secDisplay = secPhone ? `@${secPhone} (${secName})` : secName;

      const emptyCategories = {
        overdue: 0,
        today: 0,
        h_1: 0,
        h_2_h_3: 0,
        h_5_h_7: 0,
        waitingApproval: 0,
        stuck: 0,
      };

      const emptyMentionedPhones = [coordPhone, secPhone].filter(
        (p): p is string => Boolean(p && p.length > 5)
      );
      const messageContent = buildEmptyEventReminderMessage(
        emptyEvent.name,
        coordDisplay,
        secDisplay
      );

      // Dry-Run Mode
      if (dryRun) {
        groupResults.push({
          targetGroupId,
          groupName,
          taskCount: 0,
          newTaskCount: 0,
          status: "dry_run",
          messagePreview: messageContent.slice(0, 200),
          fullMessage: messageContent,
        });
        for (const phone of emptyMentionedPhones) {
          sentMentionedPhones.add(phone);
        }
        return;
      }

      // Live Send Mode
      try {
        const eventOrgId =
          emptyEvent.organization_id ||
          emptyEvent.org_id ||
          emptyEvent.orgId ||
          "main_org";

        const dispatchResult = await sendWhatsAppMessage({
          target: targetGroupId,
          message: messageContent,
          type: "group",
          mentions: emptyMentionedPhones,
          org_id: eventOrgId,
        });

        if (dispatchResult.skipped) {
          await logWhatsAppDigestDispatch({
            organizationId: eventOrgId,
            recipient: targetGroupId,
            messageContent,
            status: "skipped",
            taskIds: [],
            categories: emptyCategories,
            mentionedPhones: emptyMentionedPhones,
            errorMessage:
              dispatchResult.error ||
              "Gateway WhatsApp ormawa belum dikonfigurasi.",
            provider: dispatchResult.provider,
          });
          return;
        }

        const whatsappLogId = await logWhatsAppDigestDispatch({
          organizationId: eventOrgId,
          recipient: targetGroupId,
          messageContent,
          status: "sent",
          taskIds: [],
          categories: emptyCategories,
          mentionedPhones: emptyMentionedPhones,
          wablasResponse: dispatchResult.responseText,
          provider: dispatchResult.provider,
        });

        await createTaskReminderDigestLog({
          digestType: "EMPTY_EVENT_DIGEST",
          groupId: targetGroupId,
          digestDateKey,
          taskIds: [],
          allCurrentTaskIds: [],
          newTaskIds: [],
          categories: emptyCategories,
          mentionedPhones: emptyMentionedPhones,
          status: "sent",
          messageContent,
          whatsappLogId,
          target_group_id: targetGroupId,
          target_group_type: "event_group",
          linked_event_id: emptyEvent.id,
        });

        digestSentCount++;
        for (const phone of emptyMentionedPhones) {
          sentMentionedPhones.add(phone);
        }

        groupResults.push({
          targetGroupId,
          groupName,
          taskCount: 0,
          newTaskCount: 0,
          status: "sent",
          messagePreview: messageContent.slice(0, 150),
        });
      } catch (error: unknown) {
        let status = "failed";
        let cooldownUntil: Date | null = null;
        let rateLimitReason: string | undefined;
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Gagal mengirim digest acara baru.";

        digestFailedCount++;
        digestErrors.push({ target: targetGroupId, reason: errorMessage });

        if (error instanceof WhatsAppRateLimitError) {
          status = error.status;
          cooldownUntil = error.cooldownUntil;
          rateLimitReason = error.message;
          skipped.rateLimited++;
        } else {
          errors.push(`Group ${targetGroupId}: ${errorMessage}`);
        }

        const eventOrgId =
          emptyEvent.organization_id ||
          emptyEvent.org_id ||
          emptyEvent.orgId ||
          "main_org";

        const whatsappLogId = await logWhatsAppDigestDispatch({
          organizationId: eventOrgId,
          recipient: targetGroupId,
          messageContent,
          status,
          taskIds: [],
          categories: emptyCategories,
          mentionedPhones: emptyMentionedPhones,
          errorMessage,
          cooldownUntil,
          rateLimitReason,
          provider: process.env.WHATSAPP_PROVIDER || "fonnte",
        });

        await createTaskReminderDigestLog({
          digestType: "EMPTY_EVENT_DIGEST",
          groupId: targetGroupId,
          digestDateKey,
          taskIds: [],
          allCurrentTaskIds: [],
          newTaskIds: [],
          categories: emptyCategories,
          mentionedPhones: emptyMentionedPhones,
          status: "failed",
          messageContent,
          whatsappLogId,
          target_group_id: targetGroupId,
          target_group_type: "event_group",
          linked_event_id: emptyEvent.id,
        });

        groupResults.push({
          targetGroupId,
          groupName,
          taskCount: 0,
          newTaskCount: 0,
          status: "failed",
          reason: errorMessage,
        });
      }
    });

    await Promise.allSettled([...groupPromises, ...emptyEventPromises]);

    // 5. Process Academic / Class Task Reminders (Skenario 2: H-5, H-3, H-1, Hari Ini)
    let academicCronResult = { checked: 0, sent: 0, skipped: 0, errors: [] as string[], tasks: [] as Array<{ id: string; milestone: string; status: string; taskName: string }> };
    if (!targetGroupIdParam || isKnownClassGroupId(targetGroupIdParam)) {
      try {
        academicCronResult = await processAcademicCronReminders(db, { force, dryRun });
      } catch (acadErr) {
        console.error("Failed to process academic cron reminders:", acadErr);
        const errMsg = acadErr instanceof Error ? acadErr.message : "unknown error";
        academicCronResult.errors.push(errMsg);
        errors.push(`Academic Reminders: ${errMsg}`);
      }
    }

    skipped.alreadyInDigestToday = alreadyInDigestToday;

    // Ephemeral data lightweight cleanup (non-blocking)
    purgeExpiredEphemeralData(db).catch((err) => {
      console.warn("[Cron] Ephemeral cleanup non-blocking error:", err);
    });

    const totalSent = smartSent + digestSentCount + academicCronResult.sent;
    const totalFailed = smartFailed + digestFailedCount + academicCronResult.errors.length;
    const allErrors = [...smartErrors, ...digestErrors, ...academicCronResult.errors];
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      ok: totalFailed === 0,
      mode: dryRun ? "dry_run" : force ? "forced" : "normal",
      provider: process.env.WHATSAPP_PROVIDER || "fonnte",
      targetOverride: targetGroupIdParam,
      sent: totalSent,
      failed: totalFailed,
      errors: allErrors,
      checkedTasks,
      activeOrmawaTasks: activeOrmawaTasks.length,
      activeTasks: activeOrmawaTasks.length,
      academicTasksCount,
      eligibleTasks: eligibleTasksCount,
      groupsChecked: taskGroups.size + emptyEventsToProcess.length,
      groups: groupResults,
      academicReminders: academicCronResult,
      digestSent:
        digestSentCount > 0 ||
        academicCronResult.sent > 0 ||
        (dryRun && (eligibleTasksCount > 0 || emptyEventsToProcess.length > 0 || academicCronResult.tasks.length > 0)),
      digestTaskCount,
      newTaskIdsInDigest,
      categories: categoriesSum,
      skipped,
      mentionedPhones: Array.from(sentMentionedPhones),
      durationMs,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error.";
    errors.push(errorMessage);

    return NextResponse.json(
      {
        ok: false,
        provider: process.env.WHATSAPP_PROVIDER || "fonnte",
        sent: 0,
        failed: 1,
        errors: [{ target: "cron-engine", reason: errorMessage }],
        checkedTasks: 0,
        activeTasks: 0,
        eligibleTasks: 0,
        groupsChecked: 0,
        groups: [],
        digestSent: false,
        digestTaskCount: 0,
        newTaskIdsInDigest: 0,
        categories: null,
        skipped,
        mentionedPhones: [],
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
