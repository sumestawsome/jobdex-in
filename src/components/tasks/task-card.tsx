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

type TaskCardProps = {
  task: Task;
  usersById: Map<string, UserProfile>;
  eventsById: Map<string, Event>;
  canEdit: boolean;
  onEdit: (task: Task) => void;
  onArchive: (task: Task) => void;
};

export function TaskCard({
  task,
  usersById,
  eventsById,
  canEdit,
  onEdit,
  onArchive,
}: TaskCardProps) {
  const [refDialogOpen, setRefDialogOpen] = useState(false);

  const riskLevel = getRiskLevelFromTask(task);
  const riskLabel = getRiskLabel(riskLevel, task);
  const eventName =
    task.type === "acara"
      ? eventsById.get(task.event_id || "")?.name ?? "Acara tidak ditemukan"
      : task.division_id || "Humas & Media Kreatif";

  const riskVariant =
    riskLevel === "red"
      ? "error"
      : riskLevel === "orange"
      ? "orange"
      : riskLevel === "yellow"
      ? "warning"
      : "neutral";

  return (
    <div className="flex flex-col justify-between rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-none transition-all hover:border-zinc-400 dark:hover:border-zinc-700 gap-4">
      <div>
        {/* Badges Bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
          <WorkspaceBadge
            campusId={task.campus_id || task.univ_id}
            orgId={task.org_id || task.organization_id}
          />
        </div>

        {/* Task Title */}
        <h3 className="mt-3 text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
          {task.name}
        </h3>

        {/* Task Meta List */}
        <dl className="mt-3 space-y-2 text-xs border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">PIC</dt>
            <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
              {usersById.get(task.pic_id)?.name ?? "User tidak ditemukan"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Deadline</dt>
            <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatTaskDate(task.deadline)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Acara/Divisi</dt>
            <dd className="text-right font-semibold text-zinc-900 dark:text-zinc-100">
              {eventName}
            </dd>
          </div>
          <div className="flex justify-between gap-2 items-center">
            <dt className="text-zinc-500 dark:text-zinc-400">Risiko</dt>
            <dd>
              <Badge variant={riskVariant} className="text-[10px] font-medium">
                {riskLabel}
              </Badge>
            </dd>
          </div>
        </dl>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-1.5">
        <Link
          href={`/dashboard/tasks/${task.id}`}
          className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-none bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold shadow-none transition-all border border-indigo-700 dark:border-indigo-500"
        >
          <Eye className="size-3 text-white/90" />
          <span>Detail</span>
        </Link>

        <button
          type="button"
          onClick={() => setRefDialogOpen(true)}
          className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-none bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white text-xs font-semibold shadow-none transition-all border border-purple-700 dark:border-purple-500 cursor-pointer"
        >
          <Sparkles className="size-3 text-white/90" />
          <span>Solusi</span>
        </button>

        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-none bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-zinc-950 text-xs font-semibold shadow-none transition-all border border-amber-600 dark:border-amber-400 cursor-pointer"
            >
              <Pencil className="size-3 text-zinc-950/80" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => onArchive(task)}
              className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-none bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold shadow-none transition-all border border-rose-700 dark:border-rose-500 cursor-pointer ml-auto"
            >
              <Archive className="size-3 text-white/90" />
              <span>Arsip</span>
            </button>
          </>
        )}
      </div>

      {refDialogOpen && (
        <SuggestedReferencesDialog
          open={refDialogOpen}
          onClose={() => setRefDialogOpen(false)}
          task={task}
          eventName={eventName}
        />
      )}
    </div>
  );
}
