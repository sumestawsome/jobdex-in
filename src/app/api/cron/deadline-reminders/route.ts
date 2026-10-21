import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import {
  getWhatsAppRecipient,
  sendWhatsAppMessage,
  WhatsAppRateLimitError,
} from "@/lib/server/whatsapp";
import {
  buildDigestReminderMessage,
  buildReminderDigest,
  createTaskReminderDigestLog,
  getDigestDateKey,
  getTaskIdsAlreadyInDigestToday,
  logWhatsAppDigestDispatch,
  processSmartFollowupReminders,
} from "@/lib/server/deadline-reminders";
import { groupTasksByTarget } from "@/lib/server/group-routing";
import type { GroupRouteTarget } from "@/lib/server/group-routing";
import type { ReminderDigest } from "@/lib/server/deadline-reminders";
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
    const activeTasks: Task[] = [];

    tasksSnapshot.forEach((doc) => {
      const data = doc.data() as Partial<Task>;

      if (data.is_archived) {
        skipped.archived++;
        return;
      }

      if (isCompletedTask(data)) {
        skipped.completed++;
        return;
      }

      activeTasks.push({ id: doc.id, ...data } as Task);
    });

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
    eventsSnapshot.forEach((doc) => {
      eventsMap.set(doc.id, doc.data() as { name?: string });
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

    // Group tasks using the routing helper
    const taskGroups = await groupTasksByTarget(activeTasks, eventsCache, divisionsMap);

    // If targetGroupId is explicitly provided in testing, redirect all groups or group all tasks into targetGroupId
    if (targetGroupIdParam) {
      const allActiveTasksForTest: Task[] = [];
      for (const groupData of taskGroups.values()) {
        allActiveTasksForTest.push(...groupData.tasks);
      }
      taskGroups.clear();
      taskGroups.set(targetGroupIdParam, {
        target: {
          groupId: targetGroupIdParam,
          groupType: "default_group",
          groupName: "Test Group Override",
        },
        tasks: allActiveTasksForTest.length > 0 ? allActiveTasksForTest : activeTasks,
      });
    }

    if (taskGroups.size === 0 && !globalDefaultGroupId) {
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

      const messageContent = buildDigestReminderMessage(digest);

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

    await Promise.allSettled(groupPromises);

    skipped.alreadyInDigestToday = alreadyInDigestToday;

    const totalSent = smartSent + digestSentCount;
    const totalFailed = smartFailed + digestFailedCount;
    const allErrors = [...smartErrors, ...digestErrors];
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
      activeTasks: activeTasks.length,
      eligibleTasks: eligibleTasksCount,
      groupsChecked: taskGroups.size,
      groups: groupResults,
      digestSent: digestSentCount > 0 || (dryRun && eligibleTasksCount > 0),
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
