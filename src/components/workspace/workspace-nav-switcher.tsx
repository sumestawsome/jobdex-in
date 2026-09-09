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
import type { Campus, Ormawa } from "@/types/workspace";

export function WorkspaceNavSwitcher() {
  const {
    activeWorkspace,
    activeCampus,
    activeOrmawa,
    campuses,
    getOrmawasByCampus,
    selectWorkspace,
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"campus" | "ormawa">("ormawa");
  const [tempSelectedCampus, setTempSelectedCampus] = useState<Campus>(activeCampus);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync temp campus with active campus when opened
  useEffect(() => {
    if (isOpen) {
      setTempSelectedCampus(activeCampus);
      setStep("ormawa");
      setSearchQuery("");
    }
  }, [isOpen, activeCampus]);

  // Handle click outside to close dropdown
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

  // Handle escape key
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

  const availableOrmawas = getOrmawasByCampus(tempSelectedCampus.id);
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
    selectWorkspace(tempSelectedCampus.id, ormawa.id);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`
          flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs
          ${
            isOpen
              ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 ring-2 ring-sky-500/20"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
          }
        `}
        title="Beralih Ruang Kerja Kampus & Ormawa"
      >
        <span className="flex size-5 items-center justify-center rounded-md bg-sky-600 text-white text-[10px] font-black shrink-0">
          {activeWorkspace.campus_code}
        </span>
        <div className="flex flex-col text-left leading-none max-w-[130px] sm:max-w-[170px]">
          <span className="truncate font-bold text-slate-900 dark:text-slate-100 text-xs">
            {activeOrmawa.short_name || activeWorkspace.org_name}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {activeWorkspace.campus_name}
          </span>
        </div>
        <ChevronDown
          className={`size-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-sky-500" : ""
          }`}
        />
      </button>

      {/* Cascading Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-2 duration-150">
          {/* Header Step Indicator */}
          <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Sparkles className="size-3.5 text-sky-500" />
                <span>Pilih Ruang Kerja</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
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
                    ? "text-sky-600 dark:text-sky-400"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <Building2 className="size-3" />
                <span>{tempSelectedCampus.code}</span>
              </button>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span
                className={`font-semibold ${
                  step === "ormawa"
                    ? "text-sky-600 dark:text-sky-400"
                    : "text-slate-400"
                }`}
              >
                {step === "ormawa" ? "Pilih Ormawa" : "Ormawa"}
              </span>
            </div>
          </div>

          {/* Step 1: Pilih Kampus */}
          {step === "campus" && (
            <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
                      w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer
                      ${
                        isCampusActive
                          ? "bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent"
                      }
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs shrink-0">
                        {campus.code}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {campus.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {campus.city} • {campus.ormawa_count} Ormawa
                        </p>
                      </div>
                    </div>
                    {isCampusActive && (
                      <Check className="size-4 text-sky-600 dark:text-sky-400 shrink-0 ml-2" />
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
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  <ArrowLeft className="size-3" />
                  Ganti Kampus ({tempSelectedCampus.code})
                </button>
                <span className="text-[10px] text-slate-400 font-medium">
                  {availableOrmawas.length} Ormawa
                </span>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="size-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={`Cari di ${tempSelectedCampus.code}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Ormawa List */}
              <div className="max-h-60 overflow-y-auto space-y-1 pt-1">
                {filteredOrmawas.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-400">
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
                          w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer
                          ${
                            isSelected
                              ? "bg-sky-50 dark:bg-sky-950/50 border border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent text-slate-800 dark:text-slate-200"
                          }
                        `}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-sm bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                              {ormawa.type}
                            </span>
                            <span className="text-xs font-bold truncate">
                              {ormawa.short_name}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {ormawa.name}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="size-4 text-sky-600 dark:text-sky-400 shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Footer with link to full workspace page */}
          <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-2.5 px-4 flex items-center justify-between text-xs">
            <Link
              href="/dashboard/workspace"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            >
              <span>Semua Ruang Kerja</span>
              <ExternalLink className="size-3" />
            </Link>
            <span className="text-[10px] text-slate-400">Multi-tenant</span>
          </div>
        </div>
      )}
    </div>
  );
}
