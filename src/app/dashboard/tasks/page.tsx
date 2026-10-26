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
import { Plus, Building2, ArrowRight, Mic } from "lucide-react";
import { VoiceTaskDialog, type ExtractedVoiceTaskData } from "@/components/tasks/voice-task-dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { ActiveWorkspaceBanner } from "@/components/workspace/active-workspace-banner";
import { getEventsForProfile } from "@/lib/firebase/events";
import { getMembers } from "@/lib/firebase/members";
import { getDivisions } from "@/lib/firebase/divisions";
import {
  archiveTask,
  unarchiveTask,
  createTask,
  getTasksForProfile,
  getTasksByEvent,
  getTaskDateInputValue,
  updateTask,
} from "@/lib/firebase/tasks";
import { canCreateTask, canManageTask, isClassAdmin } from "@/lib/permissions";
import type { Division, Event, Task, TaskInput, TaskPriority, TaskStatus, TaskType, UserProfile } from "@/types";
import { showConfirm, showSuccess, showError } from "@/lib/swal";
import { db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";

export default function TasksPage() {
  const { user, userProfile } = useAuth();
  const { activeWorkspace, activeCampus, activeOrmawa, isClassWorkspace } = useWorkspace();

  const canCreate = isClassWorkspace
    ? isClassAdmin(userProfile, activeWorkspace)
    : canCreateTask(userProfile, undefined, activeWorkspace.org_id, activeWorkspace);

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
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<TaskViewMode>("card");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateMobileStatus = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        try {
          const savedMode = localStorage.getItem("jobdex_task_view_mode") as TaskViewMode | null;
          if (savedMode === "table" || savedMode === "card") {
            setViewMode(savedMode);
          }
        } catch {
          // ignore localStorage error
        }
      }
    };

    updateMobileStatus();
    window.addEventListener("resize", updateMobileStatus);
    return () => window.removeEventListener("resize", updateMobileStatus);
  }, []);

  const handleViewModeChange = (mode: TaskViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("jobdex_task_view_mode", mode);
    } catch {
      // ignore localStorage error
    }
  };
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [userEventRoles, setUserEventRoles] = useState<Map<string, string>>(new Map());
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Partial<TaskInput> | null>(null);
  const [autoFocusField, setAutoFocusField] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && userProfile) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("voice") === "1" && canCreate) {
        setVoiceDialogOpen(true);
      }
    }
  }, [userProfile, canCreate]);

  const handleVoiceTaskExtracted = (data: ExtractedVoiceTaskData) => {
    setSelectedTask(null);
    setFormInitialValues({
      course_name: data.course_name,
      name: data.name,
      title: data.name,
      description: data.description,
      deadline: data.deadline ? data.deadline.slice(0, 10) : "",
      submission_url: data.submission_url,
      submission_link: data.submission_url,
      type: "tugas_kuliah",
    });

    const isDeadlineMissing = !data.deadline || data.missing_fields?.includes("deadline");
    const isCourseMissing = !data.course_name || data.missing_fields?.includes("course_name");
    const isNameMissing = !data.name || data.missing_fields?.includes("name");

    if (isDeadlineMissing) {
      toast.info("Tenggat waktu belum disebutkan di suara, silakan lengkapi di formulir");
      setAutoFocusField("deadline");
    } else if (isCourseMissing) {
      toast.info("Mata kuliah belum disebutkan di suara, silakan lengkapi di formulir");
      setAutoFocusField("course_name");
    } else if (isNameMissing) {
      toast.info("Judul tugas belum disebutkan di suara, silakan lengkapi di formulir");
      setAutoFocusField("name");
    } else {
      toast.success("Detail tugas berhasil diekstrak dari suara!");
      setAutoFocusField(null);
    }

    setVoiceDialogOpen(false);
    setFormOpen(true);
  };

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
        taskData = await getTasksForProfile(userProfile, activeWorkspace, showArchived);
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
  }, [userProfile, activeWorkspace.org_id, activeWorkspace.campus_id, showArchived]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);

  const filteredTasks = useMemo(() => {
    const rawQuery = search.trim().toLowerCase();
    const queryTokens = rawQuery ? rawQuery.split(/\s+/).filter(Boolean) : [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAhead = new Date(today);
    weekAhead.setDate(today.getDate() + 7);

    return tasks.filter((task) => {
      const deadline = getDeadlineDate(task.deadline);

      // Word-based tokenized search matching task name, description, PIC name, or event/division name
      let matchesSearch = true;
      if (queryTokens.length > 0) {
        const picName = usersById.get(task.pic_id)?.name?.toLowerCase() || "";
        const eventName = (
          task.type === "acara"
            ? eventsById.get(task.event_id || "")?.name
            : task.division_id || "humas & media kreatif"
        )?.toLowerCase() || "";
        const taskName = (task.name || "").toLowerCase();
        const taskDesc = (task.description || "").toLowerCase();
        const courseName = (task.course_name || task.subject_name || "").toLowerCase();
        const subLink = (task.submission_url || task.submission_link || "").toLowerCase();

        // Combined searchable text corpus for this task
        const corpus = `${taskName} ${taskDesc} ${courseName} ${subLink} ${picName} ${eventName}`;

        // Every token word typed by the user must be found in the corpus (flexible order)
        matchesSearch = queryTokens.every((token) => corpus.includes(token));
      }

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

      const taskOrgId = (task as unknown as { org_id?: string; organization_id?: string }).org_id || (task as unknown as { organization_id?: string }).organization_id;
      const matchesWorkspace =
        !taskOrgId ||
        taskOrgId === activeWorkspace.org_id ||
        ((taskOrgId === "main_org" || taskOrgId === "org-undiksha-forkom-kip" || taskOrgId === "org-undiksha-bem") &&
         (activeWorkspace.org_id === "org-undiksha-forkom-kip" || activeWorkspace.org_id === "org-undiksha-bem" || activeWorkspace.org_id === "main_org"));

      const matchesArchived = showArchived ? task.is_archived === true : !task.is_archived;

      return (
        matchesWorkspace &&
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesPriority &&
        matchesPic &&
        matchesEvent &&
        matchesDeadline &&
        matchesArchived
      );
    });
  }, [
    activeWorkspace.org_id,
    deadlineFilter,
    eventFilter,
    eventsById,
    picFilter,
    priorityFilter,
    search,
    showArchived,
    statusFilter,
    tasks,
    typeFilter,
    usersById,
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
        const oldDeadline = selectedTask?.deadline ? getTaskDateInputValue(selectedTask.deadline) : "";
        const newDeadline = input.deadline || "";
        const oldDesc = selectedTask?.description || "";
        const newDesc = input.description || "";
        const deadlineChanged = Boolean(oldDeadline && newDeadline && oldDeadline !== newDeadline);
        const descriptionChanged = Boolean(oldDesc !== newDesc);

        await updateTask(taskId, input);
        void showSuccess("Job desk berhasil diperbarui!");

        if (user && (deadlineChanged || descriptionChanged)) {
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
                  taskId,
                  eventType: "task_updated",
                  changes: {
                    deadlineChanged,
                    descriptionChanged,
                    oldDeadline,
                    newDeadline,
                    oldDescription: oldDesc,
                    newDescription: newDesc,
                  },
                }),
              });
            } catch {
              // Notification failure doesn't block task update
            }
          })();
        }
      } else {
        const inputWithTenant = {
          ...input,
          workspace_id: input.workspace_id || activeWorkspace.org_id,
          organization_id: input.organization_id || activeWorkspace.org_id,
          org_id: input.org_id || activeWorkspace.org_id,
          orgId: input.orgId || activeWorkspace.org_id,
          campus_id: input.campus_id || activeWorkspace.campus_id,
          campusId: input.campusId || activeWorkspace.campus_id,
          univ_id: input.univ_id || activeWorkspace.campus_id,
          univId: input.univId || activeWorkspace.campus_id,
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
    if (task.is_archived) {
      const taskLabel = task.course_name ? `${task.course_name} - ${task.name}` : task.name;
      const confirmed = await showConfirm({
        title: "Buka Arsip & Aktifkan Tugas",
        text: `Apakah Anda yakin ingin mengaktifkan kembali tugas "${taskLabel}"? Pengingat otomatis akan kembali aktif.`,
        confirmButtonText: "Ya, Aktifkan Kembali",
        cancelButtonText: "Batal",
      });

      if (!confirmed) {
        return;
      }

      try {
        await unarchiveTask(task.id);
        void showSuccess("Tugas berhasil diaktifkan kembali!");
        await loadData();
      } catch {
        void showError("Gagal mengaktifkan kembali tugas.");
      }
      return;
    }

    const confirmed = await showConfirm({
      title: isClassWorkspace ? "Arsipkan Tugas Kuliah" : "Arsipkan Job Desk",
      text: `Apakah Anda yakin ingin mengarsipkan ${isClassWorkspace ? "tugas kuliah" : "job desk"} "${task.name}"?`,
      confirmButtonText: "Ya, Arsipkan",
      cancelButtonText: "Batal",
    });

    if (!confirmed) {
      return;
    }

    try {
      await archiveTask(task.id);
      void showSuccess(isClassWorkspace ? "Tugas kuliah berhasil diarsipkan!" : "Job desk berhasil diarsipkan!");
      await loadData();
    } catch {
      void showError(isClassWorkspace ? "Gagal mengarsipkan tugas kuliah." : "Gagal mengarsipkan job desk.");
    }
  }

  if (!userProfile) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full pb-16">
      {/* ── Active Workspace Isolation Banner (Sembunyi di mode kelas) ── */}
      {!isClassWorkspace && (
        <ActiveWorkspaceBanner description={`${activeCampus.name} • Menampilkan job desk terfilter untuk ruang kerja ini`} />
      )}

      {/* ── Header Section ──────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {isClassWorkspace ? "Daftar Tugas Kuliah" : "Job Desk & Daftar Tugas"}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {isClassWorkspace
              ? "Kelola jadwal tugas, mata kuliah, dan tenggat pengumpulan kelas."
              : "Kelola pembagian tugas divisi dan kepanitiaan acara secara terstruktur."}
          </p>
        </div>
        {canCreate ? (
          <div className="flex items-center gap-2">
            {isClassWorkspace && (
              <button
                type="button"
                onClick={() => setVoiceDialogOpen(true)}
                title="Input Tugas via Suara"
                className="inline-flex items-center justify-center size-9 rounded-none border border-zinc-300 dark:border-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-none transition-colors active:scale-95 cursor-pointer shrink-0"
              >
                <Mic className="size-4 text-primary" />
                <span className="sr-only">Input Tugas via Suara</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedTask(null);
                setFormInitialValues(null);
                setAutoFocusField(null);
                setFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold rounded-none bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white shadow-none transition-all active:scale-[0.98] cursor-pointer shrink-0"
            >
              <Plus className="size-3.5" />
              <span>{isClassWorkspace ? "Tambah Tugas" : "Tambah Job Desk"}</span>
            </button>
          </div>
        ) : null}
      </header>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
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
        isClassWorkspace={isClassWorkspace}
        onSearchChange={setSearch}
        onTypeChange={setTypeFilter}
        onStatusChange={setStatusFilter}
        onPriorityChange={setPriorityFilter}
        onPicChange={setPicFilter}
        onEventChange={setEventFilter}
        onDeadlineChange={setDeadlineFilter}
      />

      {/* ── View Mode & Summary Bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-xs font-medium text-[#898989] dark:text-zinc-400">
            Menampilkan <strong className="text-[#242424] dark:text-zinc-100">{filteredTasks.length}</strong> dari {tasks.length} {isClassWorkspace ? "tugas kuliah" : "job desk"} {showArchived ? "(arsip)" : "aktif"}
          </p>
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="size-3.5 rounded-none border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <span>Tampilkan Arsip {isClassWorkspace ? "Tugas Selesai" : "Job Desk"}</span>
          </label>
        </div>
        <div className="hidden md:inline-flex">
          <TaskViewToggle value={isMobile ? "card" : viewMode} onChange={handleViewModeChange} />
        </div>
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
      ) : (!isMobile && viewMode === "table") ? (
        <TasksTable
          tasks={filteredTasks}
          usersById={usersById}
          eventsById={eventsById}
          canEdit={(task) => canManageTask(userProfile, task, task.event_id ? userEventRoles.get(task.event_id) : undefined, activeWorkspace)}
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
          canEdit={(task) => canManageTask(userProfile, task, task.event_id ? userEventRoles.get(task.event_id) : undefined, activeWorkspace)}
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
        initialValues={formInitialValues}
        autoFocusField={autoFocusField}
        users={users.filter((user) => user.is_active)}
        events={events}
        divisions={divisions}
        fallbackCoordinatorId={userProfile.id}
        onClose={() => {
          setFormOpen(false);
          setSelectedTask(null);
          setFormInitialValues(null);
          setAutoFocusField(null);
        }}
        onSave={handleSaveTask}
      />

      {canCreate && (
        <VoiceTaskDialog
          open={voiceDialogOpen}
          onClose={() => setVoiceDialogOpen(false)}
          onTaskExtracted={handleVoiceTaskExtracted}
        />
      )}
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
