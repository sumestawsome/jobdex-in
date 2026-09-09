"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Calendar,
  CheckCircle2,
  Search,
  ArrowRight,
  Sparkles,
  LayoutDashboard,
  Check,
} from "lucide-react";
import { DUMMY_CAMPUSES, DUMMY_ORMAWAS } from "@/lib/workspace-dummy-data";
import type { OrmawaType } from "@/types/workspace";
import { useWorkspace } from "@/hooks/use-workspace";

const TYPE_COLORS: Record<OrmawaType, { badge: string; border: string; bg: string }> = {
  BEM: {
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800",
    border: "hover:border-sky-500/50",
    bg: "from-sky-500/10 to-transparent",
  },
  DPM: {
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    border: "hover:border-purple-500/50",
    bg: "from-purple-500/10 to-transparent",
  },
  HMJ: {
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    border: "hover:border-emerald-500/50",
    bg: "from-emerald-500/10 to-transparent",
  },
  UKM: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    border: "hover:border-amber-500/50",
    bg: "from-amber-500/10 to-transparent",
  },
  LAINNYA: {
    badge: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    border: "hover:border-slate-400/50",
    bg: "from-slate-500/10 to-transparent",
  },
};

export default function WorkspaceSelectionPage() {
  const { activeWorkspace, selectWorkspace } = useWorkspace();
  const [selectedCampusId, setSelectedCampusId] = useState<string>(activeWorkspace.campus_id);
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [switchSuccessMessage, setSwitchSuccessMessage] = useState<string | null>(null);

  const selectedCampus = DUMMY_CAMPUSES.find((c) => c.id === selectedCampusId) || DUMMY_CAMPUSES[0];

  const campusOrmawas = DUMMY_ORMAWAS.filter((o) => o.campus_id === selectedCampusId);

  const filteredOrmawas = campusOrmawas.filter((ormawa) => {
    const matchesType = selectedType === "ALL" || ormawa.type === selectedType;
    const matchesSearch =
      searchQuery.trim() === "" ||
      ormawa.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ormawa.short_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ormawa.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleSelectOrmawa = (campusId: string, orgId: string) => {
    const campus = DUMMY_CAMPUSES.find((c) => c.id === campusId);
    const ormawa = DUMMY_ORMAWAS.find((o) => o.id === orgId);
    if (!campus || !ormawa) return;

    selectWorkspace(campusId, orgId);

    setSwitchSuccessMessage(`Ruang kerja dialihkan ke ${ormawa.short_name} (${campus.code})`);
    setTimeout(() => {
      setSwitchSuccessMessage(null);
    }, 4000);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-linear-to-br from-sky-500/10 via-slate-50 to-indigo-500/10 dark:from-sky-950/40 dark:via-slate-900/60 dark:to-indigo-950/40 p-6 sm:p-8 shadow-xs">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/80 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
              <Sparkles className="size-3.5 text-sky-500" />
              Multi-Tenant Architecture
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Pilih Ruang Kerja Kampus & Organisasi
            </h1>
            <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
              Akses kegiatan, struktur panitia, dan pembagian tugas yang terisolasi aman berdasarkan universitas dan organisasi mahasiswa (BEM, DPM, HMJ, UKM).
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <LayoutDashboard className="size-4 text-sky-500" />
              Ke Dashboard Utama
            </Link>
          </div>
        </div>

        {/* Success toast notification */}
        {switchSuccessMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/50 px-4 py-2.5 text-sm font-medium text-emerald-800 dark:text-emerald-300 animate-in fade-in slide-in-from-top-1">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{switchSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* Active Workspace Status Card */}
      <div className="rounded-2xl border-2 border-sky-500/30 dark:border-sky-500/40 bg-white dark:bg-slate-900 p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 h-32 w-32 bg-radial from-sky-500/20 to-transparent blur-2xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-tr from-sky-500 to-indigo-600 text-white font-black text-xl shadow-md">
              {activeWorkspace.campus_code}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                  Ruang Kerja Aktif Saat Ini
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Aktif
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                {activeWorkspace.org_name}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <Building2 className="size-3.5" />
                {activeWorkspace.campus_name}
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{activeWorkspace.org_type}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/tasks"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white px-5 py-2.5 text-sm font-semibold shadow-sm transition-all"
            >
              Lihat Job Desk Ormawa Ini
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Step 1: Pilih Kampus */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-sky-600 text-white text-xs font-bold">1</span>
              Pilih Kampus / Universitas
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Pilih induk perguruan tinggi untuk menampilkan ormawa yang bernaung di dalamnya.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {DUMMY_CAMPUSES.length} Kampus Tersedia
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DUMMY_CAMPUSES.map((campus) => {
            const isSelected = campus.id === selectedCampusId;
            return (
              <button
                key={campus.id}
                type="button"
                onClick={() => {
                  setSelectedCampusId(campus.id);
                  setSelectedType("ALL");
                }}
                className={`
                  text-left rounded-xl p-4 border transition-all cursor-pointer relative overflow-hidden
                  ${
                    isSelected
                      ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/30 ring-2 ring-sky-500/20 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 text-sm">
                    {campus.code}
                  </div>
                  {isSelected && (
                    <span className="rounded-full bg-sky-600 text-white p-1">
                      <Check className="size-3" />
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">
                    {campus.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                    {campus.city}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>{campus.ormawa_count} Ormawa</span>
                  <span className="text-sky-600 dark:text-sky-400 font-medium">Buka &rarr;</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Pilih Ormawa di Kampus Terpilih */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-sky-600 text-white text-xs font-bold">2</span>
              Pilih Ormawa di {selectedCampus.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Pilih organisasi mahasiswa yang ingin Anda kelola atau pantau.
            </p>
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari ormawa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-44 sm:w-56 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
              {(["ALL", "BEM", "DPM", "HMJ", "UKM"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`
                    px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer
                    ${
                      selectedType === type
                        ? "bg-sky-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }
                  `}
                >
                  {type === "ALL" ? "Semua" : type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ormawa Grid */}
        {filteredOrmawas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-10 text-center">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Tidak ada ormawa yang cocok dengan pencarian &quot;{searchQuery}&quot; atau filter {selectedType}.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedType("ALL");
              }}
              className="mt-3 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrmawas.map((ormawa) => {
              const isCurrent =
                activeWorkspace.campus_id === selectedCampus.id &&
                activeWorkspace.org_id === ormawa.id;
              const colorInfo = TYPE_COLORS[ormawa.type] || TYPE_COLORS.LAINNYA;

              return (
                <div
                  key={ormawa.id}
                  className={`
                    group rounded-xl border bg-white dark:bg-slate-900 p-5 shadow-xs transition-all flex flex-col justify-between
                    ${
                      isCurrent
                        ? "border-sky-500 dark:border-sky-500 ring-2 ring-sky-500/20"
                        : `border-slate-200 dark:border-slate-800 ${colorInfo.border}`
                    }
                  `}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold ${colorInfo.badge}`}>
                        {ormawa.type}
                      </span>
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400">
                          <CheckCircle2 className="size-3.5" />
                          Ruang Aktif
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                      {ormawa.name}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {ormawa.short_name}
                    </p>

                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {ormawa.description}
                    </p>

                    {/* Quick Metrics */}
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5 text-center text-xs">
                      <div>
                        <div className="flex items-center justify-center gap-1 text-slate-400 text-[10px]">
                          <Users className="size-3" />
                          <span>Anggota</span>
                        </div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                          {ormawa.member_count}
                        </span>
                      </div>
                      <div className="border-x border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-center gap-1 text-slate-400 text-[10px]">
                          <Calendar className="size-3" />
                          <span>Acara</span>
                        </div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                          {ormawa.active_event_count}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1 text-slate-400 text-[10px]">
                          <CheckCircle2 className="size-3" />
                          <span>Tugas</span>
                        </div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                          {ormawa.active_task_count}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleSelectOrmawa(selectedCampus.id, ormawa.id)}
                      disabled={isCurrent}
                      className={`
                        w-full rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5
                        ${
                          isCurrent
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default"
                            : "bg-slate-900 hover:bg-sky-600 text-white dark:bg-slate-800 dark:hover:bg-sky-600"
                        }
                      `}
                    >
                      {isCurrent ? (
                        <>
                          <Check className="size-3.5" />
                          Ruang Kerja Terpilih
                        </>
                      ) : (
                        <>
                          Gunakan Ruang Kerja Ini
                          <ArrowRight className="size-3.5" />
                        </>
                      )}
                    </button>
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
