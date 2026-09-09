"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { formatTaskDate } from "@/lib/firebase/tasks";
import { getRiskLevelFromTask, getRiskLabel } from "@/lib/task-risk";
import { SuggestedReferencesDialog } from "@/components/references/suggested-references-dialog";
import { Badge } from "@/components/ui/badge";
import { WorkspaceBadge } from "@/components/workspace/workspace-badge";
import type { Event, Task, UserProfile } from "@/types";

import { Eye, Pencil, Archive, Sparkles } from "lucide-react";

type TasksTableProps = {
  tasks: Task[];
  usersById: Map<string, UserProfile>;
  eventsById: Map<string, Event>;
  canEdit: (task: Task) => boolean;
  onEdit: (task: Task) => void;
  onArchive: (task: Task) => void;
};

export function TasksTable({
  tasks,
  usersById,
  eventsById,
  canEdit,
  onEdit,
  onArchive,
}: TasksTableProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [refDialogOpen, setRefDialogOpen] = useState(false);

  return (
    <div className="overflow-hidden jd-neo-table">
      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Nama Tugas</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Ruang Kerja</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">PIC</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Acara / Divisi</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Deadline</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Prioritas</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Risiko</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Referensi</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tasks.map((task) => {
              const eventName =
                task.type === "acara"
                  ? eventsById.get(task.event_id || "")?.name ?? "Acara tidak ditemukan"
                  : task.division_id || "Humas & Media Kreatif";

              const riskLevel = getRiskLevelFromTask(task);
              const riskLabel = getRiskLabel(riskLevel, task);
              const riskVariant =
                riskLevel === "red"
                  ? "error"
                  : riskLevel === "orange"
                  ? "orange"
                  : riskLevel === "yellow"
                  ? "warning"
                  : "neutral";

              return (
                <tr key={task.id} className="align-middle hover:bg-neutral-105/50 dark:hover:bg-neutral-800/40">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{task.name}</td>
                  <td className="px-4 py-3">
                    <WorkspaceBadge
                      campusId={task.campus_id || task.univ_id}
                      orgId={task.org_id || task.organization_id}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {usersById.get(task.pic_id)?.name ?? "User tidak ditemukan"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{eventName}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatTaskDate(task.deadline)}</td>
                  <td className="px-4 py-3">
                    <TaskPriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <TaskStatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={riskVariant} className="text-[10px] font-medium">
                      {riskLabel}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelectedTask(task);
                        setRefDialogOpen(true);
                      }}
                    >
                      <Sparkles className="size-3.5" />
                      <span>Referensi</span>
                    </Button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button asChild size="sm" variant="info">
                        <Link href={`/dashboard/tasks/${task.id}?returnTo=/dashboard/tasks`} className="flex items-center gap-1.5">
                          <Eye className="size-3.5" />
                          <span>Detail</span>
                        </Link>
                      </Button>
                      {canEdit(task) ? (
                        <>
                          <Button type="button" size="sm" variant="warning" onClick={() => onEdit(task)}>
                            <Pencil className="size-3.5" />
                            <span>Edit</span>
                          </Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => onArchive(task)}>
                            <Archive className="size-3.5" />
                            <span>Archive</span>
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedTask && (
        <SuggestedReferencesDialog
          open={refDialogOpen}
          task={selectedTask}
          eventName={
            selectedTask.type === "acara"
              ? eventsById.get(selectedTask.event_id || "")?.name ?? ""
              : selectedTask.division_id || "Humas & Media Kreatif"
          }
          onClose={() => {
            setRefDialogOpen(false);
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
}
