"use client";

import { useState, useEffect } from "react";
import {
  X,
  Trash2,
  Plus,
  AlertTriangle,
  Info,
  Calendar,
  User,
  Zap,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { writeBatch, collection, doc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Event, UserProfile } from "@/types";
import type { ParsedJobdeskTask, SkippedJobdeskTask } from "@/lib/server/ai-bulk-jobdesk-parser";
import type { BulkExtractionData } from "@/components/jobdesk/voice-jobdesk-dialog";

interface EditableTaskItem {
  id: string; // temporary client ID
  name: string;
  pic_id: string;
  pic_ids: string[];
  pic_names: string[];
  priority: "rendah" | "sedang" | "tinggi";
  stage: "pra_acara" | "pasca_acara";
  deadline: string; // YYYY-MM-DD
}

interface BulkJobdeskModalProps {
  open: boolean;
  onClose: () => void;
  extractionData?: BulkExtractionData | null;
  eventName?: string;
  eventId?: string;
  initialTasks?: ParsedJobdeskTask[];
  skippedTasks?: SkippedJobdeskTask[];
  users: UserProfile[];
  events: Event[];
  onSuccess?: () => void;
}

export function BulkJobdeskModal({
  open,
  onClose,
  extractionData,
  eventName,
  eventId,
  initialTasks = [],
  skippedTasks = [],
  users,
  events,
  onSuccess,
}: BulkJobdeskModalProps) {
  const { user, userProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  const effectiveEventId = extractionData?.eventId || eventId || "";
  const currentEvent = events.find((e) => e.id === effectiveEventId);
  const effectiveEventName = extractionData?.eventName || eventName || currentEvent?.name || "Acara";
  const effectiveInitialTasks = extractionData?.tasks || initialTasks || [];
  const effectiveSkippedTasks = extractionData?.skippedTasks || skippedTasks || [];

  // Map initial tasks ke editable state
  const [tasks, setTasks] = useState<EditableTaskItem[]>(() => {
    return effectiveInitialTasks.map((t, idx) => ({
      id: `task-${Date.now()}-${idx}`,
      name: t.name || "",
      pic_id: t.pic_ids && t.pic_ids.length > 0 ? t.pic_ids[0] : "",
      pic_ids: t.pic_ids || [],
      pic_names: t.pic_names || [],
      priority: t.priority || "sedang",
      stage: t.stage || "pra_acara",
      deadline: t.deadline || "",
    }));
  });

  useEffect(() => {
    if (open) {
      setTasks(
        effectiveInitialTasks.map((t, idx) => ({
          id: `task-${Date.now()}-${idx}`,
          name: t.name || "",
          pic_id: t.pic_ids && t.pic_ids.length > 0 ? t.pic_ids[0] : "",
          pic_ids: t.pic_ids || [],
          pic_names: t.pic_names || [],
          priority: t.priority || "sedang",
          stage: t.stage || "pra_acara",
          deadline: t.deadline || "",
        }))
      );
    }
  }, [open, extractionData, initialTasks]);

  if (!open) return null;

  const activeUsers = users.filter((u) => u.is_active !== false);

  const handleUpdateField = (
    id: string,
    field: keyof EditableTaskItem,
    value: unknown
  ) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;

        if (field === "pic_id") {
          const selectedUser = users.find((u) => u.id === value);
          return {
            ...t,
            pic_id: String(value),
            pic_ids: value ? [String(value)] : [],
            pic_names: selectedUser?.name ? [selectedUser.name] : [],
          };
        }

        return { ...t, [field]: value };
      })
    );
  };

  const handleRemoveTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddTaskRow = () => {
    setTasks((prev) => [
      ...prev,
      {
        id: `task-manual-${Date.now()}`,
        name: "",
        pic_id: "",
        pic_ids: [],
        pic_names: [],
        priority: "sedang",
        stage: "pra_acara",
        deadline: "",
      },
    ]);
  };

  const handleSaveAll = async () => {
    if (tasks.length === 0) {
      toast.error("Daftar jobdesk masih kosong.");
      return;
    }

    const invalidTasks = tasks.filter((t) => !t.name.trim());
    if (invalidTasks.length > 0) {
      toast.error("Nama jobdesk tidak boleh kosong.");
      return;
    }

    setIsSaving(true);

    try {
      const batch = writeBatch(db);

      const targetOrgId =
        currentEvent?.organization_id ||
        currentEvent?.org_id ||
        userProfile?.organization_id ||
        userProfile?.org_id ||
        "main_org";

      const targetCampusId =
        currentEvent?.campus_id ||
        currentEvent?.univ_id ||
        userProfile?.campus_id ||
        userProfile?.univ_id ||
        "";

      for (const t of tasks) {
        const taskRef = doc(collection(db, "tasks"));

        let deadlineTs: Timestamp | null = null;
        if (t.deadline) {
          const parsed = new Date(`${t.deadline}T23:59:59+08:00`);
          if (!isNaN(parsed.getTime())) {
            deadlineTs = Timestamp.fromDate(parsed);
          }
        }

        const picUser = users.find((u) => u.id === t.pic_id);
        const picNames = picUser?.name ? [picUser.name] : t.pic_names;

        batch.set(taskRef, {
          id: taskRef.id,
          organization_id: targetOrgId,
          org_id: targetOrgId,
          orgId: targetOrgId,
          campus_id: targetCampusId,
          campusId: targetCampusId,
          univ_id: targetCampusId,
          univId: targetCampusId,
          type: "acara",
          division_id: currentEvent?.division_id || "",
          event_id: effectiveEventId,
          name: t.name.trim(),
          title: t.name.trim(),
          description: "",
          pic_id: t.pic_id || "",
          pic_ids: t.pic_id ? [t.pic_id] : t.pic_ids,
          pic_names: picNames,
          coordinator_id: currentEvent?.coordinator_id || userProfile?.id || "",
          deadline: deadlineTs,
          status: "belum_dimulai",
          priority: t.priority,
          stage: t.stage,
          copywriting: "",
          copywriting_docs_url: "",
          design_reference_url: "",
          drive_reference_url: "",
          color_palette: [],
          visual_direction: "",
          revision_notes: "",
          stuck_notes: "",
          result_design_url: "",
          approval_status: "pending",
          is_archived: false,
          checklist_items: [
            { id: "checklist_1", label: "Redaksi/materi tersedia", is_done: false },
            { id: "checklist_2", label: "Referensi desain/teknis tersedia", is_done: false },
            { id: "checklist_3", label: "Draft awal pengerjaan", is_done: false },
            { id: "checklist_4", label: "Review internal kepanitiaan", is_done: false },
            { id: "checklist_5", label: "Finalisasi & Upload ke JobDex.in", is_done: false },
          ],
          created_by: user?.uid || "",
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });

        // Log status awal
        const logRef = doc(collection(db, "tasks", taskRef.id, "status_logs"));
        batch.set(logRef, {
          id: logRef.id,
          task_id: taskRef.id,
          previous_status: null,
          new_status: "belum_dimulai",
          notes: "Jobdesk dibuat melalui fitur Input Suara AI (Voice Yapping)",
          changed_by: user?.uid || "",
          changed_at: serverTimestamp(),
        });
      }

      await batch.commit();

      toast.success(`${tasks.length} job desk berhasil ditambahkan!`);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("[BulkJobdeskModal] Gagal menyimpan jobdesk massal:", err);
      toast.error("Gagal menyimpan jobdesk ke database.");
    } finally {
      setIsSaving(false);
    }
  };

  const tasksMissingDeadline = tasks.filter((t) => !t.deadline);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-950 border-2 border-zinc-900 dark:border-zinc-100 rounded-none shadow-none flex flex-col max-h-[92vh] overflow-hidden">
        {/* ── Modal Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-primary text-primary-foreground rounded-none">
                REVIEW & EDIT
              </span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Pratinjau Draf Jobdesk: {effectiveEventName}
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Periksa dan lengkapi nama tugas, penanggung jawab (PIC), dan tenggat waktu sebelum disimpan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-none transition-colors cursor-pointer"
            title="Tutup pratinjau"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* ── Modal Body ────────────────────────────────────────────────────── */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Warning Banner: Missing Deadlines */}
          {tasksMissingDeadline.length > 0 && (
            <div className="flex items-start gap-2.5 p-3 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-l-4 border-amber-500 rounded-none">
              <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <strong className="font-semibold">
                  Terdapat {tasksMissingDeadline.length} tugas yang belum memiliki tenggat waktu!
                </strong>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                  Tugas tanpa deadline ditandai border kuning. Anda dapat langsung mengisinya pada kolom input tanggal di bawah.
                </p>
              </div>
            </div>
          )}

          {/* Skipped Tasks Collapsible Banner */}
          {effectiveSkippedTasks.length > 0 && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-none bg-zinc-50 dark:bg-zinc-900/30 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSkipped(!showSkipped)}
                className="w-full flex items-center justify-between p-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Info className="size-4 text-zinc-500" />
                  <span>
                    ℹ️ {effectiveSkippedTasks.length} tugas operasional hari H dilewati otomatis (tidak masuk checklist)
                  </span>
                </div>
                {showSkipped ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>

              {showSkipped && (
                <div className="p-3 pt-0 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  {effectiveSkippedTasks.map((s, idx) => (
                    <div key={idx} className="flex items-start gap-2 pl-6">
                      <span className="text-zinc-400">•</span>
                      <span>
                        <strong className="text-zinc-800 dark:text-zinc-200">{s.raw_text}</strong> ({s.reason})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tasks List Table / Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                Daftar Tugas Siap Diterbitkan ({tasks.length})
              </h3>
              <button
                type="button"
                onClick={handleAddTaskRow}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 rounded-none shadow-none cursor-pointer transition-colors"
              >
                <Plus className="size-3.5" />
                <span>Tambah Baris</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {tasks.map((task, idx) => {
                const hasNoDeadline = !task.deadline;

                return (
                  <div
                    key={task.id}
                    className={`p-3.5 border transition-all rounded-none bg-white dark:bg-zinc-900 ${
                      hasNoDeadline
                        ? "border-amber-400 dark:border-amber-600/80 bg-amber-50/20 dark:bg-amber-950/10"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
                      {/* Number & Name Input */}
                      <div className="flex items-center gap-2 flex-1 w-full">
                        <span className="font-mono text-xs font-bold text-zinc-400 size-6 rounded-none bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={task.name}
                          onChange={(e) => handleUpdateField(task.id, "name", e.target.value)}
                          placeholder="Nama job desk..."
                          className="w-full text-xs font-medium px-2.5 py-1.5 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary shadow-none"
                        />
                      </div>

                      {/* Controls Group */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto shrink-0">
                        {/* PIC Select */}
                        <div className="relative min-w-[170px] flex-1 sm:flex-initial">
                          <User className="size-3 text-zinc-400 absolute left-2 top-2.5 pointer-events-none" />
                          <select
                            value={task.pic_id}
                            onChange={(e) => handleUpdateField(task.id, "pic_id", e.target.value)}
                            className="w-full text-xs font-medium h-8 pl-7 pr-2 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary shadow-none"
                          >
                            <option value="">-- Pilih PIC --</option>
                            {activeUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name || u.email}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Priority Select */}
                        <div className="relative min-w-[100px]">
                          <Zap className="size-3 text-zinc-400 absolute left-2 top-2.5 pointer-events-none" />
                          <select
                            value={task.priority}
                            onChange={(e) =>
                              handleUpdateField(task.id, "priority", e.target.value as "rendah" | "sedang" | "tinggi")
                            }
                            className="w-full text-xs font-medium h-8 pl-6 pr-2 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary shadow-none"
                          >
                            <option value="rendah">Rendah</option>
                            <option value="sedang">Sedang</option>
                            <option value="tinggi">Tinggi</option>
                          </select>
                        </div>

                        {/* Stage Select */}
                        <div className="min-w-[110px]">
                          <select
                            value={task.stage}
                            onChange={(e) =>
                              handleUpdateField(task.id, "stage", e.target.value as "pra_acara" | "pasca_acara")
                            }
                            className="w-full text-xs font-medium h-8 px-2 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary shadow-none"
                          >
                            <option value="pra_acara">Pra-Acara</option>
                            <option value="pasca_acara">Pasca-Acara</option>
                          </select>
                        </div>

                        {/* Deadline Date Input */}
                        <div className="relative min-w-[140px] flex-1 sm:flex-initial">
                          <Calendar className="size-3 text-zinc-400 absolute left-2 top-2.5 pointer-events-none" />
                          <input
                            type="date"
                            value={task.deadline}
                            onChange={(e) => handleUpdateField(task.id, "deadline", e.target.value)}
                            className={`w-full text-xs font-mono h-8 pl-7 pr-1 rounded-none border bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary shadow-none ${
                              hasNoDeadline
                                ? "border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/20"
                                : "border-zinc-300 dark:border-zinc-700"
                            }`}
                          />
                        </div>

                        {/* Delete Row Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveTask(task.id)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-none transition-colors cursor-pointer shrink-0"
                          title="Hapus baris tugas"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>

                    {/* Warning text if deadline missing */}
                    {hasNoDeadline && (
                      <div className="mt-1.5 pl-8 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                        <AlertTriangle className="size-3 shrink-0" />
                        <span>⚠️ Tenggat waktu belum ditentukan. Disarankan untuk diisi sekarang.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Modal Footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Total: <strong>{tasks.length} tugas</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold rounded-none border border-zinc-300 dark:border-zinc-700 bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-none transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || tasks.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Menyimpan ke JobDex...</span>
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  <span>💾 Simpan Semua ke Jobdesk</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
