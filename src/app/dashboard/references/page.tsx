"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { Upload, Plus, Building2, ArrowRight } from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";
import { ReferenceDetailDialog } from "@/components/references/reference-detail-dialog";
import { ReferenceFilters } from "@/components/references/reference-filters";
import { ReferenceFormDialog } from "@/components/references/reference-form-dialog";
import { ReferenceBulkImportDialog } from "@/components/references/reference-bulk-import-dialog";
import { ReferencesGrid } from "@/components/references/references-grid";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { ActiveWorkspaceBanner } from "@/components/workspace/active-workspace-banner";
import {
  archiveDesignReference,
  canCreateDesignReference,
  canEditDesignReference,
  createDesignReference,
  getCombinedReferencesForDashboard,
  updateDesignReference,
} from "@/lib/firebase/design-references";
import { getEventsForProfile } from "@/lib/firebase/events";
import { getMembers } from "@/lib/firebase/members";
import { getDivisions } from "@/lib/firebase/divisions";
import { isKoordinator } from "@/lib/permissions";
import { showConfirm, showSuccess, showError } from "@/lib/swal";
import type {
  DesignReference,
  DesignReferenceInput,
  DesignType,
  UserProfile,
  Event,
  Division,
  ReferenceListItem,
} from "@/types";

const ITEMS_PER_PAGE = 18;

