import type { Metadata } from "next";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { isAcademicClassTask } from "@/lib/server/academic-broadcast";
import { PublicClassScheduleView } from "@/components/academic/public-class-schedule-view";
import type { Task } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Jadwal & Tenggat Tugas Ilkom B 2024 | JobDex.in",
  description:
    "Jadwal dan tenggat tugas kuliah aktif mahasiswa Kelas Ilmu Komputer 2024 (Ilkom B) Undiksha. Akses publik read-only tanpa login.",
  openGraph: {
    title: "Jadwal & Tenggat Tugas Ilkom B 2024",
    description:
      "Pantau jadwal dan batas pengumpulan tugas kuliah Ilkom B 2024 Undiksha secara real-time.",
    type: "website",
  },
};

/**
 * Deeply sanitizes Firestore documents into plain JSON-serializable primitives.
 * Completely eliminates raw Firestore Timestamps (_seconds, _nanoseconds) that crash Next.js RSC.
 */
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

export default async function PublicClassSchedulePage() {
  let initialTasks: Task[] = [];

  try {
    const db = getAdminDb();
    const snap = await db
      .collection("tasks")
      .where("is_archived", "==", false)
      .get();

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
        console.warn(`[PublicClassSchedulePage] Skipping invalid task doc ${doc.id}:`, docErr);
      }
    });

    tasks.sort((a, b) => {
      const timeA = a.deadline ? new Date(a.deadline as string).getTime() : Infinity;
      const timeB = b.deadline ? new Date(b.deadline as string).getTime() : Infinity;
      return timeA - timeB;
    });

    // Final guarantee: pure JSON round-trip to strip any remaining non-serializable properties
    initialTasks = JSON.parse(JSON.stringify(tasks));
  } catch (err) {
    console.error("[PublicClassSchedulePage] Graceful fallback after load error:", err);
    initialTasks = [];
  }

  return <PublicClassScheduleView initialTasks={initialTasks} />;
}
