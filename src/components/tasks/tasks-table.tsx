"use client";

import { useState } from "react";
import Link from "next/link";
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
    <div className="overflow-hidden rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90">
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Nama Tugas</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Ruang Kerja</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">PIC</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Acara / Divisi</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Deadline</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Prioritas</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Status</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Risiko</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Referensi</th>
              <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
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
                <tr key={task.id} className="align-middle hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{task.name}</td>
                  <td className="px-4 py-3">
                    <WorkspaceBadge
                      campusId={task.campus_id || task.univ_id}
                      orgId={task.org_id || task.organization_id}
                    />
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {usersById.get(task.pic_id)?.name ?? "User tidak ditemukan"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{eventName}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{formatTaskDate(task.deadline)}</td>
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
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTask(task);
                        setRefDialogOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-none bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white text-[11px] font-semibold transition-all shadow-none border border-purple-700 dark:border-purple-500 cursor-pointer"
                    >
                      <Sparkles className="size-3 text-white/90" />
                      <span>Lihat Solusi</span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/dashboard/tasks/${task.id}`}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-none bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[11px] font-semibold transition-all shadow-none border border-indigo-700 dark:border-indigo-500"
                      >
                        <Eye className="size-3 text-white/90" />
                        <span>Detail</span>
                      </Link>

                      {canEdit(task) && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(task)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-none bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-zinc-950 text-[11px] font-semibold transition-all shadow-none border border-amber-600 dark:border-amber-400 cursor-pointer"
                          >
                            <Pencil className="size-3 text-zinc-950/80" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onArchive(task)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-none bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-[11px] font-semibold transition-all shadow-none border border-rose-700 dark:border-rose-500 cursor-pointer"
                          >
                            <Archive className="size-3 text-white/90" />
                            <span>Arsip</span>
                          </button>
                        </>
                      )}
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
          onClose={() => {
            setRefDialogOpen(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          eventName={
            selectedTask.type === "acara"
              ? eventsById.get(selectedTask.event_id || "")?.name ?? "Acara"
              : selectedTask.division_id || "Divisi"
          }
        />
      )}
    </div>
  );
}
