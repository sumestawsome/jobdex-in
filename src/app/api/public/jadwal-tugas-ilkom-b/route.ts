import "server-only";

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { isAcademicClassTask } from "@/lib/server/academic-broadcast";
import type { Task } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeFirestoreValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === "object") {
    if ("toDate" in val && typeof (val as { toDate: () => Date }).toDate === "function") {
      try {
        return (val as { toDate: () => Date }).toDate().toISOString();
      } catch {
        return null;
      }
    }
    if (val instanceof Date) {
      return val.toISOString();
    }
    if (Array.isArray(val)) {
      return val.map(sanitizeFirestoreValue);
    }
    const cleanObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      cleanObj[k] = sanitizeFirestoreValue(v);
    }
    return cleanObj;
  }
  return val;
}

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collection("tasks").where("is_archived", "==", false).get();

    const tasks: Task[] = [];
    snap.forEach((doc) => {
      try {
        const rawData = doc.data() as Record<string, unknown>;
        const cleanData = sanitizeFirestoreValue(rawData) as Record<string, unknown>;

        const t = {
          ...cleanData,
          id: doc.id,
          deadline: cleanData.deadline ? String(cleanData.deadline) : "",
          created_at: cleanData.created_at ? String(cleanData.created_at) : "",
          updated_at: cleanData.updated_at ? String(cleanData.updated_at) : "",
        } as Task;

        if (
          isAcademicClassTask(t) &&
          t.status !== "approved" &&
          (t.status as string) !== "selesai"
        ) {
          tasks.push(t);
        }
      } catch (docErr) {
        console.warn(`[public/jadwal-tugas-ilkom-b] Skipping task doc ${doc.id}:`, docErr);
      }
    });

    tasks.sort((a, b) => {
      const timeA = a.deadline ? new Date(a.deadline as string).getTime() : Infinity;
      const timeB = b.deadline ? new Date(b.deadline as string).getTime() : Infinity;
      return timeA - timeB;
    });

    const safeTasks = JSON.parse(JSON.stringify(tasks));

    return NextResponse.json({
      ok: true,
      count: safeTasks.length,
      tasks: safeTasks,
    });
  } catch (err) {
    console.error("[public/jadwal-tugas-ilkom-b] Error fetching tasks:", err);
    // Return empty tasks array with 200 OK so client renders fallback UI instead of crashing
    return NextResponse.json({
      ok: true,
      count: 0,
      tasks: [],
      error: "Belum ada jadwal tugas atau server sedang memuat.",
    });
  }
}
