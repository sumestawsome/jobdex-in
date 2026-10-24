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

export function DashboardBottomNav() {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  const { isClassWorkspace } = useWorkspace();
  
  if (!userProfile) return null;
  
  const navItems = getDashboardNavigation(userProfile, { isClassWorkspace });
  
  const activeBottomItems = isClassWorkspace
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

  return (
    <nav className="jd-bottom-nav md:hidden">
      {activeBottomItems.map((item) => {
        const IconComponent = iconMap[item.href];
        const isActive =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`jd-bottom-nav-item ${isActive ? "jd-bottom-nav-active" : ""}`}
          >
            {IconComponent ? <IconComponent className="size-5" /> : null}
            <span className="truncate max-w-full mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
