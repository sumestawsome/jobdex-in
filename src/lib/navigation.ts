import {
  canAccessAI,
  canManageMembers,
  isAnggota,
  isSuperAdmin,
} from "@/lib/permissions";
import type { DashboardNavItem, UserProfile } from "@/types";

type DashboardNavConfig = DashboardNavItem & {
  visible: (profile: UserProfile | null) => boolean;
};

const allUsers = () => true;

export const dashboardNavigation: DashboardNavConfig[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    visible: allUsers,
  },
  {
    label: "Ruang Kerja",
    href: "/dashboard/workspace",
    visible: allUsers,
  },
  {
    label: "Job Desk",
    href: "/dashboard/tasks",
    visible: allUsers,
  },
  {
    label: "Kalender",
    href: "/dashboard/calendar",
    visible: allUsers,
  },
  {
    label: "Acara",
    href: "/dashboard/events",
    visible: allUsers,
  },
  {
    label: "Anggota",
    href: "/dashboard/members",
    visible: (profile) => canManageMembers(profile),
  },
  {
    label: "Referensi",
    href: "/dashboard/references",
    visible: allUsers,
  },
  {
    label: "AI Assistant",
    href: "/dashboard/ai",
    visible: (profile) => canAccessAI(profile),
  },
  {
    label: "Setup",
    href: "/dashboard/setup",
    visible: (profile) => process.env.NODE_ENV !== "production" && isSuperAdmin(profile),
  },
  {
    label: "Profile",
    href: "/dashboard/profile",
    visible: allUsers,
  },
  {
    label: "Pengaturan",
    href: "/dashboard/settings",
    visible: allUsers,
  },
];

export function getDashboardNavigation(profile: UserProfile | null) {
  return dashboardNavigation
    .filter((item) => item.visible(profile))
    .map((item) => {
      if (item.href === "/dashboard/tasks" && isAnggota(profile)) {
        return {
          ...item,
          label: "Job Desk Saya",
        };
      }

      return item;
    });
}
