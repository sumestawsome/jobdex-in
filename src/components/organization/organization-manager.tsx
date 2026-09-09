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
    "org-undiksha-bem": DUMMY_DEFAULT_DIVISIONS,
    "org-ui-bem": DUMMY_DEFAULT_DIVISIONS,
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
      text: "Apakah Anda yakin ingin memigrasikan data lama ke hierarki Universitas Pendidikan Ganesha (Undiksha) & BEM Undiksha serta mengisolasi relasi ormawa?",
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
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-linear-to-br from-indigo-500/10 via-sky-500/5 to-slate-50 dark:from-indigo-950/40 dark:via-sky-950/20 dark:to-slate-900/60 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/70 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
              <Sparkles className="size-3.5 text-sky-500" />
              <span>Hierarki Multi-Tenant: Universitas &rarr; Ormawa &rarr; Divisi Pokok</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Kelola Organisasi & Struktur Kampus
            </h1>
            <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
              Atur kampus induk, daftarkan ormawa kemahasiswaan (BEM, DPM, HMJ, UKM), dan tentukan divisi pokok standar sebagai pondasi distribusi tugas dan kepanitiaan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {userProfile?.role === "super_admin" && (
              <button
                type="button"
                onClick={handleRunMigration}
                disabled={isMigrating}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-4 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${isMigrating ? "animate-spin" : ""}`} />
                <span>{isMigrating ? "Memigrasikan..." : "Migrasi Data Lama"}</span>
              </button>
            )}
            <Link
              href="/dashboard/workspace"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Building2 className="size-3.5 text-sky-500" />
              <span>Pilih Ruang Kerja</span>
            </Link>
          </div>
        </div>

        {/* Multi-step Navigation Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200/80 dark:border-slate-800/80 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab("kampus")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "kampus"
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
            }`}
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-white/20 text-[10px]">1</span>
            <span>1. Daftar Kampus ({DUMMY_CAMPUSES.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ormawa")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "ormawa"
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
            }`}
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-white/20 text-[10px]">2</span>
            <span>2. Ormawa di {selectedCampus.code} ({campusOrmawas.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("divisi")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "divisi"
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
            }`}
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-white/20 text-[10px]">3</span>
            <span>3. Divisi Pokok ({DUMMY_DEFAULT_DIVISIONS.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Kampus View */}
      {activeTab === "kampus" && (
        <div className="space-y-4">
          {successMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/50 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <School className="size-5 text-sky-500" />
                <span>Daftar Perguruan Tinggi / Kampus</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Pilih kampus untuk mengelola ormawa dan divisi di bawahnya.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="size-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari kampus..."
                  value={campusSearch}
                  onChange={(e) => setCampusSearch(e.target.value)}
                  className="h-8.5 w-40 sm:w-52 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddCampusOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Tambah Kampus</span>
              </button>

              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
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
                        ? "border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 ring-2 ring-sky-500/20 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                    }
                  `}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-sky-500 to-indigo-600 text-white font-extrabold text-sm shadow-xs">
                        {campus.code}
                      </span>
                      {isActiveWorkspaceCampus && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <Check className="size-3" />
                          Aktif
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 font-bold text-slate-900 dark:text-white text-base leading-snug">
                      {campus.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {campus.city}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {campus.ormawa_count} Ormawa
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCampus(campus.id);
                        setActiveTab("ormawa");
                      }}
                      className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
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
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="size-5 text-sky-500" />
                <span>Ormawa di {selectedCampus.name} ({selectedCampus.code})</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Organisasi kemahasiswaan tingkat universitas, fakultas, atau minat bakat.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="size-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari ormawa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8.5 w-40 sm:w-52 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5">
                {(["ALL", "BEM", "DPM", "HMJ", "UKM"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      selectedType === type
                        ? "bg-sky-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    {type === "ALL" ? "Semua" : type}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsAddOrmawaOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition-colors cursor-pointer"
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
                    p-5 rounded-2xl border bg-white dark:bg-slate-900 transition-all flex flex-col justify-between
                    ${
                      isCurrentWorkspace
                        ? "border-sky-500 dark:border-sky-500 ring-2 ring-sky-500/20 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }
                  `}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        {ormawa.type}
                      </span>
                      {isCurrentWorkspace && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400">
                          <CheckCircle2 className="size-3.5" />
                          Ruang Aktif
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 font-bold text-base text-slate-900 dark:text-white">
                      {ormawa.name}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {ormawa.short_name}
                    </p>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {ormawa.description}
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Anggota</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{ormawa.member_count}</span>
                      </div>
                      <div className="border-x border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] text-slate-400 block">Acara</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{ormawa.active_event_count}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Tugas</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{ormawa.active_task_count}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleActivateWorkspace(selectedCampus.id, ormawa.id)}
                      disabled={isCurrentWorkspace}
                      className={`
                        flex-1 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5
                        ${
                          isCurrentWorkspace
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default"
                            : "bg-slate-900 hover:bg-sky-600 text-white dark:bg-slate-800 dark:hover:bg-sky-600"
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
                      className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      title="Lihat Divisi Pokok"
                    >
                      <Layers className="size-4 text-sky-500" />
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
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="size-5 text-sky-500" />
                <span>Divisi Pokok Standar ({selectedOrmawa.short_name})</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Divisi pokok ini digunakan secara otomatis saat membuat kepanitiaan dan distribusi tugas.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddDivision}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Tambah Divisi Pokok</span>
              </button>

              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                {currentDivisions.length} Divisi Pokok
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentDivisions.map((div, idx) => (
              <div
                key={div.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold text-xs">
                      {idx + 1}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">Standar Pokok</span>
                  </div>
                  <h3 className="mt-3 font-bold text-base text-slate-900 dark:text-white">
                    {div.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {div.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="size-3.5" />
                    Siap Digunakan
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditDivision(div)}
                      className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      title="Ubah Divisi"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDivision(div.id, div.name)}
                      className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 hover:text-red-700 transition-colors"
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
