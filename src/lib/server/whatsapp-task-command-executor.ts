import "server-only";

import { FieldValue, getAdminDb } from "@/lib/server/firebase-admin";
import type { Task, UserProfile, TaskCandidate, TaskEditPreview, Event } from "@/types";
import { getTaskDeadlineDiffDays, getRiskLevelFromTask, getRiskLabel } from "@/lib/task-risk";
import { parseIndonesianDate, validateCommandPin, sanitizePinFromMessage, recalculateEventProgressAdmin } from "./whatsapp-command-executor";
import { USER_ROLE_LABELS } from "@/lib/roles";
import { WA_LABEL, WA_BOT_LABEL } from "@/lib/server/whatsapp-labels";


export { validateCommandPin, sanitizePinFromMessage };

/**
 * Validates permission of a user for a specific action on a task
 */
export function validateTaskPermission(
  user: UserProfile,
  task: Task,
  action: "approve" | "update_status" | "edit" | "archive" | "checklist" | "upload_hasil" | "tambah_catatan" | "view" | "ganti_pic" | "revisi"
): boolean {
  if (user.role === "super_admin") return true;

  if (user.role === "koordinator_divisi") {
    return task.type === "divisi" && task.division_id === user.division_id;
  }

  if (user.role === "koordinator_acara") {
    return task.type === "acara" && task.coordinator_id === user.id;
  }

  if (user.role === "anggota") {
    const isPic = task.pic_id === user.id;
    if (isPic) {
      return (
        action === "update_status" ||
        action === "checklist" ||
        action === "upload_hasil" ||
        action === "tambah_catatan" ||
        action === "view"
      );
    }
  }

  return false;
}

/**
 * Standard access denied response helper
 */
function getAccessDeniedMessage(user: UserProfile): string {
  const roleLabel = USER_ROLE_LABELS[user.role] || user.role;
  return [
    WA_LABEL.accessDenied,
    "",
    `Kamu terdeteksi sebagai: ${user.name} (${roleLabel})`,
    "Aksi ini tidak diizinkan untuk role kamu atau task ini bukan dalam cakupan akses kamu."
  ].join("\n");
}

/**
 * Fuzzy search for a user by name, returning unique match or candidates
 */
async function findUserByNameFuzzy(
  name: string
): Promise<{ user: UserProfile | null; candidates: UserProfile[] }> {
  const cleanName = name.toLowerCase().trim();
  const db = getAdminDb();
  const usersSnap = await db.collection("users").get();
  const matched: UserProfile[] = [];

  usersSnap.forEach((doc) => {
    const u = doc.data() as UserProfile;
    if (u.name.toLowerCase().includes(cleanName)) {
      matched.push({ ...u, id: doc.id });
    }
  });

  if (matched.length === 1) {
    return { user: matched[0], candidates: [] };
  }
  return { user: null, candidates: matched };
}





/**
 * Programmatic Deadline and Task Risk queries
 */
export async function handleDeadlineQuery(queryType: string, user: UserProfile): Promise<string> {
  const db = getAdminDb();

  try {
    const tasksSnap = await db
      .collection("tasks")
      .where("is_archived", "==", false)
      .get();

    const usersSnap = await db.collection("users").get();
    const eventsSnap = await db.collection("events").get();
    const divisionsSnap = await db.collection("divisions").get();

    const usersMap = new Map<string, string>();
    usersSnap.forEach((d) => usersMap.set(d.id, d.data().name || "-"));

    const eventsMap = new Map<string, string>();
    eventsSnap.forEach((d) => eventsMap.set(d.id, d.data().name || "-"));

    const divisionsMap = new Map<string, string>();
    divisionsSnap.forEach((d) => divisionsMap.set(d.id, d.data().name || "-"));

    const activeTasks: Task[] = [];
    tasksSnap.forEach((doc) => {
      const data = doc.data() as Task;
      if (data.status !== "approved") {
        activeTasks.push({ ...data, id: doc.id });
      }
    });

    // === FIX A: Scope filter berdasarkan role user ===
    const scopedTasks = activeTasks.filter((task) => {
      if (user.role === "super_admin") return true;
      if (user.role === "koordinator_divisi") {
        return task.type === "divisi" && task.division_id === user.division_id;
      }
      if (user.role === "koordinator_acara") {
        return task.type === "acara" && task.coordinator_id === user.id;
      }
      // anggota: hanya task yang ia jadi PIC
      return task.pic_id === user.id;
    });

    // Filter tasks based on queryType
    const filtered = scopedTasks.filter((task) => {
      const diffDays = getTaskDeadlineDiffDays(task);
      const risk = getRiskLevelFromTask(task);

      switch (queryType) {
        case "dekat":
          return diffDays >= 0 && diffDays <= 5;
        case "h-7":
          return diffDays === 7;
        case "h-5":
          return diffDays === 5;
        case "h-3":
          return diffDays === 3;
        case "h-1":
          return diffDays === 1;
        case "hari_ini":
          return diffDays === 0;
        case "overdue":
          return diffDays < 0;
        case "belum_dimulai":
          return task.status === "belum_dimulai";
        case "stuck":
          return task.status === "stuck";
        case "butuh_bantuan":
          return task.status === "butuh_bantuan";
        case "menunggu_materi":
          return task.status === "menunggu_materi";
        case "menunggu_approval":
          return task.status === "menunggu_approval";
        case "berisiko":
          return risk === "yellow" || risk === "orange" || risk === "red";
        case "kritis":
          return risk === "red";
        case "prioritas_tinggi":
          return task.priority === "tinggi" || task.priority === "kritis";
        default:
          return false;
      }
    });

    if (filtered.length === 0) {
      // Pesan ramah sesuai role
      const emptyMsg =
        user.role === "anggota"
          ? "Saya hanya menampilkan tugas yang menjadi tanggung jawab kamu.\n\nBelum ada tugas kamu yang masuk kategori ini."
          : "Tidak ada tugas berisiko untuk kategori ini dalam cakupan kamu.";
      return [WA_LABEL.deadline, "", emptyMsg].join("\n");
    }

    // Sort by severity (red first, orange, yellow, then none)
    const severityWeight = { red: 3, orange: 2, yellow: 1, none: 0 };
    filtered.sort((a, b) => {
      const riskA = getRiskLevelFromTask(a);
      const riskB = getRiskLevelFromTask(b);
      return severityWeight[riskB] - severityWeight[riskA];
    });

    // Batasi output panjang ke 10 task teratas
    const displayedTasks = filtered.slice(0, 10);
    const totalCount = filtered.length;

    const lines = [
      WA_LABEL.deadline,
      "",
      `Ditemukan ${totalCount} tugas${totalCount > 10 ? " (menampilkan 10 teratas)" : ""}:`,
      ""
    ];

    displayedTasks.forEach((task, index) => {
      const picName = usersMap.get(task.pic_id) || "Tidak ada";
      const divisionOrEvent =
        task.type === "acara" && task.event_id
          ? eventsMap.get(task.event_id)
          : task.division_id
          ? divisionsMap.get(task.division_id)
          : "-";

      const diffDays = getTaskDeadlineDiffDays(task);
      const risk = getRiskLevelFromTask(task);
      const riskLabel = getRiskLabel(risk, task);

      let deadlineStr = "-";
      if (task.deadline) {
        const d =
          task.deadline && typeof task.deadline === "object" && "toDate" in task.deadline
            ? (task.deadline as { toDate: () => Date }).toDate()
            : task.deadline instanceof Date
            ? task.deadline
            : new Date(task.deadline as string);
        deadlineStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      }

      let riskBadge = `${riskLabel}`;
      if (diffDays < 0) riskBadge += ` / Overdue`;
      else if (diffDays === 0) riskBadge += ` / Hari Ini`;
      else riskBadge += ` / H-${diffDays}`;

      lines.push(`${index + 1}. ${task.name}`);
      lines.push(`   PIC: ${picName}`);
      lines.push(`   Deadline: ${deadlineStr}`);
      lines.push(`   Acara/Divisi: ${divisionOrEvent || "-"}`);
      lines.push(`   Status: ${getFormattedStatus(task.status)}`);
      lines.push(`   Prioritas: ${getFormattedPriority(task.priority)}`);
      lines.push(`   Risk: ${riskBadge}`);
      lines.push("");
    });

    if (totalCount > 10) {
      lines.push(`...dan ${totalCount - 10} tugas lainnya. Buka dashboard JobdexIn untuk detail lengkap.`);
    }

    return lines.join("\n").trim();
  } catch (error) {
    console.error("[Deadline Query] Failed:", error);
    return `${WA_LABEL.deadline}\n\nGagal memproses pencarian deadline.`;
  }
}

/**
 * Code generator for uniquely identifying ambiguous candidate tasks
 */
function generateCandidateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "TSK";
  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Searches for a task or handles candidate lookup if code matches
 */
