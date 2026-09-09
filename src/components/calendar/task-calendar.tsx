"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Task, UserProfile } from "@/types";
import { getCalendarGrid, isSameDay } from "@/lib/calendar-utils";
import { getRiskLevelFromTask, getRiskColor } from "@/lib/task-risk";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar, Eye } from "lucide-react";

import { useWorkspace } from "@/hooks/use-workspace";

type TaskCalendarProps = {
  profile: UserProfile;
};

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
            const org = item.organization_id || item.org_id || item.orgId || "org-undiksha-bem";
            const isLegacyOrg = (!item.organization_id && !item.org_id && !item.orgId) && (targetOrgId === "org-undiksha-bem" || targetOrgId === "org-ui-bem");
            if (org !== targetOrgId && !isLegacyOrg) return false;
          }
          if (targetCampusId) {
            const campus = item.campus_id || item.campusId || item.univ_id || item.univId || "univ-undiksha";
            const isLegacyCampus = (!item.campus_id && !item.campusId && !item.univ_id && !item.univId) && (targetCampusId === "univ-undiksha" || targetCampusId === "univ-ui");
            if (campus !== targetCampusId && !isLegacyCampus) return false;
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

  const statusLabels = {
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
      {/* Calendar Grid Container */}
      <div className="lg:col-span-2 space-y-4 bg-[var(--secondary-background)] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="size-5 text-sky-600 dark:text-sky-400" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              {monthNames[currentMonth]} {currentYear}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={setToday}>
              <Calendar className="h-4 w-4" />
              Hari Ini
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-[var(--jd-neo-muted)] uppercase tracking-wider pb-2 border-b border-slate-200 dark:border-slate-800">
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

            // Determine highest risk level color for this day's tasks
            let maxRiskColor = "";
            let maxRiskWeight = 0;
            const riskWeights = { red: 3, orange: 2, yellow: 1, none: 0 };

            dayTasks.forEach((t) => {
              const r = getRiskLevelFromTask(t);
              const w = riskWeights[r] || 0;
              if (w > maxRiskWeight) {
                maxRiskWeight = w;
                maxRiskColor = getRiskColor(r);
              }
            });

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={`relative h-16 p-1.5 rounded-lg border text-left flex flex-col justify-between transition-all duration-100 cursor-pointer ${
                  isSelected
                    ? "bg-sky-600 border-sky-600 text-white shadow-sm z-10"
                    : isCurrentMonth
                    ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[var(--foreground)] hover:bg-slate-50 dark:hover:bg-slate-800"
                    : "bg-slate-50 dark:bg-slate-950/40 border-slate-100 dark:border-slate-900 text-[var(--jd-neo-muted)] opacity-65 hover:bg-slate-100 dark:hover:bg-slate-900"
                }`}
              >
                {/* Date Number */}
                <div className="flex justify-between items-center w-full">
                  <span
                    className={`text-xs font-semibold ${
                      isToday
                        ? isSelected
                          ? "inline-flex items-center justify-center size-5 rounded-full bg-white text-sky-600 font-bold"
                          : "inline-flex items-center justify-center size-5 rounded-full bg-sky-600 text-white"
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
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: maxRiskColor || "#94A3B8" }}
                    ></span>
                    <span className={isSelected ? "text-white" : "text-[var(--jd-neo-muted)]"}>
                      {dayTasks.length} Tugas
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Task List (Sidebar/Details) */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm p-5 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-[var(--jd-neo-muted)] uppercase tracking-wider">
            Tugas Deadline
          </h3>
          <p className="text-base font-bold text-[var(--foreground)] mt-1">
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
          <div className="space-y-3 animate-pulse pt-2">
            <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-850 shadow-sm"></div>
            <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-850 shadow-sm"></div>
          </div>
        ) : selectedDayTasks.length === 0 ? (
          <div className="py-8 px-4 text-center text-xs font-semibold text-[var(--jd-neo-muted)] bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
            Tidak ada tugas deadline di tanggal ini.
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto max-h-[360px] pr-1">
            {selectedDayTasks.map((task) => {
              const riskLevel = getRiskLevelFromTask(task);
              const riskColor = getRiskColor(riskLevel);
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
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm hover:shadow-md transition-shadow space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: riskColor }}
                      ></span>
                      <span className="text-[10px] font-semibold text-[var(--jd-neo-muted)] uppercase tracking-wider">
                        {divisionOrEventName}
                      </span>
                    </div>
                    <h4 className="font-bold text-[var(--foreground)] text-xs line-clamp-2">
                      {task.name}
                    </h4>
                    <div className="flex justify-between items-center text-[10px] text-[var(--jd-neo-muted)] pt-1">
                      <span>PIC: {picUser ? picUser.name : "-"}</span>
                      <span className="font-semibold text-[var(--foreground)]">
                        {statusLabels[task.status] || task.status}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-1">
                    <Link href={`/dashboard/tasks/${task.id}`} passHref legacyBehavior>
                      <Button variant="secondary" size="sm" className="w-full">
                        <Eye className="h-4 w-4" />
                        Buka Detail Task
                      </Button>
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
