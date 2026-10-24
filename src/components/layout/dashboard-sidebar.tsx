"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDashboardNavigation } from "@/lib/navigation";
import { useAuth } from "@/hooks/use-auth";
import { RoleBadge } from "@/components/ui/role-badge";

import { useWorkspace } from "@/hooks/use-workspace";

function getNavItemClass(isActive: boolean) {
  const base = "px-3 py-2.5 text-sm font-semibold transition-colors";

  if (isActive) {
    return `${base} jd-sidebar-active`;
  }

  return `${base} jd-sidebar-item`;
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user, userProfile } = useAuth();
  const { isClassWorkspace } = useWorkspace();
  const navItems = getDashboardNavigation(userProfile, { isClassWorkspace });

  return (
    <aside className="hidden w-64 shrink-0 border-r lg:flex lg:flex-col jd-sidebar">
      <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
        <Link href="/" className="text-xl font-black">
          JobDex.in
        </Link>
        <p className="mt-1 text-xs opacity-75">Humas & Media Kreatif</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1.5 p-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href} className={getNavItemClass(isActive)}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="p-4 jd-muted-surface">
          <p className="text-sm font-bold">
            {userProfile?.name ?? user?.displayName ?? "Anggota"}
          </p>
          <div className="mt-2">
            <RoleBadge
              role={
                isClassWorkspace &&
                (userProfile?.role === "admin_komunitas" ||
                  userProfile?.email === "agus.sumerta@student.undiksha.ac.id")
                  ? "admin_komunitas"
                  : userProfile?.role
              }
            />
          </div>
          <Link
            href="/dashboard/profile"
            className="mt-3 inline-flex text-xs font-semibold opacity-75 hover:opacity-100 transition-opacity"
          >
            Lihat profile
          </Link>
        </div>
      </div>
    </aside>
  );
}
