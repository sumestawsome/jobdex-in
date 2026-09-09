"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { logoutUser } from "@/lib/firebase/auth";
import { showSuccess } from "@/lib/swal";
import { useTheme } from "@/components/theme/theme-provider";
import { USER_ROLE_LABELS } from "@/lib/roles";
import { Sun, Moon, LogOut, User, Home, ChevronDown, Menu, AlertTriangle } from "lucide-react";
import { getDivisionById } from "@/lib/firebase/divisions";
import { subscribeWhatsAppSystemSettings } from "@/lib/firebase/system-settings";
import type { WhatsAppSystemSettings } from "@/types";
import { WorkspaceNavSwitcher } from "@/components/workspace/workspace-nav-switcher";
import { useWorkspace } from "@/hooks/use-workspace";

function getPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Ringkasan";
  if (pathname.startsWith("/dashboard/workspace")) return "Pilih Ruang Kerja";
  if (pathname.startsWith("/dashboard/tasks")) return "Job Desk";
  if (pathname.startsWith("/dashboard/events")) return "Acara";
  if (pathname.startsWith("/dashboard/members")) return "Anggota";
  if (pathname.startsWith("/dashboard/references")) return "Referensi";
  if (pathname.startsWith("/dashboard/ai")) return "AI Assistant";
  if (pathname.startsWith("/dashboard/setup")) return "Setup";
  if (pathname.startsWith("/dashboard/settings")) return "Pengaturan";
  if (pathname.startsWith("/dashboard/profile")) return "Profile";
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
  const { theme, toggleTheme } = useTheme();
  const { activeWorkspace, activeOrmawa } = useWorkspace();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [fetchedDivisionName, setFetchedDivisionName] = useState<string | null>(null);
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

  useEffect(() => {
    if (userProfile?.role !== "super_admin" && userProfile?.division_id) {
      getDivisionById(userProfile.division_id)
        .then((div) => {
          if (div) {
            setFetchedDivisionName(div.name);
          }
        })
        .catch(() => {});
    }
  }, [userProfile?.division_id, userProfile?.role]);

  const divisionName = userProfile?.role === "super_admin"
    ? "JobDex.in Workspace"
    : (fetchedDivisionName || "Humas & Media Kreatif");

  async function handleLogout() {
    setIsLoggingOut(true);
    await logoutUser();
    await showSuccess("Anda berhasil keluar dari akun.", "Logout Sukses");
    router.replace("/login");
  }

  const isDark = theme === "dark";

  return (
    <header className="jd-neo-topbar sticky top-0 z-40 w-full">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Title and Badge Info */}
        <div className="flex items-center gap-3">
          {props.onToggleMobileMenu && (
            <button
              type="button"
              onClick={props.onToggleMobileMenu}
              className="lg:hidden p-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer shrink-0 transition-all shadow-xs"
              title="Buka Menu"
            >
              <Menu size={16} />
            </button>
          )}
          <span className="jd-neo-badge bg-main text-main-foreground">
            {getPageTitle(pathname)}
          </span>

          {/* Active Workspace Pill Indicator */}
          <Link
            href="/dashboard/workspace"
            className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
            title={`Ruang Kerja Aktif: ${activeWorkspace.org_name} (${activeWorkspace.campus_name})`}
          >
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold">{activeWorkspace.campus_code}</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="truncate max-w-[130px] font-medium">{activeOrmawa.short_name || activeWorkspace.org_name}</span>
          </Link>

          <p className="hidden xl:block text-xs font-bold text-neutral-500 dark:text-neutral-400">
            {divisionName}
          </p>

          {/* Global WhatsApp Sandbox Active Indicator */}
          {waSettings?.isTestMode && (
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wide bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border-2 border-amber-500 shadow-xs hover:opacity-90 transition-all cursor-pointer"
              title="WhatsApp Sandbox Mode sedang AKTIF! Semua notifikasi dialihkan ke grup testing. Klik untuk mengatur."
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400" />
              <span>WA SANDBOX ACTIVE</span>
            </Link>
          )}
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Multi-Tenant Workspace Cascading Switcher */}
          <WorkspaceNavSwitcher />
          
          {/* Theme toggle */}
          {mounted && (
            <button
              type="button"
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center jd-neo-button p-0"
              title={isDark ? "Aktifkan light mode" : "Aktifkan dark mode"}
            >
              {isDark ? (
                <Sun size={18} color="#facc15" fill="#facc15" className="shrink-0" />
              ) : (
                <Moon size={18} color="currentColor" fill="currentColor" className="shrink-0" />
              )}
            </button>
          )}

          {/* User Info & Quick Controls */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="jd-neo-button h-10 px-1.5 sm:px-3 flex items-center gap-2 text-sm"
              >
                {/* Avatar */}
                {userProfile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={userProfile.avatar_url}
                    alt={userProfile?.name || "Avatar"}
                    className="size-8 rounded-full border border-slate-200 dark:border-slate-800 object-cover shrink-0"
                  />
                ) : (
                  <div className="size-8 rounded-full border border-slate-200 dark:border-slate-800 bg-sky-100 dark:bg-sky-950/40 flex items-center justify-center text-xs font-semibold text-sky-700 dark:text-sky-400 shrink-0">
                    {getInitials(userProfile?.name || user?.displayName)}
                  </div>
                )}

                {/* Name & Role (Desktop) */}
                <div className="hidden sm:flex flex-col items-start text-left leading-tight">
                  <span className="font-bold text-foreground text-xs truncate max-w-[120px]">
                    {userProfile?.name ?? user?.displayName ?? "User"}
                  </span>
                  <span className="text-[10px] font-normal text-neutral-500 dark:text-neutral-400">
                    {userProfile?.role ? USER_ROLE_LABELS[userProfile.role] : "Anggota"}
                  </span>
                </div>

                <ChevronDown size={14} className="text-foreground shrink-0 hidden sm:block" />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 z-20 jd-neo-card p-2 flex flex-col gap-1 shadow-shadow">
                    <div className="px-2 py-1.5 border-b border-neutral-100 dark:border-neutral-800 mb-1">
                      <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Akun Anda</p>
                      <p className="text-xs font-black text-foreground truncate">
                        {userProfile?.name ?? user?.displayName ?? "Anggota"}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/profile"
                      className="flex items-center gap-2 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded font-bold text-xs text-neutral-800 dark:text-neutral-200"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <User size={14} />
                      Profile
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center gap-2 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded font-bold text-xs text-neutral-800 dark:text-neutral-200"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <Home size={14} />
                      Landing Page
                    </Link>
                    <hr className="border-neutral-200 dark:border-neutral-700 my-1" />
                    <button
                      type="button"
                      disabled={isLoggingOut}
                      onClick={() => {
                        setDropdownOpen(false);
                        void handleLogout();
                      }}
                      className="flex w-full text-left items-center gap-2 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded font-bold text-xs"
                    >
                      <LogOut size={14} />
                      {isLoggingOut ? "Keluar..." : "Logout"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
