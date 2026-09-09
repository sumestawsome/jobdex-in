import "server-only";

import { getAdminDb } from "@/lib/server/firebase-admin";
import { isKoordinatorAcara, isKoordinatorDivisi, isSuperAdmin } from "@/lib/permissions";
import { TASK_STATUS_LABELS } from "@/lib/task-status";
import type { DesignReference, Event, Task, TaskStatus, UserProfile } from "@/types";

type BuildAIContextInput = {
  profile: UserProfile;
  eventId?: string;
};

type UserNameMap = Map<string, string>;
type EventNameMap = Map<string, string>;

const JOBDEX_APP_CONTEXT = [
  "TENTANG JOBDEX.IN:",
  "JobDex.in adalah aplikasi web untuk mengelola job desk organisasi mahasiswa, khususnya divisi Humas dan Media Kreatif/Pubdok.",
  "Aplikasi ini membantu mencatat anggota, acara, job desk divisi, job desk acara, status pengerjaan, kendala, revisi, approval, upload hasil desain, arsip referensi desain, notifikasi WhatsApp, dan ringkasan progress menggunakan AI.",
].join("\n");

function formatDate(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format((value as { toDate: () => Date }).toDate());
}

function formatTaskLine(task: Task, usersById: UserNameMap, eventsById: EventNameMap) {
  return [
    `- ${task.name}`,
    `PIC: ${usersById.get(task.pic_id) ?? "User tidak ditemukan"}`,
    `Koordinator: ${usersById.get(task.coordinator_id) ?? "User tidak ditemukan"}`,
    `Status: ${TASK_STATUS_LABELS[task.status] ?? task.status}`,
    `Prioritas: ${task.priority}`,
    `Deadline: ${formatDate(task.deadline)}`,
    task.event_id ? `Acara: ${eventsById.get(task.event_id) ?? "Acara tidak ditemukan"}` : "Tipe: Divisi",
    task.stuck_notes ? `Kendala: ${task.stuck_notes}` : "",
    task.revision_notes ? `Catatan revisi: ${task.revision_notes}` : "",
    `Approval: ${task.approval_status ?? "pending"}`,
  ]
    .filter(Boolean)
    .join(" | ");
}

function countByStatus(tasks: Task[]) {
  return tasks.reduce(
    (accumulator, task) => {
      accumulator[task.status] = (accumulator[task.status] ?? 0) + 1;
      return accumulator;
    },
    {} as Partial<Record<TaskStatus, number>>,
  );
}

async function getUsersById(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const snapshots = await Promise.all(
    uniqueIds.map((userId) => getAdminDb().collection("users").doc(userId).get()),
  );

  return new Map(
    snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => {
        const data = snapshot.data() as UserProfile;
        return [snapshot.id, data.name || "User tanpa nama"];
      }),
  );
}

async function getEventsById(eventIds: string[]) {
  const uniqueIds = [...new Set(eventIds.filter(Boolean))];
  const snapshots = await Promise.all(
    uniqueIds.map((eventId) => getAdminDb().collection("events").doc(eventId).get()),
  );

  return new Map(
    snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => {
        const data = snapshot.data() as Event;
        return [snapshot.id, data.name || "Acara tanpa nama"];
      }),
  );
}

function matchesProfileTenant(
  item: Record<string, unknown>,
  profile: UserProfile
): boolean {
  const targetOrgId = profile.organization_id || profile.org_id;
  const targetCampusId = profile.campus_id || profile.univ_id;

  if (targetOrgId) {
    const org = item.organization_id || item.org_id || item.orgId || "org-undiksha-forkom-kip";
    const isLegacyOrgMatch =
      org === targetOrgId ||
      ((org === "main_org" || org === "org-undiksha-forkom-kip" || org === "org-undiksha-bem") &&
       (targetOrgId === "org-undiksha-forkom-kip" || targetOrgId === "org-undiksha-bem" || targetOrgId === "main_org"));
    if (!isLegacyOrgMatch) return false;
  }
  if (targetCampusId) {
    const campus = item.campus_id || item.campusId || item.univ_id || item.univId || "univ-undiksha";
    const isLegacyCampusMatch =
      campus === targetCampusId ||
      campus === "univ-undiksha" ||
      campus === "ui" ||
      (!item.campus_id && !item.campusId && !item.univ_id && !item.univId);
    if (!isLegacyCampusMatch) return false;
  }
  return true;
}

async function getVisibleTasks(profile: UserProfile, eventId?: string) {
  const snapshot = await getAdminDb().collection("tasks").get();
  const tasks = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as Task[];

  return tasks
    .filter((task) => !task.is_archived)
    .filter((task) => matchesProfileTenant(task as unknown as Record<string, unknown>, profile))
    .filter((task) => {
      if (eventId && task.event_id !== eventId) {
        return false;
      }

      if (isSuperAdmin(profile) || isKoordinatorDivisi(profile)) {
        return true;
      }

      if (isKoordinatorAcara(profile)) {
        return task.type === "acara" && task.coordinator_id === profile.id;
      }

      // Anggota can see tasks where they are PIC
      return task.pic_id === profile.id;
    });
}

