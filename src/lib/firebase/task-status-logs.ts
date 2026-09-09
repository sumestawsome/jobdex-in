import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Task, TaskStatus, TaskStatusLog } from "@/types";
import { recalculateEventProgress } from "./tasks";

export async function getTaskStatusLogs(taskId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "tasks", taskId, "status_logs"),
      orderBy("created_at", "desc"),
    ),
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as TaskStatusLog[];
}

export async function updateTaskStatusWithLog({
  task,
  toStatus,
  changedBy,
  note,
  stuckNotes,
}: {
  task: Task;
  toStatus: TaskStatus;
  changedBy: string;
  note: string;
  stuckNotes?: string;
}) {
  const taskRef = doc(db, "tasks", task.id);
  const logRef = doc(collection(db, "tasks", task.id, "status_logs"));
  const batch = writeBatch(db);
  const updatePayload: Record<string, unknown> = {
    status: toStatus,
    updated_at: serverTimestamp(),
  };

  if (toStatus === "stuck" || toStatus === "butuh_bantuan") {
    updatePayload.stuck_notes = stuckNotes ?? note;
  }

  const orgId = task.orgId || task.org_id || task.organization_id || "";
  const campusId = task.univId || task.univ_id || task.campus_id || task.campusId || "";

  batch.update(taskRef, updatePayload);
  batch.set(logRef, {
    id: logRef.id,
    task_id: task.id,
    organization_id: orgId,
    org_id: orgId,
    orgId: orgId,
    campus_id: campusId,
    campusId: campusId,
    univ_id: campusId,
    univId: campusId,
    from_status: task.status,
    to_status: toStatus,
    changed_by: changedBy,
    note,
    created_at: serverTimestamp(),
  });

  await batch.commit();

  if (task.type === "acara" && task.event_id) {
    await recalculateEventProgress(task.event_id);
  }
}

export async function requestTaskRevision({
  task,
  changedBy,
  revisionNotes,
}: {
  task: Task;
  changedBy: string;
  revisionNotes: string;
}) {
  const taskRef = doc(db, "tasks", task.id);
  const logRef = doc(collection(db, "tasks", task.id, "status_logs"));
  const batch = writeBatch(db);
  const orgId = task.orgId || task.org_id || task.organization_id || "";
  const campusId = task.univId || task.univ_id || task.campus_id || task.campusId || "";

  batch.update(taskRef, {
    status: "perlu_revisi",
    approval_status: "need_revision",
    revision_notes: revisionNotes,
    updated_at: serverTimestamp(),
  });
  batch.set(logRef, {
    id: logRef.id,
    task_id: task.id,
    organization_id: orgId,
    org_id: orgId,
    orgId: orgId,
    campus_id: campusId,
    campusId: campusId,
    univ_id: campusId,
    univId: campusId,
    from_status: task.status,
    to_status: "perlu_revisi",
    changed_by: changedBy,
    note: revisionNotes,
    created_at: serverTimestamp(),
  });

  await batch.commit();

  if (task.type === "acara" && task.event_id) {
    await recalculateEventProgress(task.event_id);
  }
}

export async function approveTask({
  task,
  changedBy,
}: {
  task: Task;
  changedBy: string;
}) {
  const taskRef = doc(db, "tasks", task.id);
  const logRef = doc(collection(db, "tasks", task.id, "status_logs"));
  const batch = writeBatch(db);
  const orgId = task.orgId || task.org_id || task.organization_id || "";
  const campusId = task.univId || task.univ_id || task.campus_id || task.campusId || "";

  batch.update(taskRef, {
    status: "approved",
    approval_status: "approved",
    approved_by: changedBy,
    approved_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  batch.set(logRef, {
    id: logRef.id,
    task_id: task.id,
    organization_id: orgId,
    org_id: orgId,
    orgId: orgId,
    campus_id: campusId,
    campusId: campusId,
    univ_id: campusId,
    univId: campusId,
    from_status: task.status,
    to_status: "approved",
    changed_by: changedBy,
    note: "Task disetujui.",
    created_at: serverTimestamp(),
  });

  await batch.commit();

  if (task.type === "acara" && task.event_id) {
    await recalculateEventProgress(task.event_id);
  }
}

export async function appendTaskStatusLog({
  task,
  toStatus,
  changedBy,
  note,
}: {
  task: Task;
  toStatus: TaskStatus;
  changedBy: string;
  note: string;
}) {
  const orgId = task.orgId || task.org_id || task.organization_id || "";
  const campusId = task.univId || task.univ_id || task.campus_id || task.campusId || "";

  await addDoc(collection(db, "tasks", task.id, "status_logs"), {
    task_id: task.id,
    organization_id: orgId,
    org_id: orgId,
    orgId: orgId,
    campus_id: campusId,
    campusId: campusId,
    univ_id: campusId,
    univId: campusId,
    from_status: task.status,
    to_status: toStatus,
    changed_by: changedBy,
    note,
    created_at: serverTimestamp(),
  });
}

export async function updateTaskStatusOnly(
  taskId: string,
  toStatus: TaskStatus,
) {
  const taskRef = doc(db, "tasks", taskId);
  const taskSnap = await getDoc(taskRef);
  const taskData = taskSnap.exists() ? taskSnap.data() : null;

  await updateDoc(taskRef, {
    status: toStatus,
    updated_at: serverTimestamp(),
  });

  if (taskData && taskData.type === "acara" && taskData.event_id) {
    await recalculateEventProgress(taskData.event_id);
  }
}
