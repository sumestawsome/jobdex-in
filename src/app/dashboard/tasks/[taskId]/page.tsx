"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TaskDetail } from "@/components/tasks/task-detail";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/hooks/use-auth";
import { getEventsForProfile } from "@/lib/firebase/events";
import { getMembers, getUsersByIds } from "@/lib/firebase/members";
import { getTaskStatusLogs } from "@/lib/firebase/task-status-logs";
import { getTaskUploads } from "@/lib/firebase/task-uploads";
import { getTaskById } from "@/lib/firebase/tasks";
import { canReadTask } from "@/lib/permissions";
import type { Event, Task, TaskStatusLog, TaskUpload, UserProfile } from "@/types";
import { db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";

import { useWorkspace } from "@/hooks/use-workspace";

export default function TaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [logs, setLogs] = useState<TaskStatusLog[]>([]);
  const [uploads, setUploads] = useState<TaskUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventRole, setEventRole] = useState("");
  const taskId = params.taskId;
  const rawReturnTo = searchParams.get("returnTo") || "/dashboard/tasks";
  const returnTo = (rawReturnTo.startsWith("/dashboard") && !rawReturnTo.startsWith("//") && !rawReturnTo.includes(":") && !rawReturnTo.includes("\\"))
    ? rawReturnTo
    : "/dashboard/tasks";

  const loadDetail = useCallback(async () => {
    if (!userProfile || !taskId) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const taskData = await getTaskById(taskId, {
        org_id: activeWorkspace.org_id,
        campus_id: activeWorkspace.campus_id,
      });

      if (!taskData) {
        setTask(null);
        return;
      }

      const existingOrg =
        taskData.organization_id ||
        taskData.org_id ||
        (taskData as unknown as Record<string, unknown>).orgId;
      const existingCampus =
        taskData.campus_id ||
        taskData.univ_id ||
        (taskData as unknown as Record<string, unknown>).univId ||
        (taskData as unknown as Record<string, unknown>).campusId;

      if (activeWorkspace.org_id && existingOrg && activeWorkspace.org_id !== existingOrg) {
        router.replace("/dashboard/unauthorized");
        return;
      }
      if (activeWorkspace.campus_id && existingCampus && activeWorkspace.campus_id !== existingCampus) {
        router.replace("/dashboard/unauthorized");
        return;
      }

      let role = "";
      if (taskData.event_id) {
        const memberDoc = await getDoc(doc(db, "events", taskData.event_id, "event_members", userProfile.id)).catch(() => null);
        if (memberDoc && memberDoc.exists()) {
          role = memberDoc.data().role_in_event || "";
        }
      }
      setEventRole(role);

      if (!canReadTask(userProfile, taskData, role)) {
        router.replace("/dashboard/unauthorized");
        return;
      }

      const [usersData, eventsData, logData, uploadData] = await Promise.all([
        getMembers(activeWorkspace.org_id, activeWorkspace.campus_id).catch(() => [userProfile]),
        getEventsForProfile(userProfile, {
          org_id: activeWorkspace.org_id,
          campus_id: activeWorkspace.campus_id,
        }).catch(() => []),
        getTaskStatusLogs(taskId).catch(() => []),
        getTaskUploads(taskId).catch(() => []),
      ]);
      const userIdsFromLogs = logData.map((log) => log.changed_by);
      const missingLogUserIds = userIdsFromLogs.filter(
        (userId) =>
          userId &&
          !usersData.some((user) => user.id === userId) &&
          userId !== userProfile.id,
      );
      const logUsers = missingLogUserIds.length
        ? await getUsersByIds(missingLogUserIds).catch(() => [])
        : [];
      const usersByUniqueId = new Map(
        [...usersData, userProfile, ...logUsers].map((user) => [user.id, user]),
      );

      setTask(taskData);
      setUsers([...usersByUniqueId.values()]);
      setEvents(eventsData);
      setLogs(logData);
      setUploads(uploadData);
    } catch {
      setError("Gagal memuat detail task. Periksa izin akses dan Firestore Rules.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace.campus_id, activeWorkspace.org_id, router, taskId, userProfile]);

  useEffect(() => {
    void Promise.resolve().then(loadDetail);
  }, [loadDetail]);

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);

  if (loading) {
    return <LoadingState title="Memuat detail job desk..." />;
  }

  if (error) {
    return <EmptyState title="Detail job desk gagal dimuat" description={error} />;
  }

  if (!task) {
    return (
      <EmptyState
        title="Job desk tidak ditemukan"
        description="Dokumen task tidak tersedia atau sudah tidak dapat diakses."
      />
    );
  }

  if (!userProfile) {
    return null;
  }

  return (
    <TaskDetail
      task={task}
      usersById={usersById}
      eventsById={eventsById}
      logs={logs}
      uploads={uploads}
      currentUser={userProfile}
      onChanged={loadDetail}
      returnTo={returnTo}
      eventRole={eventRole}
    />
  );
}
