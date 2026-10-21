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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
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
  const [selectedDetail, setSelectedDetail] = useState<UserProfile | null>(null);
  const [selectedEdit, setSelectedEdit] = useState<UserProfile | null>(null);

  const [divisionsList, setDivisionsList] = useState<Division[]>([]);

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
    const query = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch =
         !query ||
        member.name?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query);
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
  }, [activeWorkspace.org_id, activeWorkspace.campus_id, divisionFilter, members, roleFilter, search, statusFilter]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[#e1e2e3] bg-white shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#242424] text-white font-bold text-xs shrink-0 shadow-xs">
            {activeWorkspace.campus_code}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#242424] truncate">
                {activeOrmawa.name}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f7f0] border border-[#a3e6cd] px-2 py-0.5 text-[10px] font-semibold text-[#19a874]">
                <span className="size-1.5 rounded-full bg-[#19a874] animate-pulse" />
                Aktif
              </span>
            </div>
            <p className="text-xs text-[#898989] truncate mt-0.5">
              {activeCampus.name} • Menampilkan anggota terfilter untuk ruang kerja ini
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/workspace"
          className="text-xs font-semibold text-[#242424] hover:underline inline-flex items-center gap-1 shrink-0"
        >
          <span>Ganti Ruang Kerja</span>
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {/* ── Header Section ──────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#e1e2e3]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#242424]">
            Anggota & Tim Organisasi
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#898989]">
            Kelola profil tim, penetapan peran (role), pembagian divisi, dan hak akses ruang kerja.
          </p>
        </div>
        <div className="rounded-lg border border-[#e1e2e3] bg-white px-4 py-2 text-right shadow-2xs">
          <span className="text-[10px] font-semibold text-[#898989] uppercase tracking-wider block">Total Anggota</span>
          <span className="text-lg font-bold text-[#242424]">
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

      {error ? (
        <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <LoadingState title="Memuat daftar anggota..." />
      ) : members.length === 0 ? (
        <EmptyState
          title={`Belum ada anggota di ${activeOrmawa.short_name}`}
          description={`Ruang kerja ${activeOrmawa.name} (${activeCampus.code}) belum memiliki anggota terdaftar.`}
          action={
            <Link href="/dashboard/workspace">
              <Button variant="outline" size="sm">
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
              <Button variant="outline" size="sm">
                Pilih Ruang Kerja Lain
              </Button>
            </Link>
          }
        />
      ) : (
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
