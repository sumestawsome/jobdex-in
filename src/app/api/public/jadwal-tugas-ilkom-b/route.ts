import "server-only";

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { isAcademicClassTask } from "@/lib/server/academic-broadcast";
import type { Task } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collection("tasks").where("is_archived", "==", false).get();

    const tasks: Task[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const t = {
        id: doc.id,
        ...data,
        deadline:
          data.deadline && typeof data.deadline === "object" && "toDate" in data.deadline
            ? (data.deadline as { toDate: () => Date }).toDate().toISOString()
            : data.deadline,
        created_at:
          data.created_at && typeof data.created_at === "object" && "toDate" in data.created_at
            ? (data.created_at as { toDate: () => Date }).toDate().toISOString()
            : data.created_at,
        updated_at:
          data.updated_at && typeof data.updated_at === "object" && "toDate" in data.updated_at
            ? (data.updated_at as { toDate: () => Date }).toDate().toISOString()
            : data.updated_at,
      } as Task;

      if (
        isAcademicClassTask(t) &&
        t.status !== "approved" &&
        (t.status as string) !== "selesai"
      ) {
        tasks.push(t);
      }
    });

    // Urutkan deadline terdekat
    tasks.sort((a, b) => {
      const timeA = a.deadline ? new Date(a.deadline as string).getTime() : Infinity;
      const timeB = b.deadline ? new Date(b.deadline as string).getTime() : Infinity;
      return timeA - timeB;
    });

    return NextResponse.json({
      ok: true,
      count: tasks.length,
      tasks,
    });
  } catch (err) {
    console.error("[public/jadwal-tugas-ilkom-b] Error fetching tasks:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch class tasks" },
      { status: 500 }
    );
  }
}
