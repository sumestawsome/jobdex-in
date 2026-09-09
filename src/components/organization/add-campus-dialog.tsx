"use client";

import { useState, type FormEvent } from "react";
import { X, Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Campus } from "@/types/workspace";

type AddCampusDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (campus: Campus) => void;
  existingCampuses: Campus[];
};

export function AddCampusDialog({
  open,
  onClose,
  onSave,
  existingCampuses,
}: AddCampusDialogProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Nama kampus wajib diisi.");
      return;
    }

    // Check duplicate name
    const isDuplicateName = existingCampuses.some(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicateName) {
      setError(`Kampus "${trimmedName}" sudah terdaftar sebelumnya.`);
      return;
    }

    // Generate or use code
    let finalCode = code.trim().toUpperCase();
    if (!finalCode) {
      finalCode = trimmedName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 5)
        .toUpperCase();
    }

    // Check duplicate code
    const isDuplicateCode = existingCampuses.some(
      (c) => c.code.toLowerCase() === finalCode.toLowerCase()
    );
    if (isDuplicateCode) {
      setError(`Kode singkatan "${finalCode}" sudah digunakan kampus lain.`);
      return;
    }

    setIsSubmitting(true);

    const newCampus: Campus = {
      id: `univ-${finalCode.toLowerCase()}-${Date.now()}`,
      name: trimmedName,
      code: finalCode,
      city: city.trim() || "Indonesia",
      ormawa_count: 0,
    };

    onSave(newCampus);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6">
        {/* Close Button */}
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
            <Building2 className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Tambah Kampus Baru
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daftarkan perguruan tinggi sebagai induk ormawa.
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
              Nama Kampus / Universitas <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="Contoh: Universitas Brawijaya"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Kode / Singkatan Kampus
            </label>
            <Input
              type="text"
              placeholder="Contoh: UB (Opsional, otomatis dari inisial)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Kota / Wilayah
            </label>
            <Input
              type="text"
              placeholder="Contoh: Malang, Jawa Timur"
              value={city}
              onChange={(e) => setCity(e.target.value)}
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
              <span>Simpan Kampus</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
