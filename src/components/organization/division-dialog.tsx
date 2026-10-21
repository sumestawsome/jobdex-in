"use client";

import { useState, type FormEvent } from "react";
import { X, Layers, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface DivisionItem {
  id: string;
  name: string;
  description: string;
}

type DivisionDialogProps = {
  open: boolean;
  division: DivisionItem | null;
  onClose: () => void;
  onSave: (division: DivisionItem) => void;
  existingDivisions: DivisionItem[];
  ormawaName: string;
};

export function DivisionDialog({
  open,
  division,
  onClose,
  onSave,
  existingDivisions,
  ormawaName,
}: DivisionDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevDivisionId, setPrevDivisionId] = useState(division?.id);

  // Sync state during render when dialog opens or editing division changes
  if (open !== prevOpen || division?.id !== prevDivisionId) {
    setPrevOpen(open);
    setPrevDivisionId(division?.id);
    if (open) {
      setName(division?.name ?? "");
      setDescription(division?.description ?? "");
      setError("");
    }
  }

  if (!open) return null;

  const isEdit = Boolean(division?.id);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Nama divisi pokok wajib diisi.");
      return;
    }

    // Check duplicate name excluding current division if editing
    const isDuplicate = existingDivisions.some(
      (d) =>
        d.id !== division?.id &&
        d.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      setError(`Divisi "${trimmedName}" sudah ada di ormawa ini.`);
      return;
    }

    setIsSubmitting(true);

    const savedDivision: DivisionItem = {
      id: division?.id || `div-${Date.now()}`,
      name: trimmedName,
      description: description.trim() || "Divisi standar operasional dan kepanitiaan.",
    };

    onSave(savedDivision);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-[#e1e2e3] bg-white shadow-2xl p-6">
        {/* Close button */}
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
            <Layers className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#242424]">
              {isEdit ? "Ubah Divisi Pokok" : "Tambah Divisi Pokok"}
            </h2>
            <p className="text-xs text-[#898989]">
              {ormawaName}
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

          <div>
            <label className="block text-xs font-semibold text-[#242424] mb-1">
              Nama Divisi Pokok <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="Contoh: Publikasi & Dokumentasi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="border-[#e1e2e3] focus:border-[#242424] focus:ring-1 focus:ring-[#242424]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#242424] mb-1">
              Deskripsi Fungsi / Cakupan Kerja
            </label>
            <textarea
              rows={3}
              placeholder="Tuliskan cakupan tugas dan tanggung jawab pokok divisi..."
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
              <span>{isEdit ? "Simpan Perubahan" : "Tambahkan Divisi"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