export async function findTaskCandidates(
  taskNameOrCode: string,
  isCode: boolean,
  commandType: "approve" | "update_status" | "edit" | "archive" | "checklist" | "detail" | "upload_hasil" | "minta_revisi" | "cek_checklist" | "tambah_catatan" | "ganti_pic",
  userId: string,
  extraPayload?: Record<string, unknown> | null
): Promise<{ tasks: Task[]; candidateMessage?: string }> {
  const db = getAdminDb();

  if (isCode) {
    const code = taskNameOrCode.toUpperCase().trim();
    const candidateSnap = await db
      .collection("whatsapp_task_candidates")
      .where("code", "==", code)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (candidateSnap.empty) {
      return { tasks: [] };
    }

    const candidateDoc = candidateSnap.docs[0];
    const candidateData = candidateDoc.data() as TaskCandidate;

    // Check expiration (15 minutes)
    const expiresAt =
      candidateData.expires_at && typeof candidateData.expires_at === "object" && "toDate" in candidateData.expires_at
        ? (candidateData.expires_at as { toDate: () => Date }).toDate()
        : new Date(candidateData.expires_at as string);

    if (expiresAt.getTime() < Date.now()) {
      await candidateDoc.ref.update({ status: "expired" });
      return { tasks: [] };
    }

    // Mark as used
    await candidateDoc.ref.update({ status: "used" });

    const taskDoc = await db.collection("tasks").doc(candidateData.task_id).get();
    if (!taskDoc.exists) {
      return { tasks: [] };
    }

    return { tasks: [{ ...taskDoc.data(), id: taskDoc.id } as Task] };
  }

  // Else, query by fuzzy task name (case-insensitive substring)
  const tasksSnap = await db
    .collection("tasks")
    .where("is_archived", "==", false)
    .get();

  const queryClean = taskNameOrCode.toLowerCase().trim();
  const matched: Task[] = [];

  tasksSnap.forEach((doc) => {
    const data = doc.data() as Task;
    if (data.name.toLowerCase().includes(queryClean)) {
      matched.push({ ...data, id: doc.id });
    }
  });

  if (matched.length === 0) {
    return { tasks: [] };
  }

  if (matched.length === 1) {
    return { tasks: matched };
  }

  // Ambiguous: matched.length > 1
  // Create candidate codes for each match
  const lines = [
    WA_LABEL.task,
    "",
    "Ditemukan beberapa task mirip:",
    ""
  ];

  const batch = db.batch();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  for (let i = 0; i < matched.length; i++) {
    const task = matched[i];
    const code = generateCandidateCode() + i; // Append index to avoid exact same random code clash

    const candidateRef = db.collection("whatsapp_task_candidates").doc();
    batch.set(candidateRef, {
      id: candidateRef.id,
      code,
      task_id: task.id,
      task_title: task.name,
      command_type: commandType,
      created_at: FieldValue.serverTimestamp(),
      expires_at: expiresAt,
      status: "pending",
      requested_by_user_id: userId,
      payload: extraPayload || null
    });

    lines.push(`${i + 1}. ${task.name}`);
    lines.push(`   Kode: ${code}`);
    lines.push("");
  }

  await batch.commit();

  // Print helpful guidance instructions
  lines.push("Gunakan:");
  if (commandType === "approve") {
    lines.push(`!jobdex approve kode [KODE]`);
  } else if (commandType === "update_status") {
    const statusLabel = extraPayload?.statusText || "sedang dikerjakan";
    const notesStr = extraPayload?.notes ? ` catatan: ${extraPayload.notes}` : "";
    lines.push(`!jobdex update status kode [KODE] menjadi ${statusLabel}${notesStr}`);
  } else if (commandType === "edit") {
    lines.push(`!jobdex edit kode [KODE]\n[parameter]`);
  } else if (commandType === "archive") {
    lines.push(`!jobdex archive kode [KODE]`);
  } else if (commandType === "checklist") {
    const itemLabel = extraPayload?.item || "redaksi";
    lines.push(`!jobdex checklist kode [KODE] ${itemLabel} selesai`);
  } else if (commandType === "detail") {
    lines.push(`!jobdex detail task kode [KODE]`);
  } else if (commandType === "upload_hasil") {
    lines.push(`!jobdex upload hasil kode [KODE]\nlink: [URL]\ncatatan: [CATATAN]`);
  } else if (commandType === "minta_revisi") {
    lines.push(`!jobdex minta revisi kode [KODE]\ncatatan: [CATATAN]`);
  } else if (commandType === "cek_checklist") {
    lines.push(`!jobdex cek checklist kode [KODE]`);
  } else if (commandType === "tambah_catatan") {
    lines.push(`!jobdex tambah catatan kode [KODE]\ncatatan: [CATATAN]`);
  } else if (commandType === "ganti_pic") {
    const picName = extraPayload?.pic_name || "[NAMA]";
    lines.push(`!jobdex ganti pic kode [KODE] ke ${picName}`);
  }

  return {
    tasks: matched,
    candidateMessage: lines.join("\n").trim()
  };
}

/**
 * Approve task via WhatsApp with PIN
 */
export async function handleApproveTaskCommand(
  taskNameOrCode: string,
  user: UserProfile,
  isCode: boolean
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const { tasks, candidateMessage } = await findTaskCandidates(
      taskNameOrCode,
      isCode,
      "approve",
      user.id
    );

    if (candidateMessage) {
      const cleanMessage = candidateMessage.replace(/\s+pin\s*:?\s*\[PIN\]/gi, "");
      return { success: true, replyText: cleanMessage };
    }

    if (tasks.length === 0) {
      return { success: false, replyText: `${WA_LABEL.approval}\n\nTugas tidak ditemukan atau kode kandidat kadaluwarsa.` };
    }

    const task = tasks[0];

    // Validate permission
    const allowed = validateTaskPermission(user, task, "approve");
    if (!allowed) {
      return { success: false, replyText: getAccessDeniedMessage(user) };
    }

    const db = getAdminDb();
    
    // Update task
    await db.collection("tasks").doc(task.id).update({
      status: "approved",
      approval_status: "approved",
      approved_by: user.id,
      approved_by_name: user.name,
      approved_by_role: user.role,
      approved_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    });

    // Create status log
    const taskOrgId = (task as any).orgId || (task as any).org_id || task.organization_id || "";
    const taskCampusId = (task as any).univId || (task as any).campus_id || (task as any).univ_id || (task as any).campusId || "";
    const logRef = db.collection("tasks").doc(task.id).collection("status_logs").doc();
    await logRef.set({
      id: logRef.id,
      task_id: task.id,
      organization_id: taskOrgId,
      org_id: taskOrgId,
      orgId: taskOrgId,
      campus_id: taskCampusId,
      campusId: taskCampusId,
      univ_id: taskCampusId,
      univId: taskCampusId,
      from_status: task.status,
      to_status: "approved",
      changed_by: user.id,
      changed_by_name: user.name,
      changed_by_role: user.role,
      source: "whatsapp_command",
      note: `Approved via WhatsApp command oleh ${user.name} (${user.role})`,
      created_at: FieldValue.serverTimestamp()
    });

    const timeStr = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    return {
      success: true,
      replyText: [
        WA_LABEL.approval,
        "",
        "Task berhasil di-approve.",
        "",
        `Tugas: ${task.name}`,
        `PIC: ${task.pic_id ? (await getUsernameById(task.pic_id)) : "-"}`,
        `Approved oleh: ${user.name}`,
        `Waktu: ${timeStr} WITA`
      ].join("\n"),
      taskId: task.id,
      taskName: task.name
    };
  } catch (error) {
    console.error("[Approve Command] Error:", error);
    return { success: false, replyText: `${WA_LABEL.approval}\n\nGagal memproses persetujuan tugas.` };
  }
}

/**
 * Update task status via WhatsApp with PIN and Catatan
 */
export async function handleUpdateTaskStatusCommand(
  taskNameOrCode: string,
  user: UserProfile,
  isCode: boolean,
  statusText: string,
  notes: string
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const statusEnum = normalizeStatusFromText(statusText);
    if (!statusEnum) {
      return {
        success: false,
        replyText: [
          WA_LABEL.status,
          "",
          "Format status tidak dikenali.",
          "",
          "Pilih salah satu status yang didukung:",
          "- belum dimulai",
          "- sedang dikerjakan",
          "- butuh bantuan",
          "- stuck",
          "- menunggu materi",
          "- draft selesai",
          "- perlu revisi",
          "- revisi dikerjakan",
          "- menunggu approval",
          "- approve / approved / acc",
          "- ditunda"
        ].join("\n")
      };
    }

    // Stuck, butuh bantuan, waiting material requires notes!
    if ((statusEnum === "stuck" || statusEnum === "butuh_bantuan" || statusEnum === "menunggu_materi") && !notes.trim()) {
      return {
        success: false,
        replyText: `${WA_LABEL.status}\n\nCatatan wajib diisi untuk status "stuck", "butuh bantuan", atau "menunggu materi".`
      };
    }

    const { tasks, candidateMessage } = await findTaskCandidates(
      taskNameOrCode,
      isCode,
      "update_status",
      user.id,
      { statusText, notes }
    );

    if (candidateMessage) {
      const cleanMessage = candidateMessage.replace(/\s+pin\s*:?\s*\[PIN\]/gi, "");
      return { success: true, replyText: cleanMessage };
    }

    if (tasks.length === 0) {
      return { success: false, replyText: `${WA_LABEL.status}\n\nTugas tidak ditemukan atau kode kandidat kadaluwarsa.` };
    }

    const task = tasks[0];

    // Validate permission
    const allowed = validateTaskPermission(user, task, "update_status");
    if (!allowed) {
      return { success: false, replyText: getAccessDeniedMessage(user) };
    }

    const db = getAdminDb();

    // Prepare update parameters
    const updateParams: Record<string, unknown> = {
      status: statusEnum,
      updated_at: FieldValue.serverTimestamp()
    };

    if (statusEnum === "stuck") {
      updateParams.stuck_notes = notes;
    } else if (statusEnum === "butuh_bantuan" || statusEnum === "menunggu_materi") {
      updateParams.stuck_notes = notes; // save to general stuck notes
    } else if (statusEnum === "approved") {
      updateParams.approval_status = "approved";
      updateParams.approved_by = user.id;
      updateParams.approved_by_name = user.name;
      updateParams.approved_by_role = user.role;
      updateParams.approved_at = FieldValue.serverTimestamp();
    }

    // Update task
    await db.collection("tasks").doc(task.id).update(updateParams);

    // Create status log
    const taskOrgId = (task as any).orgId || (task as any).org_id || task.organization_id || "";
    const taskCampusId = (task as any).univId || (task as any).campus_id || (task as any).univ_id || (task as any).campusId || "";
    const logNote = notes ? `Update status via WhatsApp: ${notes}` : "Update status via WhatsApp command";
    const logRef = db.collection("tasks").doc(task.id).collection("status_logs").doc();
    await logRef.set({
      id: logRef.id,
      task_id: task.id,
      organization_id: taskOrgId,
      org_id: taskOrgId,
      orgId: taskOrgId,
      campus_id: taskCampusId,
      campusId: taskCampusId,
      univ_id: taskCampusId,
      univId: taskCampusId,
      from_status: task.status,
      to_status: statusEnum,
      changed_by: user.id,
      changed_by_name: user.name,
      changed_by_role: user.role,
      source: "whatsapp_command",
      note: logNote,
      created_at: FieldValue.serverTimestamp()
    });

    return {
      success: true,
      replyText: [
        WA_LABEL.status,
        "",
        "Status task berhasil diperbarui.",
        "",
        `Tugas: ${task.name}`,
        `Status baru: ${getFormattedStatus(statusEnum)}`,
        ...(notes ? [`Catatan: ${notes}`] : []),
        `Diperbarui oleh: ${user.name}`
      ].join("\n"),
      taskId: task.id,
      taskName: task.name
    };
  } catch (error) {
    console.error("[Update Status] Error:", error);
    return { success: false, replyText: `${WA_LABEL.status}\n\nGagal memperbarui status tugas.` };
  }
}

