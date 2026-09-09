"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Sparkles, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getDateFromValue } from "@/lib/date-utils";
import type { AILog } from "@/types";

export const DEFAULT_AI_DAILY_LIMIT = 20;

export function countUserQuestionsToday(logs: AILog[], userId?: string): number {
  if (!userId) return 0;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayTime = startOfToday.getTime();

  return logs.filter((log) => {
    if (log.asked_by !== userId) return false;
    const date = getDateFromValue(log.created_at);
    return date ? date.getTime() >= startOfTodayTime : false;
  }).length;
}

type AIQuotaWarningProps = {
  logs: AILog[];
  userId?: string;
  dailyLimit?: number;
  isRateLimited?: boolean;
  className?: string;
};

export function AIQuotaWarning({
  logs,
  userId,
  dailyLimit = DEFAULT_AI_DAILY_LIMIT,
  isRateLimited = false,
  className = "",
}: AIQuotaWarningProps) {
  const usedToday = useMemo(() => {
    return countUserQuestionsToday(logs, userId);
  }, [logs, userId]);

  const effectiveUsed = isRateLimited ? Math.max(usedToday, dailyLimit) : usedToday;
  const remaining = Math.max(0, dailyLimit - effectiveUsed);
  const isExhausted = effectiveUsed >= dailyLimit || isRateLimited;
  const isLow = !isExhausted && remaining <= 5;
  const percentUsed = Math.min(100, Math.round((effectiveUsed / dailyLimit) * 100));

  if (isExhausted) {
    return (
      <div
        className={`rounded-xl border-2 border-rose-500 bg-rose-50/90 dark:bg-rose-950/40 p-4 shadow-sm text-rose-950 dark:text-rose-200 transition-all ${className}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-rose-500 p-2 text-white shrink-0 shadow-sm mt-0.5">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-sm tracking-tight text-rose-900 dark:text-rose-100 flex items-center gap-1.5">
                <span>Kuota AI Harian Telah Habis</span>
                <Badge variant="error" className="text-[10px] uppercase font-bold tracking-wider">
                  0 / {dailyLimit} Tersisa
                </Badge>
              </h4>
              <span className="flex items-center gap-1 text-xs text-rose-700 dark:text-rose-300 font-medium">
                <Clock className="h-3.5 w-3.5" />
                Reset pukul 00:00
              </span>
            </div>

            <p className="mt-1 text-xs leading-relaxed text-rose-800 dark:text-rose-200">
              Anda telah mencapai batas maksimum <strong>{dailyLimit} pertanyaan</strong> hari ini.
              Sistem membatasi kuota harian untuk menjaga stabilitas layanan AI.
            </p>

            {/* Quota Progress Bar */}
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-rose-200 dark:bg-rose-900">
                <div
                  className="h-full bg-rose-600 transition-all duration-300 rounded-full"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 pt-1 border-t border-rose-200/80 dark:border-rose-900/60">
              <span className="text-xs text-rose-700 dark:text-rose-300">
                Butuh inspirasi desain atau panduan aset?
              </span>
              <Link
                href="/dashboard/references"
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-900 dark:text-rose-100 underline hover:no-underline transition-colors"
              >
                Katalog Referensi Desain
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLow) {
    return (
      <div
        className={`rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/30 p-3 shadow-xs text-amber-950 dark:text-amber-200 transition-all ${className}`}
        role="alert"
      >
        <div className="flex items-start gap-2.5">
          <div className="rounded-md bg-amber-500 p-1.5 text-white shrink-0 mt-0.5">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                <span>Peringatan Kuota AI Menipis</span>
                <Badge variant="warning" className="text-[10px] font-bold">
                  Sisa {remaining} Pertanyaan
                </Badge>
              </p>
              <span className="text-[11px] text-amber-800 dark:text-amber-300">
                {effectiveUsed} dari {dailyLimit} digunakan
              </span>
            </div>

            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
              Gunakan kuota tersisa secara optimal dengan mengajukan pertanyaan spesifik seputar tugas atau kegiatan.
            </p>

            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900">
              <div
                className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal Status Header / Indicator
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 text-xs text-slate-600 dark:text-slate-400 ${className}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-sky-500" />
        <span className="font-medium text-slate-800 dark:text-slate-200">
          Kuota Harian AI:
        </span>
        <span className="font-semibold text-slate-950 dark:text-slate-50">
          {remaining} tersisa
        </span>
        <span className="text-[11px] text-slate-400">
          ({effectiveUsed}/{dailyLimit})
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 hidden sm:block">
          <div
            className="h-full bg-sky-500 rounded-full transition-all duration-300"
            style={{ width: `${percentUsed}%` }}
          />
        </div>
        <Badge variant="success" className="text-[10px] py-0 px-1.5 font-normal">
          <ShieldCheck className="h-3 w-3 mr-0.5 inline" />
          Aktif
        </Badge>
      </div>
    </div>
  );
}
