"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EventFilters, type EventDateFilter } from "@/components/events/event-filters";
import { EventFormDialog } from "@/components/events/event-form-dialog";
import { EventsTable } from "@/components/events/events-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { Plus, Building2, ArrowRight } from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  getEventMembers,
  addEventMember,
  removeEventMember,
} from "@/lib/firebase/event-members";
import {
  createEvent,
  getEventsForProfile,
  updateEvent,
} from "@/lib/firebase/events";
import { getMembers } from "@/lib/firebase/members";
import { canCreateEvent } from "@/lib/permissions";
import type { Event, EventInput, EventStatus, UserProfile, EventMember } from "@/types";
import { showSuccess, showError } from "@/lib/swal";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export default function EventsPage() {
  return <EventsManagement />;
}

function EventsManagement() {
  const { userProfile } = useAuth();
  const { activeWorkspace, activeCampus, activeOrmawa } = useWorkspace();
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [userRolesByEvent, setUserRolesByEvent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EventStatus>("all");
  const [dateFilter, setDateFilter] = useState<EventDateFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedEventMembers, setSelectedEventMembers] = useState<EventMember[]>([]);

  const loadEvents = useCallback(async () => {
    if (!userProfile) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [eventsData, usersData] = await Promise.all([
        getEventsForProfile(userProfile, activeWorkspace),
        getMembers(activeWorkspace.org_id, activeWorkspace.campus_id),
      ]);
      const counts = await getMemberCounts(eventsData);

      const roles: Record<string, string> = {};
      await Promise.all(
        eventsData.map(async (event) => {
          if (event.coordinator_id === userProfile.id) {
            roles[event.id] = "koordinator_acara";
            return;
          }
          try {
            const memberSnap = await getDoc(doc(db, "events", event.id, "event_members", userProfile.id));
            if (memberSnap.exists()) {
              roles[event.id] = memberSnap.data().role_in_event || "anggota_acara";
            }
          } catch {
            // Ignore
          }
        })
      );

      setEvents(eventsData);
      setUsers(usersData);
      setMemberCounts(counts);
      setUserRolesByEvent(roles);
    } catch {
      setError("Gagal mengambil data acara. Periksa Firestore Rules dan koneksi.");
    } finally {
      setLoading(false);
    }
  }, [userProfile, activeWorkspace.org_id, activeWorkspace.campus_id]);

  useEffect(() => {
    void Promise.resolve().then(loadEvents);
  }, [loadEvents]);

  const usersById = useMemo(() => {
    return new Map(users.map((user) => [user.id, user]));
  }, [users]);

  const coordinators = useMemo(() => {
    if (!userProfile) {
      return [];
    }

    if (userProfile.role === "koordinator_acara") {
      return [userProfile];
    }

    const coordinatorUsers = users.filter((user) =>
      ["super_admin", "koordinator_divisi", "koordinator_acara"].includes(user.role),
    );

    return coordinatorUsers.length ? coordinatorUsers : [userProfile];
  }, [userProfile, users]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events.filter((event) => {
      const matchesSearch = !query || event.name.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" || event.status === statusFilter;
      const eventDate = getEventDate(event.event_date);
      const matchesDate =
        dateFilter === "all" ||
        !eventDate ||
        (dateFilter === "upcoming" && eventDate >= today) ||
        (dateFilter === "past" && eventDate < today);

      const eventOrgId = event.org_id || event.organization_id;
      const eventCampusId = event.campus_id || event.univ_id;
      const matchesOrg = !eventOrgId || eventOrgId === activeWorkspace.org_id;
      const matchesCampus = !eventCampusId || eventCampusId === activeWorkspace.campus_id;
      const matchesWorkspace = matchesOrg && matchesCampus;

      return matchesWorkspace && matchesSearch && matchesStatus && matchesDate;
    });
  }, [activeWorkspace.org_id, activeWorkspace.campus_id, dateFilter, events, search, statusFilter]);

  async function handleSaveEvent(input: EventInput, eventId?: string) {
    if (!userProfile) {
      return;
    }

    if (!eventId && !activeWorkspace.org_id) {
      void showError("Pilih ruang kerja (ormawa) terlebih dahulu sebelum membuat acara.");
      return;
    }

    try {
      let activeId = eventId;
      if (eventId) {
        await updateEvent(eventId, input, userProfile.id);
        void showSuccess("Acara berhasil diperbarui!");
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
        activeId = await createEvent(inputWithTenant as EventInput, userProfile.id);
        void showSuccess("Acara baru berhasil ditambahkan!");
      }

      if (activeId) {
        // Sync members: coordinator, secretary, initial_member_ids
        const existingMembers = eventId ? await getEventMembers(eventId) : [];
        const existingMembersMap = new Map(existingMembers.map((m) => [m.user_id, m]));

        // 1. Process Coordinator (koordinator_acara)
        await addEventMember({
          eventId: activeId,
          userId: input.coordinator_id,
          roleInEvent: "koordinator_acara",
          addedBy: userProfile.id,
          organization_id: activeWorkspace.org_id,
          org_id: activeWorkspace.org_id,
          orgId: activeWorkspace.org_id,
          campus_id: activeWorkspace.campus_id,
          campusId: activeWorkspace.campus_id,
          univ_id: activeWorkspace.campus_id,
          univId: activeWorkspace.campus_id,
        });

        // 2. Process Secretary (sekretaris_acara)
        const oldSec = existingMembers.find((m) => {
          const r = m.role_in_event?.toLowerCase() || "";
          return r === "sekretaris_acara" || r === "sekretaris acara" || r === "sekretaris";
        });

        if (input.secretary_id) {
          await addEventMember({
            eventId: activeId,
            userId: input.secretary_id,
            roleInEvent: "sekretaris_acara",
            addedBy: userProfile.id,
          });
          // If secretary changed, change old secretary back to "anggota_acara"
          if (oldSec && oldSec.user_id !== input.secretary_id && oldSec.user_id !== input.coordinator_id) {
            await addEventMember({
              eventId: activeId,
              userId: oldSec.user_id,
              roleInEvent: "anggota_acara",
              addedBy: userProfile.id,
            });
          }
        } else {
          // If secretary cleared, change old secretary back to "anggota_acara"
          if (oldSec && oldSec.user_id !== input.coordinator_id) {
            await addEventMember({
              eventId: activeId,
              userId: oldSec.user_id,
              roleInEvent: "anggota_acara",
              addedBy: userProfile.id,
            });
          }
        }

        // 3. Process Initial Members
        const currentCoordId = input.coordinator_id;
        const currentSecId = input.secretary_id || "";
        const targetMemberIds = input.initial_member_ids || [];

        // Add/Update new members
        for (const mId of targetMemberIds) {
          if (mId === currentCoordId || mId === currentSecId) continue;
          const exist = existingMembersMap.get(mId);
          if (!exist || exist.role_in_event !== "anggota_acara") {
            await addEventMember({
              eventId: activeId,
              userId: mId,
              roleInEvent: "anggota_acara",
              addedBy: userProfile.id,
            });
          }
        }

        // Remove unselected members (only if editing)
        if (eventId) {
          for (const ext of existingMembers) {
            if (ext.user_id === currentCoordId || ext.user_id === currentSecId) continue;
            if (!targetMemberIds.includes(ext.user_id)) {
              await removeEventMember(activeId, ext.user_id);
            }
          }
        }
      }

      await loadEvents();
    } catch (err) {
      void showError("Gagal menyimpan acara.");
      throw err;
    }
  }

  if (!userProfile) {
    return null;
  }

  const showCreateBtn = canCreateEvent(userProfile);

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
              {activeCampus.name} • Menampilkan acara terfilter untuk ruang kerja ini
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
          <Badge variant="info">Manajemen Acara</Badge>
          <h1 className="mt-3 text-3xl font-bold text-slate-950 dark:text-slate-50">
            Manajemen Acara
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Buat, edit, ubah status, dan kelola anggota yang terlibat dalam
            acara organisasi.
          </p>
        </div>
        {showCreateBtn && (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setSelectedEvent(null);
              setSelectedEventMembers([]);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Tambah Acara
          </Button>
        )}
      </section>

      <EventFilters
        search={search}
        status={statusFilter}
        dateFilter={dateFilter}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
        onDateFilterChange={setDateFilter}
      />

      {error ? (
        <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <LoadingState title="Memuat daftar acara..." />
      ) : events.length === 0 ? (
        <EmptyState
          title={`Belum ada acara di ${activeOrmawa.short_name}`}
          description={`Ruang kerja ${activeOrmawa.name} (${activeCampus.code}) belum memiliki acara terdaftar. Buat acara pertama untuk mulai mengelola kepanitiaan.`}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {showCreateBtn ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setSelectedEvent(null);
                    setSelectedEventMembers([]);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Acara di {activeOrmawa.short_name}
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
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          title={`Tidak ada acara yang cocok di ${activeOrmawa.short_name}`}
          description={`Tidak ada acara pada filter aktif di ruang kerja ${activeOrmawa.name}. Coba ubah pencarian atau tambahkan acara baru.`}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {showCreateBtn ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setSelectedEvent(null);
                    setSelectedEventMembers([]);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Acara
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
      ) : (
        <EventsTable
          events={filteredEvents}
          usersById={usersById}
          memberCounts={memberCounts}
          userProfile={userProfile}
          userRoles={userRolesByEvent}
          onEdit={async (event) => {
            setSelectedEvent(event);
            try {
              const members = await getEventMembers(event.id);
              setSelectedEventMembers(members);
            } catch {
              setSelectedEventMembers([]);
            }
            setFormOpen(true);
          }}
        />
      )}

      <EventFormDialog
        open={formOpen}
        event={selectedEvent}
        coordinators={coordinators}
        fallbackCoordinatorId={userProfile.id}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveEvent}
        users={users}
        eventMembers={selectedEventMembers}
      />
    </div>
  );
}

async function getMemberCounts(events: Event[]) {
  const entries = await Promise.all(
    events.map(async (event) => {
      try {
        const members = await getEventMembers(event.id);
        return [event.id, members.length] as const;
      } catch {
        return [event.id, 0] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}

function getEventDate(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return null;
  }

  const date = (value as { toDate: () => Date }).toDate();
  date.setHours(0, 0, 0, 0);
  return date;
}
