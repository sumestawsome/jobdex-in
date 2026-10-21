"use client";

import { useState, type FormEvent } from "react";
import { X, Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Campus, Ormawa, OrmawaType } from "@/types/workspace";

type AddOrmawaDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (ormawa: Ormawa) => void;
  campuses: Campus[];
  defaultCampusId: string;
  existingOrmawas: Ormawa[];
};

export function AddOrmawaDialog({
  open,
  onClose,
  onSave,
  campuses,
  defaultCampusId,
  existingOrmawas,
}: AddOrmawaDialogProps) {
  const [campusId, setCampusId] = useState(defaultCampusId);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [type, setType] = useState<OrmawaType>("HMJ");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  // Sync state during render when dialog opens (React 19 pattern to avoid effect cascades)
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setCampusId(defaultCampusId);
      setName("");
      setShortName("");
      setType("HMJ");
      setDescription("");
      setError("");
    }
  }

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!campusId) {
      setError("Pilih kampus terlebih dahulu.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Nama ormawa wajib diisi.");
      return;
    }

    const finalShortName = shortName.trim() || trimmedName.slice(0, 15);

    // Validate duplicate in the same campus
    const duplicate = existingOrmawas.some(
      (o) =>
        o.campus_id === campusId &&
        (o.name.toLowerCase() === trimmedName.toLowerCase() ||
          o.short_name.toLowerCase() === finalShortName.toLowerCase())
    );

    if (duplicate) {
      setError(
        `Ormawa "${trimmedName}" atau "${finalShortName}" sudah terdaftar di kampus ini.`
      );
      return;
    }

    setIsSubmitting(true);

    const ormawaId = `org-${campusId.replace("univ-", "")}-${type.toLowerCase()}-${Date.now()}`;
    const newOrmawa: Ormawa = {
      id: ormawaId,
      campus_id: campusId,
      campusId: campusId,
      univ_id: campusId,
      univId: campusId,
      org_id: ormawaId,
      orgId: ormawaId,
      name: trimmedName,
      short_name: finalShortName,
      type,
      description: description.trim() || `Organisasi kemahasiswaan tipe ${type} di lingkungan kampus.`,
      member_count: 1,
      active_event_count: 0,
      active_task_count: 0,
      is_active: true,
    };

    onSave(newOrmawa);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#e1e2e3] bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[#898989] hover:bg-[#f7f7f8] hover:text-[#242424] transition-colors"
        >
          <X className="size-4" />
        </button>

        {/* Dialog Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#f7f7f8] border border-[#e1e2e3] text-[#242424]">
            <Building2 className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#242424]">
              Tambah Ormawa Baru
            </h2>
            <p className="text-xs text-[#898989]">
              Daftarkan BEM, DPM, HMJ, atau UKM di bawah kampus pilihan.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* 1. Pilih Kampus */}
          <div>
            <label className="block text-xs font-semibold text-[#242424] mb-1">
              Kampus Induk <span className="text-red-500">*</span>
            </label>
            <select
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#e1e2e3] bg-white px-3 text-xs text-[#242424] focus:outline-hidden focus:border-[#242424] focus:ring-1 focus:ring-[#242424]"
              required
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Jenis Ormawa */}
          <div>
            <label className="block text-xs font-semibold text-[#242424] mb-1">
              Jenis Organisasi <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(["BEM", "DPM", "HMJ", "UKM", "LAINNYA"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer text-center ${
                    type === t
                      ? "border-[#242424] bg-[#242424] text-white shadow-2xs font-semibold"
                      : "border-[#e1e2e3] bg-white text-[#898989] hover:border-[#242424]/40 hover:text-[#242424]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Nama Lengkap */}
          <div>
            <label className="block text-xs font-semibold text-[#242424] mb-1">
              Nama Lengkap Ormawa <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="Contoh: Himpunan Mahasiswa Teknik Elektro"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="border-[#e1e2e3] focus:border-[#242424] focus:ring-1 focus:ring-[#242424]"
            />
          </div>

          {/* 4. Nama Singkat */}
          <div>
            <label className="block text-xs font-semibold text-[#242424] mb-1">
              Singkatan / Akronim
            </label>
            <Input
              type="text"
              placeholder="Contoh: HMTE"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              className="border-[#e1e2e3] focus:border-[#242424] focus:ring-1 focus:ring-[#242424]"
            />
          </div>

          {/* 5. Deskripsi */}
          <div>
            <label className="block text-xs font-semibold text-[#242424] mb-1">
              Deskripsi Singkat
            </label>
            <textarea
              rows={2}
              placeholder="Deskripsi peran dan fokus kegiatan ormawa..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[#e1e2e3] bg-white p-2.5 text-xs text-[#242424] placeholder:text-[#898989] focus:outline-hidden focus:border-[#242424] focus:ring-1 focus:ring-[#242424]"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-[#e1e2e3]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-[#e1e2e3] hover:bg-[#f7f7f8] text-[#242424]"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-[#242424] hover:bg-[#141414] text-white shadow-xs"
            >
              <Save className="size-3.5 mr-1.5" />
              <span>Simpan Ormawa</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
