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
  const isMainOrg =
    !orgId ||
    orgId === "main_org" ||
    orgId === "org-undiksha-forkom-kip" ||
    orgId.toLowerCase().includes("forkom");

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

  let campusText: string;
  let ormawaText: string;

  if (isMainOrg) {
    campusText = "UNDIKSHA";
    ormawaText = "FORKOM KIP";
  } else {
    campusText = campus?.code || (campusId ? campusId.toUpperCase() : "UNDIKSHA");
    ormawaText = ormawa?.short_name || ormawa?.name || (orgId ? orgId.toUpperCase() : "FORKOM KIP");
  }

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-xs px-2 py-0.5 gap-1.5",
    md: "text-xs px-2.5 py-1 gap-1.5",
  }[size];

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-none border border-zinc-200 bg-zinc-50 text-zinc-900 shadow-none ${sizeClasses} ${className}`}
      title={`Kampus: ${campus?.name || campusText} • Ormawa: ${ormawa?.name || ormawaText}`}
    >
      {showIcon && <Building2 className="size-3 shrink-0 text-zinc-700" />}
      <span className="font-bold uppercase tracking-tight">{campusText}</span>
      <span className="text-zinc-400 font-normal">/</span>
      <span className="truncate max-w-[120px] font-medium">{ormawaText}</span>
    </span>
  );
}

