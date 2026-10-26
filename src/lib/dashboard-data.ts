import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Task, TaskStatus, UserProfile, Event } from "@/types";
import { getUsersByIds } from "@/lib/firebase/members";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SummaryCardData = {
  activeEvents: number;
  activeEventNames: string[];
  activeJobs: number;
  activeJobsDivisionCount: number;
  activeJobsEventCount: number;
  needsAttention: number;
  stuckCount: number;
  approvalCount: number;
  revisionCount: number;
  completedTotal: number;
  completedThisWeek: number;
  totalMembers: number;
};

export type TaskStatusCount = {
  status: TaskStatus;
  label: string;
  count: number;
  color: string;
};

export type EventTaskCount = {
  eventId: string;
  eventName: string;
  total: number;
  done: number; // approved
  progress: number; // 0-100
};

export type FocusItem = {
  id: string;
  taskId: string;
  taskName: string;
  picName: string;
  eventOrDivision: string;
  deadline: Date | null;
  diffDays: number | null;
  kind: "approval" | "stuck" | "revision" | "overdue" | "h1";
  status?: TaskStatus;
};

export type ActivityItem = {
  id: string;
  text: string;
  time: Date;
  kind: "approved" | "revision" | "stuck" | "created";
};

export type DashboardData = {
  summary: SummaryCardData;
  statusCounts: TaskStatusCount[];
  eventTaskCounts: EventTaskCount[];
  focusItems: FocusItem[];
  recentActivity: ActivityItem[];
  role: UserProfile["role"];
  allTasks: Task[];
  allEvents: Event[];
  usersMap: Record<string, { name: string; avatar_url?: string }>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (typeof val === "object" && "toDate" in (val as object)) {
    return (val as { toDate: () => Date }).toDate();
  }
  if (val instanceof Date) return val;
  return null;
}

function diffDaysFromToday(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

// ─── Status display config ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  belum_dimulai:    { label: "Belum Dimulai",       color: "#898989" },
  sedang_dikerjakan:{ label: "Sedang Dikerjakan",   color: "#6349ea" },
  menunggu_approval:{ label: "Menunggu Approval",   color: "#7c65f0" },
  perlu_revisi:     { label: "Perlu Revisi",         color: "#fb923c" },
  stuck:            { label: "Stuck",                color: "#e94235" },
  approved:         { label: "Selesai / Approved",  color: "#19a874" },
  butuh_bantuan:    { label: "Butuh Bantuan",        color: "#ffba00" },
  menunggu_materi:  { label: "Menunggu Materi",     color: "#6349ea" },
  draft_selesai:    { label: "Draft Selesai",        color: "#19a874" },
  revisi_dikerjakan:{ label: "Revisi Dikerjakan",   color: "#7c65f0" },
  ditunda:          { label: "Ditunda",              color: "#898989" },
};

// Statuses shown in the donut chart (grouped for clarity)
const DONUT_STATUSES: TaskStatus[] = [
  "belum_dimulai",
  "sedang_dikerjakan",
  "menunggu_approval",
  "perlu_revisi",
  "stuck",
  "approved",
];

// ─── Main Fetcher ─────────────────────────────────────────────────────────────

