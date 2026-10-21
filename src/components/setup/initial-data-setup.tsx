"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, Database, Sparkles } from "lucide-react";
import {
  ensureInitialData,
  getInitialSetupStatus,
  type InitialSetupStatus,
} from "@/lib/setup";

export function InitialDataSetup() {
  const [status, setStatus] = useState<InitialSetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStatus() {
    setLoading(true);
    setError("");

    try {
      const setupStatus = await getInitialSetupStatus();
      setStatus(setupStatus);
    } catch {
      setError("Gagal membaca status setup. Periksa Firestore Rules.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInitialData() {
    setIsCreating(true);
    setError("");
    setMessage("");

    try {
      const setupStatus = await ensureInitialData();
      setStatus(setupStatus);
      setMessage("Data awal JobDex.in berhasil dibuat atau sudah tersedia.");
    } catch {
      setError("Gagal membuat data awal. Pastikan role Anda super_admin dan rules sudah dipasang.");
    } finally {
      setIsCreating(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadStatus);
  }, []);

  const orgDone = Boolean(status?.organizationExists);
  const divDone = Boolean(status?.divisionExists);
  const completedCount = (orgDone ? 1 : 0) + (divDone ? 1 : 0);
  const percent = loading ? 0 : Math.round((completedCount / 2) * 100);
  const setupReady = orgDone && divDone;

  return (
    <div className="rounded-2xl border border-[#e1e2e3] bg-white p-6 md:p-8 shadow-xs space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#e1e2e3] bg-[#f7f7f8] px-2.5 py-0.5 text-xs font-medium text-[#242424] mb-2">
            <Database className="size-3.5 text-[#242424]" />
            <span>Dokumen Database & Firestore</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#242424]">
            Checklist Inisialisasi Data Dasar
          </h2>
          <p className="mt-1 text-sm text-[#898989]">
            Verifikasi dan pastikan dokumen organisasi default dan koleksi divisi siap dipakai.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadStatus}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e1e2e3] bg-white px-3 py-2 text-xs font-medium text-[#242424] hover:bg-[#f7f7f8] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Cek Ulang</span>
          </button>
          <button
            type="button"
            onClick={handleCreateInitialData}
            disabled={isCreating || setupReady || loading}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition-colors cursor-pointer ${
              setupReady
                ? "bg-[#f7f7f8] text-[#898989] border border-[#e1e2e3] cursor-not-allowed"
                : "bg-[#242424] hover:bg-[#141414] text-white shadow-xs"
            }`}
          >
            {isCreating ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                <span>Memproses Data...</span>
              </>
            ) : setupReady ? (
              <>
                <CheckCircle2 className="size-3.5 text-[#1e7e34]" />
                <span>Data Dasar Lengkap</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5 text-white" />
                <span>Inisialisasi Otomatis</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Minimal Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-[#242424]">Status Kelengkapan Firestore</span>
          <span className="font-semibold text-[#242424]">{percent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#f4f4f4] border border-[#e1e2e3]/60">
          <div
            className="h-full bg-[#242424] transition-all duration-500 rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {message ? (
        <div className="flex items-center gap-2 rounded-xl border border-[#d1f2d9] bg-[#eefcf2] px-3.5 py-2.5 text-xs text-[#1e7e34]">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{message}</span>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Checklist Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start justify-between rounded-xl border border-[#e1e2e3] bg-[#fbfbfb] p-4 transition-colors hover:bg-white">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-[#242424]">
                organizations/main_org
              </span>
            </div>
            <p className="text-xs text-[#898989]">
              Dokumen organisasi default untuk instance JobDex.in.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
              orgDone
                ? "bg-[#eefcf2] text-[#1e7e34] border-[#d1f2d9]"
                : "bg-[#fef9ee] text-[#b54708] border-[#fdeecd]"
            }`}
          >
            {orgDone ? (
              <>
                <CheckCircle2 className="size-3" />
                <span>Terpasang</span>
              </>
            ) : (
              <span>Belum Ada</span>
            )}
          </span>
        </div>

        <div className="flex items-start justify-between rounded-xl border border-[#e1e2e3] bg-[#fbfbfb] p-4 transition-colors hover:bg-white">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-[#242424]">
                divisions/humas_media_kreatif
              </span>
            </div>
            <p className="text-xs text-[#898989]">
              Dokumen divisi default Humas dan Media Kreatif.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
              divDone
                ? "bg-[#eefcf2] text-[#1e7e34] border-[#d1f2d9]"
                : "bg-[#fef9ee] text-[#b54708] border-[#fdeecd]"
            }`}
          >
            {divDone ? (
              <>
                <CheckCircle2 className="size-3" />
                <span>Terpasang</span>
              </>
            ) : (
              <span>Belum Ada</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
