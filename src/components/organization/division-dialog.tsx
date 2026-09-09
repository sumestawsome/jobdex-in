"use client";

import { useState, useEffect, type FormEvent } from "react";
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

  useEffect(() => {
    if (open) {
      setName(division?.name ?? "");
      setDescription(division?.description ?? "");
      setError("");
    }
  }, [open, division]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="size-4" />
        </button>

        {/* Dialog Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
            <Layers className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isEdit ? "Ubah Divisi Pokok" : "Tambah Divisi Pokok"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {ormawaName}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 p-3 text-xs font-semibold text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nama Divisi Pokok <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="Contoh: Publikasi & Dokumentasi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Deskripsi Fungsi / Cakupan Kerja
            </label>
            <textarea
              rows={3}
              placeholder="Tuliskan cakupan tugas dan tanggung jawab pokok divisi..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-sky-600 hover:bg-sky-500 text-white"
            >
              <Save className="size-3.5 mr-1.5" />
              <span>{isEdit ? "Simpan Perubahan" : "Simpan Divisi"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