export async function getDashboardData(
  profile: UserProfile,
  filterDivisionId?: string,
  workspaceFilter?: { org_id?: string; campus_id?: string }
): Promise<DashboardData> {
  const role = profile.role;
  const targetOrgId = workspaceFilter?.org_id || profile.organization_id || profile.org_id;
  const targetCampusId = workspaceFilter?.campus_id || profile.campus_id || profile.univ_id;

  const isClassWorkspace =
    targetOrgId === "ws_ilkom_2024" ||
    Boolean(targetOrgId?.startsWith("ws_kelas_"));

  // In class workspace, tasks are collective (class-wide), so all members view all tasks
  const isStaff = role === "super_admin" || role === "koordinator_divisi" || isClassWorkspace;

  const matchesTenant = (item: Record<string, unknown>): boolean => {
    if (targetOrgId) {
      const org = item.organization_id || item.org_id || item.orgId || "org-undiksha-forkom-kip";
      const isLegacyOrg =
        org === targetOrgId ||
        ((org === "main_org" || org === "org-undiksha-forkom-kip" || org === "org-undiksha-bem") &&
         (targetOrgId === "org-undiksha-forkom-kip" || targetOrgId === "org-undiksha-bem" || targetOrgId === "main_org"));
      if (!isLegacyOrg) return false;
    }
    if (targetCampusId) {
      const campus = item.campus_id || item.campusId || item.univ_id || item.univId || "univ-undiksha";
      const isLegacyCampus =
        campus === targetCampusId ||
        campus === "univ-undiksha" ||
        campus === "ui" ||
        (!item.campus_id && !item.campusId && !item.univ_id && !item.univId);
      if (!isLegacyCampus) return false;
    }
    return true;
  };

  let allEvents: Event[] = [];
  let tasks: Task[] = [];
  const usersMap = new Map<string, UserProfile>();

  if (isStaff) {
    const [tasksSnap, eventsSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, "tasks")),
      getDocs(collection(db, "events")),
      getDocs(collection(db, "users")),
    ]);

    tasks = tasksSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Task))
      .filter((t) => t.is_archived !== true);
    allEvents = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
    usersSnap.docs.forEach((d) => usersMap.set(d.id, { id: d.id, ...d.data() } as UserProfile));

    tasks = tasks.filter((t) => matchesTenant(t as unknown as Record<string, unknown>));
    allEvents = allEvents.filter((e) => matchesTenant(e as unknown as Record<string, unknown>));

    if (!isClassWorkspace) {
      if (role === "koordinator_divisi" && profile.division_id) {
        tasks = tasks.filter((t) => t.division_id === profile.division_id);
      } else if (role === "super_admin" && filterDivisionId && filterDivisionId !== "all") {
        tasks = tasks.filter((t) => t.division_id === filterDivisionId);
      }
    }
  } else {
    // Non-staff (anggota)
    // 1. Fetch memberships via Collection Group Query
    try {
      const membershipsSnapshot = await getDocs(
        query(
          collectionGroup(db, "event_members"),
          where("user_id", "==", profile.id)
        )
      );
      const eventIds = [...new Set(membershipsSnapshot.docs.map((doc) => doc.data().event_id as string).filter(Boolean))];

      // Include events where coordinator_id is this user
      const coordEventsSnap = await getDocs(
        query(collection(db, "events"), where("coordinator_id", "==", profile.id))
      );
      coordEventsSnap.docs.forEach((doc) => {
        eventIds.push(doc.id);
      });

      const uniqueEventIds = [...new Set(eventIds)];

      if (uniqueEventIds.length > 0) {
        const eventSnaps = await Promise.all(
          uniqueEventIds.map((id) => getDoc(doc(db, "events", id)))
        );
        allEvents = eventSnaps
          .filter((snap) => snap.exists())
          .map((snap) => ({ id: snap.id, ...snap.data() } as Event));
      }
    } catch (err) {
      console.error("[dashboard-data] Failed to load events for non-staff:", err);
    }

    // 2. Fetch PIC tasks
    try {
      const picTasksSnap = await getDocs(
        query(
          collection(db, "tasks"),
          where("pic_id", "==", profile.id)
        )
      );
      tasks = picTasksSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Task))
        .filter((t) => t.is_archived !== true);
    } catch (err) {
      console.error("[dashboard-data] Failed to load PIC tasks:", err);
    }

    // 3. Fetch event tasks
    const uniqueEventIds = allEvents.map((e) => e.id);
    if (uniqueEventIds.length > 0) {
      try {
        const eventTasksSnaps = await Promise.all(
          uniqueEventIds.map((eventId) =>
            getDocs(
              query(
                collection(db, "tasks"),
                where("event_id", "==", eventId)
              )
            )
          )
        );
        const eventTasks = eventTasksSnaps.flatMap((snap) =>
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Task))
            .filter((t) => t.is_archived !== true)
        );

        // Merge and deduplicate
        const taskMap = new Map<string, Task>();
        tasks.forEach((t) => taskMap.set(t.id, t));
        eventTasks.forEach((t) => taskMap.set(t.id, t));
        tasks = Array.from(taskMap.values()).filter((t) => matchesTenant(t as unknown as Record<string, unknown>));
      } catch (err) {
        console.error("[dashboard-data] Failed to load event tasks:", err);
      }
    }

    // 4. Resolve name profiles
    try {
      const userIds = new Set<string>();
      userIds.add(profile.id);
      tasks.forEach((t) => {
        if (t.pic_id) userIds.add(t.pic_id);
        if (t.coordinator_id) userIds.add(t.coordinator_id);
        if (t.created_by) userIds.add(t.created_by);
      });
      allEvents.forEach((e) => {
        if (e.coordinator_id) userIds.add(e.coordinator_id);
        if (e.created_by) userIds.add(e.created_by);
      });
      const usersData = await getUsersByIds(Array.from(userIds));
      usersData.forEach((u) => usersMap.set(u.id, u));
    } catch (err) {
      console.error("[dashboard-data] Failed to resolve member names:", err);
    }
  }

  // ── Summary cards ─────────────────────────────────────────────────────────
  const weekStart = startOfWeek();

  // Total Acara Aktif: jumlah event yang statusnya bukan 'selesai'
  const activeEventsList = allEvents.filter((e) => e.status !== "selesai");
  const activeEvents = activeEventsList.length;
  const activeEventNames = Array.from(
    new Set(activeEventsList.map((e) => e.name || "Acara Aktif"))
  );

  // Total Job Desk Aktif: hitung seluruh task yang statusnya belum 'approved'
  const activeJobsList = tasks.filter((t) => t.status !== "approved");
  const activeJobs = activeJobsList.length;
  const activeJobsDivisionCount = activeJobsList.filter((t) => !t.event_id).length;
  const activeJobsEventCount = activeJobsList.filter((t) => !!t.event_id).length;

  // Perlu Tindakan Segera: hitung task dengan status 'stuck', 'butuh_bantuan', 'menunggu_approval', atau 'perlu_revisi'
  const stuckCount = tasks.filter(
    (t) => t.status === "stuck" || t.status === "butuh_bantuan"
  ).length;
  const approvalCount = tasks.filter(
    (t) => t.status === "menunggu_approval"
  ).length;
  const revisionCount = tasks.filter(
    (t) => t.status === "perlu_revisi" || t.status === "revisi_dikerjakan"
  ).length;
  const needsAttention = tasks.filter((t) =>
    t.status === "stuck" ||
    t.status === "butuh_bantuan" ||
    t.status === "menunggu_approval" ||
    t.status === "perlu_revisi"
  ).length;

  // Selesai: hitung task yang sudah berstatus 'approved'
  const completedTotal = tasks.filter((t) => t.status === "approved").length;

  const completedThisWeek = tasks.filter((t) => {
    if (t.status !== "approved") return false;
    const updatedAt = toDate(t.updated_at);
    return updatedAt !== null && updatedAt >= weekStart;
  }).length;

  const tenantMembersCount = Array.from(usersMap.values()).filter((u) =>
    matchesTenant(u as unknown as Record<string, unknown>)
  ).length;
  const totalMembers = role === "super_admin" ? (tenantMembersCount || usersMap.size) : 0;

  // ── Status distribution (donut) ────────────────────────────────────────────
  const statusCountMap: Partial<Record<TaskStatus, number>> = {};
  tasks.forEach((t) => {
    statusCountMap[t.status] = (statusCountMap[t.status] ?? 0) + 1;
  });

  const statusCounts: TaskStatusCount[] = DONUT_STATUSES.map((status) => ({
    status,
    label: STATUS_CONFIG[status].label,
    count: statusCountMap[status] ?? 0,
    color: STATUS_CONFIG[status].color,
  }));

  // ── Event progress (bar chart) ─────────────────────────────────────────────
  const eventTaskMap = new Map<string, { total: number; done: number }>();
  tasks.forEach((t) => {
    if (!t.event_id) return;
    const prev = eventTaskMap.get(t.event_id) ?? { total: 0, done: 0 };
    eventTaskMap.set(t.event_id, {
      total: prev.total + 1,
      done: prev.done + (t.status === "approved" ? 1 : 0),
    });
  });

  const eventTaskCounts: EventTaskCount[] = [];
  allEvents.forEach((ev) => {
    const counts = eventTaskMap.get(ev.id);
    if (!counts || counts.total === 0) return;
    eventTaskCounts.push({
      eventId: ev.id,
      eventName: ev.name,
      total: counts.total,
      done: counts.done,
      progress: Math.round((counts.done / counts.total) * 100),
    });
  });
  // Sort by most tasks, take top 8
  eventTaskCounts.sort((a, b) => b.total - a.total);
  const topEvents = eventTaskCounts.slice(0, 8);

  // ── Focus panel (Antrean Tindakan & Job Desk Mendesak) ──────────────────────
  const focusItems: FocusItem[] = [];

  tasks.forEach((t) => {
    if (t.status === "approved" || t.status === "ditunda") return;

    const deadlineDate = toDate(t.deadline);
    const diffDays = deadlineDate ? diffDaysFromToday(deadlineDate) : null;
    const picUser = t.pic_id ? usersMap.get(t.pic_id) : undefined;
    const picName = picUser?.name || "Anggota Tim";

    // Determine event/division label
    const eventOrDivision = t.event_id
      ? (allEvents.find((e) => e.id === t.event_id)?.name ?? "Acara")
      : (t.division_id ? `Divisi Humas` : "Umum");

    let kind: FocusItem["kind"] | null = null;

    if (t.status === "menunggu_approval") {
      kind = "approval";
    } else if (t.status === "stuck" || t.status === "butuh_bantuan") {
      kind = "stuck";
    } else if (t.status === "perlu_revisi" || t.status === "revisi_dikerjakan") {
      kind = "revision";
    } else if (diffDays !== null && diffDays < 0) {
      kind = "overdue";
    } else if (diffDays !== null && diffDays <= 1) {
      kind = "h1";
    }

    if (kind) {
      focusItems.push({
        id: t.id,
        taskId: t.id,
        taskName: t.name || "Tugas",
        picName,
        eventOrDivision,
        deadline: deadlineDate,
        diffDays,
        kind,
        status: t.status,
      });
    }
  });

  // Sort order: approval first, then stuck, then revision, then overdue, then h1
  const kindOrder: FocusItem["kind"][] = ["approval", "stuck", "revision", "overdue", "h1"];
  focusItems.sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind));

  // ── Recent activity ────────────────────────────────────────────────────────
  const recentActivity: ActivityItem[] = tasks
    .filter((t) => toDate(t.updated_at) !== null)
    .sort((a, b) => {
      const da = toDate(a.updated_at)?.getTime() ?? 0;
      const db_ = toDate(b.updated_at)?.getTime() ?? 0;
      return db_ - da;
    })
    .slice(0, 5)
    .map((t) => {
      const pic = t.pic_id ? usersMap.get(t.pic_id) : undefined;
      let text = "";
      let kind: ActivityItem["kind"] = "created";
      switch (t.status) {
        case "approved":
          text = `"${t.name}" selesai diapprove`;
          kind = "approved";
          break;
        case "perlu_revisi":
          text = `"${t.name}" perlu revisi`;
          kind = "revision";
          break;
        case "stuck":
          text = `"${t.name}" dilaporkan stuck oleh ${pic?.name ?? "-"}`;
          kind = "stuck";
          break;
        case "menunggu_approval":
          text = `"${t.name}" diajukan untuk approval`;
          kind = "created";
          break;
        default:
          text = `"${t.name}" diperbarui`;
          kind = "created";
      }
      return {
        id: t.id,
        text,
        time: toDate(t.updated_at)!,
        kind,
      };
    });

  const usersObj: Record<string, { name: string; avatar_url?: string }> = {};
  usersMap.forEach((u, id) => {
    usersObj[id] = { name: u.name || "-", avatar_url: u.avatar_url };
  });

  return {
    summary: {
      activeEvents,
      activeEventNames,
      activeJobs,
      activeJobsDivisionCount,
      activeJobsEventCount,
      needsAttention,
      stuckCount,
      approvalCount,
      revisionCount,
      completedTotal,
      completedThisWeek,
      totalMembers,
    },
    statusCounts,
    eventTaskCounts: topEvents,
    focusItems: focusItems.slice(0, 15),
    recentActivity,
    role,
    allTasks: tasks,
    allEvents,
    usersMap: usersObj,
  };
}
