"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="flex flex-col justify-between m-1">
      <div>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            <WorkspaceBadge
              campusId={task.campus_id || task.univ_id}
              orgId={task.org_id || task.organization_id}
            />
          </div>
          <CardTitle className="mt-3 text-lg font-bold text-slate-900 dark:text-white">{task.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm border-t border-dashed border-neutral-200 dark:border-neutral-800 pt-3">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400 font-medium">PIC</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-200">
                {usersById.get(task.pic_id)?.name ?? "User tidak ditemukan"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400 font-medium">Deadline</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-200">
                {formatTaskDate(task.deadline)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400 font-medium">Acara/Divisi</dt>
              <dd className="text-right font-semibold text-slate-800 dark:text-slate-200">
                {eventName}
              </dd>
            </div>
            <div className="flex justify-between gap-3 items-center">
              <dt className="text-slate-500 dark:text-slate-400 font-medium">Risiko</dt>
              <dd className="font-semibold">
                <Badge variant={riskVariant} className="text-[10px] font-medium">
                  {riskLabel}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </div>

      <CardContent className="pt-0">
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="info">
            <Link href={`/dashboard/tasks/${task.id}?returnTo=/dashboard/tasks`} className="flex items-center gap-1.5">
              <Eye className="size-3.5" />
              <span>Detail</span>
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setRefDialogOpen(true)}
          >
            <Sparkles className="size-3.5" />
            <span>Referensi</span>
          </Button>
          {canEdit ? (
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
      </CardContent>

      <SuggestedReferencesDialog
        open={refDialogOpen}
        task={task}
        eventName={eventName}
        onClose={() => setRefDialogOpen(false)}
      />
    </Card>
  );
}
