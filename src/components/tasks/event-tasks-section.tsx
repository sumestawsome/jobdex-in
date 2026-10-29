"use client";

import Link from "next/link";
import { useState } from "react";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTaskDate } from "@/lib/firebase/tasks";
import type { Event, Task, TaskInput, UserProfile } from "@/types";

import { useRouter } from "next/navigation";
import { Plus, Eye, Mic } from "lucide-react";
import { VoiceJobdeskDialog, type BulkExtractionData } from "@/components/jobdesk/voice-jobdesk-dialog";
import { BulkJobdeskModal } from "@/components/jobdesk/bulk-jobdesk-modal";

type EventTasksSectionProps = {
  event: Event;
  tasks: Task[];
  users: UserProfile[];
  canManage: boolean;
  onCreateTask: (input: TaskInput) => Promise<void>;
};

export function EventTasksSection({
  event,
  tasks,
  users,
  canManage,
  onCreateTask,
}: EventTasksSectionProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [voiceJobdeskOpen, setVoiceJobdeskOpen] = useState(false);
  const [bulkJobdeskOpen, setBulkJobdeskOpen] = useState(false);
  const [bulkExtractionData, setBulkExtractionData] = useState<BulkExtractionData | null>(null);
  const usersById = new Map(users.map((user) => [user.id, user]));

  const handleBulkExtracted = (data: BulkExtractionData) => {
    setBulkExtractionData(data);
    setVoiceJobdeskOpen(false);
    setBulkJobdeskOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">Job Desk Acara</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Task dengan event_id yang terhubung ke acara ini.
          </p>
        </div>
        {canManage ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVoiceJobdeskOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-none bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-zinc-300 dark:border-zinc-700 shadow-none transition-all active:scale-[0.98] cursor-pointer shrink-0"
            >
              <Mic className="size-3.5" />
              <span>🎙️ Input Suara AI</span>
            </button>
            <Button type="button" size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-3.5" />
              <span>Tambah Job Desk</span>
            </Button>
          </div>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="Belum ada job desk acara"
          description="Tambahkan job desk acara untuk mulai membagi pekerjaan publikasi, dokumentasi, dan desain."
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden jd-neo-table">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Nama Task</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">PIC</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Prioritas</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Deadline</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td className="px-4 py-3 font-semibold text-slate-950 dark:text-slate-50">{task.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {usersById.get(task.pic_id)?.name ?? "User tidak ditemukan"}
                      </td>
                      <td className="px-4 py-3"><TaskStatusBadge status={task.status} /></td>
                      <td className="px-4 py-3"><TaskPriorityBadge priority={task.priority} /></td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatTaskDate(task.deadline)}</td>
                      <td className="px-4 py-3">
                        <Button asChild size="sm" variant="info">
                          <Link href={`/dashboard/tasks/${task.id}?returnTo=/dashboard/events/${event.id}`} className="flex items-center gap-1.5">
                            <Eye className="size-3.5" />
                            <span>Detail</span>
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="block md:hidden space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3 m-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-base text-slate-900 dark:text-white">{task.name}</p>
                    <p className="text-xs opacity-75 mt-0.5 font-semibold">Deadline: {formatTaskDate(task.deadline)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 border-t border-dashed border-neutral-300 dark:border-neutral-700 text-xs">
                  <span className="opacity-60">PIC:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {usersById.get(task.pic_id)?.name ?? "User tidak ditemukan"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-neutral-300 dark:border-neutral-700">
                  <TaskStatusBadge status={task.status} />
                  <TaskPriorityBadge priority={task.priority} />
                </div>
                <div className="pt-3 border-t border-dashed border-neutral-300 dark:border-neutral-700">
                  <Button asChild size="sm" variant="info" className="w-full">
                    <Link href={`/dashboard/tasks/${task.id}?returnTo=/dashboard/events/${event.id}`} className="flex items-center justify-center gap-1.5">
                      <Eye className="size-3.5" />
                      <span>Detail</span>
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <TaskFormDialog
        open={formOpen}
        task={null}
        users={users.filter((user) => user.is_active)}
        events={[event]}
        fallbackCoordinatorId={event.coordinator_id}
        defaultEventId={event.id}
        onClose={() => setFormOpen(false)}
        onSave={async (input) => {
          await onCreateTask(input);
          setFormOpen(false);
        }}
      />

      {canManage && (
        <>
          <VoiceJobdeskDialog
            open={voiceJobdeskOpen}
            onClose={() => setVoiceJobdeskOpen(false)}
            events={[event]}
            defaultEventId={event.id}
            onExtracted={handleBulkExtracted}
          />
          <BulkJobdeskModal
            open={bulkJobdeskOpen}
            onClose={() => {
              setBulkJobdeskOpen(false);
              setBulkExtractionData(null);
            }}
            extractionData={bulkExtractionData}
            events={[event]}
            users={users}
            onSuccess={() => {
              router.refresh();
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
          />
        </>
      )}
    </div>
  );
}