/**
 * Edit detail task command (generates EDT preview)
 */
export async function handleEditTaskCommand(
  taskNameOrCode: string,
  user: UserProfile,
  isCode: boolean,
  parsedFields: Record<string, string>
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const { tasks, candidateMessage } = await findTaskCandidates(
      taskNameOrCode,
      isCode,
      "edit",
      user.id,
      parsedFields
    );

    if (candidateMessage) {
      const cleanMessage = candidateMessage.replace(/\s+pin\s*:?\s*\[PIN\]/gi, "");
      return { success: true, replyText: cleanMessage };
    }

    if (tasks.length === 0) {
      return { success: false, replyText: `${WA_LABEL.editTask}\n\nTugas tidak ditemukan atau kode kandidat kadaluwarsa.` };
    }

    const task = tasks[0];

    // Validate permission (PIC/Anggota is restricted from editing main fields!)
    const allowed = validateTaskPermission(user, task, "edit");
    if (!allowed) {
      return { success: false, replyText: getAccessDeniedMessage(user) };
    }

    const db = getAdminDb();
    
    // Resolve fields and changes
    const changes: Record<string, unknown> = {};
    const oldValues: Record<string, unknown> = {};
    const comparisons: string[] = [];

    // 1. pic
    if (parsedFields.pic) {
      const picUser = await findUserByName(parsedFields.pic);
      if (!picUser) {
        return { success: false, replyText: `${WA_LABEL.editTask}\nAnggota PIC "${parsedFields.pic}" tidak ditemukan.` };
      }
      if (task.pic_id !== picUser.id) {
        changes.pic_id = picUser.id;
        oldValues.pic_id = task.pic_id;
        const oldPicName = task.pic_id ? (await getUsernameById(task.pic_id)) : "-";
        comparisons.push(`- PIC: ${oldPicName} → ${picUser.name}`);
      }
    }

    // 2. deadline
    if (parsedFields.deadline) {
      const deadlineDate = parseIndonesianDate(parsedFields.deadline);
      const oldDeadlineDate =
        task.deadline && typeof task.deadline === "object" && "toDate" in task.deadline
          ? (task.deadline as { toDate: () => Date }).toDate()
          : task.deadline instanceof Date
          ? task.deadline
          : task.deadline ? new Date(task.deadline as string) : null;

      const formattedNew = deadlineDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      const formattedOld = oldDeadlineDate
        ? oldDeadlineDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
        : "-";

      if (!oldDeadlineDate || Math.abs(deadlineDate.getTime() - oldDeadlineDate.getTime()) > 1000 * 60 * 60) {
        changes.deadline = deadlineDate;
        oldValues.deadline = task.deadline || null;
        comparisons.push(`- Deadline: ${formattedOld} → ${formattedNew}`);
      }
    }

    // 3. priority / prioritas
    const prioInput = parsedFields.prioritas || parsedFields.priority;
    if (prioInput) {
      const cleanPrio = normalizePriority(prioInput);
      if (!cleanPrio) {
        return { success: false, replyText: `${WA_LABEL.editTask}\nPrioritas tidak valid (Rendah, Sedang, Tinggi, Kritis).` };
      }
      if (task.priority !== cleanPrio) {
        changes.priority = cleanPrio;
        oldValues.priority = task.priority;
        comparisons.push(`- Prioritas: ${getFormattedPriority(task.priority)} → ${getFormattedPriority(cleanPrio)}`);
      }
    }

    // 4. name / judul
    const nameInput = parsedFields.judul || parsedFields.name;
    if (nameInput && nameInput.trim()) {
      const cleanName = nameInput.trim();
      if (task.name !== cleanName) {
        changes.name = cleanName;
        oldValues.name = task.name;
        comparisons.push(`- Judul: ${task.name} → ${cleanName}`);
      }
    }

    // 5. description / deskripsi
    const descInput = parsedFields.deskripsi || parsedFields.description;
    if (descInput !== undefined) {
      const cleanDesc = descInput.trim();
      if (task.description !== cleanDesc) {
        changes.description = cleanDesc;
        oldValues.description = task.description;
        comparisons.push(`- Deskripsi: ${task.description || "-"} → ${cleanDesc || "-"}`);
      }
    }

    // 6. copywriting / redaksi
    const copyInput = parsedFields.redaksi || parsedFields.copywriting;
    if (copyInput !== undefined) {
      const cleanCopy = copyInput.trim();
      if (task.copywriting !== cleanCopy) {
        changes.copywriting = cleanCopy;
        oldValues.copywriting = task.copywriting;
        comparisons.push(`- Redaksi: ${task.copywriting ? "Lama" : "Kosong"} → ${cleanCopy ? "Baru" : "Kosong"}`);
      }
    }

    // 7. design_reference_url / referensi
    const refInput = parsedFields.referensi || parsedFields.design_reference_url;
    if (refInput !== undefined) {
      const cleanRef = refInput.trim();
      if (task.design_reference_url !== cleanRef) {
        changes.design_reference_url = cleanRef;
        oldValues.design_reference_url = task.design_reference_url;
        comparisons.push(`- Referensi: ${task.design_reference_url ? "Lama" : "Kosong"} → ${cleanRef ? "Baru" : "Kosong"}`);
      }
    }

    // 8. color_palette / warna
    const colorInput = parsedFields.warna || parsedFields.color_palette;
    if (colorInput !== undefined) {
      const cleanColors = colorInput.split(/[\s,]+/).map((c) => c.trim()).filter(Boolean);
      const isDifferent =
        !task.color_palette ||
        task.color_palette.length !== cleanColors.length ||
        cleanColors.some((c) => !task.color_palette.includes(c));

      if (isDifferent) {
        changes.color_palette = cleanColors;
        oldValues.color_palette = task.color_palette || [];
        comparisons.push(`- Warna: ${task.color_palette ? task.color_palette.join(", ") : "-"} → ${cleanColors.join(", ")}`);
      }
    }

    // 9. visual_direction / arahan visual
    const visualInput = parsedFields.arahan_visual || parsedFields.visual_direction;
    if (visualInput !== undefined) {
      const cleanVisual = visualInput.trim();
      if (task.visual_direction !== cleanVisual) {
        changes.visual_direction = cleanVisual;
        oldValues.visual_direction = task.visual_direction;
        comparisons.push(`- Arahan Visual: ${task.visual_direction || "-"} → ${cleanVisual || "-"}`);
      }
    }

    if (Object.keys(changes).length === 0) {
      return { success: true, replyText: `${WA_LABEL.editTask}\n\nTidak ada perubahan detail yang terdeteksi.` };
    }

    // Generate EDT preview
    const edtCode = "EDT" + generateRandomCode(3);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

    const previewRef = db.collection("whatsapp_task_edit_previews").doc();
    await previewRef.set({
      id: previewRef.id,
      code: edtCode,
      task_id: task.id,
      task_title: task.name,
      action_type: "edit_task",
      changes,
      old_values: oldValues,
      requested_by: user.id,
      requested_by_name: user.name,
      created_at: FieldValue.serverTimestamp(),
      expires_at: expiresAt,
      status: "pending",
      raw_message_sanitized: sanitizePinFromMessage(parsedFields.rawText || "")
    });

    return {
      success: true,
      replyText: [
        WA_LABEL.previewEditTask,
        "",
        "Saya menemukan task:",
        task.name,
        "",
        "Perubahan yang akan diterapkan:",
        ...comparisons,
        "",
        `Kode Edit: ${edtCode}`,
        "",
        "Untuk menyimpan perubahan, balas:",
        `!jobdex konfirmasi edit ${edtCode}`,
        "",
        "Untuk membatalkan:",
        `!jobdex batal edit ${edtCode}`
      ].join("\n"),
      taskId: task.id,
      taskName: task.name
    };
  } catch (error) {
    console.error("[Edit Task Command] Error:", error);
    return { success: false, replyText: `${WA_LABEL.editTask}\n\nGagal memproses draf perubahan detail tugas.` };
  }
}

/**
 * Confirm edit preview task (saves changes to Firestore)
 */
