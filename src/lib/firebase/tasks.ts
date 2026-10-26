import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DEFAULT_DIVISION_ID, DEFAULT_ORGANIZATION_ID } from "@/lib/seed-data";
import { DEFAULT_CORE_DIVISIONS } from "@/lib/workspace-schema";
import {
  isKoordinatorAcara,
  isKoordinatorDivisi,
  isSuperAdmin,
} from "@/lib/permissions";
import type { ReferenceLink, Task, TaskInput, UserProfile } from "@/types";

function dateToTimestamp(value: string) {
  if (value.includes("T")) {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return Timestamp.fromDate(parsed);
    }
  }
  return Timestamp.fromDate(new Date(`${value}T00:00:00`));
}

function getTaskTimestampMillis(task: Task) {
  if (task.created_at) return getMillis(task.created_at);
  if (task.updated_at) return getMillis(task.updated_at);
  if (task.deadline) return getMillis(task.deadline);
  return 0;
}

function sortTasks(tasks: Task[]) {
  return tasks.sort((a, b) => getTaskTimestampMillis(b) - getTaskTimestampMillis(a));
}

export async function getTasksForProfile(
  profile: UserProfile,
  workspaceFilter?: { org_id?: string; campus_id?: string },
  includeArchived: boolean = false
) {
  const targetOrgId = workspaceFilter?.org_id || profile.organization_id || profile.org_id;
  const targetCampusId = workspaceFilter?.campus_id || profile.campus_id || profile.univ_id;

  const isClassWorkspace =
    targetOrgId === "ws_ilkom_2024" ||
    Boolean(targetOrgId?.startsWith("ws_kelas_"));

  // In class workspaces, tasks are collective (class-wide), so we don't filter by pic_id
  const canViewAll =
    isSuperAdmin(profile) ||
    isKoordinatorDivisi(profile) ||
    isClassWorkspace;

  const tasksRef = collection(db, "tasks");
  const tasksQuery =
    includeArchived
      ? (canViewAll
          ? query(tasksRef)
          : isKoordinatorAcara(profile)
            ? query(tasksRef, where("coordinator_id", "==", profile.id))
            : query(tasksRef, where("pic_id", "==", profile.id)))
      : (canViewAll
          ? query(tasksRef, where("is_archived", "==", false))
          : isKoordinatorAcara(profile)
            ? query(tasksRef, where("coordinator_id", "==", profile.id))
            : query(tasksRef, where("pic_id", "==", profile.id)));

  const snapshot = await getDocs(tasksQuery);
  const rawTasks = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as Task[];

  const filteredTasks = rawTasks.filter((task) => {
    if (!includeArchived && task.is_archived) return false;

    if (targetOrgId) {
      const taskOrg =
        task.organization_id ||
        task.org_id ||
        (task as unknown as Record<string, unknown>).orgId ||
        DEFAULT_ORGANIZATION_ID;
      const isMatchOrg =
        taskOrg === targetOrgId ||
        ((taskOrg === "main_org" || taskOrg === "org-undiksha-forkom-kip" || taskOrg === "org-undiksha-bem") &&
         (targetOrgId === "org-undiksha-forkom-kip" || targetOrgId === "org-undiksha-bem" || targetOrgId === "main_org"));
      if (!isMatchOrg) return false;
    }

    if (targetCampusId) {
      const taskCampus =
        task.campus_id ||
        (task as unknown as Record<string, unknown>).campusId ||
        task.univ_id ||
        (task as unknown as Record<string, unknown>).univId;
      const isMatchCampus =
        !taskCampus ||
        taskCampus === targetCampusId ||
        taskCampus === "univ-undiksha" ||
        taskCampus === "ui";
      if (!isMatchCampus) return false;
    }

    return true;
  });

  return sortTasks(filteredTasks);
}

