"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { USER_ROLE_LABELS } from "@/lib/roles";
import { Camera, CheckCircle2, XCircle, Loader2, UploadCloud } from "lucide-react";

const divisionLabels: Record<string, string> = {
  humas_media_kreatif: "Humas dan Media Kreatif",
};

function formatDate(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return "-";
  }

  const date = (value as { toDate: () => Date }).toDate();
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
  }).format(date);
}

type ToastState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

export default function ProfilePage() {
  const { user, userProfile, reloadUserProfile } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!userProfile) {
    return null;
  }

  const displayAvatar =
    avatarUrl ||
    userProfile.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name || "User")}&background=95bdff&color=1a1a1a&bold=true&rounded=true&size=128`;

  function showToast(state: ToastState) {
    setToast(state);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate client-side
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      showToast({ type: "error", message: "Format tidak didukung. Gunakan JPEG, PNG, atau WebP." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast({ type: "error", message: "File terlalu besar. Maksimal 5 MB." });
      return;
    }

    setUploading(true);
    setToast(null);

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = (await response.json()) as { avatar_url?: string; error?: string };

      if (!response.ok || !result.avatar_url) {
        throw new Error(result.error ?? "Gagal mengupload foto.");
      }

      setAvatarUrl(result.avatar_url);
      await reloadUserProfile();
      showToast({ type: "success", message: "Foto profil berhasil diperbarui." });
    } catch (err) {
      showToast({
        type: "error",
        message: err instanceof Error ? err.message : "Gagal mengupload foto.",
      });
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const profileRows = [
    ["Nama lengkap", userProfile.name],
    ["Email", userProfile.email || user?.email || "-"],
    ["Nomor WhatsApp", userProfile.whatsapp_number],
    ["Role", USER_ROLE_LABELS[userProfile.role]],
    [
      "Divisi",
      divisionLabels[userProfile.division_id] ?? userProfile.division_id,
    ],
    ["Status akun", userProfile.is_active ? "Aktif" : "Nonaktif"],
    ["Tanggal bergabung", formatDate(userProfile.created_at)],
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className={`
            fixed bottom-6 right-4 z-50 flex items-start gap-3 rounded-xl shadow-lg border
            px-4 py-3 min-w-[260px] max-w-xs bg-white animate-in slide-in-from-right-5 fade-in duration-200
            ${toast.type === "success" ? "border-emerald-200" : "border-red-200"}
          `}
        >
          {toast.type === "success"
            ? <CheckCircle2 className="size-5 text-emerald-500 mt-0.5 shrink-0" />
            : <XCircle className="size-5 text-red-500 mt-0.5 shrink-0" />}
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {toast.type === "success" ? "Berhasil" : "Gagal"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{toast.message}</p>
          </div>
        </div>
      )}

      <section>
        <Badge variant="info">Profil</Badge>
        <h1 className="mt-3 text-3xl font-bold text-neutral-900 dark:text-white">
          Profil anggota
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Data dasar akun yang tersimpan di Firestore collection users.
        </p>
      </section>

      <Card>
        <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            {/* Avatar with upload overlay */}
            <div className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayAvatar}
                alt={userProfile.name}
                className="size-16 rounded-full border-2 border-slate-200 dark:border-slate-700 shadow-sm object-cover"
              />
              {/* Upload button overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="
                  absolute inset-0 flex items-center justify-center rounded-full
                  bg-black/0 group-hover:bg-black/40
                  transition-all duration-200
                  text-white opacity-0 group-hover:opacity-100
                  disabled:cursor-not-allowed
                "
                title="Ganti foto profil"
              >
                {uploading
                  ? <Loader2 className="size-5 animate-spin" />
                  : <Camera className="size-5" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-bold text-neutral-900 dark:text-white">
                Informasi Akun
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verifikasi data divisi &amp; otorisasi peran
              </p>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs font-medium text-sky-600 hover:text-sky-700 disabled:opacity-50 transition-colors"
                >
                  {uploading ? "Mengupload..." : "Ganti cepat"}
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <Link
                  href="/dashboard/profile/avatar"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <UploadCloud className="size-3.5" />
                  <span>Halaman Unggah Avatar</span>
                </Link>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <dl className="divide-y divide-dashed divide-neutral-200 dark:divide-neutral-800">
            {profileRows.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-4 align-middle"
              >
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</dt>
                <dd className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
