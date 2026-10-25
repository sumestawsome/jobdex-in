"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { logoutUser } from "@/lib/firebase/auth";
import { showSuccess } from "@/lib/swal";
import { useTheme } from "@/components/theme/theme-provider";
import { USER_ROLE_LABELS } from "@/lib/roles";
import { Sun, Moon, LogOut, User, Home, ChevronDown, Menu, AlertTriangle, GraduationCap } from "lucide-react";
import { subscribeWhatsAppSystemSettings } from "@/lib/firebase/system-settings";
import type { WhatsAppSystemSettings } from "@/types";
import { WorkspaceNavSwitcher } from "@/components/workspace/workspace-nav-switcher";
import { useWorkspace } from "@/hooks/use-workspace";

function getPageTitle(pathname: string, isClass?: boolean): string {
  if (pathname === "/dashboard") return isClass ? "Ringkasan Tugas Kuliah" : "Ringkasan";
  if (pathname.startsWith("/dashboard/workspace")) return "Ruang Kerja";
  if (pathname.startsWith("/dashboard/tasks")) return isClass ? "Tugas Kuliah" : "Job Desk";
  if (pathname.startsWith("/dashboard/calendar")) return "Kalender";
  if (pathname.startsWith("/dashboard/events")) return "Acara";
  if (pathname.startsWith("/dashboard/members")) return isClass ? "Anggota Kelas" : "Anggota";
  if (pathname.startsWith("/dashboard/references")) return "Referensi";
  if (pathname.startsWith("/dashboard/ai")) return "AI Assistant";
  if (pathname.startsWith("/dashboard/setup")) return "Setup";
  if (pathname.startsWith("/dashboard/settings/workspaces")) return "Kelola Ruang Kerja Kelas";
  if (pathname.startsWith("/dashboard/settings")) return "Pengaturan";
  if (pathname.startsWith("/dashboard/profile")) return "Profil";
  return "Dashboard";
}

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function NeoTopbar(props: {
  isCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onToggleMobileMenu?: () => void;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userProfile } = useAuth();
  const { isClassWorkspace, activeWorkspace } = useWorkspace();
  const { theme, toggleTheme } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [waSettings, setWaSettings] = useState<WhatsAppSystemSettings | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    const unsubscribe = subscribeWhatsAppSystemSettings((settings) => {
      setWaSettings(settings);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    await logoutUser();
    await showSuccess("Anda berhasil keluar dari akun.", "Logout Sukses");
    router.replace("/login");
  }

  const isDark = theme === "dark";
  const pageTitle = getPageTitle(pathname, isClassWorkspace);
  const effectiveRoleLabel = isClassWorkspace
    ? userProfile?.workspace_roles?.[activeWorkspace.org_id] === "admin_komunitas" ||
      userProfile?.role === "admin_komunitas" ||
      userProfile?.email === "agus.sumerta@student.undiksha.ac.id"
      ? "Admin Komunitas"
      : "Anggota Kelas"
    : userProfile?.role
    ? USER_ROLE_LABELS[userProfile.role]
    : "Anggota";

  return (
    <header className="sticky top-0 z-40 w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 rounded-none shadow-none">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* ── SISI KIRI ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          {/* Tombol Hamburger Menu (Mobile Only) */}
          {props.onToggleMobileMenu && (
            <button
              type="button"
              onClick={props.onToggleMobileMenu}
              className="md:hidden p-2 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0 transition-colors shadow-none"
              title="Buka Menu Navigasi"
              aria-label="Buka Menu"
            >
              <Menu size={18} />
            </button>
          )}

          {/* Breadcrumb Sederhana (Desktop Only) */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            <span className="text-zinc-400 dark:text-zinc-500 font-medium">Dashboard</span>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{pageTitle}</span>
          </div>

          {/* WhatsApp Sandbox Active Indicator (Desktop only if active) */}
          {waSettings?.isTestMode && (
            <Link
              href="/dashboard/settings"
              className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[10px] font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-400 dark:border-amber-700 shadow-none hover:opacity-90 transition-opacity"
              title="WhatsApp Sandbox Mode aktif"
            >
              <AlertTriangle className="size-3 text-warning shrink-0" />
              <span>WA SANDBOX ACTIVE</span>
            </Link>
          )}
        </div>

        {/* ── SISI TENGAH (Mobile Only: Judul Halaman Ringkas) ──────────────────── */}
        <div className="md:hidden flex-1 text-center truncate px-2">
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
            {pageTitle}
          </span>
        </div>

        {/* ── SISI KANAN (Controls & Profil) ───────────────────────────────────── */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Multi-Tenant Workspace Cascading Switcher (Desktop only) */}
          <div className="hidden md:block">
            <WorkspaceNavSwitcher />
          </div>
          
          {/* Theme Toggle Button (Mobile & Desktop) */}
          {mounted && (
            <button
              type="button"
              onClick={toggleTheme}
              className="size-9 flex items-center justify-center rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-none transition-colors cursor-pointer"
              title={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun size={16} className="text-amber-400 shrink-0" />
              ) : (
                <Moon size={16} className="text-zinc-600 dark:text-zinc-400 shrink-0" />
              )}
            </button>
          )}

          {/* User Profile Avatar & Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="h-9 px-1.5 sm:px-2.5 flex items-center gap-2 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-none transition-colors cursor-pointer"
              aria-label="Menu akun pengguna"
            >
              {/* Avatar Mini */}
              {userProfile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userProfile.avatar_url}
                  alt={userProfile?.name || "Avatar"}
                  className="size-6 sm:size-7 rounded-none border border-zinc-200 dark:border-zinc-700 object-cover shrink-0"
                />
              ) : (
                <div className="size-6 sm:size-7 rounded-none border border-zinc-200 dark:border-zinc-700 bg-primary/10 text-primary flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0">
                  {getInitials(userProfile?.name || user?.displayName)}
                </div>
              )}

              {/* Name & Role (Desktop Only) */}
              <div className="hidden sm:flex flex-col items-start text-left leading-tight">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs truncate max-w-[120px]">
                  {userProfile?.name ?? user?.displayName ?? "User"}
                </span>
                <span className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                  {effectiveRoleLabel}
                </span>
              </div>

              <ChevronDown size={14} className="text-zinc-400 shrink-0 hidden sm:block" />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-1 w-48 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-none p-1.5 flex flex-col gap-0.5">
                  <div className="px-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Akun Anda</p>
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {userProfile?.name ?? user?.displayName ?? "Anggota"}
                    </p>
                  </div>
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center gap-2 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none font-semibold text-xs text-zinc-800 dark:text-zinc-200 transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <User size={14} className="text-zinc-500" />
                    <span>Profil Saya</span>
                  </Link>
                  <Link
                    href="/"
                    className="flex items-center gap-2 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none font-semibold text-xs text-zinc-800 dark:text-zinc-200 transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Home size={14} className="text-zinc-500" />
                    <span>Halaman Utama</span>
                  </Link>
                  {userProfile?.role === "super_admin" && (
                    <Link
                      href="/dashboard/settings/workspaces"
                      className="flex items-center gap-2 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none font-semibold text-xs text-primary transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <GraduationCap size={14} className="text-primary" />
                      <span>Kelola Kelas</span>
                    </Link>
                  )}
                  <hr className="border-zinc-200 dark:border-zinc-800 my-1" />
                  <button
                    type="button"
                    disabled={isLoggingOut}
                    onClick={() => {
                      setDropdownOpen(false);
                      void handleLogout();
                    }}
                    className="flex w-full text-left items-center gap-2 p-2 text-danger hover:bg-red-50 dark:hover:bg-red-950/30 rounded-none font-semibold text-xs cursor-pointer transition-colors"
                  >
                    <LogOut size={14} />
                    <span>{isLoggingOut ? "Keluar..." : "Logout"}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
