"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ChangeEvent, DragEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  FileSpreadsheet,
  FileImage,
  Info,
  Link as LinkIcon,
  RefreshCw,
} from "lucide-react";
import {
  ALLOWED_FILE_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  formatFileSize,
  validateFileUpload,
} from "@/lib/upload-validation";

export interface TaskUploadFormProps {
  taskId: string;
  taskName: string;
  categoryKey?: string;
  requiresFile?: boolean;
  requiresSourceLink?: boolean;
  recommendedOutputTypes?: string[];
  uploading: boolean;
  onSubmit: (data: {
    file: File | null;
    sourceLink: string;
    uploadNote: string;
    outputType: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export function TaskUploadForm({
  taskName,
  categoryKey,
  requiresFile = false,
  requiresSourceLink = false,
  recommendedOutputTypes = [],
  uploading,
  onSubmit,
  onCancel,
}: TaskUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

  const [sourceLink, setSourceLink] = useState("");
  const [sourceLinkError, setSourceLinkError] = useState<string | null>(null);

  const [uploadNote, setUploadNote] = useState("");
  const [outputType, setOutputType] = useState(
    recommendedOutputTypes.length > 0 ? recommendedOutputTypes[0] : ""
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Bersihkan object URL preview
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Validasi URL source link saat diketik
  const handleSourceLinkChange = (value: string) => {
    setSourceLink(value);
    if (!value.trim()) {
      setSourceLinkError(null);
      return;
    }

    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setSourceLinkError("Link harus diawali dengan http:// atau https://");
      } else {
        setSourceLinkError(null);
      }
    } catch {
      setSourceLinkError("Format tautan tidak valid. Contoh: https://canva.com/design/...");
    }
  };

  // Cek dan validasi file terpilih
  const validateAndSetFile = useCallback((candidateFile: File) => {
    setFormatError(null);

    const validation = validateFileUpload(candidateFile);
    if (!validation.valid) {
      setFormatError(validation.error);
      return false;
    }

    setFile(candidateFile);
    if (candidateFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(candidateFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
    return true;
  }, []);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setFormatError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    // Validasi aturan wajib file jika ada
    if (requiresFile && !file) {
      setFormatError("Tugas ini memerlukan unggahan berkas hasil pekerjaan.");
      return;
    }

    // Validasi link jika ada error
    if (sourceLinkError) {
      return;
    }

    // Validasi jika wajib source link
    if (requiresSourceLink && !sourceLink.trim()) {
      setSourceLinkError("Tugas ini mewajibkan pencantuman link sumber pengerjaan.");
      return;
    }

    await onSubmit({
      file,
      sourceLink: sourceLink.trim(),
      uploadNote: uploadNote.trim(),
      outputType: outputType.trim(),
    });
  };

  // Helper render ikon file
  const renderFileIcon = (mime: string) => {
    if (mime.startsWith("image/")) return <FileImage className="size-5 text-sky-600" />;
    if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv"))
      return <FileSpreadsheet className="size-5 text-emerald-600" />;
    return <FileText className="size-5 text-amber-600" />;
  };

  return (
    <div className="rounded-xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-950 p-5 space-y-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-none">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-950 dark:text-slate-50">
            Unggah &amp; Konfirmasi Hasil Tugas
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Target: <span className="font-semibold text-slate-800 dark:text-slate-200">{taskName}</span>
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={uploading}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Format Checklist Helper ────────────────────────────────────────── */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
          <Info className="size-4 text-sky-600" />
          <span>Format Berkas yang Didukung (Maks. {formatFileSize(MAX_UPLOAD_SIZE_BYTES)})</span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <Badge variant="neutral" className="text-[10px]">
            Gambar: JPG, PNG, WebP, GIF
          </Badge>
          <Badge variant="neutral" className="text-[10px]">
            Dokumen: PDF, DOCX, DOC
          </Badge>
          <Badge variant="neutral" className="text-[10px]">
            Spreadsheet: XLSX, XLS, CSV
          </Badge>
        </div>
      </div>

      {/* ── Error Banner Format Check ─────────────────────────────────────── */}
      {formatError && (
        <div
          role="alert"
          className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/40 p-3.5 text-xs text-red-800 dark:text-red-200 flex items-start gap-2.5 animate-in fade-in duration-150"
        >
          <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Format Berkas Ditolak</p>
            <p className="mt-0.5 text-red-700 dark:text-red-300 leading-relaxed">{formatError}</p>
          </div>
          <button
            type="button"
            onClick={() => setFormatError(null)}
            className="text-red-700 hover:text-red-900 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Upload & Preview Area ─────────────────────────────────────────── */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Left Column: File Dropzone / Selected File Preview */}
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Berkas Hasil
          </span>

          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed
                cursor-pointer transition-all duration-150 text-center min-h-[190px]
                ${
                  isDragging
                    ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 scale-[1.01]"
                    : "border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-50/50 dark:bg-slate-900/20"
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_FILE_TYPES.join(",")}
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="p-2.5 bg-sky-100 dark:bg-sky-900/40 text-sky-600 rounded-full mb-2">
                <UploadCloud className="size-6" />
              </div>
              <p className="font-bold text-xs text-slate-800 dark:text-slate-100">
                Pilih atau Seret Berkas ke Sini
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Sistem akan memverifikasi format &amp; ukuran secara otomatis
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3.5 space-y-3">
              {previewUrl ? (
                <div className="relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-black aspect-video max-h-48 flex items-center justify-center">
                  <Image
                    src={previewUrl}
                    alt="Pratinjau berkas"
                    width={400}
                    height={250}
                    unoptimized
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 min-h-[110px]">
                  {renderFileIcon(file.type)}
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1.5">
                    {file.type || "Dokumen non-gambar"}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  {renderFileIcon(file.type)}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {formatFileSize(file.size)} • Format Valid ✓
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={uploading}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-7 px-2"
                >
                  Ganti
                </Button>
              </div>
            </div>
          )}

          {requiresFile && !file && (
            <p className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-2 rounded-md font-medium">
              ⚠️ Kategori tugas ini mewajibkan pengunggahan berkas hasil.
            </p>
          )}
        </div>

        {/* Right Column: Metadata Inputs & Link Verification */}
        <div className="space-y-3.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Detail &amp; Metadata
          </span>

          {/* Source Link */}
          <div>
            <label
              htmlFor="task-source-link-input"
              className="mb-1 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              <span className="flex items-center gap-1.5">
                <LinkIcon className="size-3.5" />
                Link Sumber Pengerjaan
              </span>
              {requiresSourceLink && (
                <span className="text-[10px] text-red-600 font-semibold">*Wajib</span>
              )}
            </label>
            <input
              id="task-source-link-input"
              type="url"
              placeholder="https://canva.com/design/... atau Figma / Google Drive"
              value={sourceLink}
              onChange={(e) => handleSourceLinkChange(e.target.value)}
              className={`
                h-9 w-full rounded-lg border px-3 text-xs outline-none transition-colors
                dark:bg-slate-900 dark:text-slate-100
                ${
                  sourceLinkError
                    ? "border-red-500 focus:ring-2 focus:ring-red-200"
                    : "border-slate-300 dark:border-slate-700 focus:border-slate-500"
                }
              `}
            />
            {sourceLinkError && (
              <p className="mt-1 text-[11px] text-red-600 font-medium">{sourceLinkError}</p>
            )}
            <p className="mt-1 text-[10px] text-slate-400">
              Disarankan untuk Canva, Figma, Google Docs/Drive agar mudah direvisi tim.
            </p>
          </div>

          {/* Output Type */}
          <div>
            <label
              htmlFor="task-output-type-input"
              className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              Jenis Output
            </label>
            <input
              id="task-output-type-input"
              type="text"
              placeholder="canva, figma, image, pdf, dll."
              value={outputType}
              onChange={(e) => setOutputType(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 px-3 text-xs outline-none focus:border-slate-500"
            />
            {recommendedOutputTypes.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                <span className="text-[10px] text-slate-400">Pilihan:</span>
                {recommendedOutputTypes.map((typeVal) => (
                  <button
                    key={typeVal}
                    type="button"
                    onClick={() => setOutputType(typeVal)}
                    className="text-[9px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    {typeVal}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upload Note */}
          <div>
            <label
              htmlFor="task-upload-note-input"
              className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              Catatan Pengerjaan / Revisi
            </label>
            <textarea
              id="task-upload-note-input"
              rows={3}
              placeholder="Jelaskan perubahan, versi rilis, atau detail pekerjaan..."
              value={uploadNote}
              onChange={(e) => setUploadNote(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 px-3 py-2 text-xs outline-none focus:border-slate-500 resize-none"
            />
          </div>
        </div>
      </div>

      {/* ── Footer Actions ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={uploading}
        >
          Batalkan
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={uploading || Boolean(sourceLinkError)}
          className="gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold"
        >
          {uploading ? (
            <>
              <RefreshCw className="size-3.5 animate-spin" />
              Mengunggah...
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3.5" />
              Serahkan Hasil Tugas
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
