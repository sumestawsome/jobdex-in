import { NextResponse, type NextRequest } from "next/server";
import { canTriggerTaskNotification, getServerAuthContext } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { notifyTaskEvent } from "@/lib/server/notifications";
import { sendJobdeskBriefReadyBroadcast } from "@/lib/server/jobdesk-brief-broadcast";
import {
  isAcademicClassTask,
  handleAcademicTaskCreated,
  handleAcademicTaskUpdated,
} from "@/lib/server/academic-broadcast";
import type { Task, TaskStatus } from "@/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { profile } = await getServerAuthContext(request);
    const body = (await request.json()) as {
      taskId?: string;
      eventType?: string;
      status?: TaskStatus;
      note?: string;
      stuckNotes?: string;
      revisionNotes?: string;
      uploadUrl?: string;
      thumbnailUrl?: string;
      changes?: {
        deadlineChanged?: boolean;
        descriptionChanged?: boolean;
        oldDeadline?: unknown;
        newDeadline?: unknown;
        oldDescription?: string;
        newDescription?: string;
      };
    };

    if (!body.taskId || !body.eventType) {
      return NextResponse.json(
        { error: "taskId dan eventType wajib diisi." },
        { status: 400 },
      );
    }

    const allowedEvents = [
      "task_created",
      "task_updated",
      "task_status_changed",
      "task_help_needed",
      "task_result_uploaded",
      "task_revision_requested",
      "task_approved",
      "brief_ready",
      "jobdesk_brief_ready",
    ];

    if (!allowedEvents.includes(body.eventType)) {
      return NextResponse.json(
        { error: "Tipe notifikasi tidak valid." },
        { status: 400 },
      );
    }

    const taskSnapshot = await getAdminDb()
      .collection("tasks")
      .doc(body.taskId)
      .get();

    if (!taskSnapshot.exists) {
      return NextResponse.json(
        { error: "Task tidak ditemukan." },
        { status: 404 },
      );
    }

    const task = {
      id: taskSnapshot.id,
      ...taskSnapshot.data(),
    } as Task;

    if (!canTriggerTaskNotification(profile, task)) {
      return NextResponse.json(
        { error: "Anda tidak punya akses untuk task ini." },
        { status: 403 },
      );
    }

    // --- Notifikasi Brief Siap Kerjakan ---
    if (body.eventType === "brief_ready" || body.eventType === "jobdesk_brief_ready") {
      const briefRes = await sendJobdeskBriefReadyBroadcast(body.taskId, profile.id);
      return NextResponse.json({
        ok: true,
        whatsappSent: briefRes.sent,
        target: briefRes.target,
        reason: briefRes.reason,
      });
    }

    // --- Khusus Ruang Kerja Kelas / Akademik ---
    if (isAcademicClassTask(task)) {
      if (body.eventType === "task_created") {
        const academicRes = await handleAcademicTaskCreated(body.taskId, profile.id);
        return NextResponse.json({
          ok: true,
          whatsappSent: academicRes.sent,
          reason: academicRes.reason,
          diffDays: academicRes.diffDays,
          isAcademic: true,
        });
      }

      if (body.eventType === "task_updated") {
        const academicRes = await handleAcademicTaskUpdated(body.taskId, profile.id, body.changes);
        return NextResponse.json({
          ok: true,
          whatsappSent: academicRes.sent,
          reason: academicRes.reason,
          isAcademic: true,
        });
      }
    }

    const result = await notifyTaskEvent({
      eventType: body.eventType as Parameters<typeof notifyTaskEvent>[0]["eventType"],
      taskId: body.taskId,
      actorId: profile.id,
      status: body.status,
      note: body.note,
      stuckNotes: body.stuckNotes,
      revisionNotes: body.revisionNotes,
      uploadUrl: body.uploadUrl,
      thumbnailUrl: body.thumbnailUrl,
    });

    return NextResponse.json({ ok: true, whatsappSent: result.sent });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengirim notifikasi WhatsApp.",
      },
      { status: 500 },
    );
  }
}
