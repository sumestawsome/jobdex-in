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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1a1a1d] border border-[#e1e2e3] dark:border-[#2e2e32] rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[#e1e2e3] dark:border-[#2e2e32] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="size-9 rounded-xl bg-[#242424] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Building2 className="size-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#242424] dark:text-white">
                Buat Ruang Kerja Baru
              </h2>
              <p className="text-xs text-[#6b7280] dark:text-[#a0a0a5]">
                Daftarkan organisasi, himpunan, atau kepanitiaan baru.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-lg border border-[#e1e2e3] dark:border-[#2e2e32] flex items-center justify-center text-[#6b7280] hover:text-[#242424] hover:bg-[#f8f9fa] dark:hover:bg-[#252528] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-xs font-semibold rounded-lg bg-[#feebe8] text-[#e94235] border border-[#fecaca]">
              {error}
            </div>
          )}

          {/* 1. Nama Organisasi / Kepanitiaan */}
          <div>
            <label className="block text-xs font-semibold text-[#242424] dark:text-[#ededed] mb-1.5">
              Nama Organisasi / Kepanitiaan <span className="text-[#e94235]">*</span>
            </label>
            <input
              type="text"
              placeholder="misal: BEM Fakultas Teknik 2026 / Panitia Makrab"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#e1e2e3] dark:border-[#2e2e32] bg-white dark:bg-[#1a1a1d] text-[#242424] dark:text-white placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#242424]/10 shadow-2xs"
            />
          </div>

          {/* 2. Singkatan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#242424] dark:text-[#ededed] mb-1.5">
                Singkatan Ruang Kerja <span className="text-[#e94235]">*</span>
              </label>
              <input
                type="text"
                placeholder="misal: BEM FT / MAKRAB"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#e1e2e3] dark:border-[#2e2e32] bg-white dark:bg-[#1a1a1d] text-[#242424] dark:text-white placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#242424]/10 shadow-2xs uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#242424] dark:text-[#ededed] mb-1.5">
                Tipe Ruang Kerja <span className="text-[#e94235]">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as OrmawaType)}
                className="w-full h-10 px-3 text-xs font-medium rounded-xl border border-[#e1e2e3] dark:border-[#2e2e32] bg-white dark:bg-[#1a1a1d] text-[#242424] dark:text-white outline-none focus:ring-2 focus:ring-[#242424]/10 shadow-2xs cursor-pointer"
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
            <label className="block text-xs font-semibold text-[#242424] dark:text-[#ededed] mb-1.5">
              Asal Kampus / Institusi <span className="text-[#e94235]">*</span>
            </label>
            <select
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              className="w-full h-10 px-3 text-xs font-medium rounded-xl border border-[#e1e2e3] dark:border-[#2e2e32] bg-white dark:bg-[#1a1a1d] text-[#242424] dark:text-white outline-none focus:ring-2 focus:ring-[#242424]/10 shadow-2xs cursor-pointer"
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
            <label className="block text-xs font-semibold text-[#242424] dark:text-[#ededed] mb-1.5">
              Pilihan Divisi Awal
            </label>
            <p className="text-[11px] text-[#6b7280] dark:text-[#a0a0a5] mb-2">
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
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      isChecked
                        ? "border-[#242424] dark:border-white bg-[#f7f7f8] dark:bg-[#222226] text-[#242424] dark:text-white font-semibold"
                        : "border-[#e1e2e3] dark:border-[#2e2e32] text-[#6b7280] dark:text-[#a0a0a5] hover:border-[#b0b2b5]"
                    }`}
                  >
                    <span>{div}</span>
                    <span
                      className={`size-4 rounded-md border flex items-center justify-center ${
                        isChecked
                          ? "border-[#242424] bg-[#242424] text-white"
                          : "border-[#e1e2e3] bg-white"
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
            <label className="block text-xs font-semibold text-[#242424] dark:text-[#ededed] mb-1.5">
              Deskripsi Singkat (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Keterangan singkat tentang lingkup kerja organisasi ini..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 text-xs rounded-xl border border-[#e1e2e3] dark:border-[#2e2e32] bg-white dark:bg-[#1a1a1d] text-[#242424] dark:text-white placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#242424]/10 shadow-2xs resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#e1e2e3] dark:border-[#2e2e32] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#e1e2e3] dark:border-[#2e2e32] bg-white dark:bg-[#1a1a1d] text-[#242424] dark:text-[#ededed] hover:bg-[#f8f9fa] dark:hover:bg-[#252528] shadow-2xs transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#242424] hover:bg-[#141414] text-white shadow-2xs transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
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