export async function getTasksByEvent(
  eventId: string,
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const snapshot = await getDocs(
    query(
      collection(db, "tasks"),
      where("event_id", "==", eventId),
      where("is_archived", "==", false),
    ),
  );

  let tasks = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as Task[];

  if (workspaceFilter?.org_id) {
    tasks = tasks.filter((t) => {
      const tOrg =
        t.organization_id ||
        t.org_id ||
        (t as unknown as Record<string, unknown>).orgId ||
        DEFAULT_ORGANIZATION_ID;
      return (
        tOrg === workspaceFilter.org_id ||
        ((tOrg === "main_org" || tOrg === "org-undiksha-forkom-kip" || tOrg === "org-undiksha-bem") &&
         (workspaceFilter.org_id === "org-undiksha-forkom-kip" || workspaceFilter.org_id === "org-undiksha-bem" || workspaceFilter.org_id === "main_org"))
      );
    });
  }

  if (workspaceFilter?.campus_id) {
    tasks = tasks.filter((t) => {
      const tCampus =
        t.campus_id ||
        (t as unknown as Record<string, unknown>).campusId ||
        t.univ_id ||
        (t as unknown as Record<string, unknown>).univId;
      return (
        !tCampus ||
        tCampus === workspaceFilter.campus_id ||
        tCampus === "univ-undiksha" ||
        tCampus === "ui"
      );
    });
  }

  return sortTasks(tasks);
}

export async function getTaskById(
  taskId: string,
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const snapshot = await getDoc(doc(db, "tasks", taskId));

  if (!snapshot.exists()) {
    return null;
  }

  const task = {
    id: snapshot.id,
    ...snapshot.data(),
  } as Task;

  if (workspaceFilter?.org_id) {
    const taskOrg =
      task.organization_id ||
      task.org_id ||
      (task as unknown as Record<string, unknown>).orgId ||
      DEFAULT_ORGANIZATION_ID;
    const isMatchOrg =
      taskOrg === workspaceFilter.org_id ||
      ((taskOrg === "main_org" || taskOrg === "org-undiksha-forkom-kip" || taskOrg === "org-undiksha-bem") &&
       (workspaceFilter.org_id === "org-undiksha-forkom-kip" || workspaceFilter.org_id === "org-undiksha-bem" || workspaceFilter.org_id === "main_org"));
    if (!isMatchOrg) {
      return null;
    }
  }

  if (workspaceFilter?.campus_id) {
    const taskCampus =
      task.campus_id ||
      (task as unknown as Record<string, unknown>).campusId ||
      task.univ_id ||
      (task as unknown as Record<string, unknown>).univId;
    const isMatchCampus =
      !taskCampus ||
      taskCampus === workspaceFilter.campus_id ||
      taskCampus === "univ-undiksha" ||
      taskCampus === "ui";
    if (!isMatchCampus) {
      return null;
    }
  }

  return task;
}

export function getTaskProgressWeight(status: string): number {
  switch (status) {
    case "approved":
      return 100;
    case "menunggu_approval":
      return 85;
    case "draft_selesai":
      return 70;
    case "perlu_revisi":
    case "revisi_dikerjakan":
      return 65;
    case "butuh_bantuan":
    case "stuck":
      return 40;
    case "sedang_dikerjakan":
    case "menunggu_materi":
      return 30;
    case "belum_dimulai":
    case "ditunda":
    default:
      return 0;
  }
}

