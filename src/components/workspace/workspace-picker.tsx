"use client";

import { useState, useMemo } from "react";
import { Building2, School, Check, ChevronDown } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { DUMMY_CAMPUSES, DUMMY_ORMAWAS } from "@/lib/workspace-dummy-data";
import type { Campus, Ormawa } from "@/types/workspace";

type WorkspacePickerProps = {
  selectedCampusId?: string;
  selectedOrgId?: string;
  onSelect?: (campusId: string, orgId: string) => void;
  syncGlobal?: boolean;
  className?: string;
  label?: string;
};

export function WorkspacePicker({
  selectedCampusId,
  selectedOrgId,
  onSelect,
  syncGlobal = true,
  className = "",
  label = "Ruang Kerja Kampus & Ormawa",
}: WorkspacePickerProps) {
  const { activeWorkspace, selectWorkspace, campuses, ormawas } = useWorkspace();

  const currentCampusId = selectedCampusId || activeWorkspace.campus_id;
  const currentOrgId = selectedOrgId || activeWorkspace.org_id;

  const [campusId, setCampusId] = useState<string>(currentCampusId);
  const [orgId, setOrgId] = useState<string>(currentOrgId);

  const availableOrmawas = useMemo(() => {
    return ormawas.filter((o) => o.campus_id === campusId);
  }, [ormawas, campusId]);

  const handleCampusChange = (newCampusId: string) => {
    setCampusId(newCampusId);
    const firstOrmawa = ormawas.find((o) => o.campus_id === newCampusId);
    const newOrgId = firstOrmawa ? firstOrmawa.id : "";
    setOrgId(newOrgId);

    if (firstOrmawa) {
      if (syncGlobal) {
        selectWorkspace(newCampusId, newOrgId);
      }
      onSelect?.(newCampusId, newOrgId);
    }
  };

  const handleOrmawaChange = (newOrgId: string) => {
    setOrgId(newOrgId);
    if (syncGlobal) {
      selectWorkspace(campusId, newOrgId);
    }
    onSelect?.(campusId, newOrgId);
  };

  const selectedCampus = campuses.find((c) => c.id === campusId) || campuses[0] || DUMMY_CAMPUSES[0];
  const selectedOrmawa =
    ormawas.find((o) => o.id === orgId && o.campus_id === campusId) ||
    availableOrmawas[0] ||
    DUMMY_ORMAWAS[0];

  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs ${className}`}>
      {label && (
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Building2 className="size-3.5 text-sky-500" />
            <span>{label}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{selectedCampus.code} / {selectedOrmawa.short_name}</span>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Campus Select */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Kampus / Perguruan Tinggi
          </label>
          <div className="relative">
            <select
              value={campusId}
              onChange={(e) => handleCampusChange(e.target.value)}
              className="h-9 w-full appearance-none rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 pr-8 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <ChevronDown className="size-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Ormawa Select */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Organisasi Mahasiswa (Ormawa)
          </label>
          <div className="relative">
            <select
              value={orgId}
              onChange={(e) => handleOrmawaChange(e.target.value)}
              className="h-9 w-full appearance-none rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 pr-8 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            >
              {availableOrmawas.map((o) => (
                <option key={o.id} value={o.id}>
                  [{o.type}] {o.name} ({o.short_name})
                </option>
              ))}
            </select>
            <ChevronDown className="size-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
