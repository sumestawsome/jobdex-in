import "server-only";

import { getAdminDb, FieldValue } from "@/lib/server/firebase-admin";
import { getTaskDeadlineDiffDays, getRiskLevelFromTask } from "@/lib/task-risk";
import type { Task, UserProfile, Event } from "@/types";
import { sanitizePinFromMessage } from "./whatsapp-command-executor";
import { WA_LABEL } from "@/lib/server/whatsapp-labels";
import { resolveTaskNotificationTarget, isKnownClassGroupId } from "@/lib/server/group-routing";
import { isAcademicClassTask } from "@/lib/server/academic-broadcast";

export { getTaskDeadlineDiffDays };

/**
 * Returns the risk level of the task (none | yellow | orange | red)
 */
export function getTaskRiskLevel(task: Task) {
  return getRiskLevelFromTask(task);
}

/**
 * Helper to format date in Indonesian style (e.g. 3 Juni 2026)
 */
export function formatIndonesianDate(dateObj: unknown): string {
  const date =
    dateObj && typeof dateObj === "object" && "toDate" in dateObj
      ? (dateObj as { toDate: () => Date }).toDate()
      : dateObj instanceof Date
      ? dateObj
      : typeof dateObj === "string"
      ? new Date(dateObj)
      : null;

  if (!date) return "-";

  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Helper to format task priorities for Indonesian display
 */
export function getFormattedPriority(priority: string): string {
  switch (priority) {
    case "rendah":
      return "Rendah";
    case "sedang":
      return "Sedang";
    case "tinggi":
      return "Tinggi";
    case "kritis":
      return "Kritis";
    default:
      return priority;
  }
}

/**
 * Helper to format task status for Indonesian display
 */
export function getFormattedStatus(status: string): string {
  switch (status) {
    case "belum_dimulai":
      return "Belum Dimulai";
    case "sedang_dikerjakan":
      return "Sedang Dikerjakan";
    case "butuh_bantuan":
      return "Butuh Bantuan";
    case "stuck":
      return "Stuck";
    case "menunggu_materi":
      return "Menunggu Materi";
    case "draft_selesai":
      return "Draft Selesai";
    case "perlu_revisi":
      return "Perlu Revisi";
    case "revisi_dikerjakan":
      return "Revisi Dikerjakan";
    case "menunggu_approval":
      return "Menunggu Approval";
    case "approved":
      return "Approved";
    case "ditunda":
      return "Ditunda";
    default:
      return status;
  }
}

/**
 * Checks whether a reminder should be sent based on task deadline difference days and priority
 */
export function shouldSendDeadlineReminder(
  task: Task,
  diffDays: number
): {
  shouldSend: boolean;
  type: "h_7" | "h_5" | "h_3" | "h_1" | "today" | "overdue" | null;
} {
  // Excluded statuses
  if (
    task.status === "approved" ||
    task.status === ("selesai" as unknown as typeof task.status) ||
    task.status === ("archived" as unknown as typeof task.status) ||
    task.is_archived
  ) {
    return { shouldSend: false, type: null };
  }

  const priority = task.priority;

  if (diffDays < 0) {
    return { shouldSend: true, type: "overdue" };
  }
  if (diffDays === 0) {
    return { shouldSend: true, type: "today" };
  }
  if (diffDays === 1) {
    return { shouldSend: true, type: "h_1" };
  }

  if (priority === "rendah" || priority === "sedang") {
    if (diffDays <= 5) {
      if (task.status === "belum_dimulai" || diffDays <= 3) {
        return { shouldSend: true, type: "h_5" };
      }
    }
  } else if (priority === "tinggi" || priority === "kritis") {
    if (diffDays <= 3) {
      return { shouldSend: true, type: "h_3" };
    } else if (diffDays <= 5) {
      return { shouldSend: true, type: "h_5" };
    } else if (diffDays <= 7) {
      return { shouldSend: true, type: "h_7" };
    }
  }

  return { shouldSend: false, type: null };
}

/**
 * Calculates days elapsed since task creation
 */
export function getDaysSinceCreation(task: Task): number {
  const createdAtDate =
    task.created_at && typeof task.created_at === "object" && "toDate" in task.created_at
      ? (task.created_at as { toDate: () => Date }).toDate()
      : task.created_at instanceof Date
      ? task.created_at
      : null;

  if (!createdAtDate) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const created = new Date(createdAtDate);
  created.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - created.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Checks if task is missing redaksi/materi (copywriting/copywriting_docs_url) after >= 2 days of creation
 */
export function checkMissingMaterial(task: Task): boolean {
  if (
    task.status === "approved" ||
    task.status === ("selesai" as unknown as typeof task.status) ||
    task.status === ("archived" as unknown as typeof task.status) ||
    task.is_archived
  ) {
    return false;
  }

  const daysSinceCreation = getDaysSinceCreation(task);

  // 1. Check checklist items first
  const checklistItems = task.checklist_items || [];
  const materialCheckItem = checklistItems.find(
    (item) => item.label === "Redaksi/materi tersedia"
  );

  if (materialCheckItem) {
    if (materialCheckItem.is_done) {
      return false; // Material is marked as available!
    } else {
      // Checklist item is not done, check if task was created >= 2 days ago
      return daysSinceCreation >= 2;
    }
  }

  // 2. Fallback to field checks
  const isCopywritingEmpty = !task.copywriting?.trim();
  const isCopywritingDocsEmpty = !task.copywriting_docs_url?.trim();

  if (isCopywritingEmpty && isCopywritingDocsEmpty) {
    return daysSinceCreation >= 2;
  }

  return false;
}

/**
 * Anti-spam check to prevent duplicated reminder dispatches
 */
export async function hasReminderBeenSent(
  taskId: string,
  type: string,
  channel: "group" | "personal",
  recipient: string
): Promise<boolean> {
  const db = getAdminDb();

  const snapshot = await db
    .collection("task_reminder_logs")
    .where("task_id", "==", taskId)
    .where("reminder_type", "==", type)
    .where("channel", "==", channel)
    .where("recipient", "==", recipient)
    .get();

  if (snapshot.empty) {
    return false;
  }

  if (type === "overdue") {
    let mostRecentSentAt: Date | null = null;
    snapshot.forEach((doc) => {
      const data = doc.data();
      const sentAtDate =
        data.sent_at && typeof data.sent_at === "object" && "toDate" in data.sent_at
          ? (data.sent_at as { toDate: () => Date }).toDate()
          : data.sent_at instanceof Date
          ? data.sent_at
          : null;
      if (sentAtDate) {
        if (!mostRecentSentAt || sentAtDate.getTime() > mostRecentSentAt.getTime()) {
          mostRecentSentAt = sentAtDate;
        }
      }
    });

    if (mostRecentSentAt) {
      const hoursSinceLastSent = (Date.now() - (mostRecentSentAt as Date).getTime()) / (1000 * 60 * 60);
      // Limit overdue notification to at most once per 23 hours
      return hoursSinceLastSent < 23;
    }
  }

  return true;
}

/**
 * Builds formatted Group WhatsApp Reminder message
 */
export function buildGroupReminderMessage(
  task: Task,
  type: string,
  pic: UserProfile | null,
  divisionOrEventName: string,
  missingMaterial: boolean
): string {
  const picName = pic ? pic.name : "-";
  const picWhatsapp = pic?.whatsapp_number ? ` (${pic.whatsapp_number})` : "";
  const formattedDeadline = formatIndonesianDate(task.deadline);
  const formattedStatus = getFormattedStatus(task.status);
  const formattedPriority = getFormattedPriority(task.priority);

  if (type === "stuck_escalation") {
    const constraint = task.stuck_notes ? `Kendala: ${task.stuck_notes}` : "Kendala: Tidak disebutkan";
    return `${WA_LABEL.warning}

🚧 Job Desk Masih Stuck

Tugas: ${task.name}
PIC: ${picName}${picWhatsapp}
Deadline: ${formattedDeadline}
Status: ${formattedStatus}
Acara/Divisi: ${divisionOrEventName}
${constraint}

Saran:
Koordinator dapat membantu membuka kendala atau mengalihkan sebagian tugas jika sudah terlalu lama.`;
  }

  if (task.status === "menunggu_approval") {
    return `${WA_LABEL.reminder}

⏳ Menunggu Approval

Tugas: ${task.name}
PIC: ${picName}${picWhatsapp}
Deadline: ${formattedDeadline}
Status: Menunggu Approval
Acara/Divisi: ${divisionOrEventName}

Catatan:
Tugas sudah dikirim dan menunggu pengecekan. Koordinator dapat segera approve atau minta revisi.`;
  }

  let header: string = WA_LABEL.reminder;
  let icon = "📌";
  let typeTitle = "";

  if (type === "h_7") {
    icon = "📌";
    typeTitle = "H-7 Deadline Job Desk";
  } else if (type === "h_5") {
    icon = "📌";
    typeTitle = "H-5 Deadline Job Desk";
  } else if (type === "h_3") {
    header = WA_LABEL.warning;
    icon = "⚠️";
    typeTitle = `H-3 Deadline Job Desk Prioritas ${formattedPriority}`;
  } else if (type === "h_1") {
    header = WA_LABEL.warning;
    icon = "⚠️";
    typeTitle = "H-1 Deadline Job Desk (Urgent)";
  } else if (type === "today") {
    header = WA_LABEL.warning;
    icon = "⚠️";
    typeTitle = "Hari-H Deadline Job Desk";
  } else if (type === "overdue") {
    header = WA_LABEL.overdue;
    icon = "🚨";
    typeTitle = "Job Desk Lewat Deadline";
  } else if (type === "missing_material") {
    header = WA_LABEL.reminder;
    icon = "⚠️";
    typeTitle = "Kelengkapan Redaksi / Materi Belum Tersedia";
  }

  if (missingMaterial && type !== "missing_material") {
    let dayText = "";
    if (type === "h_7") dayText = "H-7 Deadline";
    else if (type === "h_5") dayText = "H-5 Deadline";
    else if (type === "h_3") dayText = "H-3 Deadline";
    else if (type === "h_1") dayText = "H-1 Deadline";
    else if (type === "today") dayText = "Hari-H Deadline";
    else if (type === "overdue") dayText = "Overdue";

    return `${WA_LABEL.reminder}

⚠️ ${dayText} + Redaksi Belum Tersedia

Tugas: ${task.name}
PIC: ${picName}${picWhatsapp}
Deadline: ${formattedDeadline}
Status: ${formattedStatus}
Prioritas: ${formattedPriority}
Acara/Divisi: ${divisionOrEventName}

Catatan:
* ${
      type === "overdue"
        ? "Tugas ini telah melewati deadline."
        : `Tugas ini memiliki status ${formattedStatus}. Mohon mulai dikerjakan agar tidak mepet deadline.`
    }
* Redaksi/materi belum tersedia.
  Koordinator disarankan segera mengirimkan redaksi agar PIC bisa mulai mengerjakan.`;
  }

  if (type === "missing_material") {
    return `${header}

${icon} ${typeTitle}

Tugas: ${task.name}
PIC: ${picName}${picWhatsapp}
Deadline: ${formattedDeadline}
Status: ${formattedStatus}
Prioritas: ${formattedPriority}
Acara/Divisi: ${divisionOrEventName}

Catatan:
* Redaksi/materi belum tersedia untuk tugas ini.
  Koordinator disarankan segera mengirimkan redaksi agar PIC bisa mulai mengerjakan.`;
  }

  if (type === "overdue") {
    return `${header}

${icon} ${typeTitle}

Tugas: ${task.name}
PIC: ${picName}${picWhatsapp}
Deadline: ${formattedDeadline}
Status: ${formattedStatus}
Prioritas: ${formattedPriority}
Acara/Divisi: ${divisionOrEventName}

Mohon segera ditindaklanjuti oleh PIC atau koordinator.`;
  }

  let catatanAtauSaran = "";
  if (type === "h_3" || type === "h_1" || type === "today") {
    catatanAtauSaran = `Saran:
Koordinator disarankan mengecek progress PIC. Jika PIC tidak memungkinkan mengerjakan, pertimbangkan bantuan atau pengalihan tugas.`;
  } else {
    catatanAtauSaran = `Catatan:
Tugas ini ${
      task.status === "belum_dimulai" ? "belum dimulai" : `memiliki status ${formattedStatus}`
    }. Mohon mulai dikerjakan agar tidak mepet deadline.`;
  }

  return `${header}

${icon} ${typeTitle}

Tugas: ${task.name}
PIC: ${picName}${picWhatsapp}
Deadline: ${formattedDeadline}
Status: ${formattedStatus}
Prioritas: ${formattedPriority}
Acara/Divisi: ${divisionOrEventName}

${catatanAtauSaran}`;
}

export type DigestType =
  | "DAILY_DIGEST"
  | "OVERDUE_DIGEST"
  | "APPROVAL_DIGEST"
  | "URGENT_DIGEST"
  | "EMPTY_EVENT_DIGEST"
  | "NO_DEADLINE_TASK_DIGEST";

export type DigestCategoryKey =
  | "overdue"
  | "today"
  | "h_1"
  | "h_2_h_3"
  | "h_5_h_7"
  | "waitingApproval"
  | "stuck";

export type ReminderDigestTask = {
  task: Task;
  pic: UserProfile | null;
  divisionOrEventName: string;
  diffDays: number | null;
  categories: DigestCategoryKey[];
};

export type ReminderDigest = {
  digestType: DigestType;
  tasks: ReminderDigestTask[];
  taskIds: string[];
  categories: Record<DigestCategoryKey, number>;
  mentionedPhones: string[];
};

const DIGEST_CATEGORY_LABELS: Record<DigestCategoryKey, string> = {
  overdue: "OVERDUE",
  today: "HARI-H",
  h_1: "H-1",
  h_2_h_3: "H-2 / H-3",
  h_5_h_7: "H-5 / H-7",
  waitingApproval: "MENUNGGU APPROVAL",
  stuck: "STUCK / BUTUH BANTUAN",
};

const DIGEST_CATEGORY_ORDER: DigestCategoryKey[] = [
  "overdue",
  "today",
  "h_1",
  "h_2_h_3",
  "h_5_h_7",
  "waitingApproval",
  "stuck",
];

export function normalizeMentionPhone(value?: string) {
  if (!value) {
    return "";
  }

  return value.replace(/[^\d]/g, "").replace(/^0/, "62");
}

function getTaskPrimaryDigestCategory(item: ReminderDigestTask) {
  return item.categories[0] ?? null;
}

function getDigestAction(item: ReminderDigestTask) {
  const category = getTaskPrimaryDigestCategory(item);

  if (item.task.status === "menunggu_approval") {
    return category === "overdue"
      ? "[Prioritas Tinggi] Koordinator harap SEGERA review/approve karena sudah lewat deadline."
      : "Koordinator perlu cek hasil dan approve/revisi.";
  }

  if (item.task.status === "stuck" || item.task.status === "butuh_bantuan") {
    return "Koordinator perlu hubungi PIC untuk membantu kendala/alihkan tugas.";
  }
  
  if (item.task.status === "perlu_revisi" || item.task.status === "revisi_dikerjakan") {
    return "PIC perlu segera menyelesaikan revisi sesuai arahan koordinator.";
  }

  if (item.task.status === "belum_dimulai") {
    return category === "overdue" || category === "today" || category === "h_1"
      ? "PIC belum mulai! Koordinator harap tegur PIC segera."
      : "PIC disarankan mulai mengerjakan agar tidak menumpuk.";
  }

  if (category === "overdue") {
    return "[Prioritas Tinggi] Sudah lewat deadline! PIC harap segera upload hasil akhir.";
  }

  if (category === "today") {
    return "Batas akhir hari ini! PIC perlu segera selesaikan dan upload.";
  }
  
  if (category === "h_1") {
    return "PIC perlu pastikan draft sudah siap hari ini.";
  }

  return "PIC perlu update progress rutin ke sistem.";
}

function getTaskDigestCategories(task: Task, diffDays: number | null) {
  const categories: DigestCategoryKey[] = [];

  if (typeof diffDays === "number") {
    if (diffDays < 0) {
      categories.push("overdue");
    } else if (diffDays === 0) {
      categories.push("today");
    } else if (diffDays === 1) {
      categories.push("h_1");
    } else if (diffDays >= 2 && diffDays <= 3) {
      categories.push("h_2_h_3");
    } else if (diffDays >= 4 && diffDays <= 7) {
      categories.push("h_5_h_7");
    }
  }

  if (task.status === "menunggu_approval") {
    categories.push("waitingApproval");
  }

  if (task.status === "stuck" || task.status === "butuh_bantuan") {
    categories.push("stuck");
  }

  return Array.from(new Set(categories));
}

export function buildReminderDigest(
  tasks: Task[],
  usersMap: Map<string, UserProfile>,
  eventsMap: Map<string, { name?: string }>,
  divisionsMap: Map<string, { name?: string }>,
): ReminderDigest {
  const categories = {
    overdue: 0,
    today: 0,
    h_1: 0,
    h_2_h_3: 0,
    h_5_h_7: 0,
    waitingApproval: 0,
    stuck: 0,
  } satisfies Record<DigestCategoryKey, number>;
  const mentionedPhones = new Set<string>();

  const digestTasks = tasks
    .map((task) => {
      const diffDays = task.deadline ? getTaskDeadlineDiffDays(task) : null;
      const taskCategories = getTaskDigestCategories(task, diffDays);

      if (!taskCategories.length) {
        return null;
      }

      for (const category of taskCategories) {
        categories[category]++;
      }

      const pic = task.pic_id ? usersMap.get(task.pic_id) ?? null : null;
      const phone = normalizeMentionPhone(pic?.whatsapp_number);

      if (phone) {
        mentionedPhones.add(phone);
      }

      let divisionOrEventName = "-";

      if (task.type === "acara" && task.event_id) {
        divisionOrEventName = eventsMap.get(task.event_id)?.name ?? "Acara tidak ditemukan";
      } else if (task.type === "divisi" && task.division_id) {
        divisionOrEventName =
          divisionsMap.get(task.division_id)?.name ?? "Humas dan Media Kreatif";
      }

      return {
        task,
        pic,
        divisionOrEventName,
        diffDays,
        categories: taskCategories,
      } satisfies ReminderDigestTask;
    })
    .filter((item): item is ReminderDigestTask => Boolean(item));

  const digestType: DigestType =
    categories.overdue > 0
      ? "OVERDUE_DIGEST"
      : categories.today > 0 || categories.h_1 > 0 || categories.stuck > 0
      ? "URGENT_DIGEST"
      : categories.waitingApproval > 0
      ? "APPROVAL_DIGEST"
      : "DAILY_DIGEST";

  return {
    digestType,
    tasks: digestTasks,
    taskIds: Array.from(new Set(digestTasks.map((item) => item.task.id))),
    categories,
    mentionedPhones: Array.from(mentionedPhones),
  };
}

export function getFriendlyStatusLabel(status: string): string {
  switch (status) {
    case "perlu_revisi":
      return "Perlu Revisi ⚠️";
    case "sedang_dikerjakan":
      return "Sedang Dikerjakan ⏳";
    case "belum_dimulai":
      return "Belum Dimulai 📋";
    case "stuck":
      return "Stuck 🚨";
    case "butuh_bantuan":
      return "Butuh Bantuan 🆘";
    case "menunggu_materi":
      return "Menunggu Materi 📥";
    case "menunggu_approval":
      return "Menunggu Approval 👀";
    case "draft_selesai":
      return "Draft Selesai ✨";
    case "revisi_dikerjakan":
      return "Revisi Dikerjakan 🛠️";
    case "approved":
      return "Disetujui ✅";
    case "ditunda":
      return "Ditunda ⏸️";
    default:
      return `${getFormattedStatus(status)} 📌`;
  }
}

export function buildDigestReminderMessage(
  digest: ReminderDigest,
  now = new Date(),
  maxTasks = 20,
  targetContext?: {
    targetGroupId?: string;
    groupName?: string;
    groupType?: string;
    isOfficialOrmawaGroup?: boolean;
  }
) {
  const dateText = formatIndonesianDate(now);
  const includedTaskIds = new Set<string>();
  let renderedCount = 0;
  let hasSevereOverdue = false;
  const taskLines: string[] = [];

  // Determine dynamic greeting header
  let greetingTitle = "Tim";
  if (targetContext?.isOfficialOrmawaGroup) {
    greetingTitle = "Forkom KIP";
  } else if (targetContext?.groupName) {
    greetingTitle = targetContext.groupName;
  } else {
    const firstOrg = digest.tasks[0]?.task.organization_id;
    if (firstOrg === "org-undiksha-forkom-kip") {
      greetingTitle = "Forkom KIP";
    } else {
      greetingTitle = "Tim";
    }
  }

  const greetingHeader = `📢 *Halo rekan-rekan ${greetingTitle}!*`;

  for (const category of DIGEST_CATEGORY_ORDER) {
    const categoryTasks = digest.tasks.filter((item) =>
      item.categories.includes(category),
    );

    if (!categoryTasks.length || renderedCount >= maxTasks) {
      continue;
    }

    for (const item of categoryTasks) {
      if (renderedCount >= maxTasks) {
        break;
      }

      if (includedTaskIds.has(item.task.id)) {
        continue;
      }

      const taskTitle =
        item.task.name ||
        (item.task as { title?: string }).title ||
        "Tugas Tanpa Judul";
      const picName = item.pic?.name || "Belum ada PIC";
      const phone = normalizeMentionPhone(item.pic?.whatsapp_number);
      const picDisplay = phone ? `@${phone} (${picName})` : picName;
      const deadline = item.task.deadline
        ? formatIndonesianDate(item.task.deadline)
        : "-";
      const statusText = getFriendlyStatusLabel(item.task.status);

      // Distinguish academic vs event vs division tasks cleanly
      const isClassTask =
        item.task.type === "tugas_kuliah" ||
        (item.task as unknown as Record<string, unknown>).workspace_type === "kelas";

      let eventOrDivLabel = "Divisi";
      let eventOrDivVal = "Umum";

      if (isClassTask) {
        eventOrDivLabel = "Mata Kuliah";
        eventOrDivVal =
          (item.task as unknown as Record<string, unknown>).course_name as string ||
          (item.task as unknown as Record<string, unknown>).subject_name as string ||
          "Umum";
      } else if (item.task.type === "acara") {
        eventOrDivLabel = "Acara";
        eventOrDivVal =
          item.divisionOrEventName && item.divisionOrEventName !== "-"
            ? item.divisionOrEventName
            : "Acara Ormawa";
      } else {
        eventOrDivLabel = "Divisi";
        eventOrDivVal =
          item.divisionOrEventName && item.divisionOrEventName !== "-"
            ? item.divisionOrEventName
            : "Umum";
      }

      // Kondisi 3 & 2: Cek apakah tugas telat parah (> 3 hari) atau berjalan normal
      const diffDays = item.diffDays;
      const isSevereOverdue = diffDays !== null && diffDays <= -3;
      const overdueDays = diffDays !== null && diffDays < 0 ? Math.abs(diffDays) : 0;

      const picMentionOrName = phone ? `@${phone}` : picName;
      let roastingNote = "";
      let taskStatusDisplay = statusText;

      if (isSevereOverdue) {
        hasSevereOverdue = true;
        taskStatusDisplay = `${statusText} (Telat ${overdueDays} Hari ⚠️)`;
        roastingNote = `\n   • 💀 Waduh ${picMentionOrName}, tugas yang ini udah lewat ${overdueDays} hari nih wkwk, yuk segera disetor drafnya jangan sampai jadi fosil ya! 💀`;
      } else if (category === "today") {
        taskStatusDisplay = `${statusText} (Deadline Hari Ini ⏰)`;
      } else if (category === "h_1") {
        taskStatusDisplay = `${statusText} (Besok Deadline ⏳)`;
      } else if (category === "h_2_h_3" && diffDays !== null) {
        taskStatusDisplay = `${statusText} (${diffDays} Hari Lagi 📌)`;
      }

      const notes =
        (category === "stuck" || item.task.status === "stuck") &&
        item.task.stuck_notes
          ? `\n   • Kendala: ${item.task.stuck_notes}`
          : "";

      renderedCount++;
      taskLines.push(
        `${renderedCount}. *${taskTitle}*\n   • ${eventOrDivLabel}: ${eventOrDivVal}\n   • PIC: ${picDisplay}\n   • Deadline: ${deadline}\n   • Status: ${taskStatusDisplay}${notes}${roastingNote}`
      );

      includedTaskIds.add(item.task.id);
    }
  }

  if (taskLines.length === 0) {
    return [
      greetingHeader,
      `Tidak ada tugas yang mendesak atau perlu dicek per siang ini (${dateText}). Semua pengerjaan aman terkendali! 🎉`,
      ``,
      `👉 Cek dashboard: https://jobdexin.sumestawsome.xyz/dashboard/tasks`,
    ].join("\n");
  }

  const remainingCount = Math.max(digest.taskIds.length - renderedCount, 0);
  const remainingText =
    remainingCount > 0
      ? `\n_(dan ${remainingCount} tugas lainnya)_\n`
      : "";

  const footerMessage = hasSevereOverdue
    ? `Yuk yang tugasnya udah lewat deadline atau mendekati waktu setor, gercep disetor yaa biar gak jadi fosil! Tetap semangat tim! 🔥`
    : `Yuk yang belum update atau mau nyetor draf, bisa langsung setor yaa. Semangat! 🔥`;

  return [
    greetingHeader,
    `Ini rekap tugas yang lagi jalan dan butuh dicek per siang ini (${dateText}):`,
    ``,
    taskLines.join("\n\n"),
    remainingText,
    footerMessage,
    `👉 Cek dashboard: https://jobdexin.sumestawsome.xyz/dashboard/tasks`,
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
}

export function buildEmptyEventReminderMessage(
  eventName: string,
  coordDisplay: string,
  secDisplay: string,
  now = new Date(),
): string {
  const dateText = formatIndonesianDate(now);
  return [
    `📢 *Semangat Siang Tim ${eventName}!* ✨`,
    `Wah, acara *${eventName}* sudah resmi terdaftar di JobDex.in per siang ini (${dateText}), tapi belum ada job desk atau pembagian tugas yang diinput sama sekali. 📋`,
    ``,
    `Yuk senggol Koordinator kita ${coordDisplay} dan Sekretaris ${secDisplay} buat mulai rembukan santai bareng panitia, susun timeline, dan input pembagian tugas pertama di web yaa! 🙌`,
    ``,
    `Biar semua pengerjaan ke-track rapi dan gak ada yang keteteran pas hari H. Semangat semuanya! 🔥`,
    `👉 Cek dashboard: https://jobdexin.sumestawsome.xyz/dashboard/tasks`,
  ].join("\n");
}

export function buildNoDeadlineEventReminderMessage(
  eventName: string,
  tasks: Array<{ name: string; picName?: string }>,
  coordDisplay: string,
  secDisplay: string,
  now = new Date()
): string {
  const dateText = formatIndonesianDate(now);
  const taskLines = tasks.slice(0, 10).map((t, idx) => {
    return `${idx + 1}. *${t.name}* (PIC: ${t.picName || "Belum ditentukan"})`;
  });
  const remaining = tasks.length > 10 ? `\n_(dan ${tasks.length - 10} tugas lainnya)_\n` : "";

  return [
    `⚠️ *PERHATIAN: TUGAS KEPANITIAAN BELUM MEMILIKI DEADLINE* ⏰`,
    `Acara: *${eventName}* (${dateText})`,
    ``,
    `Halo Koordinator ${coordDisplay} & Sekretaris ${secDisplay},`,
    `Terdapat *${tasks.length} tugas kepanitiaan* yang belum memiliki tenggat waktu (deadline):`,
    ``,
    taskLines.join("\n"),
    remaining,
    ``,
    `📌 *Mengapa deadline penting?*`,
    `Sistem pengingat berkala JobDex (H-7, H-3, H-1) hanya bisa berjalan jika tenggat waktu sudah ditentukan. Tanpa deadline, sistem tidak dapat mengawal kepanitiaan dengan optimal.`,
    ``,
    `💡 *Segera atur deadline melalui:*`,
    `👉 Buka dashboard web: https://jobdexin.sumestawsome.xyz/dashboard/tasks`,
    `Atau koordinasikan bersama PIC untuk menetapkan tanggal target selesai.`,
    ``,
    `Semangat bertugas rekan-rekan panitia! 🙌`,
  ].join("\n");
}

export async function checkDigestAlreadySentToday(data: {
  digestType?: DigestType;
  groupId: string;
  digestDateKey: string;
}): Promise<boolean> {
  const db = getAdminDb();
  let query = db
    .collection("task_reminder_digest_logs")
    .where("group_id", "==", data.groupId)
    .where("digest_date_key", "==", data.digestDateKey)
    .where("status", "in", ["sent", "pending"]);

  if (data.digestType) {
    query = query.where("digest_type", "==", data.digestType);
  }

  const snapshot = await query.limit(1).get();
  return !snapshot.empty;
}

export function getDigestDateKey(date = new Date()) {
  const tz = (typeof process !== "undefined" && process.env?.APP_TIMEZONE) || "Asia/Jakarta";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export async function getTaskIdsAlreadyInDigestToday(data: {
  digestType?: DigestType;
  groupId: string;
  digestDateKey: string;
}) {
  const db = getAdminDb();
  let query = db
    .collection("task_reminder_digest_logs")
    .where("group_id", "==", data.groupId)
    .where("digest_date_key", "==", data.digestDateKey)
    .where("status", "in", ["sent", "pending"]);

  if (data.digestType) {
    query = query.where("digest_type", "==", data.digestType);
  }

  const snapshot = await query.get();

  const taskIds = new Set<string>();

  snapshot.forEach((doc) => {
    const log = doc.data();
    const ids = Array.isArray(log.task_ids) ? log.task_ids : [];

    for (const id of ids) {
      if (typeof id === "string") {
        taskIds.add(id);
      }
    }
  });

  return taskIds;
}

export async function createTaskReminderDigestLog(data: {
  digestType: DigestType;
  groupId: string;
  digestDateKey: string;
  taskIds: string[];
  allCurrentTaskIds: string[];
  newTaskIds: string[];
  categories: Record<DigestCategoryKey, number>;
  mentionedPhones: string[];
  status: "sent" | "failed" | "pending";
  messageContent: string;
  whatsappLogId?: string;
  // Fase 19C group routing logging
  target_group_id?: string;
  target_group_type?: string;
  linked_event_id?: string;
  linked_division_id?: string;
  fallback_reason?: string;
}) {
  const db = getAdminDb();
  const logRef = db.collection("task_reminder_digest_logs").doc();

  await logRef.set({
    id: logRef.id,
    digest_type: data.digestType,
    group_id: data.groupId,
    digest_date_key: data.digestDateKey,
    task_ids: data.taskIds,
    all_current_task_ids: data.allCurrentTaskIds,
    new_task_ids: data.newTaskIds,
    task_count: data.allCurrentTaskIds.length,
    new_task_count: data.newTaskIds.length,
    categories: data.categories,
    mentioned_phones: data.mentionedPhones,
    sent_at: FieldValue.serverTimestamp(),
    status: data.status,
    message_preview: sanitizePinFromMessage(data.messageContent).slice(0, 500),
    ...(data.whatsappLogId ? { whatsapp_log_id: data.whatsappLogId } : {}),
    // Group routing extra fields
    target_group_id: data.target_group_id || data.groupId,
    target_group_type: data.target_group_type || "default_group",
    linked_event_id: data.linked_event_id || null,
    linked_division_id: data.linked_division_id || null,
    fallback_reason: data.fallback_reason || null,
  });

  return logRef.id;
}

export async function logWhatsAppDigestDispatch(data: {
  organizationId: string;
  recipient: string;
  messageContent: string;
  status: string;
  taskIds: string[];
  categories: Record<DigestCategoryKey, number>;
  mentionedPhones: string[];
  wablasResponse?: string;
  errorMessage?: string;
  cooldownUntil?: Date | null;
  rateLimitReason?: string;
  provider?: string;
}) {
  const db = getAdminDb();
  const logRef = db.collection("whatsapp_logs").doc();

  await logRef.set({
    id: logRef.id,
    organization_id: data.organizationId || "main_org",
    task_ids: data.taskIds,
    task_count: data.taskIds.length,
    categories: data.categories,
    event_type: "deadline_digest",
    message_content: sanitizePinFromMessage(data.messageContent),
    recipient: data.recipient,
    recipient_group_id: data.recipient,
    recipient_type: "group",
    is_group: true,
    status: data.status,
    send_status: data.status,
    error_message: data.errorMessage || null,
    cooldown_until: data.cooldownUntil || null,
    mentioned_phones: data.mentionedPhones,
    message_length: data.messageContent.length,
    rate_limit_status: data.rateLimitReason ? "limited" : "ok",
    rate_limit_reason: data.rateLimitReason || null,
    ...(data.wablasResponse ? { wablas_response: data.wablasResponse } : {}),
    retry_count: 0,
    created_at: FieldValue.serverTimestamp(),
    provider: data.provider || process.env.WHATSAPP_PROVIDER || "wablas",
    target_type: "group",
  });

  return logRef.id;
}

/**
 * Builds formatted Personal WhatsApp Reminder message to PIC
 */
export function buildPersonalReminderMessage(task: Task, picName: string): string {
  const taskTitle = task.name || (task as { title?: string }).title || "Tugas Tanpa Judul";
  const formattedDeadline = formatIndonesianDate(task.deadline);
  const formattedStatus = getFriendlyStatusLabel(task.status);
  const formattedPriority = getFormattedPriority(task.priority);

  return [
    `✨ *Halo ${picName}!*`,
    ``,
    `Ada job desk yang perlu diperhatikan nih:`,
    ``,
    `• Tugas: *${taskTitle}*`,
    `• Deadline: ${formattedDeadline}`,
    `• Status: ${formattedStatus}`,
    `• Prioritas: ${formattedPriority}`,
    ``,
    `Kalau udah mulai dikerjakan atau mau setor draf, langsung update di JobdexIn yaa. Semangat! 🙌`,
    `👉 https://jobdexin.sumestawsome.xyz/dashboard/tasks`,
  ].join("\n");
}

/**
 * Inserts log entry in task_reminder_logs collection
 */
export async function createTaskReminderLog(data: {
  task: Task;
  reminderType: string;
  channel: "group" | "personal";
  recipient: string;
  messageContent: string;
  whatsappLogId?: string;
}): Promise<void> {
  const db = getAdminDb();
  const logRef = db.collection("task_reminder_logs").doc();

  await logRef.set({
    id: logRef.id,
    task_id: data.task.id,
    reminder_type: data.reminderType,
    channel: data.channel,
    recipient: data.recipient,
    sent_at: FieldValue.serverTimestamp(),
    status_at_send: data.task.status,
    priority_at_send: data.task.priority,
    deadline: data.task.deadline,
    message_content: data.messageContent,
    ...(data.whatsappLogId ? { whatsapp_log_id: data.whatsappLogId } : {}),
  });
}

/**
 * Logs dispatch attempt to whatsapp_logs collection
 */
export async function logWhatsAppDispatch(data: {
  task: Task;
  recipient: string;
  recipientType: "group" | "personal";
  messageContent: string;
  status: string;
  wablasResponse?: string;
  errorMessage?: string;
  errorCode?: string | number;
  cooldownUntil?: Date | null;
  rateLimitReason?: string;
  provider?: string;
}): Promise<string> {
  const db = getAdminDb();
  const logRef = db.collection("whatsapp_logs").doc();

  await logRef.set({
    id: logRef.id,
    organization_id: data.task.organization_id || "main_org",
    task_id: data.task.id,
    event_type: "deadline_reminder",
    message_content: sanitizePinFromMessage(data.messageContent),
    recipient: data.recipient,
    recipient_type: data.recipientType,
    is_group: data.recipientType === "group",
    status: data.status,
    send_status: data.status,
    error_code: data.errorCode || null,
    error_message: data.errorMessage || null,
    cooldown_until: data.cooldownUntil || null,
    message_length: data.messageContent.length,
    rate_limit_reason: data.rateLimitReason || null,
    ...(data.wablasResponse ? { wablas_response: data.wablasResponse } : {}),
    retry_count: 0,
    created_at: FieldValue.serverTimestamp(),
    provider: data.provider || process.env.WHATSAPP_PROVIDER || "wablas",
    target_type: data.recipientType === "personal" ? "phone" : "group",
  });

  return logRef.id;
}

/**
 * Retrieves the dedicated WhatsApp group ID for the Ormawa workspace from Firestore.
 * Ensures that class group IDs are never returned as an Ormawa dedicated group.
 */
export async function getDedicatedOrmawaGroupId(
  db: FirebaseFirestore.Firestore
): Promise<string | null> {
  try {
    const wsDoc = await db.collection("workspaces").doc("main_org").get();
    if (wsDoc.exists) {
      const d = wsDoc.data();
      const g = d?.whatsapp_group_id || d?.whatsapp_settings?.group_id;
      if (typeof g === "string" && g.trim() && !isKnownClassGroupId(g.trim())) {
        return g.trim();
      }
    }
    const snap = await db.collection("workspaces").where("workspace_type", "==", "ormawa").get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const g = d?.whatsapp_group_id || d?.whatsapp_settings?.group_id;
      if (typeof g === "string" && g.trim() && !isKnownClassGroupId(g.trim())) {
        return g.trim();
      }
    }
  } catch (err) {
    console.warn("[DeadlineReminders] Error checking dedicated ormawa group:", err);
  }
  return null;
}

export async function processSmartFollowupReminders(
  sendWhatsAppMessage: (payload: {
    target: string;
    message: string;
    type?: "phone" | "group";
    org_id?: string;
    orgId?: string;
  }) => Promise<{ provider: string; responseText?: string; skipped?: boolean; error?: string }>
) {
  const db = getAdminDb();
  let sent = 0;
  let failed = 0;
  const errors: { target: string; reason: string }[] = [];
  
  // 1. Fetch active tasks (is_archived == false)
  const tasksSnap = await db.collection("tasks").where("is_archived", "==", false).get();
  
  // 2. Fetch users, events, divisions maps
  const [usersSnap, eventsSnap, divisionsSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("events").get(),
    db.collection("divisions").get(),
  ]);
  
  const usersMap = new Map<string, UserProfile>();
  usersSnap.forEach((doc) => {
    usersMap.set(doc.id, { id: doc.id, ...doc.data() } as UserProfile);
  });
  
  const eventsCache = new Map<string, Event>();
  eventsSnap.forEach((doc) => {
    eventsCache.set(doc.id, { id: doc.id, ...doc.data() } as Event);
  });
  
  const divisionsMap = new Map<string, { name?: string; whatsapp_group_id?: string; whatsapp_group_name?: string; whatsapp_group_verified?: boolean }>();
  divisionsSnap.forEach((doc) => {
    divisionsMap.set(doc.id, doc.data() as { name?: string; whatsapp_group_id?: string; whatsapp_group_name?: string; whatsapp_group_verified?: boolean });
  });

  const now = new Date();
  
  for (const doc of tasksSnap.docs) {
    const task = { id: doc.id, ...doc.data() } as Task;
    if (task.status === "approved" || task.status === ("selesai" as unknown as typeof task.status)) continue;

    // Strict Ormawa isolation: smart follow-up reminders are strictly for Ormawa tasks (divisi & acara)
    if (task.type === "tugas_kuliah" || isAcademicClassTask(task) || (task.type !== "divisi" && task.type !== "acara")) {
      continue;
    }

    const taskTitle =
      task.name || (task as { title?: string }).title || "Tugas Tanpa Judul";
    const pic = task.pic_id ? usersMap.get(task.pic_id) : null;
    const rawPicPhone = pic?.whatsapp_number
      ? pic.whatsapp_number.replace(/[^\d]/g, "").replace(/^0/, "62")
      : "";
    const picPhone = rawPicPhone;
    const picDisplay = picPhone
      ? `@${picPhone} (${pic?.name || "PIC"})`
      : pic?.name || "Belum ada PIC";

    const target = await resolveTaskNotificationTarget(
      task,
      eventsCache,
      divisionsMap,
    );

    // Prevent escalations from ever targeting known class groups
    if (target?.recipient && isKnownClassGroupId(target.recipient)) {
      continue;
    }
    const targetGroupId =
      target?.targetType === "personal" ? "" : target?.recipient || "";

    const diffDays = getTaskDeadlineDiffDays(task);

    // Compute last update elapsed time
    const updatedAt =
      task.updated_at &&
      typeof task.updated_at === "object" &&
      "toDate" in task.updated_at
        ? (task.updated_at as { toDate: () => Date }).toDate()
        : task.updated_at instanceof Date
        ? task.updated_at
        : new Date();

    const hoursSinceUpdate =
      (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

    // Evaluate rules:

    // Rule 1: H-3 but status is belum_dimulai -> Personal reminder to PIC
    if (diffDays === 3 && task.status === "belum_dimulai" && picPhone) {
      const type = "h_3_belum_dimulai";
      const alreadySent = await hasReminderBeenSent(
        task.id,
        type,
        "personal",
        picPhone,
      );
      if (!alreadySent) {
        const msg = [
          `✨ *Halo ${pic?.name || "Rekan"}!*`,
          ``,
          `Mau ngingetin nih, tugas *${taskTitle}* deadlinenya tinggal H-3 (${formatIndonesianDate(
            task.deadline,
          )}).`,
          `Status sekarang masih *Belum Dimulai*.`,
          ``,
          `Yuk mulai dicicil atau update statusnya yaa. Semangat! 🙌`,
          `_Cepat update: balas \`!jobdex ${taskTitle} sudah mulai dikerjakan\`_`,
          `👉 https://jobdexin.sumestawsome.xyz/dashboard/tasks`,
        ].join("\n");

        try {
          const taskOrgId =
            task.org_id || task.orgId || task.organization_id;
          const result = await sendWhatsAppMessage({
            target: picPhone,
            message: msg,
            type: "phone",
            org_id: taskOrgId,
          });
          if (result.skipped) {
            await logWhatsAppDispatch({
              task,
              recipient: picPhone,
              recipientType: "personal",
              messageContent: msg,
              status: "skipped",
              errorMessage:
                result.error ||
                "Gateway WhatsApp ormawa belum dikonfigurasi.",
              provider: result.provider,
            });
            continue;
          }
          const whatsappLogId = await logWhatsAppDispatch({
            task,
            recipient: picPhone,
            recipientType: "personal",
            messageContent: msg,
            status: "sent",
            wablasResponse: result.responseText,
            provider: result.provider,
          });
          await createTaskReminderLog({
            task,
            reminderType: type,
            channel: "personal",
            recipient: picPhone,
            messageContent: msg,
            whatsappLogId,
          });
          sent++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(
            `Failed to send personal reminder PIC ${picPhone}:`,
            err,
          );
          failed++;
          errors.push({ target: picPhone, reason: errMsg });
          await logWhatsAppDispatch({
            task,
            recipient: picPhone,
            recipientType: "personal",
            messageContent: msg,
            status: "failed",
            errorMessage: errMsg,
            provider: process.env.WHATSAPP_PROVIDER || "wablas",
          });
        }
      }
    }

    // Rule 2: H-1 but status is not menunggu_approval or approved -> Personal reminder to PIC
    if (diffDays === 1 && task.status !== "menunggu_approval" && picPhone) {
      const type = "h_1_urgent";
      const alreadySent = await hasReminderBeenSent(
        task.id,
        type,
        "personal",
        picPhone,
      );
      if (!alreadySent) {
        const statusLabel = getFriendlyStatusLabel(task.status);
        const msg = [
          `⚠️ *Halo ${pic?.name || "Rekan"}!*`,
          ``,
          `Tugas *${taskTitle}* deadlinenya besok (H-1) nih!`,
          `Status saat ini: *${statusLabel}*`,
          ``,
          `Kalau drafnya udah siap, langsung setor drafnya yaa biar bisa dicek koor. Semangat pol-polan! 💪`,
          `_Cepat update: balas \`!jobdex ${taskTitle} sudah upload\` atau lapor kendala via \`!jobdex ${taskTitle} stuck\`_`,
          `👉 https://jobdexin.sumestawsome.xyz/dashboard/tasks`,
        ].join("\n");

        try {
          const taskOrgId =
            task.org_id || task.orgId || task.organization_id;
          const result = await sendWhatsAppMessage({
            target: picPhone,
            message: msg,
            type: "phone",
            org_id: taskOrgId,
          });
          if (result.skipped) {
            await logWhatsAppDispatch({
              task,
              recipient: picPhone,
              recipientType: "personal",
              messageContent: msg,
              status: "skipped",
              errorMessage:
                result.error ||
                "Gateway WhatsApp ormawa belum dikonfigurasi.",
              provider: result.provider,
            });
            continue;
          }
          const whatsappLogId = await logWhatsAppDispatch({
            task,
            recipient: picPhone,
            recipientType: "personal",
            messageContent: msg,
            status: "sent",
            wablasResponse: result.responseText,
            provider: result.provider,
          });
          await createTaskReminderLog({
            task,
            reminderType: type,
            channel: "personal",
            recipient: picPhone,
            messageContent: msg,
            whatsappLogId,
          });
          sent++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(
            `Failed to send personal reminder PIC ${picPhone}:`,
            err,
          );
          failed++;
          errors.push({ target: picPhone, reason: errMsg });
          await logWhatsAppDispatch({
            task,
            recipient: picPhone,
            recipientType: "personal",
            messageContent: msg,
            status: "failed",
            errorMessage: errMsg,
            provider: process.env.WHATSAPP_PROVIDER || "wablas",
          });
        }
      }
    }

    // Rule 3: Stuck/butuh bantuan > 12 hours -> Group alert
    if (
      (task.status === "stuck" || task.status === "butuh_bantuan") &&
      hoursSinceUpdate >= 12 &&
      targetGroupId
    ) {
      const type = "stuck_12h";
      const alreadySent = await hasReminderBeenSent(
        task.id,
        type,
        "group",
        targetGroupId,
      );
      if (!alreadySent) {
        const durationStr = Math.round(hoursSinceUpdate) + " jam";
        const constraint = task.stuck_notes
          ? `Kendala: ${task.stuck_notes}`
          : "Kendala: Tidak disebutkan";
        const msg = [
          `🚨 *Halo Koor & Rekan-rekan!*`,
          ``,
          `Ada tugas yang lagi butuh bantuan nih:`,
          `• Tugas: *${taskTitle}* (stuck ${durationStr})`,
          `• PIC: ${picDisplay}`,
          `• ${constraint}`,
          ``,
          `Tolong dibantu cek yaa koor, biar bisa jalan bareng-bareng lagi! 🙌`,
          `👉 https://jobdexin.sumestawsome.xyz/dashboard/tasks`,
        ].join("\n");

        try {
          const taskOrgId =
            task.org_id || task.orgId || task.organization_id;
          const result = await sendWhatsAppMessage({
            target: targetGroupId,
            message: msg,
            type: "group",
            org_id: taskOrgId,
          });
          if (result.skipped) {
            await logWhatsAppDispatch({
              task,
              recipient: targetGroupId,
              recipientType: "group",
              messageContent: msg,
              status: "skipped",
              errorMessage:
                result.error ||
                "Gateway WhatsApp ormawa belum dikonfigurasi.",
              provider: result.provider,
            });
            continue;
          }
          const whatsappLogId = await logWhatsAppDispatch({
            task,
            recipient: targetGroupId,
            recipientType: "group",
            messageContent: msg,
            status: "sent",
            wablasResponse: result.responseText,
            provider: result.provider,
          });
          await createTaskReminderLog({
            task,
            reminderType: type,
            channel: "group",
            recipient: targetGroupId,
            messageContent: msg,
            whatsappLogId,
          });
          sent++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`Failed to send group stuck alert:`, err);
          failed++;
          errors.push({ target: targetGroupId, reason: errMsg });
          await logWhatsAppDispatch({
            task,
            recipient: targetGroupId,
            recipientType: "group",
            messageContent: msg,
            status: "failed",
            errorMessage: errMsg,
            provider: process.env.WHATSAPP_PROVIDER || "wablas",
          });
        }
      }
    }

    // Rule 4: Menunggu materi > 24 hours -> Group alert
    if (
      task.status === "menunggu_materi" &&
      hoursSinceUpdate >= 24 &&
      targetGroupId
    ) {
      const type = "waiting_material_24h";
      const alreadySent = await hasReminderBeenSent(
        task.id,
        type,
        "group",
        targetGroupId,
      );
      if (!alreadySent) {
        const msg = [
          `📥 *Halo Koor & Panitia!*`,
          ``,
          `Tugas *${taskTitle}* (PIC: ${picDisplay}) udah menunggu materi lebih dari 1 hari nih.`,
          `Catatan: ${task.stuck_notes || "Materi belum lengkap"}`,
          ``,
          `Yuk yang pegang materi/redaksi bisa segera dikirimkan ke PIC agar desain bisa segera digarap! ✨`,
          `👉 https://jobdexin.sumestawsome.xyz/dashboard/tasks`,
        ].join("\n");

        try {
          const taskOrgId =
            task.org_id || task.orgId || task.organization_id;
          const result = await sendWhatsAppMessage({
            target: targetGroupId,
            message: msg,
            type: "group",
            org_id: taskOrgId,
          });
          if (result.skipped) {
            await logWhatsAppDispatch({
              task,
              recipient: targetGroupId,
              recipientType: "group",
              messageContent: msg,
              status: "skipped",
              errorMessage:
                result.error ||
                "Gateway WhatsApp ormawa belum dikonfigurasi.",
              provider: result.provider,
            });
            continue;
          }
          const whatsappLogId = await logWhatsAppDispatch({
            task,
            recipient: targetGroupId,
            recipientType: "group",
            messageContent: msg,
            status: "sent",
            wablasResponse: result.responseText,
            provider: result.provider,
          });
          await createTaskReminderLog({
            task,
            reminderType: type,
            channel: "group",
            recipient: targetGroupId,
            messageContent: msg,
            whatsappLogId,
          });
          sent++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`Failed to send group waiting material alert:`, err);
          failed++;
          errors.push({ target: targetGroupId, reason: errMsg });
          await logWhatsAppDispatch({
            task,
            recipient: targetGroupId,
            recipientType: "group",
            messageContent: msg,
            status: "failed",
            errorMessage: errMsg,
            provider: process.env.WHATSAPP_PROVIDER || "wablas",
          });
        }
      }
    }

    // Rule 5: Menunggu approval > 24 hours -> Group alert to coordinators
    if (
      task.status === "menunggu_approval" &&
      hoursSinceUpdate >= 24 &&
      targetGroupId
    ) {
      const type = "waiting_approval_24h";
      const alreadySent = await hasReminderBeenSent(
        task.id,
        type,
        "group",
        targetGroupId,
      );
      if (!alreadySent) {
        const msg = [
          `👀 *Halo Koordinator!*`,
          ``,
          `Draf tugas *${taskTitle}* garapan *${picDisplay}* udah menunggu approval lebih dari 1 hari nih.`,
          ``,
          `Tolong dicek ya koor, biar bisa segera di-approve atau dikasih masukan kalau butuh revisi:`,
          `• Approve: \`!jobdex acc ${taskTitle}\``,
          `• Revisi: \`!jobdex revisi ${taskTitle}, catatan: [masukan]\``,
          `👉 https://jobdexin.sumestawsome.xyz/dashboard/tasks`,
        ].join("\n");

        try {
          const taskOrgId =
            task.org_id || task.orgId || task.organization_id;
          const result = await sendWhatsAppMessage({
            target: targetGroupId,
            message: msg,
            type: "group",
            org_id: taskOrgId,
          });
          if (result.skipped) {
            await logWhatsAppDispatch({
              task,
              recipient: targetGroupId,
              recipientType: "group",
              messageContent: msg,
              status: "skipped",
              errorMessage:
                result.error ||
                "Gateway WhatsApp ormawa belum dikonfigurasi.",
              provider: result.provider,
            });
            continue;
          }
          const whatsappLogId = await logWhatsAppDispatch({
            task,
            recipient: targetGroupId,
            recipientType: "group",
            messageContent: msg,
            status: "sent",
            wablasResponse: result.responseText,
            provider: result.provider,
          });
          await createTaskReminderLog({
            task,
            reminderType: type,
            channel: "group",
            recipient: targetGroupId,
            messageContent: msg,
            whatsappLogId,
          });
          sent++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`Failed to send group waiting approval alert:`, err);
          failed++;
          errors.push({ target: targetGroupId, reason: errMsg });
          await logWhatsAppDispatch({
            task,
            recipient: targetGroupId,
            recipientType: "group",
            messageContent: msg,
            status: "failed",
            errorMessage: errMsg,
            provider: process.env.WHATSAPP_PROVIDER || "wablas",
          });
        }
      }
    }
  }

  return { sent, failed, errors };
}