export async function recalculateEventProgress(eventId: string): Promise<number> {
  if (!eventId) return 0;
  try {
    const tasksRef = collection(db, "tasks");
    const q = query(
      tasksRef,
      where("event_id", "==", eventId),
      where("is_archived", "==", false)
    );
    const snapshot = await getDocs(q);
    const tasks = snapshot.docs.map((doc) => doc.data() as Task);

    if (tasks.length === 0) {
      try {
        await updateDoc(doc(db, "events", eventId), {
          progress_percentage: 0,
          updated_at: serverTimestamp(),
        });
      } catch (err) {
        console.warn("Recalculate event progress ignored (no permission):", err);
      }
      return 0;
    }

    let totalWeight = 0;
    for (const task of tasks) {
      totalWeight += getTaskProgressWeight(task.status);
    }

    const progress = Math.round(totalWeight / tasks.length);
    try {
      await updateDoc(doc(db, "events", eventId), {
        progress_percentage: progress,
        updated_at: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Recalculate event progress ignored (no permission):", err);
    }

    return progress;
  } catch (error) {
    console.error("Gagal menghitung ulang progress acara:", error);
    return 0;
  }
}

export async function createTask(input: TaskInput, createdBy: string) {
  const defaultChecklist = [
    { id: "checklist_1", label: "Redaksi/materi tersedia", is_done: false },
    { id: "checklist_2", label: "Referensi desain tersedia", is_done: false },
    { id: "checklist_3", label: "Mulai desain/draft awal", is_done: false },
    { id: "checklist_4", label: "Revisi internal", is_done: false },
    { id: "checklist_5", label: "Finalisasi desain", is_done: false },
    { id: "checklist_6", label: "Upload hasil ke JobDex.in / Drive", is_done: false },
  ];

  let orgId = input.organization_id || input.org_id || input.orgId;
  let campusId = input.campus_id || input.univ_id || input.univId || input.campusId || "";

  // Otomatis isi univId dan orgId dari event induk atau pembuat jika belum terisi
  if ((!orgId || !campusId) && input.event_id) {
    try {
      const eventSnap = await getDoc(doc(db, "events", input.event_id));
      if (eventSnap.exists()) {
        const eData = eventSnap.data() as Record<string, unknown>;
        orgId = orgId || (eData.orgId as string) || (eData.org_id as string) || (eData.organization_id as string);
        campusId = campusId || (eData.univId as string) || (eData.univ_id as string) || (eData.campusId as string) || (eData.campus_id as string) || "";
      }
    } catch {
      // ignore
    }
  }

  if ((!orgId || !campusId) && createdBy) {
    try {
      const userSnap = await getDoc(doc(db, "users", createdBy));
      if (userSnap.exists()) {
        const uData = userSnap.data() as Record<string, unknown>;
        orgId = orgId || (uData.orgId as string) || (uData.org_id as string) || (uData.organization_id as string);
        campusId = campusId || (uData.univId as string) || (uData.univ_id as string) || (uData.campusId as string) || (uData.campus_id as string) || "";
      }
    } catch {
      // ignore
    }
  }

  if (!orgId) {
    throw new Error("Ruang kerja aktif (organisasi / ormawa) wajib dipilih sebelum membuat tugas.");
  }

  // Validasi divisi pokok saat jobdesk dibuat
  if (input.type === "divisi") {
    if (!input.division_id || !input.division_id.trim()) {
      throw new Error("Divisi pokok wajib dipilih untuk jobdesk bertipe divisi.");
    }

    const targetDivisionId: string = input.division_id;

    try {
      const divSnap = await getDoc(doc(db, "divisions", targetDivisionId));
      if (divSnap.exists()) {
        const divData = divSnap.data() as Record<string, unknown>;
        const divOrg = divData.organization_id || divData.org_id || divData.orgId;
        if (divOrg && orgId && divOrg !== orgId) {
          throw new Error("Divisi yang dipilih tidak terdaftar di ormawa / ruang kerja aktif.");
        }
        if (divData.is_active === false) {
          throw new Error("Divisi yang dipilih sedang tidak aktif.");
        }
      } else {
        const isCore = DEFAULT_CORE_DIVISIONS.some(
          (d) => d.slug === targetDivisionId || d.slug === targetDivisionId.replace(/_/g, "-") || targetDivisionId.includes(d.slug)
        );
        if (!isCore && targetDivisionId !== DEFAULT_DIVISION_ID) {
          throw new Error("Divisi pokok yang dipilih tidak valid atau belum terdaftar.");
        }
      }
    } catch (err) {
      if (err instanceof Error && (err.message.includes("Divisi") || err.message.includes("divisi"))) {
        throw err;
      }
    }
  }

  // Backward compat: simpan field lama dari multi-link jika ada
  const firstRedaction = (input.redaction_links as ReferenceLink[] | undefined)?.[0]?.url || "";
  const firstDesignRef = (input.design_ref_links as ReferenceLink[] | undefined)?.[0]?.url || "";
  const firstDriveRef = (input.drive_ref_links as ReferenceLink[] | undefined)?.[0]?.url || "";

  const taskRef = await addDoc(collection(db, "tasks"), {
    organization_id: orgId,
    org_id: orgId,
    orgId: orgId,
    campus_id: campusId,
    univ_id: campusId,
    univId: campusId,
    type: input.type,
    division_id: input.type === "divisi" ? (input.division_id || DEFAULT_DIVISION_ID) : "",
    event_id: input.type === "acara" ? input.event_id : "",
    name: input.name,
    description: input.description,
    pic_id: input.pic_id,
    coordinator_id: input.coordinator_id,
    deadline: dateToTimestamp(input.deadline),
    status: input.status,
    priority: input.priority,
    copywriting: input.copywriting,
    // Legacy single-URL fields (backward compat)
    copywriting_docs_url: input.copywriting_docs_url || firstRedaction,
    design_reference_url: input.design_reference_url || firstDesignRef,
    drive_reference_url: input.drive_reference_url || firstDriveRef,
    color_palette: input.color_palette,
    visual_direction: input.visual_direction,
    revision_notes: "",
    stuck_notes: "",
    result_design_url: "",
    approval_status: "pending",
    is_archived: false,
    checklist_items: defaultChecklist,
    created_by: createdBy,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    workspace_id: input.workspace_id || orgId,
    course_name: input.course_name || input.subject_name || "",
    subject_name: input.subject_name || input.course_name || "",
    submission_url: input.submission_url || input.submission_link || "",
    submission_link: input.submission_link || input.submission_url || "",
    reminders_sent: input.reminders_sent || [],
    notification_tracker: input.notification_tracker || {
      instant_created_sent: false,
      milestones_sent: [],
      last_sent_at: null,
      last_edit_broadcast_at: null,
      edit_count: 0,
    },
    category_key: input.category_key || "",
    category_label: input.category_label || "",
    subcategory_key: input.subcategory_key || "",
    subcategory_label: input.subcategory_label || "",
    output_types: input.output_types || [],
    archive_enabled: input.archive_enabled ?? true,
    reference_candidate_enabled: input.reference_candidate_enabled ?? false,
    requires_file: input.requires_file ?? false,
    requires_source_link: input.requires_source_link ?? false,
    source_link: input.source_link || "",
    archive_notes: input.archive_notes || "",
    data_sensitivity: input.data_sensitivity || "normal",
    // Fase 26A: Multi-link fields
    redaction_links: input.redaction_links || [],
    design_ref_links: input.design_ref_links || [],
    drive_ref_links: input.drive_ref_links || [],
    design_kit_source: input.design_kit_source || null,
  });

  if (input.type === "acara" && input.event_id) {
    await recalculateEventProgress(input.event_id);
  }

  return taskRef.id;
}

export async function updateTask(
  taskId: string,
  input: TaskInput,
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const oldDoc = await getDoc(doc(db, "tasks", taskId));
  const oldData = oldDoc.exists() ? (oldDoc.data() as Task) : null;

  if (oldData) {
    const existingOrg =
      oldData.organization_id ||
      oldData.org_id ||
      (oldData as unknown as Record<string, unknown>).orgId;
    const existingCampus =
      oldData.campus_id ||
      oldData.univ_id ||
      (oldData as unknown as Record<string, unknown>).univId ||
      (oldData as unknown as Record<string, unknown>).campusId;

    if (workspaceFilter?.org_id && existingOrg && workspaceFilter.org_id !== existingOrg) {
      throw new Error("Akses ditolak: Tidak dapat memodifikasi tugas milik organisasi/ormawa lain.");
    }
    if (workspaceFilter?.campus_id && existingCampus && workspaceFilter.campus_id !== existingCampus) {
      throw new Error("Akses ditolak: Tidak dapat memodifikasi tugas milik kampus lain.");
    }

    const inputOrg = input.organization_id || input.org_id || input.orgId;
    if (inputOrg && existingOrg && inputOrg !== existingOrg) {
      throw new Error("Dilarang mengubah penanda kepemilikan ormawa/organisasi pada pembaruan tugas.");
    }

    const inputCampus = input.campus_id || input.univ_id || input.univId || input.campusId;
    if (inputCampus && existingCampus && inputCampus !== existingCampus) {
      throw new Error("Dilarang mengubah penanda kepemilikan kampus pada pembaruan tugas.");
    }
  }

  // Validasi divisi pokok saat update
  if (input.type === "divisi") {
    if (!input.division_id || !input.division_id.trim()) {
      throw new Error("Divisi pokok wajib dipilih untuk jobdesk bertipe divisi.");
    }
    const targetDivisionId: string = input.division_id;
    const taskOrg = (oldData && (oldData.organization_id || oldData.org_id || (oldData as unknown as Record<string, unknown>).orgId)) || workspaceFilter?.org_id;
    try {
      const divSnap = await getDoc(doc(db, "divisions", targetDivisionId));
      if (divSnap.exists()) {
        const divData = divSnap.data() as Record<string, unknown>;
        const divOrg = divData.organization_id || divData.org_id || divData.orgId;
        if (divOrg && taskOrg && divOrg !== taskOrg) {
          throw new Error("Divisi yang dipilih bukan milik ormawa aktif.");
        }
        if (divData.is_active === false) {
          throw new Error("Divisi yang dipilih sedang tidak aktif.");
        }
      }
    } catch (err) {
      if (err instanceof Error && (err.message.includes("Divisi") || err.message.includes("divisi"))) {
        throw err;
      }
    }
  }

  // Backward compat: simpan field lama dari multi-link jika ada
  const firstRedaction = (input.redaction_links as ReferenceLink[] | undefined)?.[0]?.url || "";
  const firstDesignRef = (input.design_ref_links as ReferenceLink[] | undefined)?.[0]?.url || "";
  const firstDriveRef = (input.drive_ref_links as ReferenceLink[] | undefined)?.[0]?.url || "";

  await updateDoc(doc(db, "tasks", taskId), {
    type: input.type,
    division_id: input.type === "divisi" ? (input.division_id || DEFAULT_DIVISION_ID) : "",
    event_id: input.type === "acara" ? input.event_id : "",
    name: input.name,
    description: input.description,
    pic_id: input.pic_id,
    coordinator_id: input.coordinator_id,
    deadline: dateToTimestamp(input.deadline),
    status: input.status,
    priority: input.priority,
    copywriting: input.copywriting,
    // Legacy single-URL fields (backward compat)
    copywriting_docs_url: input.copywriting_docs_url || firstRedaction,
    design_reference_url: input.design_reference_url || firstDesignRef,
    drive_reference_url: input.drive_reference_url || firstDriveRef,
    color_palette: input.color_palette,
    visual_direction: input.visual_direction,
    updated_at: serverTimestamp(),
    category_key: input.category_key || "",
    category_label: input.category_label || "",
    subcategory_key: input.subcategory_key || "",
    subcategory_label: input.subcategory_label || "",
    output_types: input.output_types || [],
    archive_enabled: input.archive_enabled ?? true,
    reference_candidate_enabled: input.reference_candidate_enabled ?? false,
    requires_file: input.requires_file ?? false,
    requires_source_link: input.requires_source_link ?? false,
    source_link: input.source_link || "",
    archive_notes: input.archive_notes || "",
    data_sensitivity: input.data_sensitivity || "normal",
    // Fase 26A: Multi-link fields
    redaction_links: input.redaction_links || [],
    design_ref_links: input.design_ref_links || [],
    drive_ref_links: input.drive_ref_links || [],
    design_kit_source: input.design_kit_source ?? null,
    // Academic / Class task fields
    ...(input.workspace_id ? { workspace_id: input.workspace_id } : {}),
    ...(input.course_name || input.subject_name
      ? {
          course_name: input.course_name || input.subject_name,
          subject_name: input.subject_name || input.course_name,
        }
      : {}),
    ...(input.submission_url || input.submission_link
      ? {
          submission_url: input.submission_url || input.submission_link,
          submission_link: input.submission_link || input.submission_url,
        }
      : {}),
    ...(input.reminders_sent ? { reminders_sent: input.reminders_sent } : {}),
    ...(input.notification_tracker ? { notification_tracker: input.notification_tracker } : {}),
    ...(typeof input.is_archived === "boolean" ? { is_archived: input.is_archived } : {}),
  });

  if (oldData && oldData.type === "acara" && oldData.event_id) {
    await recalculateEventProgress(oldData.event_id);
  }
  if (input.type === "acara" && input.event_id && input.event_id !== oldData?.event_id) {
    await recalculateEventProgress(input.event_id);
  }
}

export async function archiveTask(
  taskId: string,
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const oldDoc = await getDoc(doc(db, "tasks", taskId));
  const oldData = oldDoc.exists() ? (oldDoc.data() as Task) : null;

  if (oldData) {
    const existingOrg =
      oldData.organization_id ||
      oldData.org_id ||
      (oldData as unknown as Record<string, unknown>).orgId;
    const existingCampus =
      oldData.campus_id ||
      oldData.univ_id ||
      (oldData as unknown as Record<string, unknown>).univId ||
      (oldData as unknown as Record<string, unknown>).campusId;

    if (workspaceFilter?.org_id && existingOrg && workspaceFilter.org_id !== existingOrg) {
      throw new Error("Akses ditolak: Tidak dapat mengarsipkan tugas milik organisasi/ormawa lain.");
    }
    if (workspaceFilter?.campus_id && existingCampus && workspaceFilter.campus_id !== existingCampus) {
      throw new Error("Akses ditolak: Tidak dapat mengarsipkan tugas milik kampus lain.");
    }
  }

  await updateDoc(doc(db, "tasks", taskId), {
    is_archived: true,
    updated_at: serverTimestamp(),
  });

  if (oldData && oldData.type === "acara" && oldData.event_id) {
    await recalculateEventProgress(oldData.event_id);
  }
}

export async function unarchiveTask(
  taskId: string,
  newDeadline?: string,
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const oldDoc = await getDoc(doc(db, "tasks", taskId));
  const oldData = oldDoc.exists() ? (oldDoc.data() as Task) : null;

  if (oldData) {
    const existingOrg =
      oldData.organization_id ||
      oldData.org_id ||
      (oldData as unknown as Record<string, unknown>).orgId;
    const existingCampus =
      oldData.campus_id ||
      oldData.univ_id ||
      (oldData as unknown as Record<string, unknown>).univId ||
      (oldData as unknown as Record<string, unknown>).campusId;

    if (workspaceFilter?.org_id && existingOrg && workspaceFilter.org_id !== existingOrg) {
      throw new Error("Akses ditolak: Tidak dapat mengaktifkan tugas milik organisasi/ormawa lain.");
    }
    if (workspaceFilter?.campus_id && existingCampus && workspaceFilter.campus_id !== existingCampus) {
      throw new Error("Akses ditolak: Tidak dapat mengaktifkan tugas milik kampus lain.");
    }
  }

  const updatePayload: Record<string, unknown> = {
    is_archived: false,
    status: "belum_dimulai",
    updated_at: serverTimestamp(),
  };

  if (newDeadline) {
    updatePayload.deadline = dateToTimestamp(newDeadline);
  }

  await updateDoc(doc(db, "tasks", taskId), updatePayload);

  if (oldData && oldData.type === "acara" && oldData.event_id) {
    await recalculateEventProgress(oldData.event_id);
  }
}

export function formatTaskDate(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format((value as { toDate: () => Date }).toDate());
}

export function getTaskDateInputValue(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return "";
  }

  return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
}

function getMillis(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return 0;
  }

  return (value as { toDate: () => Date }).toDate().getTime();
}
