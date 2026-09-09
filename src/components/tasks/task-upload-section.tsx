"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Upload, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskUploadHistory } from "@/components/tasks/task-upload-history";
import { TaskUploadForm } from "@/components/tasks/task-upload-form";
import { useAuth } from "@/hooks/use-auth";
import { canManageTask } from "@/lib/permissions";
import { formatFileSize } from "@/lib/upload-validation";
import type { Task, TaskUpload, UserProfile } from "@/types";
import { showSuccess, showError, showWarning } from "@/lib/swal";

type TaskUploadSectionProps = {
  task: Task;
  uploads: TaskUpload[];
  currentUser: UserProfile;
  usersById: Map<string, UserProfile>;
  onUploaded: () => Promise<void>;
  eventRole?: string;
};

export function TaskUploadSection({
  task,
  uploads,
  currentUser,
  usersById,
  onUploaded,
  eventRole,
}: TaskUploadSectionProps) {
  const { user } = useAuth();
  
  const [isConfirming, setIsConfirming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");

  const latestUpload = useMemo(() => uploads[0], [uploads]);
  const canUpload = canManageTask(currentUser, task, eventRole) || task.pic_id === currentUser.id;

  function resetUploadState() {
    setIsConfirming(false);
    setMessage("");
    setWarning("");
    setError("");
  }

  async function handleUploadSubmit(payload?: {
    file: File | null;
    sourceLink: string;
    uploadNote: string;
    outputType: string;
  }) {
    if (!user) {
      void showError("Sesi login tidak ditemukan. Silakan login ulang.", "Error");
      setError("Sesi login tidak ditemukan. Silakan login ulang.");
      return;
    }

    setUploading(true);
    setMessage("");
    setWarning("");
    setError("");

    try {
      const fileToUpload = payload?.file ?? null;
      const linkToUpload = payload?.sourceLink ?? "";
      const noteToUpload = payload?.uploadNote ?? "";
      const typeToUpload = payload?.outputType ?? "";

      const formData = new FormData();
      formData.append("taskId", task.id);
      
      if (fileToUpload) {
        formData.append("file", fileToUpload);
      }
      if (linkToUpload) {
        formData.append("sourceLink", linkToUpload);
      }
      if (noteToUpload) {
        formData.append("uploadNote", noteToUpload);
      }
      if (typeToUpload) {
        formData.append("outputType", typeToUpload);
      }
      formData.append("isFinalCandidate", "true");

      const token = await user.getIdToken();
      const response = await fetch("/api/uploads/task-result", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = (await response.json()) as {
        error?: string;
        whatsappSent?: boolean;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Upload hasil desain gagal.");
      }

      void showSuccess("Hasil pekerjaan berhasil diserahkan! Status task diubah menjadi Menunggu Approval.");
      setMessage("Penyerahan berhasil. Task dipindahkan ke Menunggu Approval.");

      if (!result.whatsappSent) {
        void showWarning("Penyerahan berhasil, tetapi notifikasi WhatsApp gagal dikirim.");
        setWarning("Penyerahan berhasil, tetapi notifikasi WhatsApp gagal dikirim.");
      }

      resetUploadState();
      await onUploaded();
    } catch (uploadError) {
      const errMsg =
        uploadError instanceof Error
          ? uploadError.message
          : "Upload hasil desain gagal.";
      void showError(errMsg, "Upload Gagal");
      setError(errMsg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Hasil Pekerjaan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {latestUpload ? (
            latestUpload.upload_url ? (
              latestUpload.file_type?.startsWith("image/") ? (
                <div className="overflow-hidden rounded-[8px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                  <Image
                    src={latestUpload.thumbnail_url || latestUpload.upload_url}
                    alt={`Preview hasil desain ${task.name}`}
                    width={1000}
                    height={700}
                    className="max-h-[420px] w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-[8px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-8 text-slate-500">
                  <FileText className="h-16 w-16 text-slate-400 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                    {latestUpload.file_name || "File Dokumen / Hasil"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Format: {latestUpload.file_type || "Dokumen"} | Ukuran: {formatFileSize(latestUpload.file_size)}
                  </p>
                  <Button asChild variant="secondary" size="sm" className="mt-4">
                    <a href={latestUpload.upload_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
                      <ExternalLink className="h-4 w-4" />
                      Buka Berkas
                    </a>
                  </Button>
                </div>
              )
            ) : (
              <div className="rounded-[8px] border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-6 text-sm text-slate-500 dark:text-slate-400">
                Tugas diserahkan tanpa file (hanya link sumber atau catatan).
              </div>
            )
          ) : (
            <div className="rounded-[8px] border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-6 text-sm text-slate-500 dark:text-slate-400">
              Belum ada hasil pekerjaan.
            </div>
          )}

          {/* Rule-based warnings */}
          <div className="space-y-2">
            {task.requires_file && !latestUpload ? (
              <p className="rounded-[8px] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium">
                ⚠️ Tugas ini memiliki kategori yang <strong>wajib mengunggah file hasil</strong> (seperti poster/surat/laporan). Harap unggah berkas di bawah ini.
              </p>
            ) : null}
            {task.requires_source_link && !task.source_link ? (
              <p className="rounded-[8px] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium">
                ⚠️ Tugas ini <strong>wajib mencantumkan link sumber pengerjaan</strong> (Canva/Figma/Docs). Silakan sertakan link sumber saat menyerahkan hasil.
              </p>
            ) : null}
            {task.requires_file === false ? (
              <p className="rounded-[8px] bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 px-3.5 py-2.5 text-xs text-sky-800 dark:text-sky-300 font-medium">
                ℹ️ Kategori tugas ini <strong>tidak wajib mengunggah file hasil</strong> (hanya log aktivitas). Anda dapat menyerahkan tugas tanpa file, atau menyertakan link sumber / catatan pengerjaan saja.
              </p>
            ) : null}
          </div>

          {/* Confirmation Panel with Format Check */}
          {isConfirming ? (
            <TaskUploadForm
              taskId={task.id}
              taskName={task.name}
              categoryKey={task.category_key}
              requiresFile={task.requires_file}
              requiresSourceLink={task.requires_source_link}
              recommendedOutputTypes={task.output_types || []}
              uploading={uploading}
              onSubmit={handleUploadSubmit}
              onCancel={resetUploadState}
            />
          ) : (
            <div className="flex flex-col gap-3 rounded-[8px] border border-slate-200 dark:border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-950 dark:text-slate-50">Upload Hasil Pekerjaan</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Gambar (JPG, PNG, WEBP), PDF, atau berkas spreadsheet. Max {formatFileSize(10 * 1024 * 1024)}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {latestUpload?.upload_url ? (
                  <Button asChild variant="secondary" size="sm">
                    <a href={latestUpload.upload_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
                      <ExternalLink className="h-4 w-4" />
                      Buka File
                    </a>
                  </Button>
                ) : null}
                {canUpload ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsConfirming(true)}
                      disabled={uploading}
                    >
                      <Upload className="h-4 w-4" />
                      Upload Berkas Hasil
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsConfirming(true)}
                      disabled={uploading}
                    >
                      Input Tanpa File
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {message ? (
            <p className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
              {message}
            </p>
          ) : null}
          {warning ? (
            <p className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {warning}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <TaskUploadHistory uploads={uploads} usersById={usersById} />
    </section>
  );
}