async function getVisibleEvents(profile: UserProfile) {
  const snapshot = await getAdminDb().collection("events").get();
  const events = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as Event[];

  return events.filter((e) => matchesProfileTenant(e as unknown as Record<string, unknown>, profile));
}

async function getDesignReferencesSummary(profile: UserProfile) {
  const snapshot = await getAdminDb()
    .collection("design_references")
    .where("is_archived", "==", false)
    .get();
  const references = snapshot.docs
    .map((item) => ({
      id: item.id,
      ...item.data(),
    }) as DesignReference)
    .filter((ref) => matchesProfileTenant(ref as unknown as Record<string, unknown>, profile));

  return references.slice(0, 20).map((reference) =>
    [
      `- ${reference.title}`,
      `Jenis: ${reference.design_type}`,
      `Acara: ${reference.event_name || "-"}`,
      `Tahun: ${reference.year}`,
      reference.style_notes ? `Style: ${reference.style_notes}` : "",
      reference.color_palette?.length ? `Palette: ${reference.color_palette.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

export async function buildAIContext({ profile, eventId }: BuildAIContextInput) {
  const [tasks, events, referencesSummary] = await Promise.all([
    getVisibleTasks(profile, eventId),
    getVisibleEvents(profile),
    getDesignReferencesSummary(profile).catch(() => []),
  ]);
  const usersById = await getUsersById([
    ...tasks.map((task) => task.pic_id),
    ...tasks.map((task) => task.coordinator_id),
  ]);
  const eventsById = new Map([
    ...events.map((event) => [event.id, event.name] as const),
    ...(await getEventsById(tasks.map((task) => task.event_id ?? ""))).entries(),
  ]);
  const statusCounts = countByStatus(tasks);
  const taskLines = tasks
    .sort((a, b) => {
      const dateA = a.deadline && typeof a.deadline === "object" && "toDate" in a.deadline
        ? (a.deadline as { toDate: () => Date }).toDate().getTime()
        : Number.MAX_SAFE_INTEGER;
      const dateB = b.deadline && typeof b.deadline === "object" && "toDate" in b.deadline
        ? (b.deadline as { toDate: () => Date }).toDate().getTime()
        : Number.MAX_SAFE_INTEGER;

      return dateA - dateB;
    })
    .slice(0, 80)
    .map((task) => formatTaskLine(task, usersById, eventsById));
  const eventLines = events.slice(0, 30).map((event) =>
    [
      `- ${event.name}`,
      `Status: ${event.status}`,
      `Tanggal: ${formatDate(event.event_date)}`,
      `Koordinator: ${usersById.get(event.coordinator_id) ?? "User tidak ditemukan"}`,
      `Progress: ${event.progress_percentage ?? 0}%`,
    ].join(" | "),
  );
  const statistics = [
    `Total task: ${tasks.length}`,
    ...Object.entries(statusCounts).map(
      ([status, count]) => `${TASK_STATUS_LABELS[status as TaskStatus] ?? status}: ${count}`,
    ),
  ];
  const contextSummary = [
    JOBDEX_APP_CONTEXT,
    "",
    "PENGGUNA YANG BERTANYA:",
    `Nama: ${profile.name}`,
    `Role: ${profile.role === "super_admin" ? "Super Admin" : profile.role === "koordinator_divisi" ? "Koordinator Divisi" : profile.role === "koordinator_acara" ? "Koordinator Acara" : "Anggota (PIC)"}`,
    profile.role === "anggota"
      ? "Catatan: User ini adalah anggota/PIC. Fokuskan jawaban pada tugas yang ditugaskan kepadanya dan berikan panduan cara update progress, upload hasil, atau melaporkan kendala."
      : profile.role === "koordinator_acara"
      ? "Catatan: User ini adalah koordinator acara. Fokuskan jawaban pada progress acara yang dikoordinasinya, task yang perlu di-approve, dan PIC yang perlu di-follow-up."
      : "Catatan: User ini adalah koordinator/admin. Berikan jawaban menyeluruh tentang semua task, progress anggota, dan rekomendasi prioritas.",
    "",
    "STATISTIK:",
    ...statistics,
    "",
    "DATA TASK:",
    ...(taskLines.length ? taskLines : ["Belum ada task yang bisa dianalisis."]),
    "",
    "DATA ACARA:",
    ...(eventLines.length ? eventLines : ["Belum ada acara yang bisa dianalisis."]),
    "",
    "REFERENSI DESAIN RINGKAS:",
    ...(referencesSummary.length ? referencesSummary : ["Belum ada referensi desain aktif."]),
  ].join("\n");

  return {
    contextSummary,
    taskCount: tasks.length,
  };
}
