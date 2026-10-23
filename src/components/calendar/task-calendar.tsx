"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Task, UserProfile } from "@/types";
import { getCalendarGrid, isSameDay } from "@/lib/calendar-utils";
import { getRiskLevelFromTask } from "@/lib/task-risk";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar, Eye } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";

type TaskCalendarProps = {
  profile: UserProfile;
};

function getRiskDotClass(level: "none" | "yellow" | "orange" | "red"): string {
  switch (level) {
    case "red":
      return "bg-rose-500";
    case "orange":
      return "bg-orange-500";
    case "yellow":
      return "bg-amber-500";
    case "none":
    default:
      return "bg-emerald-500";
  }
}

export function TaskCalendar({ profile }: TaskCalendarProps) {
  const { activeWorkspace } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [usersMap, setUsersMap] = useState<Map<string, UserProfile>>(new Map());
  const [eventsMap, setEventsMap] = useState<Map<string, { name?: string }>>(new Map());
  const [divisionsMap, setDivisionsMap] = useState<Map<string, { name?: string }>>(new Map());
  const [loading, setLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const targetOrgId = activeWorkspace.org_id || profile.organization_id || profile.org_id;
        const targetCampusId = activeWorkspace.campus_id || profile.campus_id || profile.univ_id;

        const matchesTenant = (item: Record<string, unknown>): boolean => {
          if (targetOrgId) {
            const org = item.organization_id || item.org_id || item.orgId || "org-undiksha-forkom-kip";
            const isLegacyOrg =
              org === targetOrgId ||
              ((org === "main_org" || org === "org-undiksha-forkom-kip" || org === "org-undiksha-bem") &&
               (targetOrgId === "org-undiksha-forkom-kip" || targetOrgId === "org-undiksha-bem" || targetOrgId === "main_org"));
            if (!isLegacyOrg) return false;
          }
          if (targetCampusId) {
            const campus = item.campus_id || item.campusId || item.univ_id || item.univId || "univ-undiksha";
            const isLegacyCampus =
              campus === targetCampusId ||
              campus === "univ-undiksha" ||
              campus === "ui" ||
              (!item.campus_id && !item.campusId && !item.univ_id && !item.univId);
            if (!isLegacyCampus) return false;
          }
          return true;
        };

        const tasksQuery = query(collection(db, "tasks"), where("is_archived", "==", false));
        const [tasksSnap, usersSnap, eventsSnap, divisionsSnap] = await Promise.all([
          getDocs(tasksQuery),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "events")),
          getDocs(collection(db, "divisions")),
        ]);

        if (!mounted) return;

        // Process users
        const uMap = new Map<string, UserProfile>();
        usersSnap.forEach((doc) => {
          uMap.set(doc.id, { id: doc.id, ...doc.data() } as UserProfile);
        });
        setUsersMap(uMap);

        // Process events
        const eMap = new Map<string, { name?: string }>();
        eventsSnap.forEach((doc) => {
          const data = doc.data() as Record<string, unknown>;
          if (matchesTenant(data)) {
            eMap.set(doc.id, data as { name?: string });
          }
        });
        setEventsMap(eMap);

        // Process divisions
        const dMap = new Map<string, { name?: string }>();
        divisionsSnap.forEach((doc) => {
          const data = doc.data() as Record<string, unknown>;
          if (matchesTenant(data)) {
            dMap.set(doc.id, data as { name?: string });
          }
        });
        setDivisionsMap(dMap);

        // Process and filter tasks
        const allTasks: Task[] = [];
        tasksSnap.forEach((doc) => {
          const data = doc.data() as Record<string, unknown>;
          if (matchesTenant(data)) {
            allTasks.push({ ...data, id: doc.id } as Task);
          }
        });

        // Role-aware filter
        let filteredTasks = allTasks;
        if (profile.role === "anggota") {
          filteredTasks = allTasks.filter((t) => t.pic_id === profile.id);
        } else if (profile.role === "koordinator_divisi") {
          filteredTasks = allTasks.filter((t) => t.division_id === profile.division_id);
        } else if (profile.role === "koordinator_acara") {
          filteredTasks = allTasks.filter((t) => t.coordinator_id === profile.id);
        }

        // Only keep tasks that are not approved and have a deadline
        const activeTasks = filteredTasks.filter((t) => t.status !== "approved" && t.deadline);
        setTasks(activeTasks);
      } catch (error) {
        console.error("[TaskCalendar] Load failed:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [profile, activeWorkspace.org_id, activeWorkspace.campus_id]);

  const daysGrid = getCalendarGrid(currentYear, currentMonth);

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const setToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Helper to extract due date from task
  const getTaskDate = (task: Task): Date | null => {
    if (!task.deadline) return null;
    return task.deadline && typeof task.deadline === "object" && "toDate" in task.deadline
      ? (task.deadline as { toDate: () => Date }).toDate()
      : task.deadline instanceof Date
      ? task.deadline
      : new Date(task.deadline as string);
  };

  // Get tasks due on a specific day
  const getTasksForDay = (day: Date): Task[] => {
    return tasks.filter((task) => {
      const taskDate = getTaskDate(task);
      return taskDate ? isSameDay(taskDate, day) : false;
    });
  };

  const selectedDayTasks = selectedDate ? getTasksForDay(selectedDate) : [];

  const statusLabels: Record<string, string> = {
    belum_dimulai: "Belum Dimulai",
    sedang_dikerjakan: "Sedang Dikerjakan",
    butuh_bantuan: "Butuh Bantuan",
    stuck: "Stuck",
    menunggu_materi: "Menunggu Materi",
    draft_selesai: "Draft Selesai",
    perlu_revisi: "Perlu Revisi",
    revisi_dikerjakan: "Revisi Dikerjakan",
    menunggu_approval: "Menunggu Approval",
    approved: "Approved",
    ditunda: "Ditunda",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* ── Left Column: Calendar Grid Container ── */}
      <div className="lg:col-span-2 space-y-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none p-5 sm:p-6 shadow-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="size-4.5 text-zinc-900 dark:text-zinc-100" />
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {monthNames[currentMonth]} {currentYear}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prevMonth}
              className="size-8 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-center transition-all shadow-none cursor-pointer"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={setToday}
              className="h-8 px-3 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-none cursor-pointer"
            >
              <Calendar className="size-3.5" />
              <span>Hari Ini</span>
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="size-8 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-center transition-all shadow-none cursor-pointer"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pb-2 border-b border-zinc-200 dark:border-zinc-800">
          <div>Min</div>
          <div>Sen</div>
          <div>Sel</div>
          <div>Rab</div>
          <div>Kam</div>
          <div>Jum</div>
          <div>Sab</div>
        </div>

        {/* 6-Week Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {daysGrid.map((day, idx) => {
            const isCurrentMonth = day.getMonth() === currentMonth;
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
            const dayTasks = getTasksForDay(day);

            // Determine highest risk level for this day's tasks
            let maxRiskLevel: "none" | "yellow" | "orange" | "red" = "none";
            let maxRiskWeight = 0;
            const riskWeights = { red: 3, orange: 2, yellow: 1, none: 0 };

            dayTasks.forEach((t) => {
              const r = getRiskLevelFromTask(t);
              const w = riskWeights[r] || 0;
              if (w > maxRiskWeight) {
                maxRiskWeight = w;
                maxRiskLevel = r;
              }
            });

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={`relative h-16 p-1.5 rounded-none border text-left flex flex-col justify-between transition-all duration-100 cursor-pointer shadow-none ${
                  isSelected
                    ? "bg-indigo-600 border-indigo-600 text-white z-10 font-bold"
                    : isCurrentMonth
                    ? "bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    : "bg-zinc-50/50 dark:bg-zinc-950/40 border-zinc-200/60 dark:border-zinc-800/60 text-zinc-300 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-850/60"
                }`}
              >
                {/* Date Number */}
                <div className="flex justify-between items-center w-full">
                  <span
                    className={`text-xs font-semibold ${
                      isToday
                        ? isSelected
                          ? "inline-flex items-center justify-center size-5 rounded-none bg-white text-indigo-600 font-bold"
                          : "inline-flex items-center justify-center size-5 rounded-none bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold"
                        : "text-inherit"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </div>

                {/* Task Indicators */}
                {dayTasks.length > 0 && (
                  <div className="flex items-center gap-1 mt-auto text-[9px] font-semibold">
                    <span
                      className={`size-1.5 rounded-none shrink-0 ${getRiskDotClass(maxRiskLevel)}`}
                    />
                    <span className={isSelected ? "text-white" : "text-zinc-500 dark:text-zinc-400"}>
                      {dayTasks.length} Tugas
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right Column: Selected Day Task List (Sidebar/Details) ── */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-none bg-white dark:bg-zinc-900 shadow-none p-5 space-y-4">
        <div>
          <h3 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Tugas Deadline
          </h3>
          <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            {selectedDate
              ? selectedDate.toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "Pilih tanggal"}
          </p>
        </div>

        {loading ? (
          <div className="space-y-3 pt-2">
            <div className="h-20 bg-zinc-50 dark:bg-zinc-800/50 rounded-none border border-zinc-200 dark:border-zinc-800 animate-pulse" />
            <div className="h-20 bg-zinc-50 dark:bg-zinc-800/50 rounded-none border border-zinc-200 dark:border-zinc-800 animate-pulse" />
          </div>
        ) : selectedDayTasks.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-950/60 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-none">
            Tidak ada tugas deadline pada tanggal ini.
          </div>
        ) : (
          <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
            {selectedDayTasks.map((task) => {
              const riskLevel = getRiskLevelFromTask(task);
              const picUser = task.pic_id ? usersMap.get(task.pic_id) || null : null;

              let divisionOrEventName = "-";
              if (task.type === "acara" && task.event_id) {
                const event = eventsMap.get(task.event_id);
                if (event && event.name) divisionOrEventName = event.name;
              } else if (task.type === "divisi" && task.division_id) {
                const division = divisionsMap.get(task.division_id);
                if (division && division.name) divisionOrEventName = division.name;
              }

              return (
                <div
                  key={task.id}
                  className="p-3.5 rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors space-y-2.5 flex flex-col justify-between shadow-none"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`size-1.5 rounded-none shrink-0 ${getRiskDotClass(riskLevel)}`}
                      />
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {divisionOrEventName}
                      </span>
                    </div>
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-xs line-clamp-2">
                      {task.name}
                    </h4>
                    <div className="flex justify-between items-center text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
                      <span>
                        PIC: <strong className="text-zinc-900 dark:text-zinc-100">{picUser ? picUser.name : "-"}</strong>
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {statusLabels[task.status] || task.status}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <Link
                      href={`/dashboard/tasks/${task.id}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold shadow-none transition-all cursor-pointer"
                    >
                      <Eye className="size-3.5 text-zinc-500 dark:text-zinc-400" />
                      <span>Buka Detail Tugas</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
