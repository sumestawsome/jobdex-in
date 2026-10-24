import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskActionButtons } from "@/components/tasks/task-action-buttons";
import { TaskActivityLog } from "@/components/tasks/task-activity-log";
import { TaskApprovalBadge } from "@/components/tasks/task-approval-badge";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { TaskUploadSection } from "@/components/tasks/task-upload-section";
import { TaskWorkflowPanel } from "@/components/tasks/task-workflow-panel";
import { TaskChecklist } from "@/components/tasks/task-checklist";
import { SuggestedReferencesDialog } from "@/components/references/suggested-references-dialog";
import { formatTaskDate } from "@/lib/firebase/tasks";
import { TASK_STATUS_LABELS } from "@/lib/task-status";
import type { Event, Task, TaskStatusLog, TaskUpload, UserProfile } from "@/types";

type TaskDetailProps = {
  task: Task;
  usersById: Map<string, UserProfile>;
  eventsById: Map<string, Event>;
  logs: TaskStatusLog[];
  uploads: TaskUpload[];
  currentUser: UserProfile;
  onChanged: () => Promise<void>;
  returnTo?: string;
  eventRole?: string;
};

function formatDateTime(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format((value as { toDate: () => Date }).toDate());
}

export function TaskDetail({
  task,
  usersById,
  eventsById,
  logs,
  uploads,
  currentUser,
  onChanged,
  returnTo = "/dashboard/tasks",
  eventRole,
}: TaskDetailProps) {
  const [refDialogOpen, setRefDialogOpen] = useState(false);

  const eventName = task.event_id ? eventsById.get(task.event_id)?.name ?? "" : "";

  const rows: Array<[string, React.ReactNode]> = [
    ["Tipe task", task.type === "tugas_kuliah" ? "Tugas Kuliah" : task.type],
    ...(task.course_name || task.subject_name
      ? [["Mata Kuliah", task.course_name || task.subject_name] as [string, React.ReactNode]]
      : []),
    ...(task.submission_url || task.submission_link
      ? [
          [
            "Link / Tempat Pengumpulan",
            (() => {
              const val = (task.submission_url || task.submission_link || "").trim();
              const isUrl = /^https?:\/\//i.test(val);
              return isUrl ? (
                <a
                  key="sub_link"
                  href={val}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 dark:text-sky-400 underline break-all font-medium hover:text-sky-800"
                >
                  {val}
                </a>
              ) : (
                <span key="sub_text" className="font-medium text-zinc-800 dark:text-zinc-200">
                  {val}
                </span>
              );
            })(),
          ] as [string, React.ReactNode],
        ]
      : []),
    ...(task.type === "acara" ? [["Acara", task.event_id ? eventName || "Acara tidak ditemukan" : "-"] as [string, React.ReactNode]] : []),
    ...(task.type === "divisi" ? [["Divisi", task.division_id || "-"] as [string, React.ReactNode]] : []),
    ["PIC", usersById.get(task.pic_id)?.name ?? "User tidak ditemukan"],
    ["Koordinator", usersById.get(task.coordinator_id)?.name ?? "User tidak ditemukan"],
    ["Deadline", formatTaskDate(task.deadline)],
    ["Approval status", task.approval_status],
    ["Created by", usersById.get(task.created_by)?.name ?? task.created_by],
    ["Created at", formatDateTime(task.created_at)],
    ["Updated at", formatDateTime(task.updated_at)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <section>
          <div className="flex flex-wrap gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            <TaskApprovalBadge status={task.approval_status} />
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-950 dark:text-slate-50">{task.name}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {task.description || "Tidak ada deskripsi."}
          </p>
        </section>
        <Button asChild variant="secondary">
          <Link href={returnTo}>Kembali</Link>
        </Button>
      </div>

      <TaskActionButtons
        task={task}
        currentUser={currentUser}
        onChanged={onChanged}
        eventRole={eventRole}
      />

      <TaskWorkflowPanel task={task} usersById={usersById} />

      <TaskChecklist
        task={task}
        profile={currentUser}
        onUpdate={onChanged}
      />

      <Card>
        <CardHeader>
          <CardTitle>Informasi task</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map(([label, value]) => (
              <div key={label} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr]">
                <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="text-sm font-semibold text-slate-950 dark:text-slate-50">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kategori &amp; Arsip</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kategori Utama</p>
              <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                {task.category_label || "Belum dikategorikan"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Subkategori</p>
              <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                {task.subcategory_label || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Jenis Output</p>
              <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                {task.output_types?.length ? task.output_types.join(", ") : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Masuk Arsip</p>
              <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                {task.archive_enabled === undefined ? "-" : task.archive_enabled ? "Ya" : "Tidak"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kandidat Referensi</p>
              <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                {task.reference_candidate_enabled === undefined ? "-" : task.reference_candidate_enabled ? "Ya" : "Tidak"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sensitivitas Data</p>
              <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50 capitalize">
                {task.data_sensitivity || "normal"}
              </p>
            </div>
            {task.source_link ? (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Link Sumber (Canva/Figma/Drive)</p>
                <a
                  href={task.source_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-200 text-sm font-semibold break-all"
                >
                  {task.source_link}
                </a>
              </div>
            ) : null}
            {task.archive_notes ? (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Catatan Arsip</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{task.archive_notes}</p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 w-full max-w-full min-w-0">
        <Card className="w-full min-w-0 max-w-full">
          <CardHeader>
            <CardTitle>Redaksi dan referensi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm w-full min-w-0 max-w-full">
            <Block label="Copywriting" value={task.copywriting} />
            <LinkBlock label="Google Docs redaksi" href={task.copywriting_docs_url} />
            <LinkBlock label="Referensi desain" href={task.design_reference_url} />
            <LinkBlock label="Google Drive referensi" href={task.drive_reference_url} />
            
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 w-full min-w-0 max-w-full">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setRefDialogOpen(true)}
                className="w-full text-xs font-semibold py-1.5 h-auto whitespace-normal break-words"
              >
                Perlu Referensi Cerdas
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="w-full min-w-0 max-w-full">
          <CardHeader>
            <CardTitle>Arahan visual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm w-full min-w-0 max-w-full">
            <Block label="Arahan visual/supergrafis" value={task.visual_direction} />
            <div className="w-full min-w-0 max-w-full">
              <p className="font-semibold text-slate-950 dark:text-slate-50">Color palette</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {task.color_palette?.length ? (
                  task.color_palette.map((color) => (
                    <span key={color} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <span className="size-4 rounded-full border border-slate-200 dark:border-slate-800" style={{ backgroundColor: color }} />
                      {color}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">-</span>
                )}
              </div>
            </div>
            <Block label="Revision notes" value={task.revision_notes} />
            <Block label="Stuck notes" value={task.stuck_notes} />
            <Block label="Status saat ini" value={TASK_STATUS_LABELS[task.status]} />
          </CardContent>
        </Card>
      </section>

      <TaskUploadSection
        task={task}
        uploads={uploads}
        currentUser={currentUser}
        usersById={usersById}
        onUploaded={onChanged}
        eventRole={eventRole}
      />

      <TaskActivityLog logs={logs} usersById={usersById} />

      <SuggestedReferencesDialog
        open={refDialogOpen}
        task={task}
        eventName={eventName}
        onClose={() => setRefDialogOpen(false)}
      />
    </div>
  );
}

// Subcomponents helper

function Block({ label, value }: { label: string; value?: string }) {
  return (
    <div className="w-full min-w-0 max-w-full">
      <p className="font-semibold text-slate-950 dark:text-slate-50">{label}</p>
      <p className="mt-1 whitespace-pre-wrap leading-6 text-slate-600 dark:text-slate-300 jd-safe-text">{value || "-"}</p>
    </div>
  );
}

function LinkBlock({ label, href }: { label: string; href?: string }) {
  return (
    <div className="w-full min-w-0 max-w-full">
      <p className="font-semibold text-slate-950 dark:text-slate-50">{label}</p>
      {href ? (
        <a 
          href={href} 
          target="_blank" 
          rel="noreferrer" 
          className="mt-1 inline-block text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-200 jd-safe-text"
        >
          {href}
        </a>
      ) : (
        <p className="mt-1 text-slate-500 dark:text-slate-400">-</p>
      )}
    </div>
  );
}