export async function handleConfirmEditTaskCommand(
  code: string,
  user: UserProfile
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const db = getAdminDb();
    const previewSnap = await db
      .collection("whatsapp_task_edit_previews")
      .where("code", "==", code)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (previewSnap.empty) {
      return { success: false, replyText: `${WA_LABEL.confirmEdit}\n\nKode edit tidak ditemukan atau sudah diproses.` };
    }

    const previewDoc = previewSnap.docs[0];
    const previewData = previewDoc.data() as TaskEditPreview;

    const expiresAt =
      previewData.expires_at && typeof previewData.expires_at === "object" && "toDate" in previewData.expires_at
        ? (previewData.expires_at as { toDate: () => Date }).toDate()
        : new Date(previewData.expires_at as string);

    if (expiresAt.getTime() < Date.now()) {
      await previewDoc.ref.update({ status: "expired" });
      return { success: false, replyText: `${WA_LABEL.confirmEdit}\n\nKode edit telah kadaluwarsa (batas 30 menit).` };
    }

    const taskDoc = await db.collection("tasks").doc(previewData.task_id).get();
    if (!taskDoc.exists) {
      return { success: false, replyText: `${WA_LABEL.confirmEdit}\n\nTugas asli tidak ditemukan di database.` };
    }

    const task = { ...taskDoc.data(), id: taskDoc.id } as Task;

    // === FIX C: Validasi ownership preview ===
    if (previewData.requested_by && previewData.requested_by !== user.id && user.role !== "super_admin") {
      return {
        success: false,
        replyText: [
          WA_LABEL.accessDenied,
          "",
          "Preview ID ini dibuat oleh pengguna lain, sehingga tidak bisa kamu konfirmasi.",
          "",
          "Minta pembuat preview untuk mengonfirmasi sendiri, atau hubungi super admin."
        ].join("\n")
      };
    }

    // Permissions check
    const allowed = validateTaskPermission(user, task, "edit");
    if (!allowed) {
      return { success: false, replyText: getAccessDeniedMessage(user) };
    }

    // Apply changes
    const updates = { ...previewData.changes };
    updates.updated_at = FieldValue.serverTimestamp();

    await taskDoc.ref.update(updates);
    await previewDoc.ref.update({ status: "confirmed" });

    // Append status log
    const changedFields = Object.keys(previewData.changes).join(", ");
    const logRef = taskDoc.ref.collection("status_logs").doc();
    await logRef.set({
      id: logRef.id,
      task_id: task.id,
      from_status: task.status,
      to_status: task.status,
      changed_by: user.id,
      changed_by_name: user.name,
      changed_by_role: user.role,
      source: "whatsapp_command",
      note: `Detail task diubah via WhatsApp (${changedFields})`,
      created_at: FieldValue.serverTimestamp()
    });

    return {
      success: true,
      replyText: [
        WA_LABEL.confirmEdit,
        "",
        "Perubahan tugas berhasil disimpan.",
        "",
        `Tugas: ${task.name}`,
        `Disimpan oleh: ${user.name}`
      ].join("\n"),
      taskId: task.id,
      taskName: task.name
    };
  } catch (error) {
    console.error("[Confirm Edit] Error:", error);
    return { success: false, replyText: `${WA_LABEL.confirmEdit}\n\nGagal menyelesaikan konfirmasi perubahan tugas.` };
  }
}

/**
 * Cancel edit preview task
 */
export async function handleCancelEditTaskCommand(
  code: string,
  user: UserProfile
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const db = getAdminDb();
    console.log(`[Cancel Edit] Code ${code} cancelled by user ${user.id}`);
    const previewSnap = await db
      .collection("whatsapp_task_edit_previews")
      .where("code", "==", code)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (previewSnap.empty) {
      return { success: false, replyText: `${WA_LABEL.cancelEdit}\n\nKode edit tidak ditemukan atau sudah diproses.` };
    }

    const previewDoc = previewSnap.docs[0];
    const previewData = previewDoc.data() as TaskEditPreview;
    await previewDoc.ref.update({ status: "cancelled" });

    return {
      success: true,
      replyText: `${WA_LABEL.cancelEdit}\nDraf perubahan detail tugas (${code}) berhasil dibatalkan.`,
      taskId: previewData.task_id,
      taskName: previewData.task_title
    };
  } catch (error) {
    console.error("[Cancel Edit] Error:", error);
    return { success: false, replyText: `${WA_LABEL.cancelEdit}\n\nGagal membatalkan draf perubahan tugas.` };
  }
}

/**
 * Archive task command (generates ARC preview)
 */
export async function handleArchiveTaskCommand(
  taskNameOrCode: string,
  user: UserProfile,
  isCode: boolean
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const { tasks, candidateMessage } = await findTaskCandidates(
      taskNameOrCode,
      isCode,
      "archive",
      user.id
    );

    if (candidateMessage) {
      const cleanMessage = candidateMessage.replace(/\s+pin\s*:?\s*\[PIN\]/gi, "");
      return { success: true, replyText: cleanMessage };
    }

    if (tasks.length === 0) {
      return { success: false, replyText: `${WA_LABEL.archive}\n\nTugas tidak ditemukan atau kode kandidat kadaluwarsa.` };
    }

    const task = tasks[0];

    // Validate permission
    const allowed = validateTaskPermission(user, task, "archive");
    if (!allowed) {
      return { success: false, replyText: getAccessDeniedMessage(user) };
    }

    const db = getAdminDb();
    
    // Create ARC preview
    const arcCode = "ARC" + generateRandomCode(3);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

    const previewRef = db.collection("whatsapp_task_edit_previews").doc();
    await previewRef.set({
      id: previewRef.id,
      code: arcCode,
      task_id: task.id,
      task_title: task.name,
      action_type: "archive_task",
      changes: { is_archived: true },
      old_values: { is_archived: false },
      requested_by: user.id,
      requested_by_name: user.name,
      created_at: FieldValue.serverTimestamp(),
      expires_at: expiresAt,
      status: "pending",
      raw_message_sanitized: `archive task: ${task.name}`
    });

    return {
      success: true,
      replyText: [
        WA_LABEL.previewArchive,
        "",
        "Task ini akan diarsipkan:",
        task.name,
        "",
        `Kode: ${arcCode}`,
        "",
        "Konfirmasi:",
        `!jobdex konfirmasi archive ${arcCode}`
      ].join("\n"),
      taskId: task.id,
      taskName: task.name
    };
  } catch (error) {
    console.error("[Archive Command] Error:", error);
    return { success: false, replyText: `${WA_LABEL.archive}\n\nGagal memproses draf pengarsipan tugas.` };
  }
}

/**
 * Confirm archive task
 */
export async function handleConfirmArchiveCommand(
  code: string,
  user: UserProfile
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const db = getAdminDb();
    const previewSnap = await db
      .collection("whatsapp_task_edit_previews")
      .where("code", "==", code)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (previewSnap.empty) {
      return { success: false, replyText: `${WA_LABEL.confirmArchive}\n\nKode archive tidak ditemukan atau sudah diproses.` };
    }

    const previewDoc = previewSnap.docs[0];
    const previewData = previewDoc.data() as TaskEditPreview;

    const expiresAt =
      previewData.expires_at && typeof previewData.expires_at === "object" && "toDate" in previewData.expires_at
        ? (previewData.expires_at as { toDate: () => Date }).toDate()
        : new Date(previewData.expires_at as string);

    if (expiresAt.getTime() < Date.now()) {
      await previewDoc.ref.update({ status: "expired" });
      return { success: false, replyText: `${WA_LABEL.confirmArchive}\n\nKode archive telah kadaluwarsa (30 menit).` };
    }

    const taskDoc = await db.collection("tasks").doc(previewData.task_id).get();
    if (!taskDoc.exists) {
      return { success: false, replyText: `${WA_LABEL.confirmArchive}\n\nTugas asli tidak ditemukan di database.` };
    }

    const task = { ...taskDoc.data(), id: taskDoc.id } as Task;

    // === FIX C: Validasi ownership preview ===
    if (previewData.requested_by && previewData.requested_by !== user.id && user.role !== "super_admin") {
      return {
        success: false,
        replyText: [
          WA_LABEL.accessDenied,
          "",
          "Preview ID ini dibuat oleh pengguna lain, sehingga tidak bisa kamu konfirmasi.",
          "",
          "Minta pembuat preview untuk mengonfirmasi sendiri, atau hubungi super admin."
        ].join("\n")
      };
    }

    // Permissions check
    const allowed = validateTaskPermission(user, task, "archive");
    if (!allowed) {
      return { success: false, replyText: getAccessDeniedMessage(user) };
    }

    // Apply archive
    await taskDoc.ref.update({
      is_archived: true,
      updated_at: FieldValue.serverTimestamp()
    });

    await previewDoc.ref.update({ status: "confirmed" });

    // Append status log
    const logRef = taskDoc.ref.collection("status_logs").doc();
    await logRef.set({
      id: logRef.id,
      task_id: task.id,
      from_status: task.status,
      to_status: task.status,
      changed_by: user.id,
      changed_by_name: user.name,
      changed_by_role: user.role,
      source: "whatsapp_command",
      note: "Archived via WhatsApp command",
      created_at: FieldValue.serverTimestamp()
    });

    return {
      success: true,
      replyText: [
        WA_LABEL.confirmArchive,
        "",
        "Tugas berhasil diarsipkan.",
        "",
        `Tugas: ${task.name}`,
        `Diarsipkan oleh: ${user.name}`
      ].join("\n"),
      taskId: task.id,
      taskName: task.name
    };
  } catch (error) {
    console.error("[Confirm Archive] Error:", error);
    return { success: false, replyText: `${WA_LABEL.confirmArchive}\n\nGagal menyelesaikan konfirmasi pengarsipan.` };
  }
}

/**
 * Update checklist item status directly via WhatsApp with PIN
 */
