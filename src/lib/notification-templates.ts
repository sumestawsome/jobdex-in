import { TASK_STATUS_LABELS } from "@/lib/task-status";
import { WA_LABEL } from "@/lib/server/whatsapp-labels";
import type { Task, TaskStatus, UserProfile } from "@/types";

type NotificationTemplateInput = {
  task: Task;
  actor?: UserProfile | null;
  pic?: UserProfile | null;
  coordinator?: UserProfile | null;
  status?: TaskStatus;
  note?: string;
  stuckNotes?: string;
  revisionNotes?: string;
  uploadUrl?: string;
  thumbnailUrl?: string;
};

export type WhatsAppEventType =
  | "task_created"
  | "task_status_changed"
  | "task_help_needed"
  | "task_result_uploaded"
  | "task_revision_requested"
  | "task_approved";

export function buildWhatsAppMessage(
  eventType: WhatsAppEventType,
  input: NotificationTemplateInput,
) {
  const taskTitle = input.task.name || (input.task as { title?: string }).title || "Tugas Tanpa Judul";
  const actorName = input.actor?.name ?? "Rekan Panitia";
  const picName = input.pic?.name ?? "PIC belum ditentukan";
  const picPhone = input.pic?.whatsapp_number
    ? input.pic.whatsapp_number.replace(/[^\d]/g, "").replace(/^0/, "62")
    : "";
  const picDisplay = picPhone ? `@${picPhone} (${picName})` : picName;
  const coordinatorName = input.coordinator?.name ?? actorName;
  const deadline = formatTaskDate(input.task.deadline);
  const statusLabel = input.status
    ? TASK_STATUS_LABELS[input.status]
    : TASK_STATUS_LABELS[input.task.status];

  if (eventType === "task_help_needed") {
    return [
      "🚨 *Ada Kendala Pengerjaan Tugas*",
      "",
      `*${actorName}* butuh bantuan untuk tugas *${taskTitle}*:`,
      `> ${input.stuckNotes || input.note || "Kendala teknis/materi pengerjaan"}`,
      "",
      `PIC: *${picDisplay}*`,
      `Status: *${statusLabel}*`,
      `Deadline: *${deadline}*`,
      "",
      "Yuk rekan-rekan atau koordinator terkait, tolong dibantu yaa! 🙏",
      "👉 Cek detail: https://jobdexin.sumestawsome.xyz/dashboard/tasks",
    ].join("\n");
  }

  if (eventType === "task_result_uploaded") {
    return [
      "🎨 *Draf Desain Udah Diupload!*",
      "",
      `*${actorName}* baru aja beres upload hasil buat tugas *${taskTitle}*.`,
      `Link: ${input.uploadUrl || "-"}`,
      ...(input.thumbnailUrl ? [`Preview: ${input.thumbnailUrl}`] : []),
      "",
      "Tolong dicek ya koor, biar bisa langsung di-acc atau dikasih catatan kalau butuh polesan lagi.",
      "👉 Cek tugas: https://jobdexin.sumestawsome.xyz/dashboard/tasks",
    ].join("\n");
  }

  if (eventType === "task_revision_requested") {
    return [
      "📝 *Ada Catatan Revisi*",
      "",
      `Buat tugas *${taskTitle}* (PIC: *${picDisplay}*), ada masukan dari koordinator nih:`,
      `> ${input.revisionNotes || input.note || "Perlu penyesuaian detail"}`,
      "",
      "Semangat polesnya ya, ditunggu update terbarunya! 💪",
      "👉 Cek detail: https://jobdexin.sumestawsome.xyz/dashboard/tasks",
    ].join("\n");
  }

  if (eventType === "task_approved") {
    return [
      "🎉 *Mantap! Tugas Disetujui*",
      "",
      `Tugas *${taskTitle}* garapan *${picName}* udah resmi di-approve sama *${coordinatorName}*.`,
      "Otomatis tersimpan ke arsip desain. Makasih banyak kerja kerasnya! ✨",
      "👉 Cek arsip: https://jobdexin.sumestawsome.xyz/dashboard/tasks",
    ].join("\n");
  }

  if (eventType === "task_created") {
    return [
      "✨ *Ada tugas baru nih buat kamu!*",
      "",
      `Tugas: *${taskTitle}*`,
      `PIC: *${picDisplay}*`,
      `Deadline: *${deadline}*`,
      `Koordinator: ${coordinatorName}`,
      "",
      "Kalau udah mulai dikerjain, jangan lupa update statusnya ya! 🙌",
      "👉 Cek tugas: https://jobdexin.sumestawsome.xyz/dashboard/tasks",
    ].join("\n");
  }

  return [
    "📌 *Update Progress Tugas*",
    "",
    `*${actorName}* baru aja memperbarui tugas *${taskTitle}*.`,
    `Status: *${statusLabel}*`,
    ...(input.note ? [`Catatan: ${input.note}`] : []),
    `Deadline: *${deadline}*`,
    "",
    "👉 Cek tugas: https://jobdexin.sumestawsome.xyz/dashboard/tasks",
  ].join("\n");
}

function formatTaskDate(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format((value as { toDate: () => Date }).toDate());
}
