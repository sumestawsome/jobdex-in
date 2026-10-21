"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  School,
  Users,
  Calendar,
  CheckCircle2,
  Search,
  Plus,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck,
  Check,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { showConfirm, showSuccess, showError } from "@/lib/swal";
import {
  DUMMY_CAMPUSES,
  DUMMY_ORMAWAS,
  DUMMY_WORKSPACE_EVENTS,
  DUMMY_WORKSPACE_TASKS,
} from "@/lib/workspace-dummy-data";
import { useWorkspace } from "@/hooks/use-workspace";
import { AddCampusDialog } from "@/components/organization/add-campus-dialog";
import { AddOrmawaDialog } from "@/components/organization/add-ormawa-dialog";
import { DivisionDialog, type DivisionItem } from "@/components/organization/division-dialog";
import type { Campus, Ormawa, OrmawaType } from "@/types/workspace";

const DUMMY_DEFAULT_DIVISIONS: DivisionItem[] = [
  { id: "div-1", name: "Humas & Media Kreatif", description: "Pengelolaan publikasi visual, media sosial, dan dokumentasi." },
  { id: "div-2", name: "Acara & Kepanitiaan", description: "Penyusunan konsep kegiatan, susunan acara, dan teknis lapangan." },
  { id: "div-3", name: "Logistik & Perlengkapan", description: "Pengadaan sarana prasarana, perlengkapan, dan tempat." },
  { id: "div-4", name: "Kemitraan & Dana Usaha", description: "Eksplorasi sponsorship, donatur, dan pendanaan mandiri." },
  { id: "div-5", name: "Kastrat & Advokasi", description: "Kajian strategis kebijakan kampus dan advokasi mahasiswa." },
];