export default function ReferencesPage() {
  const { userProfile } = useAuth();
  const { activeWorkspace, activeCampus, activeOrmawa } = useWorkspace();
  const [references, setReferences] = useState<ReferenceListItem[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedReference, setSelectedReference] = useState<ReferenceListItem | null>(null);
  const [editingReference, setEditingReference] = useState<DesignReference | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [designType, setDesignType] = useState<"all" | DesignType>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "divisi" | "acara">("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<"all" | "manual" | "approved">("all");
  const [selectedDivisionId, setSelectedDivisionId] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState("all");
  const [year, setYear] = useState("");
  const [eventName, setEventName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(ITEMS_PER_PAGE);

  const loadReferences = useCallback(async () => {
    if (!userProfile) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const workspaceFilter = {
        org_id: activeWorkspace.org_id,
        campus_id: activeWorkspace.campus_id,
      };

      const [referencesData, usersData, eventsData, divisionsData] = await Promise.all([
        getCombinedReferencesForDashboard(userProfile, workspaceFilter),
        getMembers(activeWorkspace.org_id, activeWorkspace.campus_id).catch(() => [userProfile]),
        getEventsForProfile(userProfile, workspaceFilter).catch(() => []),
        getDivisions(activeWorkspace.org_id, activeWorkspace.campus_id).catch(() => []),
      ]);

      setReferences(referencesData);
      setUsers(usersData.length ? usersData : [userProfile]);
      setEvents(eventsData);
      setDivisions(divisionsData);
    } catch (err) {
      const errorStatus = (err as { status?: number })?.status;
      if (errorStatus === 500) {
        setError(
          "Arsip referensi gagal dimuat dari server.\nSilakan coba muat ulang. Jika masih terjadi, cek log API /api/references."
        );
      } else {
        setError("Gagal memuat arsip referensi. Periksa koneksi dan Firestore Rules.");
      }
    } finally {
      setLoading(false);
    }
  }, [userProfile, activeWorkspace.org_id, activeWorkspace.campus_id]);

  useEffect(() => {
    void Promise.resolve().then(loadReferences);
  }, [loadReferences]);

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );
  const canCreate = canCreateDesignReference(userProfile);
  const canShowArchived = isKoordinator(userProfile);

  const eventNames = useMemo(() => {
    const list = references.map((item) => item.event_name).filter((val): val is string => !!val);
    events.forEach(e => {
      if (e.name) list.push(e.name);
    });
    return [...new Set(list)].sort((a, b) => a.localeCompare(b));
  }, [references, events]);

  const years = useMemo(
    () =>
      [...new Set(references.map((item) => {
        if (!item.year) return 0;
        return typeof item.year === "number" ? item.year : parseInt(String(item.year)) || 0;
      }).filter(Boolean))]
        .sort((a, b) => b - a),
    [references],
  );

  const filteredReferences = useMemo(() => {
    const query = search.trim().toLowerCase();

    return references.filter((reference) => {
      const haystack = [
        reference.title,
        reference.event_name,
        reference.notes,
        reference.category_label,
        reference.subcategory_label,
        reference.source_link,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      const matchesDesignType =
        designType === "all" || reference.visual_type === designType;
      const matchesYear = !year || String(reference.year) === year;
      const matchesEvent = !eventName || reference.event_name === eventName;
      const matchesArchive = showArchived ? true : reference.status !== "archived";
      const matchesScope =
        scopeFilter === "all" ||
        (scopeFilter === "divisi" && (!reference.scope || reference.scope === "divisi")) ||
        (scopeFilter === "acara" && reference.scope === "acara");

      const matchesSource =
        sourceTypeFilter === "all" ||
        (sourceTypeFilter === "manual" && reference.source_type === "manual_reference") ||
        (sourceTypeFilter === "approved" && reference.source_type === "approved_task");

      const matchesSpecificDivision =
        scopeFilter !== "divisi" ||
        selectedDivisionId === "all" ||
        reference.division_id === selectedDivisionId ||
        (selectedDivisionId === "humas_media_kreatif" && !reference.division_id);

      const matchesSpecificEvent =
        scopeFilter !== "acara" ||
        selectedEventId === "all" ||
        reference.event_id === selectedEventId;

      return (
        matchesSearch &&
        matchesDesignType &&
        matchesYear &&
        matchesEvent &&
        matchesArchive &&
        matchesScope &&
        matchesSource &&
        matchesSpecificDivision &&
        matchesSpecificEvent
      );
    });
  }, [
    designType,
    eventName,
    references,
    search,
    showArchived,
    year,
    scopeFilter,
    sourceTypeFilter,
    selectedDivisionId,
    selectedEventId,
  ]);

  // Reset pagination limit when any filter changes
  useEffect(() => {
    setVisibleLimit(ITEMS_PER_PAGE);
  }, [
    designType,
    eventName,
    search,
    showArchived,
    year,
    scopeFilter,
    sourceTypeFilter,
    selectedDivisionId,
    selectedEventId,
  ]);

  const displayedReferences = useMemo(() => {
    return filteredReferences.slice(0, visibleLimit);
  }, [filteredReferences, visibleLimit]);

  async function handleSave(input: DesignReferenceInput, referenceId?: string) {
    if (!userProfile) {
      return;
    }

    if (!referenceId && !activeWorkspace.org_id) {
      await showError("Pilih ruang kerja aktif terlebih dahulu sebelum menambahkan referensi.");
      return;
    }

    try {
      if (referenceId) {
        await updateDesignReference(referenceId, input, {
          org_id: activeWorkspace.org_id,
          campus_id: activeWorkspace.campus_id,
        });
        await showSuccess("Referensi berhasil diperbarui.", "Sukses");
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
        await createDesignReference(inputWithTenant, userProfile.id);
        await showSuccess("Referensi baru berhasil ditambahkan.", "Sukses");
      }
      await loadReferences();
    } catch {
      await showError("Gagal menyimpan referensi ke database.", "Error");
    }
  }

  async function handleArchive(reference: DesignReference) {
    const confirmed = await showConfirm({
      title: "Archive Referensi?",
      text: `Apakah Anda yakin ingin mengarsipkan referensi "${reference.title}"?`,
      confirmButtonText: "Ya, Arsipkan",
      cancelButtonText: "Batal",
      icon: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await archiveDesignReference(reference.id, {
        org_id: activeWorkspace.org_id,
        campus_id: activeWorkspace.campus_id,
      });
      await showSuccess(`Referensi "${reference.title}" berhasil diarsipkan.`, "Sukses");
      await loadReferences();
    } catch {
      await showError("Gagal mengarsipkan referensi.", "Error");
    }
  }

  function openCreateForm() {
    setEditingReference(null);
    setFormOpen(true);
  }

  function openEditForm(reference: DesignReference) {
    setEditingReference(reference);
    setFormOpen(true);
  }

  if (loading) {
    return <LoadingState title="Memuat arsip referensi desain..." />;
  }

  if (error) {
    return (
      <EmptyState
        title="Arsip referensi gagal dimuat"
        description={error}
        action={
          <Button onClick={() => void loadReferences()} className="jd-neo-button rounded-none shadow-none">
            Muat ulang
          </Button>
        }
      />
    );
  }

  if (!userProfile) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* ── Active Workspace Isolation Banner ────────────────────────────────── */}
      <ActiveWorkspaceBanner description={`${activeCampus.name} • Menampilkan referensi desain terfilter untuk ruang kerja ini`} />

      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Arsip Referensi Desain
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Catat desain lama, link Drive/Canva ganda, style visual, supergrafis, dan color
            palette agar anggota baru punya sumber inspirasi yang rapi.
          </p>
          <p className="mt-3 text-sm font-semibold text-muted-foreground font-mono">
            Menampilkan {displayedReferences.length} dari {filteredReferences.length} referensi {filteredReferences.length !== references.length ? `(total ${references.length} dalam arsip)` : ""}
          </p>
        </div>
        {canCreate ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setBulkImportOpen(true)} className="rounded-none shadow-none">
              <Upload className="h-4 w-4" />
              Import Banyak
            </Button>
            <Button type="button" size="sm" onClick={openCreateForm} className="rounded-none shadow-none">
              <Plus className="h-4 w-4" />
              Tambah Referensi
            </Button>
          </div>
        ) : null}
      </section>

      <ReferenceFilters
        search={search}
        designType={designType}
        scopeFilter={scopeFilter}
        sourceTypeFilter={sourceTypeFilter}
        selectedDivisionId={selectedDivisionId}
        selectedEventId={selectedEventId}
        year={year}
        eventName={eventName}
        eventNames={eventNames}
        years={years}
        divisions={divisions}
        events={events}
        showArchived={showArchived}
        canShowArchived={canShowArchived}
        onSearchChange={setSearch}
        onDesignTypeChange={setDesignType}
        onScopeFilterChange={setScopeFilter}
        onSourceTypeChange={setSourceTypeFilter}
        onDivisionChange={setSelectedDivisionId}
        onEventChange={setSelectedEventId}
        onYearChange={setYear}
        onEventNameChange={setEventName}
        onShowArchivedChange={setShowArchived}
      />

      {filteredReferences.length ? (
        <div className="space-y-6">
          <ReferencesGrid
            references={displayedReferences}
            canEditReference={(reference) => reference.source_type !== "approved_task" && canEditDesignReference(userProfile, reference as unknown as DesignReference)}
            onView={setSelectedReference}
            onEdit={(reference) => openEditForm(reference as unknown as DesignReference)}
            onArchive={(reference) => handleArchive(reference as unknown as DesignReference)}
          />

          {filteredReferences.length > visibleLimit ? (
            <div className="flex flex-col items-center justify-center gap-2.5 pt-4 pb-2">
              <p className="text-xs text-muted-foreground font-mono">
                Menampilkan {displayedReferences.length} dari {filteredReferences.length} referensi
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setVisibleLimit((prev) => prev + ITEMS_PER_PAGE)}
                className="rounded-none shadow-none border-border px-8 py-2 font-semibold text-sm hover:bg-muted"
              >
                Muat Lebih Banyak ({Math.min(ITEMS_PER_PAGE, filteredReferences.length - visibleLimit)} lagi)
              </Button>
            </div>
          ) : filteredReferences.length > ITEMS_PER_PAGE ? (
            <div className="text-center pt-4 pb-2">
              <p className="text-xs text-muted-foreground font-mono">
                Semua {filteredReferences.length} referensi telah ditampilkan.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title={`Belum ada referensi di ${activeOrmawa.short_name}`}
          description={`Ruang kerja ${activeOrmawa.name} (${activeCampus.code}) belum memiliki referensi desain yang cocok. Coba sesuaikan filter atau tambahkan referensi baru.`}
          action={
            <div className="flex flex-wrap gap-2 justify-center">
              {canCreate ? (
                <>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setBulkImportOpen(true)} className="rounded-none shadow-none">
                    <Upload className="h-4 w-4" />
                    Import Banyak
                  </Button>
                  <Button type="button" size="sm" onClick={openCreateForm} className="rounded-none shadow-none">
                    <Plus className="h-4 w-4" />
                    Tambah Referensi di {activeOrmawa.short_name}
                  </Button>
                </>
              ) : null}
              <Link href="/dashboard/workspace">
                <Button variant="outline" size="sm" className="rounded-none shadow-none">
                  Ganti Ruang Kerja
                </Button>
              </Link>
            </div>
          }
        />
      )}

      <ReferenceFormDialog
        open={formOpen}
        reference={editingReference}
        events={events}
        divisions={divisions}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />
      <ReferenceBulkImportDialog
        open={bulkImportOpen}
        events={events}
        existingReferences={references as unknown as DesignReference[]}
        currentUser={userProfile}
        onClose={() => setBulkImportOpen(false)}
        onSuccess={loadReferences}
      />
      <ReferenceDetailDialog
        reference={selectedReference}
        usersById={usersById}
        onClose={() => setSelectedReference(null)}
      />
    </div>
  );
}
