import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthContext, AuthRoleError } from "@/lib/server/auth";
import { getAdminDb, FieldValue } from "@/lib/server/firebase-admin";
import { sendJobdeskBriefReadyBroadcast } from "@/lib/server/jobdesk-brief-broadcast";
import type { Task } from "@/types";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/tasks/[id]
 * Fetch task details by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await getServerAuthContext(request);
    const { id: taskId } = await params;

    if (!taskId) {
      return NextResponse.json({ ok: false, error: "Task ID wajib diisi." }, { status: 400 });
    }

    const taskSnap = await getAdminDb().collection("tasks").doc(taskId).get();
    if (!taskSnap.exists) {
      return NextResponse.json({ ok: false, error: "Task tidak ditemukan." }, { status: 404 });
    }

    const task = { id: taskSnap.id, ...taskSnap.data() } as Task;
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    if (error instanceof AuthRoleError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Terjadi kesalahan server.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/tasks/[id]
 * Updates task fields and triggers "Brief Siap Kerjakan" WhatsApp broadcast if requested
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { profile } = await getServerAuthContext(request);
    const { id: taskId } = await params;

    if (!taskId) {
      return NextResponse.json({ ok: false, error: "Task ID wajib diisi." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const shouldNotifyBrief = Boolean(body.notify_brief || body.notifyBrief || body.eventType === "brief_ready");

    const db = getAdminDb();
    const taskRef = db.collection("tasks").doc(taskId);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return NextResponse.json({ ok: false, error: "Task tidak ditemukan." }, { status: 404 });
    }

    // Filter updates if provided in request body
    const updates: Record<string, unknown> = {
      ...(body.updates && typeof body.updates === "object" ? body.updates : {}),
    };

    // Extract potential direct field updates
    const allowedFields = [
      "name",
      "title",
      "description",
      "copywriting",
      "copywriting_docs_url",
      "design_reference_url",
      "drive_reference_url",
      "color_palette",
      "visual_direction",
      "redaction_links",
      "design_ref_links",
      "drive_ref_links",
      "status",
      "priority",
      "deadline",
      "pic_id",
      "pic_ids",
      "coordinator_id",
      "submission_url",
      "submission_link",
      "archive_notes",
      "source_link",
      "category_key",
      "subcategory_key",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = FieldValue.serverTimestamp();
      await taskRef.update(updates);
    }

    let broadcastResult = null;
    if (shouldNotifyBrief) {
      broadcastResult = await sendJobdeskBriefReadyBroadcast(taskId, profile.id);
    }

    return NextResponse.json({
      ok: true,
      message: "Task berhasil diperbarui.",
      broadcast: broadcastResult,
    });
  } catch (error) {
    if (error instanceof AuthRoleError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Gagal memperbarui task.";
    console.error(`[PATCH /api/tasks/[id]] Error:`, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/tasks/[id]
 * Alias for triggering brief broadcast or update
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return PATCH(request, { params });
}
