"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Task, UserProfile } from "@/types";
import { getRiskLevelFromTask } from "@/lib/task-risk";
import { TaskRiskCard } from "@/components/dashboard/task-risk-card";
import { AlertTriangle } from "lucide-react";

import { useWorkspace } from "@/hooks/use-workspace";

type TaskRiskSectionProps = {
  profile: UserProfile;
};


export function TaskRiskSection({ profile }: TaskRiskSectionProps) {
  const { activeWorkspace } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [usersMap, setUsersMap] = useState<Map<string, UserProfile>>(new Map());
  const [eventsMap, setEventsMap] = useState<Map<string, { name?: string }>>(new Map());
  const [divisionsMap, setDivisionsMap] = useState<Map<string, { name?: string }>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Anggota role doesn't need to load or see this section
    if (profile.role === "anggota") {
      return;
    }

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

        // Fetch all active tasks
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

        // Filter based on role
        let filteredTasks = allTasks;
        if (profile.role === "koordinator_divisi") {
          filteredTasks = allTasks.filter((t) => t.division_id === profile.division_id);
        } else if (profile.role === "koordinator_acara") {
          filteredTasks = allTasks.filter((t) => t.coordinator_id === profile.id);
        }

        // Keep only tasks with a deadline, not approved, and risk level !== "none"
        const atRiskTasks = filteredTasks.filter((task) => {
          if (task.status === "approved" || !task.deadline) {
            return false;
          }
          const riskLevel = getRiskLevelFromTask(task);
          return riskLevel === "yellow" || riskLevel === "orange" || riskLevel === "red";
        });

        // Sort by severity (red first, then orange, then yellow)
        const severityWeight = { red: 3, orange: 2, yellow: 1, none: 0 };
        atRiskTasks.sort((a, b) => {
          const riskA = getRiskLevelFromTask(a);
          const riskB = getRiskLevelFromTask(b);
          return severityWeight[riskB] - severityWeight[riskA];
        });

        setTasks(atRiskTasks);
      } catch (error) {
        console.error("[TaskRiskSection] Load failed:", error);
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

  // Members/Anggota do not see this global section
  if (profile.role === "anggota") {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-3 py-2 animate-pulse">
        <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
        <div className="flex gap-4 overflow-x-hidden">
          <div className="h-44 w-[290px] bg-slate-100 dark:bg-slate-900 rounded-xl flex-none"></div>
          <div className="h-44 w-[290px] bg-slate-100 dark:bg-slate-900 rounded-xl flex-none"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <AlertTriangle className="size-5 text-red-500 fill-red-500/10 shrink-0" />
          <span>Tugas Berisiko</span>
          {tasks.length > 0 && (
            <span className="inline-flex items-center justify-center border border-sky-200 dark:border-sky-800 rounded-md bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-400 shrink-0">
              {tasks.length}
            </span>
          )}
        </h2>
      </div>

      {tasks.length === 0 ? (
        <div className="p-6 rounded-xl border border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/30 text-center text-sm text-slate-400 dark:text-slate-500">
          Tidak ada tugas berisiko saat ini.
        </div>
      ) : (
        <div className="flex overflow-x-auto gap-4 pb-3 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          {tasks.map((task) => {
            const picUser = task.pic_id ? usersMap.get(task.pic_id) || null : null;

            // Determine division or event name
            let divisionOrEventName = "-";
            if (task.type === "acara" && task.event_id) {
              const event = eventsMap.get(task.event_id);
              if (event && event.name) divisionOrEventName = event.name;
            } else if (task.type === "divisi" && task.division_id) {
              const division = divisionsMap.get(task.division_id);
              if (division && division.name) divisionOrEventName = division.name;
            }

            return (
              <TaskRiskCard
                key={task.id}
                task={task}
                picUser={picUser}
                divisionOrEventName={divisionOrEventName}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
