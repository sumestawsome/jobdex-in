"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  CheckCircle2,
  Search,
  ArrowRight,
  Settings,
  ShieldCheck,
  Check,
  CalendarCheck2,
  FolderKanban,
} from "lucide-react";
import { DUMMY_CAMPUSES } from "@/lib/workspace-dummy-data";
import type { OrmawaType } from "@/types/workspace";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/hooks/use-auth";
import { isClassWorkspacePermitted, isClassAdmin } from "@/lib/permissions";

export interface UserWorkspaceItem {
  id: string;
  campusId: string;
  name: string;
  campusName: string;
  campusCode: string;
  initials: string;
  type: OrmawaType;
  role: string;
  activeTasks: number;
  totalMembers: number;
}

const INITIAL_USER_WORKSPACES: UserWorkspaceItem[] = [
  {
    id: "main_org",
    campusId: "univ-undiksha",
    name: "Forkom KIP-Kuliah Undiksha",
    campusName: "Universitas Pendidikan Ganesha",
    campusCode: "UNDIKSHA",
    initials: "FK",
    type: "UKM",
    role: "Super Admin",
    activeTasks: 4,
    totalMembers: 48,
  },
  {
    id: "ws_ilkom_2024",
    campusId: "univ-undiksha",
    name: "Ilmu Komputer Undiksha 2024",
    campusName: "Universitas Pendidikan Ganesha",
    campusCode: "UNDIKSHA",
    initials: "IK",
    type: "KELAS",
    role: "Admin Komunitas",
    activeTasks: 1,
    totalMembers: 35,
  },
];