export async function handleChecklistCommand(
  taskNameOrCode: string,
  user: UserProfile,
  isCode: boolean,
  itemKeyword: string
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const checklistMap: Record<string, string> = {
      redaksi: "Redaksi/materi tersedia",
      referensi: "Referensi desain tersedia",
      draft: "Mulai desain/draft awal",
      revisi: "Revisi internal",
      final: "Finalisasi desain",
      upload: "Upload hasil ke Drive"
    };

    const targetLabel = checklistMap[itemKeyword];
    if (!targetLabel) {
      return { success: false, replyText: `${WA_LABEL.checklist}\nItem checklist "${itemKeyword}" tidak valid. Pilih salah satu (redaksi, referensi, draft, revisi, final, upload).` };
    }

    const { tasks, candidateMessage } = await findTaskCandidates(
      taskNameOrCode,
      isCode,
      "checklist",
      user.id,
      { item: itemKeyword }
    );

    if (candidateMessage) {
      const cleanMessage = candidateMessage.replace(/\s+pin\s*:?\s*\[PIN\]/gi, "");
      return { success: true, replyText: cleanMessage };
    }

    if (tasks.length === 0) {
      return { success: false, replyText: `${WA_LABEL.checklist}\n\nTugas tidak ditemukan atau kode kandidat kadaluwarsa.` };
    }

    const task = tasks[0];

    // Validate permission
    const allowed = validateTaskPermission(user, task, "checklist");
    if (!allowed) {
      return { success: false, replyText: getAccessDeniedMessage(user) };
    }

    const checklistItems = task.checklist_items || [];
    const itemExists = checklistItems.some((i) => i.label === targetLabel);

    let updatedChecklist = [];
    if (!itemExists) {
      // If item does not exist, build default or add it
      const defaultChecklist = [
        { id: "checklist_1", label: "Redaksi/materi tersedia", is_done: false },
        { id: "checklist_2", label: "Referensi desain tersedia", is_done: false },
        { id: "checklist_3", label: "Mulai desain/draft awal", is_done: false },
        { id: "checklist_4", label: "Revisi internal", is_done: false },
        { id: "checklist_5", label: "Finalisasi desain", is_done: false },
        { id: "checklist_6", label: "Upload hasil ke Drive", is_done: false },
      ];

      updatedChecklist = defaultChecklist.map((item) => {
        if (item.label === targetLabel) {
          return {
            ...item,
            is_done: true,
            done_by: user.id,
            done_by_name: user.name,
            done_at: new Date()
          };
        }
        return item;
      });
    } else {
      updatedChecklist = checklistItems.map((item) => {
        if (item.label === targetLabel) {
          return {
            ...item,
            is_done: true,
            done_by: user.id,
            done_by_name: user.name,
            done_at: new Date()
          };
        }
        return item;
      });
    }

    const db = getAdminDb();

    // Update task
    await db.collection("tasks").doc(task.id).update({
      checklist_items: updatedChecklist,
      updated_at: FieldValue.serverTimestamp()
    });

    // Create status log
    const taskOrgId = (task as any).orgId || (task as any).org_id || task.organization_id || "";
    const taskCampusId = (task as any).univId || (task as any).campus_id || (task as any).univ_id || (task as any).campusId || "";
    const logRef = db.collection("tasks").doc(task.id).collection("status_logs").doc();
    await logRef.set({
      id: logRef.id,
      task_id: task.id,
      organization_id: taskOrgId,
      org_id: taskOrgId,
      orgId: taskOrgId,
      campus_id: taskCampusId,
      campusId: taskCampusId,
      univ_id: taskCampusId,
      univId: taskCampusId,
      from_status: task.status,
      to_status: task.status,
      changed_by: user.id,
      changed_by_name: user.name,
      changed_by_role: user.role,
      source: "whatsapp_command",
      note: `Checklist "${targetLabel}" ditandai selesai via WhatsApp.`,
      created_at: FieldValue.serverTimestamp()
    });

    return {
      success: true,
      replyText: [
        WA_LABEL.checklist,
        "",
        "Item checklist berhasil ditandai selesai.",
        "",
        `Tugas: ${task.name}`,
        `Item: ${targetLabel}`,
        `PIC/Penuntas: ${user.name}`
      ].join("\n"),
      taskId: task.id,
      taskName: task.name
    };
  } catch (error) {
    console.error("[Checklist Command] Error:", error);
    return { success: false, replyText: `${WA_LABEL.checklist}\n\nGagal menandai checklist tugas.` };
  }
}

/**
 * Natural language mapping for TaskStatus
 */
function normalizeStatusFromText(text: string): import("@/types").TaskStatus | null {
  const clean = text.toLowerCase().replace(/[\s\-_]+/g, " ").trim();
  
  if (clean.includes("belum mulai") || clean.includes("belum dimulai")) return "belum_dimulai";
  if (
    clean.includes("sedang dikerjakan") || 
    clean.includes("dikerjakan") || 
    clean.includes("kerja") ||
    clean.includes("mulai") ||
    clean.includes("on progress") ||
    clean.includes("proses") ||
    clean.includes("gas")
  ) {
    return "sedang_dikerjakan";
  }
  if (clean.includes("butuh bantuan") || clean.includes("bantuan")) return "butuh_bantuan";
  if (
    clean.includes("stuck") || 
    clean.includes("macet") ||
    clean.includes("terkendala") ||
    clean.includes("kendala")
  ) {
    return "stuck";
  }
  if (
    clean.includes("menunggu materi") || 
    clean.includes("materi") ||
    clean.includes("nunggu") ||
    clean.includes("belum ada redaksi") ||
    clean.includes("menunggu bahan") ||
    clean.includes("bahan")
  ) {
    return "menunggu_materi";
  }
  if (
    clean.includes("draft selesai") || 
    clean.includes("draft") ||
    clean.includes("draft jadi") ||
    clean.includes("draft sudah ada")
  ) {
    return "draft_selesai";
  }
  if (clean.includes("perlu revisi")) return "perlu_revisi";
  if (
    clean.includes("revisi dikerjakan") ||
    clean.includes("revisi sudah dikerjakan") ||
    clean.includes("revisi selesai")
  ) {
    return "revisi_dikerjakan";
  }
  if (
    clean.includes("menunggu approval") || 
    clean.includes("approval") ||
    clean.includes("sudah upload") ||
    clean.includes("sudah kirim link") ||
    clean.includes("hasil sudah dikirim")
  ) {
    return "menunggu_approval";
  }

  // Alias List for Approved
  const approvedKeywords = [
    "approve",
    "approved",
    "acc",
    "approve task",
    "setujui",
    "disetujui",
    "sudah approve",
    "sudah approved",
    "selesai approve",
    "final approve",
  ];
  if (
    approvedKeywords.some(kw => clean === kw || clean.includes(kw)) ||
    clean.includes("selesai") ||
    clean === "approved" ||
    clean === "oke" ||
    clean === "aman" ||
    clean === "acc"
  ) {
    return "approved";
  }

  if (
    clean.includes("ditunda") || 
    clean.includes("tunda") ||
    clean.includes("pending")
  ) {
    return "ditunda";
  }

  return null;
}

/**
 * Maps task priority string input to standard TaskPriority enum
 */
function normalizePriority(text: string): import("@/types").TaskPriority | null {
  const clean = text.toLowerCase().trim();
  if (clean === "rendah") return "rendah";
  if (clean === "sedang") return "sedang";
  if (clean === "tinggi") return "tinggi";
  if (clean === "kritis") return "kritis";
  return null;
}

/**
 * Helper to retrieve user's name from Firestore safely
 */
async function getUsernameById(userId: string): Promise<string> {
  try {
    const doc = await getAdminDb().collection("users").doc(userId).get();
    return doc.exists ? (doc.data()?.name || "-") : "-";
  } catch {
    return "-";
  }
}

/**
 * Format helpers
 */
function getFormattedPriority(priority: string): string {
  switch (priority) {
    case "rendah": return "Rendah";
    case "sedang": return "Sedang";
    case "tinggi": return "Tinggi";
    case "kritis": return "Kritis";
    default: return priority;
  }
}

function getFormattedStatus(status: string): string {
  switch (status) {
    case "belum_dimulai": return "Belum Dimulai";
    case "sedang_dikerjakan": return "Sedang Dikerjakan";
    case "butuh_bantuan": return "Butuh Bantuan";
    case "stuck": return "Stuck";
    case "menunggu_materi": return "Menunggu Materi";
    case "draft_selesai": return "Draft Selesai";
    case "perlu_revisi": return "Perlu Revisi";
    case "revisi_dikerjakan": return "Revisi Dikerjakan";
    case "menunggu_approval": return "Menunggu Approval";
    case "approved": return "Approved";
    case "ditunda": return "Ditunda";
    default: return status;
  }
}

function findUserByName(name: string): Promise<UserProfile | null> {
  return new Promise(async (resolve) => {
    try {
      const cleanName = name.toLowerCase().trim();
      const usersSnap = await getAdminDb().collection("users").get();
      let matched: UserProfile | null = null;
      usersSnap.forEach((doc) => {
        const u = doc.data() as UserProfile;
        if (u.name.toLowerCase().includes(cleanName)) {
          matched = { ...u, id: doc.id };
        }
      });
      resolve(matched);
    } catch {
      resolve(null);
    }
  });
}

