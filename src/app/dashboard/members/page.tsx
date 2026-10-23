"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { MemberDetailDialog } from "@/components/members/member-detail-dialog";
import { MemberEditDialog } from "@/components/members/member-edit-dialog";
import {
  MemberFilters,
  type MemberStatusFilter,
} from "@/components/members/member-filters";
import { MembersTable } from "@/components/members/members-table";
import { MemberCardGrid } from "@/components/members/member-card-grid";
import { MemberViewToggle, type MemberViewMode } from "@/components/members/member-view-toggle";
import { getDivisionRoleLabel } from "@/components/members/member-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { ActiveWorkspaceBanner } from "@/components/workspace/active-workspace-banner";
import { getMembers, updateMember } from "@/lib/firebase/members";
import { getDivisions } from "@/lib/firebase/divisions";
import { collection, collectionGroup, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { canManageMembers } from "@/lib/permissions";
import type { MemberUpdateInput, UserProfile, UserRole, Division } from "@/types";
import { showConfirm, showSuccess, showError } from "@/lib/swal";

export default function MembersPage() {
  return (
    <PermissionGuard canAccess={canManageMembers}>
      <MembersManagement />
    </PermissionGuard>
  );
}

function MembersManagement() {
  const { reloadUserProfile, userProfile } = useAuth();
  const { activeWorkspace, activeCampus, activeOrmawa } = useWorkspace();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [eventRolesByUser, setEventRolesByUser] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [viewMode, setViewMode] = useState<MemberViewMode>("table");
  const [isMobile, setIsMobile] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<UserProfile | null>(null);
  const [selectedEdit, setSelectedEdit] = useState<UserProfile | null>(null);
  const [divisionsList, setDivisionsList] = useState<Division[]>([]);

  useEffect(() => {
    const updateMobileStatus = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        try {
          const savedMode = localStorage.getItem("jobdex_members_view_mode") as MemberViewMode | null;
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

  const handleViewModeChange = (mode: MemberViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("jobdex_members_view_mode", mode);
    } catch {
      // ignore localStorage error
    }
  };

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [membersData, divsData, eventsSnap, eventMembersSnap] = await Promise.all([
        getMembers(activeWorkspace.org_id, activeWorkspace.campus_id),
        getDivisions(activeWorkspace.org_id, activeWorkspace.campus_id),
        getDocs(collection(db, "events")).catch(() => null),
        getDocs(collectionGroup(db, "event_members")).catch(() => null),
      ]);
      setMembers(membersData);
      setDivisionsList(divsData);

      // Compute active event roles for members
      if (eventsSnap && eventMembersSnap) {
        const activeEventsMap = new Map<string, string>();
        eventsSnap.docs.forEach((doc) => {
          const d = doc.data();
          if (d.status !== "selesai") {
            activeEventsMap.set(doc.id, d.name || "Acara Aktif");
          }
        });

        const rolesMap: Record<string, string> = {};
        eventMembersSnap.docs.forEach((doc) => {
          const d = doc.data();
          const eventId = d.event_id || doc.ref.parent.parent?.id;
          const userId = d.user_id || doc.id;
          if (eventId && activeEventsMap.has(eventId)) {
            const eventName = activeEventsMap.get(eventId)!;
            let roleLabel = "Panitia";
            if (d.role_in_event === "koordinator_acara") roleLabel = "Koor Acara";
            else if (d.role_in_event === "sekretaris_acara") roleLabel = "Sekretaris";
            else if (d.role_in_event === "bendahara_acara") roleLabel = "Bendahara";
            else if (d.role_in_event && typeof d.role_in_event === "string") {
              roleLabel = d.role_in_event.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
            }
            rolesMap[userId] = `${roleLabel} - ${eventName}`;
          }
        });
        setEventRolesByUser(rolesMap);
      }
    } catch {
      setError("Gagal mengambil daftar anggota. Periksa koneksi dan Firestore Rules.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace.org_id, activeWorkspace.campus_id]);

  useEffect(() => {
    void Promise.resolve().then(loadMembers);
  }, [loadMembers]);

  const divisions = useMemo(() => {
    return Array.from(
      new Set(
        members
          .map((member) => member.division_id)
          .filter((divisionId): divisionId is string => Boolean(divisionId)),
      ),
    ).sort();
  }, [members]);

  const filteredMembers = useMemo(() => {
    const queryTokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return members.filter((member) => {
      const eventRole = eventRolesByUser[member.id] || "";
      const divisionRole = getDivisionRoleLabel(member.role);
      const searchableContent = [
        member.name || "",
        member.email || "",
        member.whatsapp_number || "",
        member.division_id || "",
        divisionRole,
        eventRole,
      ].join(" ").toLowerCase();

      const matchesSearch =
        queryTokens.length === 0 ||
        queryTokens.every((token) => searchableContent.includes(token));

      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && member.is_active) ||
        (statusFilter === "inactive" && !member.is_active);
      const matchesDivision =
        divisionFilter === "all" || member.division_id === divisionFilter;

      const memberOrgId = member.orgId || member.org_id || member.organization_id;
      const memberCampusId = member.univId || member.campusId || member.campus_id || member.univ_id;

      const matchesOrg =
        !activeWorkspace.org_id ||
        !memberOrgId ||
        memberOrgId === activeWorkspace.org_id ||
        ((memberOrgId === "main_org" || memberOrgId === "org-undiksha-forkom-kip" || memberOrgId === "org-undiksha-bem") &&
         (activeWorkspace.org_id === "org-undiksha-forkom-kip" || activeWorkspace.org_id === "org-undiksha-bem" || activeWorkspace.org_id === "main_org"));
      const matchesCampus =
        !activeWorkspace.campus_id ||
        !memberCampusId ||
        memberCampusId === activeWorkspace.campus_id ||
        memberCampusId === "univ-undiksha" ||
        memberCampusId === "ui";
      const matchesWorkspace = matchesOrg && matchesCampus;

      return matchesWorkspace && matchesSearch && matchesRole && matchesStatus && matchesDivision;
    });
  }, [activeWorkspace.campus_id, activeWorkspace.org_id, divisionFilter, eventRolesByUser, members, roleFilter, search, statusFilter]);

  async function handleSaveMember(memberId: string, input: MemberUpdateInput) {
    if (!userProfile) {
      return;
    }

    try {
      const canUpdateRole = userProfile.role === "super_admin";
      await updateMember(memberId, input, canUpdateRole);
      await loadMembers();

      if (memberId === userProfile.id) {
        await reloadUserProfile();
      }
      void showSuccess("Data anggota berhasil diperbarui!");
    } catch (err) {
      void showError("Gagal menyimpan perubahan anggota.");
      throw err;
    }
  }

  async function handleToggleStatus(member: UserProfile) {
    if (!userProfile || member.id === userProfile.id) {
      return;
    }

    if (userProfile.role !== "super_admin" && member.role === "super_admin") {
      void showError("Koordinator divisi tidak dapat mengubah status super admin.", "Akses Ditolak");
      return;
    }

    // Confirmation for deactivation
    if (member.is_active) {
      const confirmed = await showConfirm({
        title: "Nonaktifkan Anggota",
        text: `Apakah Anda yakin ingin menonaktifkan ${member.name || "anggota ini"}? Anggota ini tidak akan bisa mengakses JobDex.in.`,
        confirmButtonText: "Ya, Nonaktifkan",
        cancelButtonText: "Batal",
      });
      if (!confirmed) {
        return;
      }
    }

    try {
      await updateMember(member.id, {
        name: member.name || "-",
        whatsapp_number: member.whatsapp_number || "",
        role: member.role,
        division_id: member.division_id || "humas_media_kreatif",
        is_active: !member.is_active,
        whatsapp_command_pin: member.whatsapp_command_pin || "",
      }, userProfile.role === "super_admin");
      
      await loadMembers();
      
      const statusText = !member.is_active ? "diaktifkan" : "dinonaktifkan";
      void showSuccess(`Anggota berhasil ${statusText}!`);
    } catch {
      void showError("Gagal mengubah status anggota.");
    }
  }

  if (!userProfile) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full pb-16">
      {/* ── Active Workspace Isolation Banner ────────────────────────────────── */}
      <ActiveWorkspaceBanner description={`${activeCampus.name} • Menampilkan anggota terfilter untuk ruang kerja ini`} />

      {/* ── Header Section ──────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Anggota & Tim Organisasi
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Kelola profil tim, penetapan peran (role), pembagian divisi, dan hak akses ruang kerja.
          </p>
        </div>
        <div className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 text-right shadow-none">
          <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Total Anggota</span>
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {(activeWorkspace.org_id === "org-undiksha-forkom-kip" || activeWorkspace.org_id === "org-undiksha-bem" || activeWorkspace.org_id === "org-ui-bem")
              ? filteredMembers.length
              : activeOrmawa.member_count}
          </span>
        </div>
      </header>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <MemberFilters
        search={search}
        role={roleFilter}
        status={statusFilter}
        division={divisionFilter}
        divisions={divisions}
        onSearchChange={setSearch}
        onRoleChange={setRoleFilter}
        onStatusChange={setStatusFilter}
        onDivisionChange={setDivisionFilter}
      />

      {/* ── View Mode & Summary Bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Menampilkan <strong className="text-zinc-900 dark:text-zinc-100">{filteredMembers.length}</strong> dari {members.length} anggota terdaftar
        </p>
        <div className="hidden md:inline-flex">
          <MemberViewToggle value={isMobile ? "card" : viewMode} onChange={handleViewModeChange} />
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-none bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200 border border-red-200 dark:border-red-900 shadow-none">
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadMembers()}
            className="rounded-none bg-white text-red-700 hover:bg-red-50 dark:bg-zinc-900 dark:text-red-200 dark:hover:bg-red-950/40 border-red-200 dark:border-red-800 shadow-none"
          >
            Muat ulang
          </Button>
        </div>
      ) : null}

      {loading ? (
        <LoadingState title="Memuat daftar anggota..." />
      ) : members.length === 0 ? (
        <EmptyState
          title={`Belum ada anggota di ${activeOrmawa.short_name}`}
          description={`Ruang kerja ${activeOrmawa.name} (${activeCampus.code}) belum memiliki anggota terdaftar.`}
          action={
            <Link href="/dashboard/workspace">
              <Button variant="outline" size="sm" className="rounded-none shadow-none">
                Ganti Ruang Kerja
              </Button>
            </Link>
          }
        />
      ) : filteredMembers.length === 0 ? (
        <EmptyState
          title={`Tidak ada anggota yang cocok di ${activeOrmawa.short_name}`}
          description={`Tidak ada anggota pada filter aktif di ruang kerja ${activeOrmawa.name}. Coba ubah kata kunci pencarian atau filter status/divisi.`}
          action={
            <Link href="/dashboard/workspace">
              <Button variant="outline" size="sm" className="rounded-none shadow-none">
                Pilih Ruang Kerja Lain
              </Button>
            </Link>
          }
        />
      ) : !isMobile && viewMode === "table" ? (
        <MembersTable
          members={filteredMembers}
          eventRolesByUser={eventRolesByUser}
          onView={setSelectedDetail}
          onEdit={(member) => {
            if (userProfile.role !== "super_admin" && member.role === "super_admin") {
              setError("Koordinator divisi tidak dapat mengedit super admin.");
              return;
            }

            setSelectedEdit(member);
          }}
          onToggleStatus={handleToggleStatus}
        />
      ) : (
        <MemberCardGrid
          members={filteredMembers}
          eventRolesByUser={eventRolesByUser}
          onView={setSelectedDetail}
          onEdit={(member) => {
            if (userProfile.role !== "super_admin" && member.role === "super_admin") {
              setError("Koordinator divisi tidak dapat mengedit super admin.");
              return;
            }

            setSelectedEdit(member);
          }}
          onToggleStatus={handleToggleStatus}
        />
      )}

      <MemberDetailDialog
        member={selectedDetail}
        onClose={() => setSelectedDetail(null)}
        onEdit={(member) => {
          if (userProfile.role !== "super_admin" && member.role === "super_admin") {
            setError("Koordinator divisi tidak dapat mengedit super admin.");
            return;
          }
          setSelectedEdit(member);
        }}
        canEditRole={userProfile.role === "super_admin"}
      />
      <MemberEditDialog
        member={selectedEdit}
        currentUserProfile={userProfile}
        onClose={() => setSelectedEdit(null)}
        onSave={handleSaveMember}
        divisions={divisionsList}
      />
    </div>
  );
}