export function OrganizationManager() {
  const { user, userProfile } = useAuth();
  const { activeWorkspace, selectWorkspace } = useWorkspace();
  const [isMigrating, setIsMigrating] = useState(false);
  const [campuses, setCampuses] = useState<Campus[]>(DUMMY_CAMPUSES);
  const [ormawas, setOrmawas] = useState<Ormawa[]>(DUMMY_ORMAWAS);
  const [divisionsMap, setDivisionsMap] = useState<Record<string, DivisionItem[]>>({
    [activeWorkspace.org_id]: DUMMY_DEFAULT_DIVISIONS,
    "org-undiksha-forkom-kip": DUMMY_DEFAULT_DIVISIONS,
    "org-undiksha-bem": DUMMY_DEFAULT_DIVISIONS,
    "main_org": DUMMY_DEFAULT_DIVISIONS,
  });
  const [editingDivision, setEditingDivision] = useState<DivisionItem | null>(null);
  const [isDivisionDialogOpen, setIsDivisionDialogOpen] = useState(false);
  const [selectedCampusId, setSelectedCampusId] = useState<string>(activeWorkspace.campus_id);
  const [selectedOrmawaId, setSelectedOrmawaId] = useState<string>(activeWorkspace.org_id);
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [campusSearch, setCampusSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"kampus" | "ormawa" | "divisi">("kampus");
  const [isAddCampusOpen, setIsAddCampusOpen] = useState(false);
  const [isAddOrmawaOpen, setIsAddOrmawaOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedCampus = campuses.find((c) => c.id === selectedCampusId) || campuses[0] || DUMMY_CAMPUSES[0];
  const campusOrmawas = ormawas.filter((o) => o.campus_id === selectedCampusId);
  const selectedOrmawa =
    ormawas.find((o) => o.id === selectedOrmawaId && o.campus_id === selectedCampusId) ||
    campusOrmawas[0] ||
    ormawas[0];

  const filteredCampuses = campuses.filter((c) => {
    if (!campusSearch.trim()) return true;
    const q = campusSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.city.toLowerCase().includes(q);
  });

  const handleAddCampus = (newCampus: Campus) => {
    setCampuses((prev) => [newCampus, ...prev]);
    setSelectedCampusId(newCampus.id);
    setSuccessMessage(`Kampus ${newCampus.name} (${newCampus.code}) berhasil ditambahkan dan siap digunakan!`);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleAddOrmawa = (newOrmawa: Ormawa) => {
    setOrmawas((prev) => [newOrmawa, ...prev]);
    // update campus ormawa_count
    setCampuses((prev) =>
      prev.map((c) =>
        c.id === newOrmawa.campus_id
          ? { ...c, ormawa_count: (c.ormawa_count ?? 0) + 1 }
          : c
      )
    );
    setSelectedCampusId(newOrmawa.campus_id);
    setSelectedOrmawaId(newOrmawa.id);
    setSuccessMessage(
      `Ormawa "${newOrmawa.name}" (${newOrmawa.short_name}) berhasil didaftarkan di ${selectedCampus.code}!`
    );
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const filteredOrmawas = campusOrmawas.filter((o) => {
    const matchesType = selectedType === "ALL" || o.type === selectedType;
    const matchesSearch =
      searchQuery.trim() === "" ||
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.short_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const currentDivisions = divisionsMap[selectedOrmawa.id] || DUMMY_DEFAULT_DIVISIONS;

  const handleOpenAddDivision = () => {
    setEditingDivision(null);
    setIsDivisionDialogOpen(true);
  };

  const handleOpenEditDivision = (div: DivisionItem) => {
    setEditingDivision(div);
    setIsDivisionDialogOpen(true);
  };

  const handleSaveDivision = (div: DivisionItem) => {
    setDivisionsMap((prev) => {
      const existing = prev[selectedOrmawa.id] || DUMMY_DEFAULT_DIVISIONS;
      const isExisting = existing.some((d) => d.id === div.id);
      const updated = isExisting
        ? existing.map((d) => (d.id === div.id ? div : d))
        : [...existing, div];
      return { ...prev, [selectedOrmawa.id]: updated };
    });
    setSuccessMessage(`Divisi "${div.name}" berhasil disimpan untuk ${selectedOrmawa.short_name}!`);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleDeleteDivision = (divId: string, divName: string) => {
    setDivisionsMap((prev) => {
      const existing = prev[selectedOrmawa.id] || DUMMY_DEFAULT_DIVISIONS;
      return { ...prev, [selectedOrmawa.id]: existing.filter((d) => d.id !== divId) };
    });
    setSuccessMessage(`Divisi "${divName}" berhasil dihapus.`);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleSelectCampus = (campusId: string) => {
    setSelectedCampusId(campusId);
    const firstOrmawa = ormawas.find((o) => o.campus_id === campusId);
    if (firstOrmawa) {
      setSelectedOrmawaId(firstOrmawa.id);
    }
  };

  const handleActivateWorkspace = (campusId: string, orgId: string) => {
    selectWorkspace(campusId, orgId);
  };

  const handleRunMigration = async () => {
    if (!user || userProfile?.role !== "super_admin") return;

    const confirmed = await showConfirm({
      title: "Migrasi Data Organisasi",
      text: "Apakah Anda yakin ingin memigrasikan data lama ke hierarki Universitas Pendidikan Ganesha (Undiksha) & Forkom KIP Undiksha serta mengisolasi relasi ormawa?",
      confirmButtonText: "Ya, Jalankan Migrasi",
      cancelButtonText: "Batal",
    });

    if (!confirmed) return;

    setIsMigrating(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/migrate-organization", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal memproses migrasi.");
      }
      void showSuccess(data.message || "Migrasi data berhasil dijalankan!");
    } catch (err) {
      void showError(err instanceof Error ? err.message : "Terjadi kesalahan saat migrasi.");
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-[#e1e2e3] bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#e1e2e3] bg-[#f7f7f8] px-2.5 py-0.5 text-xs font-medium text-[#242424]">
              <Sparkles className="size-3.5 text-[#242424]" />
              <span>Hierarki Multi-Tenant: Universitas &rarr; Ormawa &rarr; Divisi Pokok</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#242424]">
              Kelola Organisasi & Struktur Kampus
            </h1>
            <p className="mt-1 text-sm text-[#898989] max-w-2xl">
              Atur kampus induk, daftarkan ormawa kemahasiswaan (BEM, DPM, HMJ, UKM), dan tentukan divisi pokok standar sebagai pondasi distribusi tugas dan kepanitiaan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {userProfile?.role === "super_admin" && (
              <button
                type="button"
                onClick={handleRunMigration}
                disabled={isMigrating}
                className="inline-flex items-center gap-2 rounded-xl border border-[#e1e2e3] bg-[#f7f7f8] px-3.5 py-2 text-xs font-medium text-[#242424] hover:bg-[#ececed] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${isMigrating ? "animate-spin" : ""}`} />
                <span>{isMigrating ? "Memigrasikan..." : "Migrasi Data Lama"}</span>
              </button>
            )}
            <Link
              href="/dashboard/workspace"
              className="inline-flex items-center gap-2 rounded-xl border border-[#e1e2e3] bg-white px-3.5 py-2 text-xs font-medium text-[#242424] hover:bg-[#f7f7f8] transition-colors"
            >
              <Building2 className="size-3.5 text-[#242424]" />
              <span>Pilih Ruang Kerja</span>
            </Link>
          </div>
        </div>

        {/* Multi-step Navigation Tabs (Cal.com Segmented Pill style) */}
        <div className="mt-6 flex flex-wrap gap-1 rounded-xl border border-[#e1e2e3] bg-[#f7f7f8] p-1 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("kampus")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              activeTab === "kampus"
                ? "bg-white text-[#242424] shadow-2xs font-semibold"
                : "text-[#898989] hover:text-[#242424]"
            }`}
          >
            <span className={`flex size-4.5 items-center justify-center rounded-full text-[10px] ${activeTab === "kampus" ? "bg-[#242424] text-white" : "bg-[#e1e2e3] text-[#242424]"}`}>1</span>
            <span>1. Daftar Kampus ({DUMMY_CAMPUSES.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ormawa")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              activeTab === "ormawa"
                ? "bg-white text-[#242424] shadow-2xs font-semibold"
                : "text-[#898989] hover:text-[#242424]"
            }`}
          >
            <span className={`flex size-4.5 items-center justify-center rounded-full text-[10px] ${activeTab === "ormawa" ? "bg-[#242424] text-white" : "bg-[#e1e2e3] text-[#242424]"}`}>2</span>
            <span>2. Ormawa di {selectedCampus.code} ({campusOrmawas.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("divisi")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              activeTab === "divisi"
                ? "bg-white text-[#242424] shadow-2xs font-semibold"
                : "text-[#898989] hover:text-[#242424]"
            }`}
          >
            <span className={`flex size-4.5 items-center justify-center rounded-full text-[10px] ${activeTab === "divisi" ? "bg-[#242424] text-white" : "bg-[#e1e2e3] text-[#242424]"}`}>3</span>
            <span>3. Divisi Pokok ({DUMMY_DEFAULT_DIVISIONS.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Kampus View */}
      {activeTab === "kampus" && (
        <div className="space-y-4">
          {successMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-[#d1f2d9] bg-[#eefcf2] p-3 text-xs font-medium text-[#1e7e34] animate-in fade-in">
              <CheckCircle2 className="size-4 text-[#1e7e34] shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#242424] flex items-center gap-2">
                <School className="size-5 text-[#242424]" />
                <span>Daftar Perguruan Tinggi / Kampus</span>
              </h2>
              <p className="text-xs sm:text-sm text-[#898989]">
                Pilih kampus untuk mengelola ormawa dan divisi di bawahnya.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="size-3.5 text-[#898989] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari kampus..."
                  value={campusSearch}
                  onChange={(e) => setCampusSearch(e.target.value)}
                  className="h-8.5 w-40 sm:w-52 rounded-xl border border-[#e1e2e3] bg-white pl-8 pr-3 text-xs text-[#242424] placeholder:text-[#898989] focus:outline-hidden focus:border-[#242424] focus:ring-1 focus:ring-[#242424]"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddCampusOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#242424] hover:bg-[#141414] text-white px-3.5 py-1.5 text-xs font-medium shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Tambah Kampus</span>
              </button>

              <span className="text-xs font-medium px-2.5 py-1 rounded-xl bg-[#f7f7f8] text-[#242424] border border-[#e1e2e3]">
                {campuses.length} Kampus Terdaftar
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredCampuses.map((campus) => {
              const isSelected = campus.id === selectedCampusId;
              const isActiveWorkspaceCampus = campus.id === activeWorkspace.campus_id;
              return (
                <div
                  key={campus.id}
                  onClick={() => handleSelectCampus(campus.id)}
                  className={`
                    p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between
                    ${
                      isSelected
                        ? "border-[#242424] bg-white ring-2 ring-[#242424]/10 shadow-xs"
                        : "border-[#e1e2e3] bg-white hover:border-[#242424]/40"
                    }
                  `}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-[#242424] text-white font-bold text-xs shadow-2xs">
                        {campus.code}
                      </span>
                      {isActiveWorkspaceCampus && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#eefcf2] px-2.5 py-0.5 text-[10px] font-medium text-[#1e7e34] border border-[#d1f2d9]">
                          <Check className="size-3" />
                          Aktif
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 font-semibold text-[#242424] text-sm leading-snug">
                      {campus.name}
                    </h3>
                    <p className="mt-1 text-xs text-[#898989]">
                      {campus.city}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#e1e2e3] flex items-center justify-between text-xs">
                    <span className="font-medium text-[#898989]">
                      {campus.ormawa_count} Ormawa
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCampus(campus.id);
                        setActiveTab("ormawa");
                      }}
                      className="inline-flex items-center gap-1 font-medium text-[#242424] hover:underline cursor-pointer"
                    >
                      <span>Lihat Ormawa</span>
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Ormawa View */}
      {activeTab === "ormawa" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#242424] flex items-center gap-2">
                <Building2 className="size-5 text-[#242424]" />
                <span>Ormawa di {selectedCampus.name} ({selectedCampus.code})</span>
              </h2>
              <p className="text-xs sm:text-sm text-[#898989]">
                Organisasi kemahasiswaan tingkat universitas, fakultas, atau minat bakat.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="size-3.5 text-[#898989] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari ormawa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8.5 w-40 sm:w-52 rounded-xl border border-[#e1e2e3] bg-white pl-8 pr-3 text-xs text-[#242424] placeholder:text-[#898989] focus:outline-hidden focus:border-[#242424] focus:ring-1 focus:ring-[#242424]"
                />
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-[#e1e2e3] bg-[#f7f7f8] p-0.5">
                {(["ALL", "BEM", "DPM", "HMJ", "UKM"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      selectedType === type
                        ? "bg-white text-[#242424] shadow-2xs font-semibold"
                        : "text-[#898989] hover:text-[#242424]"
                    }`}
                  >
                    {type === "ALL" ? "Semua" : type}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsAddOrmawaOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#242424] hover:bg-[#141414] text-white px-3.5 py-1.5 text-xs font-medium shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Tambah Ormawa</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrmawas.map((ormawa) => {
              const isCurrentWorkspace =
                activeWorkspace.campus_id === selectedCampus.id &&
                activeWorkspace.org_id === ormawa.id;
              return (
                <div
                  key={ormawa.id}
                  className={`
                    p-5 rounded-2xl border bg-white transition-all flex flex-col justify-between
                    ${
                      isCurrentWorkspace
                        ? "border-[#242424] ring-2 ring-[#242424]/10 shadow-xs"
                        : "border-[#e1e2e3] hover:border-[#242424]/40"
                    }
                  `}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center rounded-lg border border-[#e1e2e3] bg-[#f7f7f8] px-2 py-0.5 text-xs font-medium text-[#242424]">
                        {ormawa.type}
                      </span>
                      {isCurrentWorkspace && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#1e7e34] bg-[#eefcf2] border border-[#d1f2d9] px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="size-3.5" />
                          Ruang Aktif
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 font-semibold text-base text-[#242424]">
                      {ormawa.name}
                    </h3>
                    <p className="text-xs font-medium text-[#898989]">
                      {ormawa.short_name}
                    </p>
                    <p className="mt-2 text-xs text-[#898989] line-clamp-2 leading-relaxed">
                      {ormawa.description}
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#f7f7f8] border border-[#e1e2e3]/60 p-2.5 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-[#898989] block">Anggota</span>
                        <span className="font-semibold text-[#242424]">{ormawa.member_count}</span>
                      </div>
                      <div className="border-x border-[#e1e2e3]">
                        <span className="text-[10px] text-[#898989] block">Acara</span>
                        <span className="font-semibold text-[#242424]">{ormawa.active_event_count}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#898989] block">Tugas</span>
                        <span className="font-semibold text-[#242424]">{ormawa.active_task_count}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#e1e2e3] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleActivateWorkspace(selectedCampus.id, ormawa.id)}
                      disabled={isCurrentWorkspace}
                      className={`
                        flex-1 rounded-xl py-2 text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5
                        ${
                          isCurrentWorkspace
                            ? "bg-[#f7f7f8] text-[#898989] border border-[#e1e2e3] cursor-default"
                            : "bg-[#242424] hover:bg-[#141414] text-white shadow-xs"
                        }
                      `}
                    >
                      {isCurrentWorkspace ? "Ruang Kerja Terpilih" : "Gunakan Ruang Ini"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrmawaId(ormawa.id);
                        setActiveTab("divisi");
                      }}
                      className="rounded-xl border border-[#e1e2e3] p-2 text-xs font-medium text-[#242424] hover:bg-[#f7f7f8] transition-colors"
                      title="Lihat Divisi Pokok"
                    >
                      <Layers className="size-4 text-[#242424]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Divisi Pokok View */}
      {activeTab === "divisi" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#242424] flex items-center gap-2">
                <Layers className="size-5 text-[#242424]" />
                <span>Divisi Pokok Standar ({selectedOrmawa.short_name})</span>
              </h2>
              <p className="text-xs sm:text-sm text-[#898989]">
                Divisi pokok ini digunakan secara otomatis saat membuat kepanitiaan dan distribusi tugas.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddDivision}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#242424] hover:bg-[#141414] text-white px-3.5 py-1.5 text-xs font-medium shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Tambah Divisi Pokok</span>
              </button>

              <span className="text-xs font-medium px-2.5 py-1 rounded-xl bg-[#f7f7f8] text-[#242424] border border-[#e1e2e3]">
                {currentDivisions.length} Divisi Pokok
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentDivisions.map((div, idx) => (
              <div
                key={div.id}
                className="p-5 rounded-2xl border border-[#e1e2e3] bg-white shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-[#f7f7f8] text-[#242424] border border-[#e1e2e3] font-bold text-xs">
                      {idx + 1}
                    </span>
                    <span className="text-[11px] font-medium text-[#898989]">Standar Pokok</span>
                  </div>
                  <h3 className="mt-3 font-semibold text-base text-[#242424]">
                    {div.name}
                  </h3>
                  <p className="mt-1 text-xs text-[#898989] leading-relaxed">
                    {div.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#e1e2e3] flex items-center justify-between text-xs text-[#898989]">
                  <span className="inline-flex items-center gap-1 text-[#1e7e34] font-medium">
                    <ShieldCheck className="size-3.5" />
                    Siap Digunakan
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditDivision(div)}
                      className="p-1.5 rounded-lg hover:bg-[#f7f7f8] text-[#242424] transition-colors"
                      title="Ubah Divisi"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDivision(div.id, div.name)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                      title="Hapus Divisi"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Campus Modal Dialog */}
      <AddCampusDialog
        open={isAddCampusOpen}
        onClose={() => setIsAddCampusOpen(false)}
        onSave={handleAddCampus}
        existingCampuses={campuses}
      />

      {/* Add Ormawa Modal Dialog */}
      <AddOrmawaDialog
        open={isAddOrmawaOpen}
        onClose={() => setIsAddOrmawaOpen(false)}
        onSave={handleAddOrmawa}
        campuses={campuses}
        defaultCampusId={selectedCampusId}
        existingOrmawas={ormawas}
      />

      {/* Division CRUD Modal Dialog */}
      <DivisionDialog
        open={isDivisionDialogOpen}
        division={editingDivision}
        onClose={() => setIsDivisionDialogOpen(false)}
        onSave={handleSaveDivision}
        existingDivisions={currentDivisions}
        ormawaName={selectedOrmawa.name}
      />
    </div>
  );
}
