import React from "react";
import { Building2 } from "lucide-react";
import { DUMMY_CAMPUSES, DUMMY_ORMAWAS } from "@/lib/workspace-dummy-data";

interface WorkspaceBadgeProps {
  campusId?: string | null;
  orgId?: string | null;
  className?: string;
  size?: "xs" | "sm" | "md";
  showIcon?: boolean;
}

export function WorkspaceBadge({
  campusId,
  orgId,
  className = "",
  size = "xs",
  showIcon = true,
}: WorkspaceBadgeProps) {
  // Find campus and ormawa from dummy or fallback
  const campus = DUMMY_CAMPUSES.find(
    (c) => c.id === campusId || c.code.toLowerCase() === campusId?.toLowerCase()
  );
  const ormawa = DUMMY_ORMAWAS.find(
    (o) =>
      o.id === orgId ||
      o.short_name.toLowerCase() === orgId?.toLowerCase() ||
      o.name.toLowerCase() === orgId?.toLowerCase()
  );

  const campusText = campus?.code || (campusId ? campusId.toUpperCase() : "UI");
  const ormawaText = ormawa?.short_name || ormawa?.name || (orgId ? orgId.toUpperCase() : "BEM");

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-xs px-2 py-0.5 gap-1.5",
    md: "text-xs px-2.5 py-1 gap-1.5",
  }[size];

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-md border border-sky-200 dark:border-sky-800/70 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 shadow-2xs ${sizeClasses} ${className}`}
      title={`Kampus: ${campus?.name || campusText} • Ormawa: ${ormawa?.name || ormawaText}`}
    >
      {showIcon && <Building2 className="size-3 shrink-0 text-sky-600 dark:text-sky-400" />}
      <span className="font-extrabold uppercase tracking-tight">{campusText}</span>
      <span className="text-sky-300 dark:text-sky-600 font-normal">/</span>
      <span className="truncate max-w-[120px]">{ormawaText}</span>
    </span>
  );
}
