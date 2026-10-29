"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EventDetail } from "@/components/events/event-detail";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/hooks/use-auth";
import {
  addEventMember,
  getEventMembers,
  removeEventMember,
  updateEventMemberRole,
} from "@/lib/firebase/event-members";
import { db } from "@/lib/firebase/client";
import { doc, updateDoc } from "firebase/firestore";
import { getEventById } from "@/lib/firebase/events";
import { getMembers } from "@/lib/firebase/members";
import { createTask, getTasksByEvent } from "@/lib/firebase/tasks";
import { canManageEvent, isSuperAdmin, isKoordinatorDivisi } from "@/lib/permissions";
import type { Event, EventMember, Task, TaskInput, UserProfile } from "@/types";

import { showConfirm, showSuccess, showError } from "@/lib/swal";
import { toast } from "sonner";

import { useWorkspace } from "@/hooks/use-workspace";

export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [event, setEvent] = useState<Event | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [eventMembers, setEventMembers] = useState<EventMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const eventId = params.eventId;

  const loadDetail = useCallback(async () => {
    if (!userProfile || !eventId) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const eventData = await getEventById(eventId, {
        org_id: activeWorkspace.org_id,
        campus_id: activeWorkspace.campus_id,
      });

      if (!eventData) {
        setEvent(null);
        return;
      }

      const existingOrg =
        eventData.organization_id ||
        eventData.org_id ||
        (eventData as unknown as Record<string, unknown>).orgId;
      const existingCampus =
        eventData.campus_id ||
        eventData.univ_id ||
        (eventData as unknown as Record<string, unknown>).univId ||
        (eventData as unknown as Record<string, unknown>).campusId;

      if (activeWorkspace.org_id && existingOrg && activeWorkspace.org_id !== existingOrg) {
        router.replace("/dashboard/unauthorized");
        return;
      }
      if (activeWorkspace.campus_id && existingCampus && activeWorkspace.campus_id !== existingCampus) {
        router.replace("/dashboard/unauthorized");
        return;
      }

      // Fetch event members first to get current user's role in the event
      const membersData = await getEventMembers(eventId);
      const currentUserMember = membersData.find((m) => m.user_id === userProfile.id);

      const isMember = !!currentUserMember;
      const isDivCoordinator = isKoordinatorDivisi(userProfile);
      const isAdmin = isSuperAdmin(userProfile);

      if (!isAdmin && !isDivCoordinator && !isMember) {
        router.replace("/dashboard/unauthorized");
        return;
      }

      const [usersData, taskData] = await Promise.all([
        getMembers(activeWorkspace.org_id, activeWorkspace.campus_id),
        getTasksByEvent(eventId, {
          org_id: activeWorkspace.org_id,
          campus_id: activeWorkspace.campus_id,
        }),
      ]);

      setEvent(eventData);
      setUsers(usersData);
      setEventMembers(membersData);
      setTasks(taskData);
    } catch {
      setError("Gagal memuat detail acara. Periksa izin akses dan Firestore Rules.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace.campus_id, activeWorkspace.org_id, eventId, router, userProfile]);

  useEffect(() => {
    void Promise.resolve().then(loadDetail);
  }, [loadDetail]);

  async function handleAddMember(userId: string, roleInEvent: string) {
    if (!userProfile || !event) {
      return;
    }

    try {
      const orgId =
        event.organization_id ||
        event.org_id ||
        (event as unknown as Record<string, unknown>).orgId;
      const campusId =
        event.campus_id ||
        event.univ_id ||
        (event as unknown as Record<string, unknown>).campusId ||
        (event as unknown as Record<string, unknown>).univId;

      await addEventMember({
        eventId: event.id,
        userId,
        roleInEvent,
        addedBy: userProfile.id,
        organization_id: (orgId as string) || activeWorkspace.org_id,
        org_id: (orgId as string) || activeWorkspace.org_id,
        campus_id: (campusId as string) || activeWorkspace.campus_id,
        univ_id: (campusId as string) || activeWorkspace.campus_id,
      });
      void showSuccess("Anggota berhasil ditambahkan ke acara!");
      await loadDetail();
    } catch {
      void showError("Gagal menambahkan anggota ke acara.");
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!event) {
      return;
    }

    const confirmed = await showConfirm({
      title: "Hapus Anggota Acara",
      text: "Apakah Anda yakin ingin mengeluarkan anggota ini dari acara?",
      confirmButtonText: "Ya, Keluarkan",
      cancelButtonText: "Batal",
    });

    if (!confirmed) {
      return;
    }

    try {
      await removeEventMember(event.id, userId);
      void showSuccess("Anggota berhasil dikeluarkan dari acara!");
      await loadDetail();
    } catch {
      void showError("Gagal mengeluarkan anggota dari acara.");
    }
  }

  async function handleCreateTask(input: TaskInput) {
    if (!userProfile) {
      return;
    }

    try {
      const orgId = event?.orgId || event?.org_id || event?.organization_id || userProfile.orgId || userProfile.org_id || userProfile.organization_id;
      const campusId = event?.univId || event?.univ_id || event?.campusId || event?.campus_id || userProfile.univId || userProfile.univ_id || userProfile.campusId || userProfile.campus_id || "";
      const taskWithTenant: TaskInput = {
        ...input,
        organization_id: orgId,
        org_id: orgId,
        orgId: orgId,
        campus_id: campusId,
        campusId: campusId,
        univ_id: campusId,
        univId: campusId,
        event_id: eventId,
      };
      const newTaskId = await createTask(taskWithTenant, userProfile.id);

      if (input.notify_brief) {
        toast.success("Jobdesk diperbarui & notifikasi brief berhasil disiarkan ke WhatsApp!");
      } else {
        void showSuccess("Job desk berhasil ditambahkan ke acara!");
      }

      // Non-blocking asynchronous WhatsApp broadcast
      if (newTaskId && user) {
        void (async () => {
          try {
            const token = await user.getIdToken();
            if (input.notify_brief) {
              await fetch(`/api/tasks/${newTaskId}`, {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  notify_brief: true,
                }),
              });
            } else {
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
            }
          } catch {
            // Notification failure doesn't block task creation
          }
        })();
      }

      await loadDetail();
    } catch {
      void showError("Gagal menambahkan job desk.");
    }
  }

  async function handleUpdateMemberRole(userId: string, roleInEvent: string) {
    if (!event) {
      return;
    }

    try {
      await updateEventMemberRole(event.id, userId, roleInEvent);
      // Sync event coordinator if role changed to koordinator_acara
      if (roleInEvent === "koordinator_acara") {
        await updateDoc(doc(db, "events", event.id), {
          coordinator_id: userId,
        });
      }
      void showSuccess("Role acara berhasil diperbarui!");
      await loadDetail();
    } catch {
      void showError("Gagal memperbarui role acara.");
    }
  }

  if (loading) {
    return <LoadingState title="Memuat detail acara..." />;
  }

  if (error) {
    return (
      <EmptyState
        title="Detail acara gagal dimuat"
        description={error}
      />
    );
  }

  if (!event) {
    return (
      <EmptyState
        title="Acara tidak ditemukan"
        description="Dokumen acara tidak tersedia atau sudah tidak dapat diakses."
      />
    );
  }

  const currentUserMember = eventMembers.find((m) => m.user_id === userProfile?.id);
  const eventRole = currentUserMember?.role_in_event;

  return (
    <EventDetail
      event={event}
      users={users}
      eventMembers={eventMembers}
      tasks={tasks}
      canManage={Boolean(userProfile && canManageEvent(userProfile, event, eventRole))}
      onAddMember={handleAddMember}
      onRemoveMember={handleRemoveMember}
      onCreateTask={handleCreateTask}
      onUpdateRole={handleUpdateMemberRole}
    />
  );
}
