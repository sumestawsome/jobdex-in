"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { USER_ROLE_OPTIONS } from "@/lib/roles";
import { X, Save } from "lucide-react";
import {
  isValidWhatsAppNumber,
  normalizeWhatsAppNumber,
} from "@/lib/whatsapp";
import type { MemberUpdateInput, UserProfile, UserRole, Division } from "@/types";

type MemberEditDialogProps = {
  member: UserProfile | null;
  currentUserProfile: UserProfile;
  onClose: () => void;
  onSave: (memberId: string, input: MemberUpdateInput) => Promise<void>;
  divisions?: Division[];
};

type MemberEditFormProps = {
  member: UserProfile;
  currentUserProfile: UserProfile;
  onClose: () => void;
  onSave: (memberId: string, input: MemberUpdateInput) => Promise<void>;
  divisions?: Division[];
};

const selectClassName =
  "h-11 w-full rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition-colors focus:border-zinc-900 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-900/10 dark:focus:ring-zinc-700/50 shadow-none disabled:bg-zinc-100 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 [&>option]:bg-white [&>option]:text-zinc-900 dark:[&>option]:bg-zinc-900 dark:[&>option]:text-zinc-100";

export function MemberEditDialog({
  member,
  currentUserProfile,
  onClose,
  onSave,
  divisions,
}: MemberEditDialogProps) {
  if (!member) {
    return null;
  }

  return (
    <MemberEditForm
      key={member.id}
      member={member}
      currentUserProfile={currentUserProfile}
      onClose={onClose}
      onSave={onSave}
      divisions={divisions}
    />
  );
}

function MemberEditForm({
  member,
  currentUserProfile,
  onClose,
  onSave,
  divisions,
}: MemberEditFormProps) {
  const [name, setName] = useState(member.name ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(
    member.whatsapp_number ?? "",
  );
  const [whatsappCommandPin, setWhatsappCommandPin] = useState(
    member.whatsapp_command_pin ?? "",
  );
  const [role, setRole] = useState<UserRole>(member.role ?? "anggota");
  const [divisionId, setDivisionId] = useState(
    member.division_id || "humas_media_kreatif",
  );
  const [isActive, setIsActive] = useState(Boolean(member.is_active));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canEditRole = currentUserProfile.role === "super_admin";
  const isSelf = member.id === currentUserProfile.id;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const normalizedWhatsapp = normalizeWhatsAppNumber(whatsappNumber);

    if (!trimmedName) {
      setError("Nama wajib diisi.");
      return;
    }

    if (!isValidWhatsAppNumber(normalizedWhatsapp)) {
      setError("Nomor WhatsApp wajib dan gunakan format 08xx, 628xx, atau +628xx.");
      return;
    }

    if (!divisionId.trim()) {
      setError("Divisi wajib diisi.");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave(member.id, {
        name: trimmedName,
        whatsapp_number: normalizedWhatsapp,
        role,
        division_id: divisionId.trim(),
        is_active: isSelf ? true : isActive,
        whatsapp_command_pin: whatsappCommandPin.trim(),
      });
      onClose();
    } catch {
      setError("Gagal menyimpan perubahan anggota.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-xs px-4 py-8">
      <div className="w-full max-w-2xl rounded-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-none">
        <div className="border-b border-zinc-200 dark:border-zinc-800 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Edit Anggota</h2>
              <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">{member.email}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="rounded-none shadow-none">
              <X className="h-4 w-4" />
              <span>Tutup</span>
            </Button>
          </div>
        </div>

        <form className="grid gap-4 p-5" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="member-name"
              className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nama
            </label>
            <Input
              id="member-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-none shadow-none"
            />
          </div>

          <div>
            <label
              htmlFor="member-whatsapp"
              className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nomor WhatsApp
            </label>
            <Input
              id="member-whatsapp"
              value={whatsappNumber}
              onChange={(event) => setWhatsappNumber(event.target.value)}
              placeholder="08xxxxxxxxxx"
              className="rounded-none shadow-none"
            />
          </div>

          <div>
            <label
              htmlFor="member-whatsapp-pin"
              className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              PIN Perintah WhatsApp (6 Digit)
            </label>
            <Input
              id="member-whatsapp-pin"
              value={whatsappCommandPin}
              onChange={(event) => setWhatsappCommandPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Contoh: 123456"
              maxLength={6}
              className="rounded-none shadow-none"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Digunakan untuk memvalidasi eksekusi perintah WhatsApp group (Fase 12C).
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="member-role"
                className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Role
              </label>
              <select
                id="member-role"
                className={selectClassName}
                value={role}
                disabled={!canEditRole}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                {USER_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {!canEditRole ? (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Koordinator divisi tidak dapat mengubah role pada fase ini.
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="member-division"
                className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Divisi
              </label>
              <select
                id="member-division"
                className={selectClassName}
                value={divisionId}
                onChange={(event) => setDivisionId(event.target.value)}
              >
                {divisions && divisions.length > 0 ? (
                  divisions.map((div) => (
                    <option key={div.id} value={div.id}>
                      {div.name}
                    </option>
                  ))
                ) : (
                  <option value="humas_media_kreatif">Humas dan Media Kreatif</option>
                )}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-none border border-zinc-200 dark:border-zinc-800 p-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={isSelf ? true : isActive}
              disabled={isSelf}
              onChange={(event) => setIsActive(event.target.checked)}
              className="rounded-none"
            />
            <span>Akun aktif</span>
          </label>
          {isSelf ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Untuk mencegah terkunci, akun sendiri tidak dapat dinonaktifkan
              dari UI ini.
            </p>
          ) : null}

          {error ? (
            <p className="rounded-none bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200 border border-red-200 dark:border-red-900 shadow-none">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} className="rounded-none shadow-none">
              <X className="h-4 w-4" />
              <span>Batal</span>
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="rounded-none shadow-none">
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? "Menyimpan..." : "Simpan perubahan"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
