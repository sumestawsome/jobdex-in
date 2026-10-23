"use client";

import { useState } from "react";
import { Building2, X, Plus, Check } from "lucide-react";
import type { Campus, OrmawaType } from "@/types/workspace";

type CreateWorkspaceDialogProps = {
  open: boolean;
  onClose: () => void;
  campuses: Campus[];
  defaultCampusId?: string;
  onCreated: (newOrmawa: {
    id: string;
    campus_id: string;
    name: string;
    short_name: string;
    type: OrmawaType;
    description: string;
    divisions: string[];
  }) => void;
};

const DEFAULT_DIVISION_OPTIONS = [
  "Publikasi & Dokumentasi (Pubdok)",
  "Acara & Kreatif",
  "Humas & Kemitraan",
  "Logistik & Perlengkapan",
  "Sekretariat & Administrasi",
];

export function CreateWorkspaceDialog({
  open,
  onClose,
  campuses,
  defaultCampusId,
  onCreated,
}: CreateWorkspaceDialogProps) {
  const [campusId, setCampusId] = useState<string>(defaultCampusId || campuses[0]?.id || "");
  const [type, setType] = useState<OrmawaType>("BEM");
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([
    "Publikasi & Dokumentasi (Pubdok)",
    "Acara & Kreatif",
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const toggleDivision = (div: string) => {
    setSelectedDivisions((prev) =>
      prev.includes(div) ? prev.filter((d) => d !== div) : [...prev, div]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama organisasi atau kepanitiaan wajib diisi.");
      return;
    }
    if (!shortName.trim()) {
      setError("Singkatan nama ruang kerja wajib diisi.");
      return;
    }
    if (!campusId) {
      setError("Pilih kampus / institusi induk.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const cleanShort = shortName.trim().toUpperCase();
      const generatedId = `org-${cleanShort.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}`;

      onCreated({
        id: generatedId,
        campus_id: campusId,
        name: name.trim(),
        short_name: cleanShort,
        type,
        description: description.trim() || `Ruang kerja ${cleanShort} di lingkungan kampus.`,
        divisions: selectedDivisions,
      });

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal membuat ruang kerja baru.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-none overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="size-9 rounded-none bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center shrink-0 shadow-none">
              <Building2 className="size-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Buat Ruang Kerja Baru
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Daftarkan organisasi, himpunan, atau kepanitiaan baru.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-none border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-xs font-semibold rounded-none bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60">
              {error}
            </div>
          )}

          {/* 1. Nama Organisasi / Kepanitiaan */}
          <div>
            <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-200 mb-1.5">
              Nama Organisasi / Kepanitiaan <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="misal: BEM Fakultas Teknik 2026 / Panitia Makrab"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3.5 text-xs rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 shadow-none"
            />
          </div>

          {/* 2. Singkatan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-200 mb-1.5">
                Singkatan Ruang Kerja <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="misal: BEM FT / MAKRAB"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                className="w-full h-10 px-3.5 text-xs rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 shadow-none uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-200 mb-1.5">
                Tipe Ruang Kerja <span className="text-rose-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as OrmawaType)}
                className="w-full h-10 px-3 text-xs font-medium rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 shadow-none cursor-pointer"
              >
                <option value="BEM">BEM (Badan Eksekutif)</option>
                <option value="DPM">DPM (Dewan Perwakilan)</option>
                <option value="HMJ">HMJ (Himpunan Jurusan)</option>
                <option value="UKM">UKM (Unit Kegiatan)</option>
                <option value="LAINNYA">Kepanitiaan / Lainnya</option>
              </select>
            </div>
          </div>

          {/* 3. Asal Kampus / Institusi */}
          <div>
            <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-200 mb-1.5">
              Asal Kampus / Institusi <span className="text-rose-500">*</span>
            </label>
            <select
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              className="w-full h-10 px-3 text-xs font-medium rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 shadow-none cursor-pointer"
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* 4. Pilihan Divisi Awal */}
          <div>
            <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-200 mb-1.5">
              Pilihan Divisi Awal
            </label>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">
              Pilih divisi yang akan otomatis dibuatkan untuk ruang kerja ini:
            </p>
            <div className="space-y-1.5">
              {DEFAULT_DIVISION_OPTIONS.map((div) => {
                const isChecked = selectedDivisions.includes(div);
                return (
                  <button
                    key={div}
                    type="button"
                    onClick={() => toggleDivision(div)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-none border text-left text-xs transition-all cursor-pointer ${
                      isChecked
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
                    }`}
                  >
                    <span>{div}</span>
                    <span
                      className={`size-4 rounded-none border flex items-center justify-center ${
                        isChecked
                          ? "border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100 text-white dark:text-zinc-900"
                          : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      }`}
                    >
                      {isChecked && <Check className="size-3 stroke-[3]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Deskripsi */}
          <div>
            <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-200 mb-1.5">
              Deskripsi Singkat (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Keterangan singkat tentang lingkup kerja organisasi ini..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 text-xs rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 shadow-none resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-none transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold rounded-none bg-indigo-600 hover:bg-indigo-500 text-white shadow-none transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              <span>{submitting ? "Menyimpan..." : "+ Daftarkan Ruang Kerja"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