function generateRandomCode(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ==========================================
// FASE 19B NEW WORKFLOW COMMAND HANDLERS
// ==========================================

export async function handleTugasSayaCommand(
  user: UserProfile,
  variation: string
): Promise<{ success: boolean; replyText: string }> {
  try {
    const db = getAdminDb();

    // Fetch all active tasks for user
    const tasksSnap = await db
      .collection("tasks")
      .where("pic_id", "==", user.id)
      .where("is_archived", "==", false)
      .get();

    const eventsSnap = await db.collection("events").get();
    const divisionsSnap = await db.collection("divisions").get();

    const eventsMap = new Map<string, string>();
    eventsSnap.forEach((d) => eventsMap.set(d.id, d.data().name || "-"));

    const divisionsMap = new Map<string, string>();
    divisionsSnap.forEach((d) => divisionsMap.set(d.id, d.data().name || "-"));

    const tasks: Task[] = [];
    tasksSnap.forEach((doc) => {
      tasks.push({ ...doc.data(), id: doc.id } as Task);
    });

    // Filter based on variation
    const filtered = tasks.filter((task) => {
      if (task.status === "approved") return false;
      const diffDays = getTaskDeadlineDiffDays(task);
      if (variation === "minggu_ini") {
        return diffDays >= 0 && diffDays <= 7;
      }
      if (variation === "deadline_dekat") {
        return diffDays <= 7;
      }
      // "belum_selesai" or "all"
      return true;
    });

    if (filtered.length === 0) {
      return {
        success: true,
        replyText: [
          WA_LABEL.tugasSaya,
          "",
          `Halo ${user.name}, tidak ada tugas aktif yang ditemukan untuk kamu.`
        ].join("\n"),
      };
    }

    // Sort by deadline
    filtered.sort((a, b) => {
      const diffA = getTaskDeadlineDiffDays(a);
      const diffB = getTaskDeadlineDiffDays(b);
      return diffA - diffB;
    });

    const totalCount = filtered.length;
    const displayedTasks = filtered.slice(0, 10);
    const lines = [
      WA_LABEL.tugasSaya,
      "",
      `Halo ${user.name}, berikut tugas aktif kamu:`,
      ""
    ];

    displayedTasks.forEach((task, index) => {
      const divisionOrEventName =
        task.type === "acara" && task.event_id
          ? (eventsMap.get(task.event_id) || "Acara")
          : task.division_id
          ? (divisionsMap.get(task.division_id) || (task.division_id === "humas_media_kreatif" ? "Humas & Media Kreatif" : task.division_id))
          : "-";

      let deadlineStr = "-";
      let diffLabel = "";
      if (task.deadline) {
        const d =
          task.deadline && typeof task.deadline === "object" && "toDate" in task.deadline
            ? (task.deadline as { toDate: () => Date }).toDate()
            : task.deadline instanceof Date
            ? task.deadline
            : new Date(task.deadline as string);
        deadlineStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
        const diffDays = getTaskDeadlineDiffDays(task);
        if (diffDays < 0) {
          diffLabel = "Overdue";
        } else if (diffDays === 0) {
          diffLabel = "Hari ini";
        } else {
          diffLabel = `H-${diffDays}`;
        }
      }

      lines.push(`${index + 1}. ${task.name}`);
      lines.push(`   Status: ${getFormattedStatus(task.status)}`);
      lines.push(`   Prioritas: ${getFormattedPriority(task.priority)}`);
      lines.push(`   Deadline: ${deadlineStr}${diffLabel ? ` (${diffLabel})` : ""}`);
      lines.push(`   Acara/Divisi: ${divisionOrEventName}`);
      lines.push("");
    });

    if (totalCount > 10) {
      lines.push(`...dan ${totalCount - 10} tugas lainnya. Buka dashboard JobdexIn untuk detail lengkap.`);
    }

    return {
      success: true,
      replyText: lines.join("\n").trim(),
    };
  } catch (error) {
    console.error("[Tugas Saya] Error:", error);
    return {
      success: false,
      replyText: `${WA_LABEL.tugasSaya}\n\nGagal mengambil daftar tugas kamu.`,
    };
  }
}

export async function handleDetailTaskCommand(
  taskNameOrCode: string,
  isCode: boolean,
  user: UserProfile
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const { tasks, candidateMessage } = await findTaskCandidates(
      taskNameOrCode,
      isCode,
      "detail",
      user.id
    );

    if (candidateMessage) {
      return { success: true, replyText: candidateMessage };
    }

    if (tasks.length === 0) {
      return { success: false, replyText: `${WA_LABEL.detailTask}\n\nTugas tidak ditemukan atau kode kandidat kadaluwarsa.` };
    }

    const task = tasks[0];

    // Validate permission
    const allowed = validateTaskPermission(user, task, "view");
    if (!allowed) {
      return { success: false, replyText: getAccessDeniedMessage(user) };
    }

    const db = getAdminDb();

    // Resolve PIC name
    const picName = task.pic_id ? await getUsernameById(task.pic_id) : "-";

    // Resolve Acara/Divisi
    const eventsSnap = await db.collection("events").get();
    const divisionsSnap = await db.collection("divisions").get();

    const eventsMap = new Map<string, string>();
    eventsSnap.forEach((d) => eventsMap.set(d.id, d.data().name || "-"));

    const divisionsMap = new Map<string, string>();
    divisionsSnap.forEach((d) => divisionsMap.set(d.id, d.data().name || "-"));

    const divisionOrEventName =
      task.type === "acara" && task.event_id
        ? (eventsMap.get(task.event_id) || "Acara")
        : task.division_id
        ? (divisionsMap.get(task.division_id) || (task.division_id === "humas_media_kreatif" ? "Humas & Media Kreatif" : task.division_id))
        : "-";

    let deadlineStr = "-";
    let diffLabel = "";
    if (task.deadline) {
      const d =
        task.deadline && typeof task.deadline === "object" && "toDate" in task.deadline
          ? (task.deadline as { toDate: () => Date }).toDate()
          : task.deadline instanceof Date
          ? task.deadline
          : new Date(task.deadline as string);
      deadlineStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      const diffDays = getTaskDeadlineDiffDays(task);
      if (diffDays < 0) {
        diffLabel = "Overdue";
      } else if (diffDays === 0) {
        diffLabel = "Hari ini";
      } else {
        diffLabel = `H-${diffDays}`;
      }
    }

    const deadlineValue = deadlineStr + (diffLabel ? ` (${diffLabel})` : "");

    // Resolve last status log note
    const logsSnap = await db.collection("tasks").doc(task.id).collection("status_logs")
      .orderBy("created_at", "desc")
      .limit(1)
      .get();
    let lastNote = "-";
    if (!logsSnap.empty) {
      const logData = logsSnap.docs[0].data();
      lastNote = logData.note || "-";
    }

    const getChecklistStatus = (labelKeyword: string): string => {
      if (!task.checklist_items) return "Belum";
      const item = task.checklist_items.find(i => {
        const lbl = i.label.toLowerCase();
        if (labelKeyword === "redaksi") return lbl.includes("redaksi");
        if (labelKeyword === "referensi") return lbl.includes("referensi");
        if (labelKeyword === "draft") return lbl.includes("draft") || lbl.includes("mulai desain");
        if (labelKeyword === "revisi") return lbl.includes("revisi");
        if (labelKeyword === "final") return lbl.includes("final");
        if (labelKeyword === "upload") return lbl.includes("upload") || lbl.includes("hasil ke");
        return false;
      });
      return item?.is_done ? "Selesai" : "Belum";
    };

    const replyText = [
      WA_LABEL.detailTask,
      "",
      `Task: ${task.name}`,
      `Status: ${getFormattedStatus(task.status)}`,
      `Prioritas: ${getFormattedPriority(task.priority)}`,
      `PIC: ${picName}`,
      `Deadline: ${deadlineValue}`,
      `Acara/Divisi: ${divisionOrEventName}`,
      "",
      "Redaksi:",
      task.copywriting || "-",
      "",
      "Referensi:",
      task.design_reference_url || "-",
      task.drive_reference_url || "-",
      task.copywriting_docs_url || "-",
      "",
      "Arahan Visual:",
      task.visual_direction || "-",
      "",
      "Checklist:",
      `- Redaksi/materi tersedia: ${getChecklistStatus("redaksi")}`,
      `- Referensi desain tersedia: ${getChecklistStatus("referensi")}`,
      `- Draft awal: ${getChecklistStatus("draft")}`,
      `- Revisi internal: ${getChecklistStatus("revisi")}`,
      `- Finalisasi desain: ${getChecklistStatus("final")}`,
      `- Upload hasil: ${getChecklistStatus("upload")}`,
      "",
      "Catatan terakhir:",
      lastNote
    ].join("\n");

    return {
      success: true,
      replyText,
      taskId: task.id,
      taskName: task.name
    };
  } catch (error) {
    console.error("[Detail Task] Error:", error);
    return {
      success: false,
      replyText: `${WA_LABEL.detailTask}\n\nGagal mengambil detail tugas.`,
    };
  }
}

export async function handleUploadHasilCommand(
  taskNameOrCode: string,
  isCode: boolean,
  link: string,
  catatan: string,
  user: UserProfile
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const { tasks, candidateMessage } = await findTaskCandidates(
      taskNameOrCode,
      isCode,
      "upload_hasil",
      user.id,
      { link, catatan }
    );

    if (candidateMessage) {
      return { success: true, replyText: candidateMessage };
    }

    if (tasks.length === 0) {
      return { success: false, replyText: `${WA_LABEL.uploadHasil}\n\nTugas tidak ditemukan atau kode kandidat kadaluwarsa.` };
    }

    const task = tasks[0];

    // Validate permission
    const allowed = validateTaskPermission(user, task, "upload_hasil");
    if (!allowed) {
      return { success: false, replyText: getAccessDeniedMessage(user) };
    }

    if (!link) {
      return { success: false, replyText: `${WA_LABEL.uploadHasil}\n\nGagal mengirim hasil: Link URL wajib disertakan.` };
    }

    const db = getAdminDb();
    const taskRef = db.collection("tasks").doc(task.id);
    const batch = db.batch();

    let updatedChecklist = task.checklist_items || [];
    const checkedLabel = "Upload hasil ke Drive";
    let checklistUpdated = false;

    if (updatedChecklist.length > 0) {
      updatedChecklist = updatedChecklist.map((item) => {
        if (item.label === checkedLabel) {
          checklistUpdated = true;
          return {
            ...item,
            is_done: true,
            done_by: user.id,
            done_by_name: user.name,
            done_at: new Date()
          };
        }
        return item;
      });
    }

    const updateParams: Record<string, unknown> = {
      status: "menunggu_approval",
      approval_status: "pending",
      result_design_url: link,
      result_url: link,
      result_notes: catatan || "",
      result_submitted_at: FieldValue.serverTimestamp(),
      result_submitted_by: user.id,
      updated_at: FieldValue.serverTimestamp()
    };

    if (checklistUpdated) {
      updateParams.checklist_items = updatedChecklist;
    }

    batch.update(taskRef, updateParams);

    // Add status log
    const logRef = taskRef.collection("status_logs").doc();
    batch.set(logRef, {
      id: logRef.id,
      task_id: task.id,
      from_status: task.status,
      to_status: "menunggu_approval",
      changed_by: user.id,
      changed_by_name: user.name,
      changed_by_role: user.role,
      source: "whatsapp_command",
      note: catatan ? `Upload hasil: ${catatan}` : "Upload hasil desain via WhatsApp",
      created_at: FieldValue.serverTimestamp()
    });

    await batch.commit();

    if (task.type === "acara" && task.event_id) {
      await recalculateEventProgressAdmin(task.event_id);
    }

    const picName = task.pic_id ? await getUsernameById(task.pic_id) : "-";

    const replyText = [
      WA_LABEL.uploadHasil,
      "",
      "Hasil task berhasil dikirim.",
      "",
      `Task: ${task.name}`,
      `PIC: ${picName}`,
      "Status baru: Menunggu Approval",
      `Link: ${link}`,
      "",
      "Koordinator dapat mengecek dan approve/revisi task ini."
    ].join("\n");

    return {
      success: true,
      replyText,
      taskId: task.id,
      taskName: task.name
    };
  } catch (error) {
    console.error("[Upload Hasil] Error:", error);
    return {
      success: false,
      replyText: `${WA_LABEL.uploadHasil}\n\nGagal mengirim hasil task.`,
    };
  }
}

