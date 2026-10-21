"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { USER_ROLE_LABELS } from "@/lib/roles";
import { Camera, CheckCircle2, XCircle, Loader2, UploadCloud, User } from "lucide-react";

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
    `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name || "User")}&background=f4f4f4&color=242424&bold=true&rounded=true&size=128`;

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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const profileRows = [
    ["Nama Lengkap", userProfile.name],
    ["Alamat Email", userProfile.email || user?.email || "-"],
    ["Nomor WhatsApp", userProfile.whatsapp_number],
    ["Peran (Role)", USER_ROLE_LABELS[userProfile.role]],
    [
      "Divisi",
      divisionLabels[userProfile.division_id] ?? userProfile.division_id,
    ],
    ["Status Akun", userProfile.is_active ? "Aktif" : "Nonaktif"],
    ["Tanggal Bergabung", formatDate(userProfile.created_at)],
  ];

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full pb-16">
      {/* Toast */}
      {toast && (
        <div
          className={`
            fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-xl shadow-lg border
            px-4 py-3 min-w-[260px] max-w-xs bg-white animate-in slide-in-from-right-5 fade-in duration-200
            ${toast.type === "success" ? "border-emerald-200" : "border-red-200"}
          `}
        >
          {toast.type === "success"
            ? <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
            : <XCircle className="size-4 text-red-500 mt-0.5 shrink-0" />}
          <div>
            <p className="text-xs font-bold text-[#242424]">
              {toast.type === "success" ? "Berhasil" : "Gagal"}
            </p>
            <p className="text-xs text-[#898989] mt-0.5">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Header Section */}
      <header className="pb-3 border-b border-[#e1e2e3]">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#242424]">
          Profil Pengguna
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[#898989]">
          Informasi identitas akun dan hak akses peran yang tersimpan dalam sistem JobDex.in.
        </p>
      </header>

      {/* Main Profile Card */}
      <div className="rounded-xl border border-[#e1e2e3] bg-white shadow-2xs overflow-hidden">
        {/* Card Header: Avatar & Quick Actions */}
        <div className="p-5 sm:p-6 border-b border-[#e1e2e3]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Avatar with hover upload overlay */}
            <div className="relative group shrink-0 size-16">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayAvatar}
                alt={userProfile.name}
                className="size-16 rounded-full border border-[#e1e2e3] shadow-xs object-cover bg-[#f7f7f8]"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="
                  absolute inset-0 flex items-center justify-center rounded-full
                  bg-black/0 group-hover:bg-black/50
                  transition-all duration-200
                  text-white opacity-0 group-hover:opacity-100
                  disabled:cursor-not-allowed cursor-pointer
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
              <h2 className="text-base sm:text-lg font-bold text-[#242424]">
                {userProfile.name || "Nama Pengguna"}
              </h2>
              <p className="text-xs text-[#898989] mt-0.5">
                {userProfile.email || user?.email || "Email belum disetel"} • {USER_ROLE_LABELS[userProfile.role]}
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-xs font-semibold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <Camera className="size-3 text-[#898989]" />
                  <span>{uploading ? "Mengupload..." : "Ganti Foto"}</span>
                </button>
                <Link
                  href="/dashboard/profile/avatar"
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-xs font-semibold transition-all shadow-2xs"
                >
                  <UploadCloud className="size-3 text-[#898989]" />
                  <span>Pengaturan Avatar</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Card Body: Key-Value Rows */}
        <div className="p-5 sm:p-6">
          <dl className="divide-y divide-[#e1e2e3]">
            {profileRows.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 py-3.5 sm:grid-cols-[200px_1fr] sm:gap-4 items-center"
              >
                <dt className="text-xs font-semibold text-[#898989] uppercase tracking-wider">
                  {label}
                </dt>
                <dd className="text-xs sm:text-sm font-semibold text-[#242424]">
                  {label === "Status Akun" ? (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        userProfile.is_active
                          ? "bg-[#e8f7f0] text-[#19a874] border border-[#a3e6cd]"
                          : "bg-[#feebe8] text-[#e94235] border border-[#fecaca]"
                      }`}
                    >
                      {value}
                    </span>
                  ) : label === "Peran (Role)" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#f7f7f8] text-[#242424] border border-[#e1e2e3]">
                      {value}
                    </span>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