export default function WorkspaceManagementPage() {
  const { userProfile } = useAuth();
  const { activeWorkspace, setActiveWorkspace, selectWorkspace, campuses } = useWorkspace();

  const [workspaceList] = useState<UserWorkspaceItem[]>(INITIAL_USER_WORKSPACES);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "MEMBER">("ALL");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const allCampuses = campuses.length > 0 ? campuses : DUMMY_CAMPUSES;

  const permittedWorkspaces = useMemo(() => {
    return workspaceList
      .filter((w) => isClassWorkspacePermitted(userProfile, w))
      .map((w) => {
        if (w.type === "KELAS") {
          const roleLabel = isClassAdmin(userProfile, w) ? "Admin Komunitas" : "Anggota Kelas";
          return { ...w, role: roleLabel };
        }
        return w;
      });
  }, [workspaceList, userProfile]);

  // Active workspace detail card
  const currentWorkspaceItem = useMemo(() => {
    const found = permittedWorkspaces.find(
      (w) => w.id === activeWorkspace.org_id || w.name.toLowerCase() === activeWorkspace.org_name.toLowerCase()
    );
    if (found) return found;

    // Fallback if matched from global state
    return {
      id: activeWorkspace.org_id || "main_org",
      campusId: activeWorkspace.campus_id || "univ-undiksha",
      name: activeWorkspace.org_name || "Forkom KIP-Kuliah Undiksha",
      campusName: activeWorkspace.campus_name || "Universitas Pendidikan Ganesha",
      campusCode: activeWorkspace.campus_code || "UNDIKSHA",
      initials: (activeWorkspace.org_name || "FK")
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || "FK",
      type: (activeWorkspace.org_type as OrmawaType) || "UKM",
      role: "Super Admin",
      activeTasks: 4,
      totalMembers: 48,
    };
  }, [permittedWorkspaces, activeWorkspace]);

  // Filtered list of workspaces
  const filteredWorkspaces = useMemo(() => {
    return permittedWorkspaces.filter((item) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.campusName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.role.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole =
        roleFilter === "ALL" ||
        (roleFilter === "ADMIN" && (item.role.includes("Admin") || item.role.includes("Koordinator"))) ||
        (roleFilter === "MEMBER" && item.role.includes("Anggota"));

      return matchesSearch && matchesRole;
    });
  }, [permittedWorkspaces, searchQuery, roleFilter]);

  // Handler switch workspace
  const handleSwitchWorkspace = (workspace: UserWorkspaceItem) => {
    if (!isClassWorkspacePermitted(userProfile, workspace)) {
      setToastMessage("Anda tidak memiliki izin untuk mengakses ruang kerja kelas ini.");
      return;
    }

    const matchedCampus = allCampuses.find(
      (c) => c.id === workspace.campusId || c.code.toLowerCase() === workspace.campusCode.toLowerCase()
    ) || allCampuses[0];

    const ok = selectWorkspace(matchedCampus.id, workspace.id);
    if (!ok) {
      setActiveWorkspace({
        campus_id: matchedCampus.id,
        campusId: matchedCampus.id,
        univ_id: matchedCampus.id,
        univId: matchedCampus.id,
        campus_name: matchedCampus.name,
        campus_code: matchedCampus.code,
        org_id: workspace.id,
        orgId: workspace.id,
        org_name: workspace.name,
        org_type: workspace.type,
      });
    }

    setToastMessage(`Berhasil beralih ke ruang kerja "${workspace.name}"`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1280px] mx-auto w-full pb-16">
      {/* ── 1. Header Halaman ─────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Ruang Kerja &amp; Organisasi
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Kelola ruang kerja aktif dan akses kepengurusan ormawa Anda.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Tombol Buat Ruang Kerja Dinonaktifkan Sementara */}
          <div className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 shadow-none cursor-not-allowed">
            <span>Pendaftaran Ruang Kerja Dinonaktifkan</span>
          </div>
        </div>
      </header>

      {/* ── 2. Banner Workspace Aktif ─────────────────────────────────────────── */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none p-5 sm:p-6 shadow-none relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Sisi Kiri: Info Workspace Aktif */}
          <div className="flex items-start sm:items-center gap-4">
            {/* Avatar Inisial / Logo */}
            {currentWorkspaceItem.campusCode.toUpperCase().includes("UNDIKSHA") ? (
              <div className="size-13 sm:size-14 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden flex items-center justify-center shrink-0 shadow-none p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://cdn.undiksha.ac.id/wp-content/uploads/2021/12/27081301/logo-undiksha.png"
                  alt="Undiksha Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="size-13 sm:size-14 rounded-none bg-primary text-primary-foreground font-bold flex flex-col items-center justify-center shrink-0 shadow-none text-center">
                <span className="text-base font-extrabold tracking-tight">
                  {currentWorkspaceItem.initials}
                </span>
                <span className="text-[9px] font-semibold opacity-80 uppercase tracking-wider -mt-0.5">
                  {currentWorkspaceItem.campusCode.slice(0, 4)}
                </span>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1.5 rounded-none bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-success border border-emerald-200 dark:border-emerald-800">
                  <span className="size-1.5 rounded-none bg-success" />
                  Aktif Saat Ini
                </span>
                <span className="text-xs text-zinc-300 dark:text-zinc-600">•</span>
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <ShieldCheck className="size-3.5 text-primary" />
                  <span>Peran: <strong className="text-zinc-900 dark:text-zinc-100">{currentWorkspaceItem.role}</strong></span>
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                {currentWorkspaceItem.name}
              </h2>

              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
                <Building2 className="size-3.5 text-zinc-400" />
                <span>{currentWorkspaceItem.campusName}</span>
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Metrik Ringkas & Tombol Aksi */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-zinc-200 dark:border-zinc-800">
            {/* Metrik Anggota & Tugas */}
            <div className="flex items-center gap-4 px-3.5 py-2 rounded-none bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-xs">
              <div>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">Anggota</span>
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{currentWorkspaceItem.totalMembers}</span>
              </div>
              <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" />
              <div>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">Tugas Aktif</span>
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{currentWorkspaceItem.activeTasks}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-none transition-colors"
              >
                <Settings className="size-3.5 text-zinc-500" />
                <span>Pengaturan Ruang Kerja</span>
              </Link>
              <Link
                href="/dashboard/tasks"
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-none bg-primary hover:bg-primary-hover text-primary-foreground shadow-none transition-colors"
              >
                <span>Buka Job Desk</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Grid / List Daftar Ruang Kerja ─────────────────────────────────── */}
      <section className="space-y-4">
        {/* Sub-header & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Daftar Ruang Kerja Terdaftar</span>
              <span className="px-2 py-0.5 rounded-none bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold border border-zinc-200 dark:border-zinc-700">
                {filteredWorkspaces.length}
              </span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Ruang kerja resmi yang terhubung dengan akun Anda.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="size-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari ruang kerja..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-48 sm:w-60 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-8 pr-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-primary shadow-none"
              />
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 shadow-none text-xs">
              <button
                type="button"
                onClick={() => setRoleFilter("ALL")}
                className={`px-2.5 py-1 rounded-none text-xs font-semibold transition-colors cursor-pointer ${
                  roleFilter === "ALL"
                    ? "bg-primary text-primary-foreground shadow-none"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("ADMIN")}
                className={`px-2.5 py-1 rounded-none text-xs font-semibold transition-colors cursor-pointer ${
                  roleFilter === "ADMIN"
                    ? "bg-primary text-primary-foreground shadow-none"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("MEMBER")}
                className={`px-2.5 py-1 rounded-none text-xs font-semibold transition-colors cursor-pointer ${
                  roleFilter === "MEMBER"
                    ? "bg-primary text-primary-foreground shadow-none"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                Anggota
              </button>
            </div>
          </div>
        </div>

        {/* Card Grid */}
        {filteredWorkspaces.length === 0 ? (
          <div className="rounded-none border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center bg-white dark:bg-zinc-900">
            <FolderKanban className="size-8 text-zinc-400 mx-auto mb-2" />
            <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Tidak ada ruang kerja yang sesuai dengan kata kunci &quot;{searchQuery}&quot;.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setRoleFilter("ALL");
              }}
              className="mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              Reset Pencarian
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkspaces.map((workspace) => {
              const activeId = activeWorkspace.org_id || activeWorkspace.orgId || "main_org";
              const isForkomKipActive =
                activeId === "main_org" ||
                activeId === "org-undiksha-forkom-kip" ||
                activeId === "org-undiksha-bem";
              const isForkomKipCard =
                workspace.id === "main_org" ||
                workspace.id === "org-undiksha-forkom-kip" ||
                workspace.id === "org-undiksha-bem";

              const isCurrent = isForkomKipCard ? isForkomKipActive : workspace.id === activeId;

              return (
                <div
                  key={workspace.id}
                  className={`
                    rounded-none border bg-white dark:bg-zinc-900 p-5 shadow-none transition-colors flex flex-col justify-between gap-4
                    ${
                      isCurrent
                        ? "border-primary"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }
                  `}
                >
                  <div>
                    {/* Header Card: Avatar + Role Badge */}
                    <div className="flex items-start justify-between gap-3">
                      {workspace.campusCode.toUpperCase().includes("UNDIKSHA") ? (
                        <div className="size-11 rounded-none border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-1 flex items-center justify-center shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="https://cdn.undiksha.ac.id/wp-content/uploads/2021/12/27081301/logo-undiksha.png"
                            alt="Undiksha"
                            className="size-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="size-11 rounded-none bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold text-sm flex items-center justify-center shrink-0">
                          {workspace.initials}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none bg-emerald-50 dark:bg-emerald-950/40 text-success text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="size-3" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-none bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[11px] font-semibold border border-zinc-200 dark:border-zinc-700">
                            {workspace.type}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Titles */}
                    <div className="mt-3">
                      <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-1">
                        {workspace.name}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                        {workspace.campusName}
                      </p>
                    </div>

                    {/* Role Indicator */}
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                      <span className="text-zinc-500">Peran Anda:</span>
                      <span className="font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-none text-[11px]">
                        {workspace.role}
                      </span>
                    </div>

                    {/* Metrik Mini */}
                    <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-none bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <CalendarCheck2 className="size-3.5 text-zinc-400" />
                        <div>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">Tugas Aktif</span>
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">{workspace.activeTasks} tugas</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-700 pl-2">
                        <Users className="size-3.5 text-zinc-400" />
                        <div>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">Anggota</span>
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">{workspace.totalMembers} orang</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi Beralih / Masuk */}
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => handleSwitchWorkspace(workspace)}
                      disabled={isCurrent}
                      className={`
                        w-full h-8.5 rounded-none text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-none
                        ${
                          isCurrent
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700 cursor-default"
                            : "bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 border border-transparent cursor-pointer"
                        }
                      `}
                    >
                      {isCurrent ? (
                        <>
                          <Check className="size-3.5 text-success stroke-[2.5]" />
                          <span>Ruang Kerja Terpilih</span>
                        </>
                      ) : (
                        <>
                          <span>Pilih Ruang Kerja</span>
                          <ArrowRight className="size-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Feedback Toast ───────────────────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-none border border-zinc-700 bg-zinc-900 text-white text-xs font-semibold shadow-none animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="size-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
