"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  Check,
  Search,
  ArrowLeft,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/hooks/use-auth";
import { isClassWorkspacePermitted } from "@/lib/permissions";
import type { Campus, Ormawa } from "@/types/workspace";

export function WorkspaceNavSwitcher() {
  const { userProfile } = useAuth();
  const {
    activeWorkspace,
    activeCampus,
    activeOrmawa,
    campuses,
    isClassWorkspace,
    getOrmawasByCampus,
    selectWorkspace,
    resetWorkspace,
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"campus" | "ormawa">("ormawa");
  const [tempSelectedCampus, setTempSelectedCampus] = useState<Campus>(activeCampus);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleToggleOpen = () => {
    if (!isOpen) {
      setTempSelectedCampus(activeCampus);
      setStep("ormawa");
      setSearchQuery("");
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // If user is currently in a class workspace without legitimate access, revert to default
  useEffect(() => {
    if (
      userProfile &&
      isClassWorkspace &&
      !isClassWorkspacePermitted(userProfile, activeWorkspace)
    ) {
      resetWorkspace();
    }
  }, [userProfile, isClassWorkspace, activeWorkspace, resetWorkspace]);

  const availableOrmawas = getOrmawasByCampus(tempSelectedCampus.id).filter((o) =>
    isClassWorkspacePermitted(userProfile, o)
  );

  const filteredOrmawas = availableOrmawas.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.short_name.toLowerCase().includes(q) ||
      o.type.toLowerCase().includes(q)
    );
  });

  const handleSelectCampus = (campus: Campus) => {
    setTempSelectedCampus(campus);
    setStep("ormawa");
    setSearchQuery("");
  };

  const handleSelectOrmawa = (ormawa: Ormawa) => {
    if (!isClassWorkspacePermitted(userProfile, ormawa)) {
      return;
    }
    selectWorkspace(tempSelectedCampus.id, ormawa.id);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggleOpen}
        className={`
          flex items-center gap-2 rounded-none border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer shadow-none
          ${
            isOpen
              ? "border-primary bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700"
          }
        `}
        title="Beralih Ruang Kerja Kampus & Ormawa"
      >
        <span className="flex size-6 items-center justify-center rounded-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-0.5 overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://cdn.undiksha.ac.id/wp-content/uploads/2021/12/27081301/logo-undiksha.png"
            alt="Logo Undiksha"
            className="size-full object-contain"
          />
        </span>
        <div className="flex flex-col text-left leading-none max-w-[130px] sm:max-w-[170px]">
          <span className="truncate font-bold text-zinc-900 dark:text-zinc-100 text-xs">
            {activeOrmawa.short_name || activeWorkspace.org_name}
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
            {activeWorkspace.campus_name}
          </span>
        </div>
        <ChevronDown
          className={`size-3.5 text-zinc-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-primary" : ""
          }`}
        />
      </button>

      {/* Cascading Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 sm:right-0 sm:left-auto mt-1 w-80 sm:w-96 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none z-50 overflow-hidden">
          {/* Header Step Indicator */}
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <Sparkles className="size-3.5 text-primary" />
                <span>Pilih Ruang Kerja</span>
              </div>
              <span className="text-[11px] font-semibold text-zinc-400">
                {step === "campus" ? "Langkah 1/2" : "Langkah 2/2"}
              </span>
            </div>

            {/* Stepper Breadcrumb */}
            <div className="mt-2 flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setStep("campus")}
                className={`flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                  step === "campus"
                    ? "text-primary"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                <Building2 className="size-3" />
                <span>{tempSelectedCampus.code}</span>
              </button>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <span
                className={`font-semibold ${
                  step === "ormawa"
                    ? "text-primary"
                    : "text-zinc-400"
                }`}
              >
                {step === "ormawa" ? "Pilih Ormawa" : "Ormawa"}
              </span>
            </div>
          </div>

          {/* Step 1: Pilih Kampus */}
          {step === "campus" && (
            <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Pilih Kampus / Perguruan Tinggi
              </p>
              {campuses.map((campus) => {
                const isCampusActive = campus.id === tempSelectedCampus.id;
                return (
                  <button
                    key={campus.id}
                    type="button"
                    onClick={() => handleSelectCampus(campus)}
                    className={`
                      w-full flex items-center justify-between p-2.5 rounded-none text-left transition-colors cursor-pointer
                      ${
                        isCampusActive
                          ? "bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60 border border-transparent"
                      }
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex size-8 items-center justify-center rounded-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 shrink-0 overflow-hidden">
                        {campus.id === "univ-undiksha" || campus.code === "UNDIKSHA" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src="https://cdn.undiksha.ac.id/wp-content/uploads/2021/12/27081301/logo-undiksha.png"
                            alt={campus.name}
                            className="size-full object-contain"
                          />
                        ) : (
                          <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200 truncate">
                            {(campus.code || "UN").slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                          {campus.name}
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          {campus.city} • {campus.ormawa_count} Ormawa
                        </p>
                      </div>
                    </div>
                    {isCampusActive && (
                      <Check className="size-4 text-primary shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Pilih Ormawa di Kampus Terpilih */}
          {step === "ormawa" && (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setStep("campus")}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  <ArrowLeft className="size-3" />
                  Ganti Kampus ({tempSelectedCampus.code})
                </button>
                <span className="text-[10px] text-zinc-400 font-medium">
                  {availableOrmawas.length} Ormawa
                </span>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="size-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={`Cari di ${tempSelectedCampus.code}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 pl-8 pr-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-primary shadow-none"
                />
              </div>

              {/* Ormawa List */}
              <div className="max-h-60 overflow-y-auto space-y-1 pt-1">
                {filteredOrmawas.length === 0 ? (
                  <p className="p-4 text-center text-xs text-zinc-400">
                    Tidak ada ormawa yang cocok.
                  </p>
                ) : (
                  filteredOrmawas.map((ormawa) => {
                    const isSelected =
                      activeWorkspace.campus_id === tempSelectedCampus.id &&
                      activeWorkspace.org_id === ormawa.id;
                    return (
                      <button
                        key={ormawa.id}
                        type="button"
                        onClick={() => handleSelectOrmawa(ormawa)}
                        className={`
                          w-full flex items-center justify-between p-2.5 rounded-none text-left transition-colors cursor-pointer
                          ${
                            isSelected
                              ? "bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60 border border-transparent text-zinc-800 dark:text-zinc-200"
                          }
                        `}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-none bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                              {ormawa.type}
                            </span>
                            <span className="text-xs font-bold truncate">
                              {ormawa.short_name}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {ormawa.name}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="size-4 text-primary shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Footer with link to full workspace page */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2.5 px-4 flex items-center justify-between text-xs">
            <Link
              href="/dashboard/workspace"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 font-semibold text-zinc-600 dark:text-zinc-400 hover:text-primary transition-colors"
            >
              <span>Semua Ruang Kerja</span>
              <ExternalLink className="size-3" />
            </Link>
            <span className="text-[10px] text-zinc-400">Multi-tenant</span>
          </div>
        </div>
      )}
    </div>
  );
}
