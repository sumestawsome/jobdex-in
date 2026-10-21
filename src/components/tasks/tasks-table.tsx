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
    <div className="overflow-hidden rounded-xl border border-[#e1e2e3] bg-white shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#e1e2e3] bg-[#f7f7f8]">
              <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Nama Tugas</th>
              <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Ruang Kerja</th>
              <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">PIC</th>
              <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Acara / Divisi</th>
              <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Deadline</th>
              <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Prioritas</th>
              <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Status</th>
              <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Risiko</th>
              <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Referensi</th>
              <th className="px-4 py-3 font-semibold text-[#898989] uppercase tracking-wider text-[11px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e1e2e3]">
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
                <tr key={task.id} className="align-middle hover:bg-[#f7f7f8] transition-colors">
                  <td className="px-4 py-3 font-semibold text-[#242424]">{task.name}</td>
                  <td className="px-4 py-3">
                    <WorkspaceBadge
                      campusId={task.campus_id || task.univ_id}
                      orgId={task.org_id || task.organization_id}
                    />
                  </td>
                  <td className="px-4 py-3 text-[#6b7280]">
                    {usersById.get(task.pic_id)?.name ?? "User tidak ditemukan"}
                  </td>
                  <td className="px-4 py-3 text-[#6b7280]">{eventName}</td>
                  <td className="px-4 py-3 text-[#6b7280]">{formatTaskDate(task.deadline)}</td>
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
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-[11px] font-semibold transition-all shadow-2xs cursor-pointer"
                    >
                      <Sparkles className="size-3 text-[#6349ea]" />
                      <span>Lihat Solusi</span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/dashboard/tasks/${task.id}`}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-[11px] font-semibold transition-all shadow-2xs"
                      >
                        <Eye className="size-3 text-[#898989]" />
                        <span>Detail</span>
                      </Link>

                      {canEdit(task) && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(task)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-[11px] font-semibold transition-all shadow-2xs cursor-pointer"
                          >
                            <Pencil className="size-3 text-[#898989]" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onArchive(task)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#e94235] hover:bg-[#feebe8] text-[11px] font-semibold transition-all shadow-2xs cursor-pointer"
                          >
                            <Archive className="size-3 text-[#e94235]" />
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
