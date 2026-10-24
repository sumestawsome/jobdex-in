"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDashboardNavigation } from "@/lib/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { 
  LayoutDashboard, 
  ClipboardList, 
  CalendarDays, 
  Images, 
  Bot,
  User
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/tasks": ClipboardList,
  "/dashboard/calendar": CalendarDays,
  "/dashboard/events": CalendarDays,
  "/dashboard/references": Images,
  "/dashboard/ai": Bot,
  "/dashboard/profile": User,
};

export function NeoMobileNav() {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  const { isClassWorkspace } = useWorkspace();
  
  if (!userProfile) return null;
  
  const navItems = getDashboardNavigation(userProfile, { isClassWorkspace });

  const itemsToRender = isClassWorkspace
    ? [
        { label: "Ringkasan", href: "/dashboard" },
        { label: "Tugas", href: "/dashboard/tasks" },
        { label: "Kalender", href: "/dashboard/calendar" },
        { label: "Profil", href: "/dashboard/profile" },
      ]
    : navItems.filter((item) =>
        [
          "/dashboard",
          "/dashboard/tasks",
          "/dashboard/events",
          "/dashboard/references",
          "/dashboard/ai",
        ].includes(item.href)
      );

  const gridColsClass = isClassWorkspace ? "grid-cols-4" : "grid-cols-5";

  return (
    <nav className={`fixed left-0 right-0 bottom-0 z-50 grid ${gridColsClass} gap-1 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden rounded-none shadow-none`}>
      {itemsToRender.map((item) => {
        const IconComponent = iconMap[item.href];
        const isActive =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 rounded-none py-1.5 px-0.5 font-medium text-[10px] transition-all shadow-none ${
              isActive
                ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {IconComponent ? <IconComponent className="size-5" /> : null}
            <span className="truncate max-w-full mt-0.5">
              {item.href === "/dashboard/ai" ? "AI" : item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

