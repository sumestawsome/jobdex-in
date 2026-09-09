"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  UploadCloud,
  AlertCircle,
  CheckCircle2,
  Camera,
  FileImage,
  RefreshCw,
  Trash2,
  Info,
  ShieldAlert,
} from "lucide-react";

interface UploadErrorDetails {
  title: string;
  message: string;
  statusCode?: number;
  tip?: string;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function AvatarUploadPage() {
  const router = useRouter();
  const { user, userProfile, reloadUserProfile } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorDetails, setErrorDetails] = useState<UploadErrorDetails | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentAvatar =
    userProfile?.avatar_url ||
    (userProfile?.name
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name)}&background=95bdff&color=1a1a1a&bold=true&rounded=true&size=128`
      : "/default-avatar.png");

  const validateAndSelectFile = useCallback((selectedFile: File) => {
    setErrorDetails(null);
    setSuccess(false);

    // 1. Validasi Tipe File (MIME)
    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
      setErrorDetails({
        title: "Format File Tidak Didukung",
        message: `Format file "${selectedFile.type || "unknown"}" ditolak oleh sistem.`,
        tip: "Hanya gambar berformat JPG, PNG, atau WebP yang diperbolehkan.",
      });
      return false;
    }

    // 2. Validasi Ukuran File (> 5MB)
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
      setErrorDetails({
        title: "Ukuran Gambar Terlalu Besar",
        message: `Ukuran file (${sizeMB} MB) melebihi batas kuota yang diizinkan (${MAX_FILE_SIZE_MB} MB).`,
        tip: "Kompres atau resize gambar terlebih dahulu sebelum mengunggah kembali.",
      });
      return false;
    }

    // 3. Set File & Buat Live Preview
    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return true;
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSelectFile(droppedFile);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const handleReset = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setErrorDetails(null);
    setSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!file || !user) {
      setErrorDetails({
        title: "File Tidak Ditemukan",
        message: "Silakan pilih foto profil terlebih dahulu.",
        tip: "Klik dropzone atau seret foto ke dalam area unggah.",
      });
      return;
    }

    setUploading(true);
    setErrorDetails(null);

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = (await response.json()) as { avatar_url?: string; error?: string };

      if (!response.ok || !data.avatar_url) {
        const status = response.status;
        let errorMsg = data.error || "Gagal mengunggah foto profil ke server.";
        let tip = "Pastikan koneksi internet stabil dan coba kembali beberapa saat lagi.";

        if (status === 500) {
          tip = "Terjadi kendala pada integrasi penyimpanan Cloudinary atau pemrosesan multipart server.";
        } else if (status === 400) {
          tip = "Pastikan file multipart dikirimkan dengan benar.";
        } else if (status === 401 || status === 403) {
          tip = "Sesi login kedaluwarsa. Silakan refresh atau login ulang akun Anda.";
        }

        setErrorDetails({
          title: `Gagal Unggah (HTTP ${status})`,
          message: errorMsg,
          statusCode: status,
          tip,
        });
        return;
      }

      setSuccess(true);
      await reloadUserProfile();
    } catch (err) {
      setErrorDetails({
        title: "Kesalahan Jaringan / Sistem",
        message: err instanceof Error ? err.message : "Terjadi kesalahan yang tidak terduga saat menghubungi server.",
        tip: "Periksa sambungan koneksi Anda lalu ulangi proses unggah.",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* ── Breadcrumbs / Header ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/profile">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="size-4" />
            Kembali ke Profil
          </Button>
        </Link>
        <Badge variant="info">Perbaikan Audit</Badge>
      </div>

      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Unggah Foto Profil
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Ubah avatar akun Anda dengan format standar, pengecekan ukuran otomatis, dan diagnosa pesan error terperinci.
        </p>
      </div>

      {/* ── Error Banner (Pesan Error Terperinci) ────────────────────────────── */}
      {errorDetails && (
        <div
          role="alert"
          className="rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-950/40 p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 rounded-lg shrink-0">
              <ShieldAlert className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-red-900 dark:text-red-200">
                  {errorDetails.title}
                </h3>
                {errorDetails.statusCode && (
                  <span className="rounded bg-red-200 dark:bg-red-800/60 px-1.5 py-0.5 text-[10px] font-mono font-bold text-red-800 dark:text-red-200">
                    Status {errorDetails.statusCode}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300 leading-relaxed font-medium">
                {errorDetails.message}
              </p>
              {errorDetails.tip && (
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400 bg-red-100/60 dark:bg-red-900/40 px-2.5 py-1.5 rounded-md">
                  <Info className="size-3.5 shrink-0" />
                  <span>{errorDetails.tip}</span>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setErrorDetails(null)}
              className="text-red-700 hover:text-red-900 hover:bg-red-100 text-xs px-2 h-7"
            >
              Tutup
            </Button>
          </div>
        </div>
      )}

      {/* ── Success Banner ─────────────────────────────────────────────────── */}
      {success && (
        <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                Foto Profil Berhasil Diperbarui!
              </h3>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                Avatar baru Anda telah tersimpan dan disinkronkan ke seluruh sistem JobDex.in.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => router.push("/dashboard/profile")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                >
                  Lihat Profil
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="text-xs h-8"
                >
                  Unggah Foto Lain
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Upload Card ────────────────────────────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Pilih Gambar Avatar</CardTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gunakan foto wajah atau logo yang jelas dengan rasio persegi (1:1).
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Comparison: Current vs Preview */}
          <div className="flex items-center justify-around p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Avatar Saat Ini</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentAvatar}
                alt="Current Avatar"
                className="size-20 rounded-full border-2 border-slate-300 dark:border-slate-700 object-cover shadow-sm"
              />
            </div>

            <div className="text-slate-400 text-xl font-bold">→</div>

            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                {previewUrl ? "Pratinjau Baru" : "Belum Ada File"}
              </span>
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="New Preview"
                  className="size-20 rounded-full border-2 border-primary object-cover shadow-md ring-2 ring-primary/20"
                />
              ) : (
                <div className="size-20 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400">
                  <Camera className="size-6" />
                </div>
              )}
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed
              cursor-pointer transition-all duration-200 text-center
              ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-slate-300 dark:border-slate-700 hover:border-slate-400 hover:bg-slate-50/60 dark:hover:bg-slate-900/30"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleInputChange}
              className="hidden"
            />
            <div className="p-3 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-full mb-3 shadow-sm">
              <UploadCloud className="size-8" />
            </div>
            <p className="font-semibold text-sm text-slate-900 dark:text-white">
              Seret dan lepaskan file gambar ke sini, atau <span className="text-primary underline">jelajahi</span>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Mendukung JPEG, PNG, atau WebP (Maksimal 5 MB)
            </p>
          </div>

          {/* Selected File Details */}
          {file && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3 min-w-0">
                <FileImage className="size-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {file.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs gap-1 h-8"
              >
                <Trash2 className="size-3.5" />
                Hapus
              </Button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={uploading || (!file && !previewUrl)}
              className="w-full sm:w-auto"
            >
              Reset
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full sm:w-auto gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold"
            >
              {uploading ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Mengunggah ke Cloudinary...
                </>
              ) : (
                <>
                  <UploadCloud className="size-4" />
                  Simpan Foto Profil
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
