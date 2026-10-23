"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { USER_ROLE_LABELS } from "@/lib/roles";
import { getDivisions } from "@/lib/firebase/divisions";
import { updateMember } from "@/lib/firebase/members";
import { auth, db } from "@/lib/firebase/client";
import { collection, getDocs, collectionGroup } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { showSuccess, showError } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Camera,
  CheckCircle2,
  XCircle,
  Loader2,
  UploadCloud,
  Lock,
  KeyRound,
  Briefcase,
  Calendar,
  MessageSquare,
  AlertCircle,
  Save,
  User,
  Shield,
  Smartphone,
} from "lucide-react";
import type { Division } from "@/types";

function formatDate(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return "-";
  }

  const date = (value as { toDate: () => Date }).toDate();
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
  }).format(date);
}

function getInitials(name?: string | null) {
  if (!name) return "JD";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "JD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type ToastState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

export default function ProfilePage() {
  const { user, userProfile, reloadUserProfile } = useAuth();
  const { activeWorkspace } = useWorkspace();

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile Form state
  const [nameInput, setNameInput] = useState("");
  const [whatsappInput, setWhatsappInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Security / Password Form state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Contextual Division & Event Roles
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [activeEventRoles, setActiveEventRoles] = useState<string[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  // Initialize form fields from profile
  useEffect(() => {
    if (userProfile) {
      setNameInput(userProfile.name || "");
      setWhatsappInput(userProfile.whatsapp_number || "");
    }
  }, [userProfile]);

  // Load Division info & Active Event Committee Roles
  const loadRolesAndContext = useCallback(async () => {
    if (!userProfile) return;
    setLoadingRoles(true);
    try {
      const [divsData, eventsSnap, eventMembersSnap] = await Promise.all([
        getDivisions(activeWorkspace.org_id, activeWorkspace.campus_id).catch(() => []),
        getDocs(collection(db, "events")).catch(() => null),
        getDocs(collectionGroup(db, "event_members")).catch(() => null),
      ]);

      setDivisions(divsData);

      if (eventsSnap && eventMembersSnap) {
        const activeEventsMap = new Map<string, string>();
        eventsSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.status !== "selesai") {
            activeEventsMap.set(d.id, data.name || "Acara Aktif");
          }
        });

        const userRoles: string[] = [];
        eventMembersSnap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const eventId = data.event_id || docSnap.ref.parent.parent?.id;
          const memberUserId = data.user_id || docSnap.id;

          if (memberUserId === userProfile.id && eventId && activeEventsMap.has(eventId)) {
            const eventName = activeEventsMap.get(eventId)!;
            let roleLabel = "Panitia";
            if (data.role_in_event === "koordinator_acara") roleLabel = "Koor Acara";
            else if (data.role_in_event === "sekretaris_acara") roleLabel = "Sekretaris";
            else if (data.role_in_event === "bendahara_acara") roleLabel = "Bendahara";
            else if (data.role_in_event && typeof data.role_in_event === "string") {
              roleLabel = data.role_in_event.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
            }
            userRoles.push(`${roleLabel} (${eventName})`);
          }
        });
        setActiveEventRoles(userRoles);
      }
    } catch (err) {
      console.warn("Gagal memuat peran kepanitiaan pengguna:", err);
    } finally {
      setLoadingRoles(false);
    }
  }, [userProfile, activeWorkspace.org_id, activeWorkspace.campus_id]);

  useEffect(() => {
    void loadRolesAndContext();
  }, [loadRolesAndContext]);

  if (!userProfile) {
    return null;
  }

  function showToast(state: ToastState) {
    setToast(state);
    setTimeout(() => setToast(null), 3500);
  }

  // Avatar upload handler
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

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

  // Profile update handler
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userProfile) return;

    const cleanName = nameInput.trim();
    const cleanWa = whatsappInput.trim().replace(/[^0-9]/g, "");

    if (!cleanName) {
      await showError("Nama lengkap tidak boleh kosong.", "Validasi Gagal");
      return;
    }

    if (!cleanWa || cleanWa.length < 9) {
      await showError("Nomor WhatsApp tidak valid. Masukkan nomor yang valid (contoh: 6287842247411).", "Validasi Gagal");
      return;
    }

    setSavingProfile(true);
    try {
      await updateMember(
        userProfile.id,
        {
          name: cleanName,
          whatsapp_number: cleanWa,
          division_id: userProfile.division_id,
          is_active: userProfile.is_active,
        },
        false
      );

      await reloadUserProfile();
      await showSuccess("Informasi profil Anda berhasil diperbarui!", "Profil Disimpan");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memperbarui profil.";
      await showError(msg, "Gagal Menyimpan");
    } finally {
      setSavingProfile(false);
    }
  }

  // Password change handler
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (!oldPassword) {
      await showError("Silakan masukkan password saat ini untuk verifikasi keamanan.", "Validasi Gagal");
      return;
    }

    if (newPassword.length < 6) {
      await showError("Password baru minimal harus terdiri dari 6 karakter.", "Validasi Gagal");
      return;
    }

    if (newPassword !== confirmPassword) {
      await showError("Konfirmasi password baru tidak cocok. Periksa kembali input Anda.", "Validasi Gagal");
      return;
    }

    if (!auth.currentUser || !auth.currentUser.email) {
      await showError("Sesi otentikasi tidak valid. Silakan muat ulang halaman atau login kembali.", "Error Otentikasi");
      return;
    }

    setChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await showSuccess("Password akun Anda telah berhasil diganti. Gunakan password baru ini untuk login berikutnya.", "Password Diperbarui");
    } catch (err: unknown) {
      let message = "Gagal memperbarui password.";
      if (err && typeof err === "object" && "code" in err) {
        const code = (err as { code: string }).code;
        if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
          message = "Password lama yang Anda masukkan tidak sesuai.";
        } else if (code === "auth/weak-password") {
          message = "Password baru terlalu lemah. Gunakan kombinasi huruf dan angka.";
        } else if (code === "auth/requires-recent-login") {
          message = "Sesi keamanan kedaluwarsa. Silakan keluar dan login kembali sebelum mengganti password.";
        }
      }
      await showError(message, "Ganti Password Gagal");
    } finally {
      setChangingPassword(false);
    }
  }

  // Display avatar & initials
  const currentPhoto = avatarUrl || userProfile.avatar_url;
  const userInitials = getInitials(userProfile.name);

  // Division Name
  const divisionObj = divisions.find((d) => d.id === userProfile.division_id);
  const divisionDisplayName = divisionObj?.name || userProfile.division_id.replace(/_/g, " ").toUpperCase();

  // WhatsApp Sync Status
  const isWhatsAppSynced = Boolean(
    userProfile.whatsapp_number &&
    userProfile.whatsapp_number.replace(/\D/g, "").length >= 9
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-16">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`
            fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-none shadow-none border
            px-4 py-3 min-w-[260px] max-w-xs bg-white dark:bg-zinc-900 animate-in slide-in-from-right-5 fade-in duration-200
            ${toast.type === "success" ? "border-emerald-500 text-emerald-900 dark:text-emerald-100" : "border-red-500 text-red-900 dark:text-red-100"}
          `}
        >
          {toast.type === "success"
            ? <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            : <XCircle className="size-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />}
          <div>
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              {toast.type === "success" ? "Berhasil" : "Gagal"}
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Header Section */}
      <header className="pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Profil Pengguna
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          Kelola informasi identitas akun, status sinkronisasi WhatsApp bot, peran divisi, dan keamanan kata sandi.
        </p>
      </header>

      {/* ── CARD 1: Identitas & Status Akun (Hero Card) ── */}
      <div className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            {/* Square Sharp Avatar Box with Initials Fallback */}
            <div className="relative group shrink-0 size-20 border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 rounded-none shadow-none overflow-hidden">
              {currentPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentPhoto}
                  alt={userProfile.name}
                  className="size-full object-cover rounded-none"
                />
              ) : (
                <div className="size-full flex items-center justify-center font-bold text-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-none tracking-wider">
                  {userInitials}
                </div>
              )}

              {/* Hover upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="
                  absolute inset-0 flex items-center justify-center rounded-none
                  bg-black/0 group-hover:bg-black/60
                  transition-all duration-150
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

            {/* User Meta & Action Badges */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {userProfile.name || "Nama Pengguna"}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {userProfile.email || user?.email || "Email belum disetel"} • ID: <span className="font-mono">{userProfile.id}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold transition-all shadow-none cursor-pointer disabled:opacity-50"
                  >
                    <Camera className="size-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span>{uploading ? "Mengupload..." : "Ganti Foto"}</span>
                  </button>
                  <Link
                    href="/dashboard/profile/avatar"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold transition-all shadow-none"
                  >
                    <UploadCloud className="size-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span>Pengaturan Avatar</span>
                  </Link>
                </div>
              </div>

              {/* Peran Divisi (Indigo) & Kepanitiaan Acara Aktif (Emerald) Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {/* Divisi Role Badge (Indigo Solid) */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-none shadow-none bg-indigo-600 text-white dark:bg-indigo-500">
                  <Briefcase className="size-3.5" />
                  <span>{USER_ROLE_LABELS[userProfile.role]} • {divisionDisplayName}</span>
                </span>

                {/* Kepanitiaan Acara Aktif Badge (Emerald Solid) */}
                {activeEventRoles.length > 0 ? (
                  activeEventRoles.map((roleText) => (
                    <span
                      key={roleText}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-none shadow-none bg-emerald-600 text-white dark:bg-emerald-500"
                    >
                      <Calendar className="size-3.5" />
                      <span>{roleText}</span>
                    </span>
                  ))
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-none shadow-none bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    <Calendar className="size-3.5 text-zinc-400" />
                    <span>{loadingRoles ? "Memeriksa kepanitiaan..." : "Tidak ada acara aktif"}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* WhatsApp Synchronization Indicator Banner */}
        <div className={`p-4 border-b rounded-none shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isWhatsAppSynced
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100"
            : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/80 text-amber-950 dark:text-amber-100"
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-1.5 rounded-none shrink-0 ${
              isWhatsAppSynced ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
            }`}>
              <Smartphone className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-bold">
                  {isWhatsAppSynced ? "Nomor WhatsApp Tersinkronisasi" : "Nomor WhatsApp Perlu Disinkronkan"}
                </h4>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-none font-bold uppercase ${
                  isWhatsAppSynced
                    ? "bg-emerald-200 dark:bg-emerald-800/60 text-emerald-900 dark:text-emerald-200"
                    : "bg-amber-200 dark:bg-amber-800/60 text-amber-900 dark:text-amber-200"
                }`}>
                  {isWhatsAppSynced ? "Aktif" : "Perlu Disetel"}
                </span>
              </div>
              <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
                Nomor: <span className="font-mono font-bold">{userProfile.whatsapp_number || "-"}</span>. Digunakan untuk otentikasi login, notifikasi tugas baru, reminder deadline otomatis, dan bot interaktif JobDex.in.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Details Table */}
        <div className="p-5 sm:p-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
              <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Status Akun
              </dt>
              <dd>
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-none ${
                  userProfile.is_active
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                    : "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800"
                }`}>
                  {userProfile.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </dd>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
              <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Tanggal Bergabung
              </dt>
              <dd className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {formatDate(userProfile.created_at)}
              </dd>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
              <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Divisi Kerja
              </dt>
              <dd className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {divisionDisplayName}
              </dd>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
              <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Peran Pengguna
              </dt>
              <dd className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {USER_ROLE_LABELS[userProfile.role]}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ── CARD 2: Form Ubah Informasi Profil ── */}
      <Card className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none">
        <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <CardTitle className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <User className="size-4 text-indigo-600 dark:text-indigo-400" />
            <span>Ubah Informasi Profil</span>
          </CardTitle>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Perbarui nama lengkap dan nomor WhatsApp yang digunakan untuk sinkronisasi notifikasi.
          </p>
        </CardHeader>

        <CardContent className="pt-5 sm:pt-6">
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Nama Lengkap
                </label>
                <Input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Masukkan nama lengkap Anda..."
                  className="rounded-none shadow-none border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm focus:border-indigo-600 dark:focus:border-indigo-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Nomor WhatsApp (Sinkronisasi Bot)
                </label>
                <Input
                  type="tel"
                  value={whatsappInput}
                  onChange={(e) => setWhatsappInput(e.target.value)}
                  placeholder="Contoh: 6287842247411"
                  className="rounded-none shadow-none font-mono border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm focus:border-indigo-600 dark:focus:border-indigo-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Alamat Email (Akun Login)
              </label>
              <Input
                type="email"
                value={userProfile.email || user?.email || ""}
                disabled
                className="rounded-none shadow-none border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 cursor-not-allowed text-xs sm:text-sm"
              />
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                Alamat email terikat pada kredensial login utama dan hanya dapat diubah oleh administrator sistem.
              </p>
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                type="submit"
                disabled={savingProfile}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-5 rounded-none shadow-none cursor-pointer flex items-center gap-1.5"
              >
                {savingProfile ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                <span>{savingProfile ? "Menyimpan Profil..." : "Simpan Profil"}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── CARD 3: Keamanan & Ganti Password ── */}
      <Card className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none">
        <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <CardTitle className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Lock className="size-4 text-zinc-900 dark:text-zinc-100" />
            <span>Keamanan Akun & Ganti Password</span>
          </CardTitle>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Ubah kata sandi akun Anda secara berkala untuk menjaga kerahasiaan hak akses.
          </p>
        </CardHeader>

        <CardContent className="pt-5 sm:pt-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                Password Lama
              </label>
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Masukkan password akun saat ini..."
                className="rounded-none shadow-none border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm focus:border-zinc-900 dark:focus:border-zinc-100"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Password Baru
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter..."
                  className="rounded-none shadow-none border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm focus:border-zinc-900 dark:focus:border-zinc-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Konfirmasi Password Baru
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru..."
                  className="rounded-none shadow-none border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm focus:border-zinc-900 dark:focus:border-zinc-100"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                type="submit"
                disabled={changingPassword}
                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-bold text-xs h-9 px-5 rounded-none shadow-none cursor-pointer flex items-center gap-1.5"
              >
                {changingPassword ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                <span>{changingPassword ? "Memperbarui Password..." : "Perbarui Password"}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