export async function handleMintaRevisiCommand(
  taskNameOrCode: string,
  isCode: boolean,
  catatan: string,
  user: UserProfile
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const { tasks, candidateMessage } = await findTaskCandidates(
      taskNameOrCode,
      isCode,
      "minta_revisi",
      user.id,
      { catatan }
    );

    if (candidateMessage) {
      return { success: true, replyText: candidateMessage };
    }

    if (tasks.length === 0) {
      return { success: false, replyText: `${WA_LABEL.mintaRevisi}\n\nTugas tidak ditemukan atau kode kandidat kadaluwarsa.` };
    }

    const task = tasks[0];

    // Validate permission
    const allowed = validateTaskPermission(user, task, "revisi");
    if (!allowed) {
      return { success: false, replyText: getAccessDeniedMessage(user) };
    }

    if (!catatan) {
      return { success: false, replyText: `${WA_LABEL.mintaRevisi}\n\nGagal meminta revisi: Catatan revisi wajib disertakan.` };
    }

    const db = getAdminDb();
    const taskRef = db.collection("tasks").doc(task.id);
    const batch = db.batch();

    batch.update(taskRef, {
      status: "perlu_revisi",
      revision_notes: catatan,
      revision_requested_by: user.id,
      revision_requested_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    });

    // Add status log
    const logRef = taskRef.collection("status_logs").doc();
    batch.set(logRef, {
      id: logRef.id,
      task_id: task.id,
      from_status: task.status,
      to_status: "perlu_revisi",
      changed_by: user.id,
      changed_by_name: user.name,
      changed_by_role: user.role,
      source: "whatsapp_command",
      note: `Minta revisi: ${catatan}`,
      created_at: FieldValue.serverTimestamp()
    });

    await batch.commit();

    if (task.type === "acara" && task.event_id) {
      await recalculateEventProgressAdmin(task.event_id);
    }

    const picName = task.pic_id ? await getUsernameById(task.pic_id) : "-";

    const replyText = [
      WA_LABEL.mintaRevisi,
      "",
      "Revisi berhasil diminta.",
      "",
      `Task: ${task.name}`,
      `PIC: ${picName}`,
      "Status baru: Perlu Revisi",
      "",
      "Catatan revisi:",
      catatan
    ].join("\n");

    return {
      success: true,
      replyText,
      taskId: task.id,
      taskName: task.name
    };
  } catch (error) {
    console.error("[Minta Revisi] Error:", error);
    return {
      success: false,
      replyText: `${WA_LABEL.mintaRevisi}\n\nGagal meminta revisi tugas.`,
    };
  }
}

export async function handleCekChecklistCommand(
  taskNameOrCode: string,
  isCode: boolean,
  user: UserProfile
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const { tasks, candidateMessage } = await findTaskCandidates(
      taskNameOrCode,
      isCode,
      "cek_checklist",
      user.id
    );

    if (candidateMessage) {
      return { success: true, replyText: candidateMessage };
    }

    if (tasks.length === 0) {
      return { success: false, replyText: `${WA_LABEL.cekChecklist}\n\nTugas tidak ditemukan atau kode kandidat kadaluwarsa.` };
    }

    const task = tasks[0];

    // Validate permission
    const allowed = validateTaskPermission(user, task, "view");
    if (!allowed) {
      return { success: false, replyText: getAccessDeniedMessage(user) };
    }

    const getChecklistStatus = (labelKeyword: string): string => {
      if (!task.checklist_items) return "Belum";
      const item = task.checklist_items.find(i => {
        const lbl = i.label.toLowerCase();
        if (labelKeyword === "redaksi") return lbl.includes("redaksi");
        if (labelKeyword === "referensi") return lbl.includes("referensi");
        if (labelKeyword === "draft") return lbl.includes("draft") || lbl.includes("mulai desain");
        if (labelKeyword === "revisi") return lbl.includes("revisi");
        if (labelKeyword === "final") return lbl.includes("final");
        if (labelKeyword === "upload") return lbl.includes("upload") || lbl.includes("hasil ke");
        return false;
      });
      return item?.is_done ? "Selesai" : "Belum";
    };

    const replyText = [
      WA_LABEL.cekChecklist,
      "",
      `Task: ${task.name}`,
      "",
      `1. Redaksi/materi tersedia: ${getChecklistStatus("redaksi")}`,
      `2. Referensi desain tersedia: ${getChecklistStatus("referensi")}`,
      `3. Mulai desain/draft awal: ${getChecklistStatus("draft")}`,
      `4. Revisi internal: ${getChecklistStatus("revisi")}`,
      `5. Finalisasi desain: ${getChecklistStatus("final")}`,
      `6. Upload hasil ke Drive: ${getChecklistStatus("upload")}`
    ].join("\n");

    return {
      success: true,
      replyText,
      taskId: task.id,
      taskName: task.name
    };
  } catch (error) {
    console.error("[Cek Checklist] Error:", error);
    return {
      success: false,
      replyText: `${WA_LABEL.cekChecklist}\n\nGagal mengambil checklist tugas.`,
    };
  }
}

export async function handleTambahCatatanCommand(
  taskNameOrCode: string,
  isCode: boolean,
  catatan: string,
  user: UserProfile
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const { tasks, candidateMessage } = await findTaskCandidates(
      taskNameOrCode,
      isCode,
      "tambah_catatan",
      user.id,
      { catatan }
    );

    if (candidateMessage) {
      return { success: true, replyText: candidateMessage };
    }

    if (tasks.length === 0) {
      return { success: false, replyText: `${WA_LABEL.tambahCatatan}\n\nTugas tidak ditemukan atau kode kandidat kadaluwarsa.` };
    }

    const task = tasks[0];

    // Validate permission
    const allowed = validateTaskPermission(user, task, "tambah_catatan");
    if (!allowed) {
      return { success: false, replyText: getAccessDeniedMessage(user) };
    }

    if (!catatan) {
      return { success: false, replyText: `${WA_LABEL.tambahCatatan}\n\nGagal menambahkan catatan: Catatan wajib disertakan.` };
    }

    const db = getAdminDb();
    const taskRef = db.collection("tasks").doc(task.id);
    const batch = db.batch();

    batch.update(taskRef, {
      updated_at: FieldValue.serverTimestamp()
    });

    const logRef = taskRef.collection("status_logs").doc();
    batch.set(logRef, {
      id: logRef.id,
      task_id: task.id,
      from_status: task.status,
      to_status: task.status,
      changed_by: user.id,
      changed_by_name: user.name,
      changed_by_role: user.role,
      source: "whatsapp_command",
      note: catatan,
      created_at: FieldValue.serverTimestamp()
    });

    await batch.commit();

    const replyText = [
      WA_LABEL.tambahCatatan,
      "",
      "Catatan berhasil ditambahkan.",
      "",
      `Task: ${task.name}`,
      `Oleh: ${user.name}`,
      "",
      "Catatan:",
      catatan
    ].join("\n");

    return {
      success: true,
      replyText,
      taskId: task.id,
      taskName: task.name
    };
  } catch (error) {
    console.error("[Tambah Catatan] Error:", error);
    return {
      success: false,
      replyText: `${WA_LABEL.tambahCatatan}\n\nGagal menambahkan catatan ke tugas.`,
    };
  }
}

export async function handleGantiPicCommand(
  taskNameOrCode: string,
  isCode: boolean,
  picName: string,
  user: UserProfile
): Promise<{ success: boolean; replyText: string; taskId?: string; taskName?: string }> {
  try {
    const { tasks, candidateMessage } = await findTaskCandidates(
      taskNameOrCode,
      isCode,
      "ganti_pic",
      user.id,
      { pic_name: picName }
    );

    if (candidateMessage) {
      return { success: true, replyText: candidateMessage };
    }

    if (tasks.length === 0) {
      return { success: false, replyText: `${WA_LABEL.gantiPic}\n\nTugas tidak ditemukan atau kode kandidat kadaluwarsa.` };
    }

    const task = tasks[0];

    // Validate permission
    const allowed = validateTaskPermission(user, task, "ganti_pic");
    if (!allowed) {
      return { success: false, replyText: getAccessDeniedMessage(user) };
    }

    if (!picName) {
      return { success: false, replyText: `${WA_LABEL.gantiPic}\n\nGagal mengganti PIC: Nama PIC target wajib disertakan.` };
    }

    // Resolve target user fuzzy
    const { user: targetUser, candidates } = await findUserByNameFuzzy(picName);

    if (candidates.length > 1) {
      const lines = [
        WA_LABEL.gantiPic,
        "",
        `Ditemukan beberapa anggota dengan nama mirip "${picName}":`,
      ];
      candidates.forEach((cand, idx) => {
        lines.push(`${idx + 1}. ${cand.name}`);
      });
      lines.push("");
      lines.push("Silakan gunakan nama yang lebih spesifik.");
      return { success: true, replyText: lines.join("\n") };
    }

    if (!targetUser) {
      return {
        success: false,
        replyText: `${WA_LABEL.gantiPic}\n\nGagal mengganti PIC: Anggota dengan nama "${picName}" tidak ditemukan.`
      };
    }

    const oldPicName = task.pic_id ? await getUsernameById(task.pic_id) : "-";

    const db = getAdminDb();
    const taskRef = db.collection("tasks").doc(task.id);
    const batch = db.batch();

    batch.update(taskRef, {
      pic_id: targetUser.id,
      updated_at: FieldValue.serverTimestamp()
    });

    const logRef = taskRef.collection("status_logs").doc();
    batch.set(logRef, {
      id: logRef.id,
      task_id: task.id,
      from_status: task.status,
      to_status: task.status,
      changed_by: user.id,
      changed_by_name: user.name,
      changed_by_role: user.role,
      source: "whatsapp_command",
      note: `Ganti PIC dari ${oldPicName} ke ${targetUser.name}`,
      created_at: FieldValue.serverTimestamp()
    });

    await batch.commit();

    const replyText = [
      WA_LABEL.gantiPic,
      "",
      "PIC task berhasil diganti.",
      "",
      `Task: ${task.name}`,
      `PIC lama: ${oldPicName}`,
      `PIC baru: ${targetUser.name}`
    ].join("\n");

    return {
      success: true,
      replyText,
      taskId: task.id,
      taskName: task.name
    };
  } catch (error) {
    console.error("[Ganti PIC] Error:", error);
    return {
      success: false,
      replyText: `${WA_LABEL.gantiPic}\n\nGagal mengganti PIC tugas.`,
    };
  }
}

