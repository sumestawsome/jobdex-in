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
      <div className="lg:col-span-2 space-y-4 bg-white border border-[#e1e2e3] rounded-xl p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="size-4.5 text-[#242424]" />
            <h2 className="text-base sm:text-lg font-bold text-[#242424]">
              {monthNames[currentMonth]} {currentYear}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prevMonth}
              className="size-8 rounded-lg border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] flex items-center justify-center transition-all shadow-2xs cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={setToday}
              className="h-8 px-3 rounded-lg border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <Calendar className="size-3.5" />
              <span>Hari Ini</span>
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="size-8 rounded-lg border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] flex items-center justify-center transition-all shadow-2xs cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-[#898989] uppercase tracking-wider pb-2 border-b border-[#e1e2e3]">
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
                type="button"
                onClick={() => setSelectedDate(day)}
                className={`relative h-16 p-1.5 rounded-lg border text-left flex flex-col justify-between transition-all duration-100 cursor-pointer ${
                  isSelected
                    ? "bg-[#242424] border-[#242424] text-white shadow-xs z-10"
                    : isCurrentMonth
                    ? "bg-white border-[#e1e2e3] text-[#242424] hover:bg-[#f7f7f8]"
                    : "bg-[#f7f7f8] border-[#e1e2e3]/60 text-[#898989] opacity-60 hover:bg-[#f0f0f2]"
                }`}
              >
                {/* Date Number */}
                <div className="flex justify-between items-center w-full">
                  <span
                    className={`text-xs font-semibold ${
                      isToday
                        ? isSelected
                          ? "inline-flex items-center justify-center size-5 rounded-full bg-white text-[#242424] font-bold"
                          : "inline-flex items-center justify-center size-5 rounded-full bg-[#242424] text-white"
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
                      className="size-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: maxRiskColor || "#898989" }}
                    />
                    <span className={isSelected ? "text-white" : "text-[#898989]"}>
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
      <div className="border border-[#e1e2e3] rounded-xl bg-white shadow-2xs p-5 space-y-4">
        <div>
          <h3 className="text-[11px] font-semibold text-[#898989] uppercase tracking-wider">
            Tugas Deadline
          </h3>
          <p className="text-base font-bold text-[#242424] mt-1">
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
            <div className="h-20 bg-[#f7f7f8] rounded-lg border border-[#e1e2e3]" />
            <div className="h-20 bg-[#f7f7f8] rounded-lg border border-[#e1e2e3]" />
          </div>
        ) : selectedDayTasks.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs font-medium text-[#898989] bg-[#f7f7f8] border border-dashed border-[#e1e2e3] rounded-lg">
            Tidak ada tugas deadline pada tanggal ini.
          </div>
        ) : (
          <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
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
                  className="p-3.5 rounded-lg border border-[#e1e2e3] bg-[#f7f7f8] shadow-2xs hover:border-[#b0b2b5] transition-colors space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="size-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: riskColor }}
                      />
                      <span className="text-[10px] font-semibold text-[#898989] uppercase tracking-wider">
                        {divisionOrEventName}
                      </span>
                    </div>
                    <h4 className="font-bold text-[#242424] text-xs line-clamp-2">
                      {task.name}
                    </h4>
                    <div className="flex justify-between items-center text-[11px] text-[#898989] pt-1">
                      <span>PIC: <strong className="text-[#242424]">{picUser ? picUser.name : "-"}</strong></span>
                      <span className="font-semibold text-[#242424]">
                        {statusLabels[task.status] || task.status}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#e1e2e3]">
                    <Link
                      href={`/dashboard/tasks/${task.id}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 h-7.5 px-3 rounded-md border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-xs font-semibold shadow-2xs transition-all"
                    >
                      <Eye className="size-3 text-[#898989]" />
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
