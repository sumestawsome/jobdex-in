"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDashboardNavigation } from "@/lib/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  Calendar,
  Users,
  Images,
  Bot,
  Wrench,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";

import { useState, useEffect } from "react";
import { getDivisionById } from "@/lib/firebase/divisions";
import { useWorkspace } from "@/hooks/use-workspace";

const sidebarIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/workspace": Building2,
  "/dashboard/tasks": ClipboardList,
  "/dashboard/calendar": CalendarDays,
  "/dashboard/events": Calendar,
  "/dashboard/members": Users,
  "/dashboard/references": Images,
  "/dashboard/ai": Bot,
  "/dashboard/setup": Wrench,
  "/dashboard/settings": Settings,
  "/dashboard/profile": User,
};

type NeoSidebarProps = {
  isCollapsed?: boolean;
  onToggle?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
};

export function NeoSidebar({ 
  isCollapsed = false, 
  onToggle, 
  isMobileOpen = false, 
  onCloseMobile 
}: NeoSidebarProps) {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  const { activeWorkspace, activeOrmawa } = useWorkspace();
  const navItems = getDashboardNavigation(userProfile);
  const [fetchedDivisionName, setFetchedDivisionName] = useState<string | null>(null);

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

  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Brand Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-5 flex items-center justify-between gap-1">
        {(!isCollapsed || isMobile) ? (
          <div className="min-w-0 flex-1">
            <Link href="/" className="text-2xl font-extrabold tracking-wider text-foreground hover:opacity-90 block">
              JobDex<span className="text-sky-600 dark:text-sky-400">.in</span>
            </Link>
            <p className="mt-1 text-[10px] opacity-80 tracking-wide uppercase font-semibold text-slate-500 truncate" title={divisionName}>
              {divisionName}
            </p>
          </div>
        ) : (
          <div className="flex-1 flex justify-center">
            <Link href="/" className="text-2xl font-extrabold tracking-wider text-foreground hover:opacity-90 block">
              J<span className="text-sky-600 dark:text-sky-400">D</span>
            </Link>
          </div>
        )}

        {/* Toggle Collapse Button (Desktop) */}
        {!isMobile && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer shrink-0 transition-all shadow-xs"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}

        {/* Close Button (Mobile) */}
        {isMobile && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer shrink-0 transition-all shadow-xs"
            title="Tutup Menu"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Active Workspace Indicator */}
      {(!isCollapsed || isMobile) ? (
        <div className="mx-3 mt-3 mb-1 p-2.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-linear-to-r from-sky-50 to-indigo-50/40 dark:from-sky-950/40 dark:to-indigo-950/20">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 dark:text-sky-300">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ruang Aktif
            </span>
            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-sky-200 dark:bg-sky-900 text-sky-900 dark:text-sky-200">
              {activeWorkspace.campus_code}
            </span>
          </div>
          <Link
            href="/dashboard/workspace"
            className="block text-xs font-bold text-slate-900 dark:text-white truncate hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            title={`${activeWorkspace.org_name} (${activeWorkspace.campus_name})`}
          >
            {activeOrmawa.short_name || activeWorkspace.org_name}
          </Link>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {activeWorkspace.campus_name}
          </p>
        </div>
      ) : (
        <div className="mx-auto mt-3 mb-1 flex justify-center">
          <Link
            href="/dashboard/workspace"
            className="flex size-9 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-black text-xs border border-sky-300 dark:border-sky-800 hover:ring-2 hover:ring-sky-500/30 transition-all"
            title={`Ruang Aktif: ${activeWorkspace.org_name} (${activeWorkspace.campus_code})`}
          >
            {activeWorkspace.campus_code}
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-2 p-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
               ? pathname === item.href
              : pathname.startsWith(item.href);

          const IconComponent = sidebarIconMap[item.href];

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              onClick={() => {
                if (isMobile && onCloseMobile) {
                  onCloseMobile();
                }
              }}
              className={`relative flex items-center rounded-md font-medium text-sm transition-all ${
                (isCollapsed && !isMobile) ? "justify-center p-2.5" : "justify-between px-4 py-2.5"
              } ${
                isActive
                  ? "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-semibold"
                  : "bg-transparent text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
              }`}
            >
              <div className={`flex items-center ${(isCollapsed && !isMobile) ? "justify-center" : "gap-2.5"}`}>
                {IconComponent && <IconComponent className="size-4 shrink-0" />}
                {(!isCollapsed || isMobile) && <span>{item.label}</span>}
              </div>
              {(!isCollapsed || isMobile) && isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-400 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Area */}
      {(!isCollapsed || isMobile) && (
        <div className="border-t border-slate-200 dark:border-slate-800 p-4 text-center bg-white dark:bg-slate-950">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            JobDex.in Workspace
          </span>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden shrink-0 flex-col jd-neo-sidebar lg:flex h-screen sticky top-0 overflow-hidden transition-all duration-200 ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile Drawer (Sidebar overlay) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Sidebar Drawer body */}
          <div className="relative flex w-full max-w-[260px] flex-1 flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-850 h-full shadow-xl">
            {sidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
