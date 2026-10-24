import type { Metadata } from "next";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { isAcademicClassTask } from "@/lib/server/academic-broadcast";
import { PublicClassScheduleView } from "@/components/academic/public-class-schedule-view";
import type { Task } from "@/types";

export const dynamic = "force-dynamic";

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

    tasks.sort((a, b) => {
      const timeA = a.deadline ? new Date(a.deadline as string).getTime() : Infinity;
      const timeB = b.deadline ? new Date(b.deadline as string).getTime() : Infinity;
      return timeA - timeB;
    });

    initialTasks = tasks;
  } catch (err) {
    console.error("[PublicClassSchedulePage] Failed to load tasks from server:", err);
  }

  return <PublicClassScheduleView initialTasks={initialTasks} />;
}
