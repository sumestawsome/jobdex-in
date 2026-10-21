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
    <div className="flex flex-col justify-between rounded-xl border border-[#e1e2e3] bg-white p-5 shadow-2xs transition-all hover:border-[#b0b2b5] gap-4">
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
        <h3 className="mt-3 text-base font-bold text-[#242424] leading-snug">
          {task.name}
        </h3>

        {/* Task Meta List */}
        <dl className="mt-3 space-y-2 text-xs border-t border-[#e1e2e3] pt-3">
          <div className="flex justify-between gap-2">
            <dt className="text-[#898989]">PIC</dt>
            <dd className="font-semibold text-[#242424]">
              {usersById.get(task.pic_id)?.name ?? "User tidak ditemukan"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#898989]">Deadline</dt>
            <dd className="font-semibold text-[#242424]">
              {formatTaskDate(task.deadline)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#898989]">Acara/Divisi</dt>
            <dd className="text-right font-semibold text-[#242424]">
              {eventName}
            </dd>
          </div>
          <div className="flex justify-between gap-2 items-center">
            <dt className="text-[#898989]">Risiko</dt>
            <dd>
              <Badge variant={riskVariant} className="text-[10px] font-medium">
                {riskLabel}
              </Badge>
            </dd>
          </div>
        </dl>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-[#e1e2e3] flex flex-wrap items-center gap-1.5">
        <Link
          href={`/dashboard/tasks/${task.id}`}
          className="inline-flex items-center gap-1 h-7.5 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-xs font-semibold shadow-2xs transition-all"
        >
          <Eye className="size-3 text-[#898989]" />
          <span>Detail</span>
        </Link>

        <button
          type="button"
          onClick={() => setRefDialogOpen(true)}
          className="inline-flex items-center gap-1 h-7.5 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-xs font-semibold shadow-2xs transition-all cursor-pointer"
        >
          <Sparkles className="size-3 text-[#6349ea]" />
          <span>Solusi</span>
        </button>

        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="inline-flex items-center gap-1 h-7.5 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Pencil className="size-3 text-[#898989]" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => onArchive(task)}
              className="inline-flex items-center gap-1 h-7.5 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#e94235] hover:bg-[#feebe8] text-xs font-semibold shadow-2xs transition-all cursor-pointer ml-auto"
            >
              <Archive className="size-3" />
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
