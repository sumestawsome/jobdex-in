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
      <div className="border-b border-[#e1e2e3] dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 flex items-center justify-between gap-2 rounded-none">
        {(!isCollapsed || isMobile) ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-none bg-indigo-600 text-white flex items-center justify-center font-bold text-sm tracking-tight shrink-0 shadow-none">
              J
            </div>
            <div className="min-w-0">
              <Link href="/dashboard" className="text-sm font-bold text-[#18181b] dark:text-white tracking-tight hover:opacity-90 block leading-tight">
                JobDex<span className="text-indigo-600">.in</span>
              </Link>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5" title={divisionName}>
                {divisionName}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex justify-center">
            <Link href="/dashboard" className="w-8 h-8 rounded-none bg-indigo-600 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-none">
              J
            </Link>
          </div>
        )}

        {/* Toggle Collapse Button (Desktop) */}
        {!isMobile && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 rounded-none border border-[#e1e2e3] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800/50 cursor-pointer shrink-0 transition-all shadow-none"
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
            className="p-1.5 rounded-none border border-[#e1e2e3] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800/50 cursor-pointer shrink-0 transition-all shadow-none"
            title="Tutup Menu"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Active Workspace Indicator */}
      {(!isCollapsed || isMobile) ? (
        <div className="mx-3 mt-3 mb-1 p-2.5 rounded-none border border-[#e1e2e3] dark:border-slate-800 bg-[#f7f7f8] dark:bg-slate-900/90 shadow-none">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
              <span className="size-1.5 rounded-none bg-lime-600" />
              Ruang Aktif
            </span>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-none bg-[#eaeaeb] dark:bg-slate-800 text-[#18181b] dark:text-slate-200">
              {activeWorkspace.campus_code}
            </span>
          </div>
          <Link
            href="/dashboard/workspace"
            className="block text-xs font-semibold text-[#18181b] dark:text-white truncate hover:underline"
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
            className="flex size-8 items-center justify-center rounded-none bg-[#f7f7f8] dark:bg-slate-800 text-indigo-600 dark:text-white font-bold text-xs border border-[#e1e2e3] dark:border-slate-700 hover:border-indigo-500 transition-all shadow-none"
            title={`Ruang Aktif: ${activeWorkspace.org_name} (${activeWorkspace.campus_code})`}
          >
            {activeWorkspace.campus_code}
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-3 overflow-y-auto">
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
              className={`relative flex items-center rounded-none font-medium text-xs sm:text-sm transition-all shadow-none ${
                (isCollapsed && !isMobile) ? "justify-center p-2" : "justify-between px-3 py-2"
              } ${
                isActive
                  ? "bg-indigo-600 text-white font-semibold"
                  : "bg-transparent text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white hover:bg-[#f4f4f5] dark:hover:bg-slate-800/60"
              }`}
            >
              <div className={`flex items-center ${(isCollapsed && !isMobile) ? "justify-center" : "gap-2.5"}`}>
                {IconComponent && <IconComponent className="size-4 shrink-0" />}
                {(!isCollapsed || isMobile) && <span>{item.label}</span>}
              </div>
              {(!isCollapsed || isMobile) && isActive && (
                <span className="w-1.5 h-1.5 rounded-none bg-lime-400 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Area */}
      {(!isCollapsed || isMobile) && (
        <div className="border-t border-[#e1e2e3] dark:border-slate-800 p-3 text-center bg-white dark:bg-slate-900">
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
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
