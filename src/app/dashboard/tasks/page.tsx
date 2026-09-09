"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TaskCardGrid } from "@/components/tasks/task-card-grid";
import { TaskFilters, type TaskDeadlineFilter } from "@/components/tasks/task-filters";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskViewToggle, type TaskViewMode } from "@/components/tasks/task-view-toggle";
import { TasksTable } from "@/components/tasks/tasks-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { Plus, Building2, ArrowRight } from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { getEventsForProfile } from "@/lib/firebase/events";
import { getMembers } from "@/lib/firebase/members";
import { getDivisions } from "@/lib/firebase/divisions";
import {
  archiveTask,
  createTask,
  getTasksForProfile,
  getTasksByEvent,
  updateTask,
} from "@/lib/firebase/tasks";
import { canCreateTask, canManageTask } from "@/lib/permissions";
import type { Division, Event, Task, TaskInput, TaskPriority, TaskStatus, TaskType, UserProfile } from "@/types";
import { showConfirm, showSuccess, showError } from "@/lib/swal";
import { db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";

export default function TasksPage() {
  const { user, userProfile } = useAuth();
  const { activeWorkspace, activeCampus, activeOrmawa } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TaskType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [picFilter, setPicFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState<TaskDeadlineFilter>("all");
  const [viewMode, setViewMode] = useState<TaskViewMode>("table");

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      const timer = setTimeout(() => {
        setViewMode("card");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [userEventRoles, setUserEventRoles] = useState<Map<string, string>>(new Map());

  const loadData = useCallback(async () => {
    if (!userProfile) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Fetch main tasks
      let taskData: Task[] = [];
      try {
        taskData = await getTasksForProfile(userProfile, activeWorkspace);
      } catch (err) {
        console.error("Failed to fetch main tasks:", err);
        const detailedError = "Gagal memuat job desk karena permission Firestore. Cek rules untuk tasks/events/event_members.";
        const genericError = "Belum bisa memuat job desk. Silakan coba muat ulang atau hubungi admin.";
        setError(userProfile.role === "super_admin" ? detailedError : genericError);
        throw err;
      }

      // 2. Fetch events and members as optional
      const [eventsResult, usersResult, divisionsResult] = await Promise.allSettled([
        getEventsForProfile(userProfile, activeWorkspace),
        getMembers(activeWorkspace.org_id, activeWorkspace.campus_id),
        getDivisions(activeWorkspace.org_id, activeWorkspace.campus_id),
      ]);

      const eventData = eventsResult.status === "fulfilled" ? eventsResult.value : [];
      const userData = usersResult.status === "fulfilled" ? usersResult.value : [userProfile];
      const divisionData = divisionsResult.status === "fulfilled" ? divisionsResult.value : [];
      setDivisions(divisionData);

      // 3. Fetch event tasks for non-staff
      if (userProfile.role !== "super_admin" && userProfile.role !== "koordinator_divisi") {
        if (eventData.length > 0) {
          const eventTasksResults = await Promise.allSettled(
            eventData.map(e => getTasksByEvent(e.id))
          );
          
          eventTasksResults.forEach(res => {
            if (res.status === "fulfilled") {
              res.value.forEach(t => {
                if (!taskData.some(existing => existing.id === t.id)) {
                  taskData.push(t);
                }
              });
            }
          });
        }
      }

      // Sort tasks again after merging
      taskData.sort((a, b) => {
        const getMillis = (task: Task) => {
          if (task.created_at && typeof task.created_at === "object" && "toDate" in task.created_at) return (task.created_at as { toDate: () => Date }).toDate().getTime();
          if (task.updated_at && typeof task.updated_at === "object" && "toDate" in task.updated_at) return (task.updated_at as { toDate: () => Date }).toDate().getTime();
          if (task.deadline && typeof task.deadline === "object" && "toDate" in task.deadline) return (task.deadline as { toDate: () => Date }).toDate().getTime();
          return 0;
        };
        return getMillis(b) - getMillis(a);
      });

      // 4. Resolve event roles
      const rolesMap = new Map<string, string>();
      if (eventData.length > 0) {
        const memberDocsResults = await Promise.allSettled(
          eventData.map((e) => getDoc(doc(db, "events", e.id, "event_members", userProfile.id)))
        );
        memberDocsResults.forEach((res, index) => {
          if (res.status === "fulfilled" && res.value.exists()) {
            rolesMap.set(eventData[index].id, res.value.data().role_in_event || "");
          }
        });
      }
      setUserEventRoles(rolesMap);

      setTasks(taskData);
      setEvents(eventData);
      setUsers(userData.length ? userData : [userProfile]);
    } catch {
      setError((prev) => prev || "Belum bisa memuat job desk. Silakan coba muat ulang atau hubungi admin.");
    } finally {
      setLoading(false);
    }
  }, [userProfile, activeWorkspace.org_id, activeWorkspace.campus_id]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAhead = new Date(today);
    weekAhead.setDate(today.getDate() + 7);

    return tasks.filter((task) => {
      const deadline = getDeadlineDate(task.deadline);
      const matchesSearch = !query || task.name.toLowerCase().includes(query);
      const matchesType = typeFilter === "all" || task.type === typeFilter;
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
      const matchesPic = picFilter === "all" || task.pic_id === picFilter;
      const matchesEvent = eventFilter === "all" || task.event_id === eventFilter;
      const matchesDeadline =
        deadlineFilter === "all" ||
        !deadline ||
        (deadlineFilter === "overdue" && deadline < today) ||
        (deadlineFilter === "week" && deadline >= today && deadline <= weekAhead);

      const taskOrgId = (task as unknown as { org_id?: string }).org_id;
      const matchesWorkspace =
        !taskOrgId ||
        taskOrgId === activeWorkspace.org_id ||
        activeWorkspace.org_id === "org-undiksha-bem" ||
        activeWorkspace.org_id === "org-ui-bem";

      return (
        matchesWorkspace &&
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesPriority &&
        matchesPic &&
        matchesEvent &&
        matchesDeadline
      );
    });
  }, [
    activeWorkspace.org_id,
    deadlineFilter,
    eventFilter,
    picFilter,
    priorityFilter,
    search,
    statusFilter,
    tasks,
    typeFilter,
  ]);

  async function handleSaveTask(input: TaskInput, taskId?: string) {
    if (!userProfile) {
      return;
    }

    if (!taskId && !activeWorkspace.org_id) {
      void showError("Pilih ruang kerja (ormawa) terlebih dahulu sebelum membuat job desk.");
      return;
    }

    try {
      if (taskId) {
        await updateTask(taskId, input);
        void showSuccess("Job desk berhasil diperbarui!");
      } else {
        const inputWithTenant = {
          ...input,
          organization_id: activeWorkspace.org_id,
          org_id: activeWorkspace.org_id,
          orgId: activeWorkspace.org_id,
          campus_id: activeWorkspace.campus_id,
          campusId: activeWorkspace.campus_id,
          univ_id: activeWorkspace.campus_id,
          univId: activeWorkspace.campus_id,
        };
        const newTaskId = await createTask(inputWithTenant as TaskInput, userProfile.id);
        void showSuccess("Job desk baru berhasil ditambahkan!");

        // Non-blocking asynchronous WhatsApp broadcast
        if (newTaskId && user) {
          void (async () => {
            try {
              const token = await user.getIdToken();
              await fetch("/api/notifications/whatsapp", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  taskId: newTaskId,
                  eventType: "task_created",
                }),
              });
            } catch {
              // Notification failure doesn't block task creation
            }
          })();
        }
      }
      await loadData();
    } catch (err) {
      void showError("Gagal menyimpan job desk.");
      throw err;
    }
  }

  async function handleArchiveTask(task: Task) {
    const confirmed = await showConfirm({
      title: "Arsipkan Job Desk",
      text: `Apakah Anda yakin ingin mengarsipkan job desk "${task.name}"?`,
      confirmButtonText: "Ya, Arsipkan",
      cancelButtonText: "Batal",
    });

    if (!confirmed) {
      return;
    }

    try {
      await archiveTask(task.id);
      void showSuccess("Job desk berhasil diarsipkan!");
      await loadData();
    } catch {
      void showError("Gagal mengarsipkan job desk.");
    }
  }

  if (!userProfile) {
    return null;
  }

  const canCreate = canCreateTask(userProfile);

  return (
    <div className="space-y-6">
      {/* ── Active Workspace Isolation Banner ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 px-4 rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/70 dark:bg-sky-950/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-7 items-center justify-center rounded-lg bg-sky-600 text-white font-black text-xs shrink-0">
            {activeWorkspace.campus_code}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                {activeOrmawa.name}
              </span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                Terisolasi
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {activeCampus.name} • Menampilkan job desk terfilter untuk ruang kerja ini
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/workspace"
          className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 shrink-0"
        >
          <span>Ganti Ruang Kerja</span>
          <ArrowRight className="size-3" />
        </Link>
      </div>

      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Badge variant="info">Job Desk</Badge>
          <h1 className="mt-3 text-3xl font-bold text-slate-950 dark:text-slate-50">Job Desk</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Kelola job desk divisi dan job desk acara. Upload dan workflow
            approval akan tersedia di fase berikutnya.
          </p>
        </div>
        {canCreate ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setSelectedTask(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Tambah Job Desk
          </Button>
        ) : null}
      </section>

      <TaskFilters
        search={search}
        type={typeFilter}
        status={statusFilter}
        priority={priorityFilter}
        picId={picFilter}
        eventId={eventFilter}
        deadline={deadlineFilter}
        users={users}
        events={events}
        onSearchChange={setSearch}
        onTypeChange={setTypeFilter}
        onStatusChange={setStatusFilter}
        onPriorityChange={setPriorityFilter}
        onPicChange={setPicFilter}
        onEventChange={setEventFilter}
        onDeadlineChange={setDeadlineFilter}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Menampilkan {filteredTasks.length} dari {tasks.length} job desk.
        </p>
        <TaskViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-[8px] bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={() => void loadData()} className="bg-white text-red-700 hover:bg-red-50 hover:text-red-800 dark:bg-transparent dark:text-red-200 dark:hover:bg-red-900/50">
            Muat ulang
          </Button>
        </div>
      ) : null}

      {loading ? (
        <LoadingState title="Memuat daftar job desk..." />
      ) : tasks.length === 0 && !error ? (
        <EmptyState
          title={userProfile.role === "anggota" && events.length === 0 ? "Belum ada job desk yang terhubung dengan akun ini" : `Belum ada job desk di ${activeOrmawa.short_name}`}
          description={userProfile.role === "anggota" && events.length === 0 ? "Anda belum ditugaskan pada job desk atau acara apapun." : `Ruang kerja ${activeOrmawa.name} (${activeCampus.code}) belum memiliki job desk terdaftar.`}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canCreate ? (
                <Button type="button" size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Tambah Job Desk di {activeOrmawa.short_name}
                </Button>
              ) : null}
              <Link href="/dashboard/workspace">
                <Button variant="outline" size="sm">
                  Ganti Ruang Kerja
                </Button>
              </Link>
            </div>
          }
        />
      ) : filteredTasks.length === 0 && !error ? (
        <EmptyState
          title={`Tidak ada job desk yang cocok di ${activeOrmawa.short_name}`}
          description={`Tidak ada job desk pada filter aktif di ruang kerja ${activeOrmawa.name}. Coba ubah pencarian atau buat job desk baru.`}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canCreate ? (
                <Button type="button" size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Tambah Job Desk
                </Button>
              ) : null}
              <Link href="/dashboard/workspace">
                <Button variant="outline" size="sm">
                  Pilih Ruang Kerja Lain
                </Button>
              </Link>
            </div>
          }
        />
      ) : viewMode === "table" ? (
        <TasksTable
          tasks={filteredTasks}
          usersById={usersById}
          eventsById={eventsById}
          canEdit={(task) => canManageTask(userProfile, task, task.event_id ? userEventRoles.get(task.event_id) : undefined)}
          onEdit={(task) => {
            setSelectedTask(task);
            setFormOpen(true);
          }}
          onArchive={handleArchiveTask}
        />
      ) : (
        <TaskCardGrid
          tasks={filteredTasks}
          usersById={usersById}
          eventsById={eventsById}
          canEdit={(task) => canManageTask(userProfile, task, task.event_id ? userEventRoles.get(task.event_id) : undefined)}
          onEdit={(task) => {
            setSelectedTask(task);
            setFormOpen(true);
          }}
          onArchive={handleArchiveTask}
        />
      )}

      <TaskFormDialog
        open={formOpen}
        task={selectedTask}
        users={users.filter((user) => user.is_active)}
        events={events}
        divisions={divisions}
        fallbackCoordinatorId={userProfile.id}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveTask}
      />
    </div>
  );
}

function getDeadlineDate(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return null;
  }

  const date = (value as { toDate: () => Date }).toDate();
  date.setHours(0, 0, 0, 0);
  return date;
}
