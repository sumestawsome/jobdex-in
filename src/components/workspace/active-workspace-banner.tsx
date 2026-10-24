"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";

interface ActiveWorkspaceBannerProps {
  description?: string;
  className?: string;
}

export const UNDIKSHA_LOGO_URL =
  "https://cdn.undiksha.ac.id/wp-content/uploads/2021/12/27081301/logo-undiksha.png";

export function ActiveWorkspaceBanner({
  description,
  className = "",
}: ActiveWorkspaceBannerProps) {
  const { activeWorkspace, activeCampus, activeOrmawa, isClassWorkspace } = useWorkspace();
  const [logoError, setLogoError] = useState(false);

  // Sembunyikan banner di mode kelas / admin komunitas
  if (isClassWorkspace || activeWorkspace.org_id === "ws_ilkom_2024") {
    return null;
  }

  const fallbackInitial = (activeWorkspace.campus_code || "UN").slice(0, 2).toUpperCase();

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-none ${className}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Logo Container (Kotak Tajam, Overflow Hidden, No Luber) */}
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 overflow-hidden flex items-center justify-center p-1 shadow-none">
          {!logoError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={UNDIKSHA_LOGO_URL}
              alt="Logo Universitas Pendidikan Ganesha"
              className="size-full object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
              {fallbackInitial}
            </span>
          )}
        </div>

        {/* Info Ruang Kerja */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
              {activeOrmawa.name}
            </span>
            <span className="inline-flex items-center gap-1 rounded-none bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
              <span className="size-1.5 rounded-none bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
              <span>Aktif</span>
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
            {description || `${activeCampus.name} • Menampilkan data terfilter untuk ruang kerja ini`}
          </p>
        </div>
      </div>

      {/* Aksi Ganti Ruang Kerja */}
      <Link
        href="/dashboard/workspace"
        className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline inline-flex items-center gap-1 shrink-0"
      >
        <span>Ganti Ruang Kerja</span>
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