export async function handleBriefingCommand(
  user: UserProfile,
  groupId?: string
): Promise<{ success: boolean; replyText: string }> {
  if (user.role === "anggota") {
    return {
      success: false,
      replyText: `${WA_LABEL.briefing}\n\nOtorisasi ditolak: Anggota biasa tidak diperbolehkan melihat briefing. Silakan gunakan command:\n!jobdex tugas saya`
    };
  }

  try {
    const db = getAdminDb();
    
    // Resolve group event if from group
    let linkedEvent: Event | null = null;
    if (groupId) {
      const { findEventByGroupId } = await import("./group-routing");
      linkedEvent = await findEventByGroupId(groupId);
    }

    const tasksSnap = await db.collection("tasks").where("is_archived", "==", false).get();
    
    let overdueCount = 0;
    let nearDeadlineCount = 0; // H-1 or H-2
    let stuckCount = 0;
    let waitingApprovalCount = 0;
    let noUpdateCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tasksSnap.forEach((doc) => {
      const task = doc.data() as Task;
      if (task.status === "approved") return;

      // Filter by group routing (if in group)
      if (linkedEvent) {
        if (task.event_id !== linkedEvent.id) return;
      } else {
        // Filter by role scope (if personal chat)
        if (user.role === "koordinator_acara" && task.type === "acara" && task.coordinator_id !== user.id) return;
        if (user.role === "koordinator_divisi" && task.type === "divisi" && task.division_id !== user.division_id) return;
      }

      const diffDays = getTaskDeadlineDiffDays(task);
      if (diffDays !== null) {
        if (diffDays < 0) overdueCount++;
        if (diffDays === 1 || diffDays === 2) nearDeadlineCount++;
      }

      if (task.status === "menunggu_approval") waitingApprovalCount++;
      if (task.status === "stuck" || task.status === "butuh_bantuan") stuckCount++;

      // Check last update delay
      if (task.pic_id) {
        const updatedAt = task.updated_at && typeof task.updated_at === "object" && "toDate" in task.updated_at
          ? (task.updated_at as { toDate: () => Date }).toDate()
          : task.updated_at instanceof Date
          ? task.updated_at
          : null;

        if (updatedAt) {
          const updated = new Date(updatedAt);
          updated.setHours(0, 0, 0, 0);
          const diffUpdate = Math.floor((today.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
          if (diffUpdate >= 2) {
            noUpdateCount++;
          }
        }
      }
    });

    const scopeName = linkedEvent 
      ? linkedEvent.name 
      : user.role === "super_admin" 
      ? "JobDex.in" 
      : user.role === "koordinator_divisi" 
      ? "Divisi Humas & Media Kreatif" 
      : "Acara Saya";

    const replyText = [
      `[*JobdexIn* Briefing Koor]`,
      ``,
      `${scopeName} — Ringkasan Hari Ini`,
      ``,
      `Perlu dicek:`,
      `🔴 ${overdueCount} overdue`,
      `🟡 ${nearDeadlineCount} deadline H-1/H-2`,
      `⚠️ ${stuckCount} stuck`,
      `⏳ ${waitingApprovalCount} menunggu approval`,
      `📝 ${noUpdateCount} belum update 2 hari`,
      ``,
      `Aksi cepat:`,
      `- !jobdex siapa belum update`,
      `- !jobdex deadline dekat`,
      `- !jobdex siapa yang stuck`,
      `- !jobdex siapa yang menunggu approval`
    ].join("\n");

    return { success: true, replyText };
  } catch (error) {
    console.error("[Briefing] Error:", error);
    return { success: false, replyText: `${WA_LABEL.briefing}\n\nGagal mengambil data briefing.` };
  }
}

export async function handleSiapaBelumUpdateCommand(user: UserProfile): Promise<{ success: boolean; replyText: string }> {
  if (user.role === "anggota") {
    return { success: false, replyText: getAccessDeniedMessage(user) };
  }

  try {
    const db = getAdminDb();
    const tasksSnap = await db.collection("tasks").where("is_archived", "==", false).get();
    const usersSnap = await db.collection("users").get();
    
    const usersMap = new Map<string, string>();
    usersSnap.forEach((d) => usersMap.set(d.id, d.data().name || "-"));

    const picDelays = new Map<string, number>();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tasksSnap.forEach((doc) => {
      const task = doc.data() as Task;
      if (task.status === "approved" || task.status === "belum_dimulai" || !task.pic_id) return;
      
      // Filter by role scope
      if (user.role === "koordinator_acara" && task.type === "acara" && task.coordinator_id !== user.id) return;
      if (user.role === "koordinator_divisi" && task.type === "divisi" && task.division_id !== user.division_id) return;

      const updatedAt = task.updated_at && typeof task.updated_at === "object" && "toDate" in task.updated_at
          ? (task.updated_at as { toDate: () => Date }).toDate()
          : task.updated_at instanceof Date
          ? task.updated_at
          : null;

      if (updatedAt) {
        const updated = new Date(updatedAt);
        updated.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 2) { // Consider "belum update" if >= 2 days
          const currentCount = picDelays.get(task.pic_id) || 0;
          picDelays.set(task.pic_id, currentCount + 1);
        }
      }
    });

    if (picDelays.size === 0) {
      return { success: true, replyText: `${WA_LABEL.siapaBelumUpdate}\n\nSemua PIC aktif mengupdate progress dalam 2 hari terakhir.` };
    }

    const lines = [
      WA_LABEL.siapaBelumUpdate,
      "",
      "Daftar PIC yang belum update progress task (>= 2 hari):",
      ""
    ];

    let idx = 1;
    for (const [picId, count] of Array.from(picDelays.entries()).sort((a, b) => b[1] - a[1])) {
      const name = usersMap.get(picId) || "Unknown";
      lines.push(`${idx}. ${name}: ${count} task belum diupdate`);
      idx++;
    }

    lines.push("");
    lines.push("Saran: Hubungi PIC terkait untuk menanyakan progress.");

    return { success: true, replyText: lines.join("\n") };
  } catch (error) {
    console.error("[Siapa Belum Update] Error:", error);
    return { success: false, replyText: `${WA_LABEL.siapaBelumUpdate}\n\nGagal mengambil data laporan.` };
  }
}

/**
 * Command: !jobdex hubungkan grup acara <Nama Acara>
 */
export async function handleHubungkanGrupAcaraCommand(
  parsedCmd: { fields: Record<string, string> },
  senderPhone: string,
  groupId: string | undefined,
  groupName: string | undefined
) {
  if (!groupId) {
    return { success: false, replyText: `${WA_BOT_LABEL}\n\nCommand ini hanya bisa dijalankan dari dalam grup WhatsApp acara.` };
  }

  const { user } = await findUserByNameFuzzy(senderPhone);
  if (!user) {
    return { success: false, replyText: "Pengirim tidak terdaftar dalam sistem." };
  }

  const eventName = parsedCmd.fields.event_name;
  if (!eventName) {
    return { success: false, replyText: "Format salah. Gunakan: !jobdex hubungkan grup acara <nama acara>" };
  }

  const db = getAdminDb();
  
  // Find event
  const eventsSnap = await db.collection("events").get();
  
  let matchedEvent: Event | null = null;
  let matchedEventId = "";

  for (const doc of eventsSnap.docs) {
    const ev = doc.data() as Event;
    if (ev.name.toLowerCase() === eventName.toLowerCase()) {
      matchedEvent = ev;
      matchedEventId = doc.id;
      break;
    }
  }

  if (!matchedEvent) {
    return { success: false, replyText: `${WA_BOT_LABEL}\n\nAcara dengan nama "${eventName}" tidak ditemukan.` };
  }

  // Security check: super_admin OR koordinator_acara of this event
  let isAuthorized = false;
  if (user.role === "super_admin") {
    isAuthorized = true;
  } else if (user.role === "koordinator_acara" && matchedEvent.coordinator_id === user.id) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return { success: false, replyText: getAccessDeniedMessage(user) };
  }

  // Link group
  const { linkGroupToEvent } = await import("@/lib/server/group-routing");
  await linkGroupToEvent(matchedEventId, groupId, groupName || "", user.id, "webhook_detected");

  // Log activity
  await db.collection("activity_logs").add({
    action: "event_whatsapp_group_updated",
    event_id: matchedEventId,
    event_name: matchedEvent.name,
    old_group_id: matchedEvent.whatsapp_group_id || null,
    new_group_id: groupId,
    actor_id: user.id,
    actor_name: user.name,
    actor_role: user.role,
    source: "whatsapp_command",
    created_at: FieldValue.serverTimestamp(),
  });

  return { 
    success: true, 
    replyText: `${WA_LABEL.approval}\n\nGrup ini berhasil dihubungkan dengan acara "${matchedEvent.name}".\n\nNotifikasi dan reminder acara akan dikirim ke grup ini.` 
  };
}

