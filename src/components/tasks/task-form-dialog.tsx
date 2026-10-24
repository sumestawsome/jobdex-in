"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, type FormEvent, type ReactNode } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, FolderOpen, Save, Info } from "lucide-react";
import { TASK_PRIORITY_OPTIONS } from "@/lib/task-priority";
import { TASK_STATUS_OPTIONS } from "@/lib/task-status";
import { getTaskDateInputValue } from "@/lib/firebase/tasks";
import { NeoDatePicker } from "@/components/ui/neo-date-picker";
import {
  formatColorPalette,
  isValidUrl,
  parseColorPalette,
} from "@/lib/task-utils";
import {
  parseLinksFromTextarea,
  formatLinksToTextarea,
  getInvalidUrlsFromTextarea,
} from "@/lib/link-utils";
import type {
  Division,
  Event,
  ReferenceLink,
  Task,
  TaskInput,
  TaskPriority,
  TaskStatus,
  TaskType,
  UserProfile,
} from "@/types";
import {
  getMainCategories,
  getSubcategories,
  getCategoryRule,
  getDefaultArchiveSettings,
  MAIN_CATEGORIES,
  inferJobdeskCategoryFromText,
} from "@/lib/jobdesk-categories";
import { useAuth } from "@/hooks/use-auth";
import {
  runRuleBasedDetection,
  mapOutputToSensitivity,
  type DetectJobdeskCategoryResult,
} from "@/lib/jobdesk-category-detection";

function formatDetectionReason(result: DetectJobdeskCategoryResult): string {
  if (result.source === "rule_based") {
    const subLabel =
      result.category_key && result.subcategory_key
        ? (getCategoryRule(result.category_key, result.subcategory_key)?.subcategoryLabel ?? "")
        : "";
    const keyword = result.matched_keywords?.[0] || "";
    const confPercent = Math.round(result.confidence * 100);
    return `Terdeteksi sebagai ${subLabel} berdasarkan kata kunci "${keyword}" dengan confidence ${confPercent}%.`;
  }
  if (result.source === "reference_similarity") {
    return `Terdeteksi mengikuti pola referensi lama: ${result.matched_reference_title || result.reason}.`;
  }
  if (result.source === "ai_fallback") {
    return result.reason || "AI menyarankan kategori ini karena rule-based belum yakin.";
  }
  return result.reason || "Belum bisa mendeteksi kategori dengan yakin. Silakan pilih kategori manual.";
}

type TaskFormDialogProps = {
  open: boolean;
  task: Task | null;
  initialValues?: Partial<TaskInput> | null;
  autoFocusField?: string | null;
  users: UserProfile[];
  events: Event[];
  divisions?: Division[];
  fallbackCoordinatorId: string;
  defaultEventId?: string;
  onClose: () => void;
  onSave: (input: TaskInput, taskId?: string) => Promise<void>;
};

const selectClassName =
  "h-11 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 outline-none transition-colors focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-100 dark:focus:ring-slate-800";

export function TaskFormDialog(props: TaskFormDialogProps) {
  if (!props.open) {
    return null;
  }

  const key =
    props.task?.id ??
    (props.initialValues ? JSON.stringify(props.initialValues) : props.defaultEventId ?? "new");

  return <TaskForm key={key} {...props} />;
}

function TaskForm({
  task,
  initialValues,
  autoFocusField,
  users,
  events,
  divisions,
  fallbackCoordinatorId,
  defaultEventId,
  onClose,
  onSave,
}: TaskFormDialogProps) {
  const { user, userProfile } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const activeOrmawaDivisions = useMemo(() => {
    if (!divisions) return [];
    if (!activeWorkspace.org_id) return divisions;
    return divisions.filter((d) => {
      const divOrg = d.organization_id || d.org_id || (d as unknown as Record<string, unknown>).orgId;
      return !divOrg || divOrg === activeWorkspace.org_id;
    });
  }, [divisions, activeWorkspace.org_id]);

  const [divisionId, setDivisionId] = useState(() => {
    if (task?.division_id) return task.division_id;
    if (userProfile?.role === "koordinator_divisi" || userProfile?.role === "anggota") {
      return userProfile.division_id || "";
    }
    const activeDivs = (divisions || []).filter((d) => {
      if (d.is_active === false) return false;
      const divOrg = d.organization_id || d.org_id || (d as unknown as Record<string, unknown>).orgId;
      return !divOrg || !activeWorkspace.org_id || divOrg === activeWorkspace.org_id;
    });
    return activeDivs[0]?.id || "";
  });
  const [isDetecting, setIsDetecting] = useState(false);
  const [localSuggestion, setLocalSuggestion] = useState<{
    categoryKey: string;
    subcategoryKey: string;
    categoryLabel: string;
    subcategoryLabel: string;
    reason: string;
  } | null>(null);

  const isClass =
    (activeWorkspace as unknown as Record<string, unknown>)?.type === "kelas" ||
    activeWorkspace?.workspace_type === "kelas" ||
    activeWorkspace?.org_type?.toLowerCase() === "kelas" ||
    activeWorkspace?.org_id === "ws_ilkom_2024" ||
    (activeWorkspace as unknown as Record<string, unknown>)?.id === "ws_ilkom_2024" ||
    task?.type === "tugas_kuliah";

  const isClassWorkspace = isClass;

  const [type, setType] = useState<TaskType>(
    task?.type ?? (isClassWorkspace ? "tugas_kuliah" : defaultEventId ? "acara" : "divisi")
  );
  const [courseName, setCourseName] = useState(
    task?.course_name ?? task?.subject_name ?? initialValues?.course_name ?? ""
  );
  const [submissionUrl, setSubmissionUrl] = useState(
    task?.submission_url ?? task?.submission_link ?? initialValues?.submission_url ?? ""
  );
  const [eventId, setEventId] = useState(task?.event_id ?? defaultEventId ?? "");
  const [name, setName] = useState(
    task?.name ?? initialValues?.name ?? (initialValues as Record<string, unknown> | undefined)?.title as string ?? ""
  );
  const [description, setDescription] = useState(
    task?.description ?? initialValues?.description ?? ""
  );
  const [picId, setPicId] = useState(task?.pic_id ?? users[0]?.id ?? "");
  const [coordinatorId, setCoordinatorId] = useState(task?.coordinator_id ?? fallbackCoordinatorId);
  const [deadline, setDeadline] = useState(() => {
    if (task?.deadline) {
      const fromFn = getTaskDateInputValue(task.deadline);
      if (fromFn) return fromFn;
      if (typeof task.deadline === "string") return task.deadline.slice(0, 10);
    }
    if (initialValues?.deadline) {
      if (typeof initialValues.deadline === "string") {
        return initialValues.deadline.slice(0, 10);
      }
      const fromFn = getTaskDateInputValue(initialValues.deadline);
      if (fromFn) return fromFn;
    }
    return "";
  });
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "belum_dimulai");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "sedang");
  const [copywriting, setCopywriting] = useState(task?.copywriting ?? "");

  // Color palette — bisa hex atau teks biasa
  const [colorPalette, setColorPalette] = useState(formatColorPalette(task?.color_palette ?? []));
  const [visualDirection, setVisualDirection] = useState(task?.visual_direction ?? "");
  const [sourceLink, setSourceLink] = useState(task?.source_link ?? "");
  const [archiveNotes, setArchiveNotes] = useState(task?.archive_notes ?? "");

  // Fase 26A: Multi-link textarea state
  // Saat edit: load dari field baru (design_ref_links dll) dengan fallback ke field lama
  const [redactionLinksText, setRedactionLinksText] = useState(() => {
    if (task?.redaction_links?.length) {
      return formatLinksToTextarea(task.redaction_links);
    }
    return task?.copywriting_docs_url || "";
  });
  const [designRefLinksText, setDesignRefLinksText] = useState(() => {
    if (task?.design_ref_links?.length) {
      return formatLinksToTextarea(task.design_ref_links);
    }
    return task?.design_reference_url || "";
  });
  const [driveRefLinksText, setDriveRefLinksText] = useState(() => {
    if (task?.drive_ref_links?.length) {
      return formatLinksToTextarea(task.drive_ref_links);
    }
    return task?.drive_reference_url || "";
  });

  // Fase 26A: Design Kit inheritance tracking
  // "event" | "division" | "manual" | null
  const [designKitSource, setDesignKitSource] = useState<"event" | "division" | "manual" | null>(
    task?.design_kit_source ?? null
  );
  const [colorPaletteManuallyEdited, setColorPaletteManuallyEdited] = useState(false);
  const [visualDirectionManuallyEdited, setVisualDirectionManuallyEdited] = useState(false);

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!autoFocusField) return;
    const timer = setTimeout(() => {
      let targetId = "";
      if (autoFocusField === "deadline") {
        targetId = "task-form-deadline-input";
      } else if (autoFocusField === "course_name") {
        targetId = "task-form-course-input";
      } else if (autoFocusField === "name") {
        targetId = "task-form-name-input";
      } else if (autoFocusField === "description") {
        targetId = "task-form-description-input";
      }
      if (targetId) {
        const el = document.getElementById(targetId);
        if (el) {
          el.focus();
          if (autoFocusField === "deadline") {
            el.click();
          }
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [autoFocusField]);

  // --- Category detection logic (unchanged) ---
  const initialSuggestion = (() => {
    if (task && !task.category_key) {
      const result = inferJobdeskCategoryFromText({
        title: task.name,
        description: task.description,
      });
      if (result) {
        const catLabel = MAIN_CATEGORIES.find((c) => c.key === result.categoryKey)?.label ?? "";
        const subLabel = getCategoryRule(result.categoryKey, result.subcategoryKey)?.subcategoryLabel ?? "";
        return {
          categoryKey: result.categoryKey,
          subcategoryKey: result.subcategoryKey,
          categoryLabel: catLabel,
          subcategoryLabel: subLabel,
          reason: result.reason,
        };
      }
    }
    return null;
  })();

  const initialDefaults = initialSuggestion
    ? getDefaultArchiveSettings(initialSuggestion.categoryKey, initialSuggestion.subcategoryKey)
    : null;

  const [categoryKey, setCategoryKey] = useState(task?.category_key ?? initialSuggestion?.categoryKey ?? "");
  const [subcategoryKey, setSubcategoryKey] = useState(task?.subcategory_key ?? initialSuggestion?.subcategoryKey ?? "");
  const [outputTypes, setOutputTypes] = useState(
    task?.category_key
      ? (task?.output_types ?? []).join(", ")
      : (initialDefaults?.outputTypes.join(", ") ?? "")
  );
  const [archiveEnabled, setArchiveEnabled] = useState(
    task?.category_key
      ? (task?.archive_enabled ?? true)
      : (initialDefaults ? initialDefaults.archiveEnabled : true)
  );
  const [referenceCandidateEnabled, setReferenceCandidateEnabled] = useState(
    task?.category_key
      ? (task?.reference_candidate_enabled ?? false)
      : (initialDefaults ? initialDefaults.referenceCandidateEnabled : false)
  );
  const [requiresFile, setRequiresFile] = useState(
    task?.category_key
      ? (task?.requires_file ?? false)
      : (initialDefaults ? initialDefaults.requiresFile : false)
  );
  const [requiresSourceLink, setRequiresSourceLink] = useState(
    task?.category_key
      ? (task?.requires_source_link ?? false)
      : (initialDefaults ? initialDefaults.requiresSourceLink : false)
  );
  const [dataSensitivity, setDataSensitivity] = useState(
    task?.category_key
      ? (task?.data_sensitivity ?? "normal")
      : (initialDefaults ? initialDefaults.dataSensitivity : "normal")
  );

  const [suggestion, setSuggestion] = useState<{
    categoryKey: string;
    subcategoryKey: string;
    categoryLabel: string;
    subcategoryLabel: string;
    reason: string;
  } | null>(initialSuggestion);

  // =============================================
  // Fase 26A: Design Kit Inheritance Effect
  // Hanya dijalankan untuk task BARU (bukan edit)
  // =============================================
  useEffect(() => {
    // Jangan timpa nilai yang sudah tersimpan di task (mode edit)
    if (task) return;

    // Jangan timpa jika user sudah edit manual keduanya
    if (colorPaletteManuallyEdited && visualDirectionManuallyEdited) return;

    // Bungkus dalam setTimeout agar tidak synchronous di dalam effect (lint rule)
    const timer = setTimeout(() => {
      if (type === "acara" && eventId) {
        const selectedEvent = events.find((e) => e.id === eventId);
        if (!selectedEvent) return;

        const hasEventKit =
          selectedEvent.design_kit_color_palette?.length ||
          selectedEvent.design_kit_visual_direction ||
          selectedEvent.design_kit_redaction_links?.length;

        if (!hasEventKit) return;

        if (!colorPaletteManuallyEdited && selectedEvent.design_kit_color_palette?.length) {
          setColorPalette(formatColorPalette(selectedEvent.design_kit_color_palette));
        }
        if (!visualDirectionManuallyEdited && selectedEvent.design_kit_visual_direction) {
          setVisualDirection(selectedEvent.design_kit_visual_direction);
        }
        if (!redactionLinksText && selectedEvent.design_kit_redaction_links?.length) {
          setRedactionLinksText(formatLinksToTextarea(selectedEvent.design_kit_redaction_links));
        }
        if (!designRefLinksText && selectedEvent.design_kit_design_reference_links?.length) {
          setDesignRefLinksText(formatLinksToTextarea(selectedEvent.design_kit_design_reference_links));
        }
        if (!driveRefLinksText && selectedEvent.design_kit_drive_reference_links?.length) {
          setDriveRefLinksText(formatLinksToTextarea(selectedEvent.design_kit_drive_reference_links));
        }
        setDesignKitSource("event");
      } else if (type === "divisi" && divisionId) {
        const selectedDivision = divisions?.find((d) => d.id === divisionId);
        if (!selectedDivision) return;

        const hasDivisionKit =
          selectedDivision.design_kit_color_palette?.length ||
          selectedDivision.design_kit_visual_direction;

        if (!hasDivisionKit) return;

        if (!colorPaletteManuallyEdited && selectedDivision.design_kit_color_palette?.length) {
          setColorPalette(formatColorPalette(selectedDivision.design_kit_color_palette));
        }
        if (!visualDirectionManuallyEdited && selectedDivision.design_kit_visual_direction) {
          setVisualDirection(selectedDivision.design_kit_visual_direction);
        }
        if (!designRefLinksText && selectedDivision.design_kit_design_reference_links?.length) {
          setDesignRefLinksText(formatLinksToTextarea(selectedDivision.design_kit_design_reference_links));
        }
        if (!driveRefLinksText && selectedDivision.design_kit_drive_reference_links?.length) {
          setDriveRefLinksText(formatLinksToTextarea(selectedDivision.design_kit_drive_reference_links));
        }
        setDesignKitSource("division");
      }
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, eventId, divisionId]);

  // Helper: tandai sebagai "manual" jika user mengedit color/visual
  function handleColorPaletteChange(val: string) {
    setColorPalette(val);
    setColorPaletteManuallyEdited(true);
    setDesignKitSource("manual");
  }

  function handleVisualDirectionChange(val: string) {
    setVisualDirection(val);
    setVisualDirectionManuallyEdited(true);
    setDesignKitSource("manual");
  }

  // --- Nama sumber Design Kit untuk indikator ---
  function getDesignKitSourceLabel(): string | null {
    if (!designKitSource) return null;
    if (designKitSource === "manual") return null; // akan ditampilkan pesan berbeda
    if (designKitSource === "event") {
      const ev = events.find((e) => e.id === eventId);
      return ev ? ev.name : "acara ini";
    }
    if (designKitSource === "division") {
      const div = divisions?.find((d) => d.id === divisionId) || divisions?.[0];
      return div ? div.name : "divisi";
    }
    return null;
  }

  const designKitSourceLabel = getDesignKitSourceLabel();

  // --- Category detection handlers ---
  const handleManualDetect = async () => {
    if (!name.trim()) {
      setError("Nama task wajib diisi untuk mendeteksi kategori.");
      return;
    }

    setIsDetecting(true);
    setError("");
    setSuggestion(null);

    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("Sesi login Anda tidak valid atau kedaluwarsa.");
      }

      const event = events.find((e) => e.id === eventId);
      const eventName = event ? event.name : "";

      const res = await fetch("/api/tasks/detect-category", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: name,
          description: description,
          eventName: eventName,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Gagal mendeteksi kategori.");
      }

      const result = await res.json();

      if (result) {
        const formattedReason = formatDetectionReason(result);

        if (result.category_key && result.subcategory_key) {
          const catLabel = MAIN_CATEGORIES.find((c) => c.key === result.category_key)?.label ?? "";
          const subLabel = getCategoryRule(result.category_key, result.subcategory_key)?.subcategoryLabel ?? "";

          setSuggestion({
            categoryKey: result.category_key,
            subcategoryKey: result.subcategory_key,
            categoryLabel: catLabel,
            subcategoryLabel: subLabel,
            reason: formattedReason,
          });

          setCategoryKey(result.category_key);
          setSubcategoryKey(result.subcategory_key);
          setArchiveEnabled(result.archive_enabled);
          setReferenceCandidateEnabled(result.reference_candidate_enabled);

          const mappedSensitivity = mapOutputToSensitivity(result.data_sensitivity);
          setDataSensitivity(mappedSensitivity);

          const defaults = getDefaultArchiveSettings(result.category_key, result.subcategory_key);
          setRequiresFile(defaults.requiresFile);
          setRequiresSourceLink(defaults.requiresSourceLink);
          setOutputTypes(defaults.outputTypes.join(", "));
        } else {
          setSuggestion({
            categoryKey: "",
            subcategoryKey: "",
            categoryLabel: "",
            subcategoryLabel: "",
            reason: formattedReason,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mendeteksi kategori.");
    } finally {
      setIsDetecting(false);
    }
  };

  useEffect(() => {
    if (!name.trim()) {
      const timer = setTimeout(() => {
        setLocalSuggestion(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      const result = runRuleBasedDetection(name, description);
      if (result && result.category_key && result.subcategory_key) {
        if (
          result.category_key !== categoryKey ||
          result.subcategory_key !== subcategoryKey
        ) {
          const catLabel = MAIN_CATEGORIES.find((c) => c.key === result.category_key)?.label ?? "";
          const subLabel = getCategoryRule(result.category_key, result.subcategory_key)?.subcategoryLabel ?? "";
          setLocalSuggestion({
            categoryKey: result.category_key,
            subcategoryKey: result.subcategory_key,
            categoryLabel: catLabel,
            subcategoryLabel: subLabel,
            reason: `Terdeteksi dari kata kunci "${result.matched_keywords?.[0] || ""}"`,
          });
          return;
        }
      }
      setLocalSuggestion(null);
    }, 500);

    return () => clearTimeout(timer);
  }, [name, description, categoryKey, subcategoryKey]);

  const handleCategoryChange = (catKey: string) => {
    setCategoryKey(catKey);
    setSubcategoryKey("");
    setOutputTypes("");
    setArchiveEnabled(true);
    setReferenceCandidateEnabled(false);
    setRequiresFile(false);
    setRequiresSourceLink(false);
    setDataSensitivity("normal");
  };

  const handleSubcategoryChange = (subKey: string) => {
    setSubcategoryKey(subKey);
    if (categoryKey && subKey) {
      const defaults = getDefaultArchiveSettings(categoryKey, subKey);
      setArchiveEnabled(defaults.archiveEnabled);
      setReferenceCandidateEnabled(defaults.referenceCandidateEnabled);
      setRequiresFile(defaults.requiresFile);
      setRequiresSourceLink(defaults.requiresSourceLink);
      setOutputTypes(defaults.outputTypes.join(", "));
      setDataSensitivity(defaults.dataSensitivity);
    }
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const colors = parseColorPalette(colorPalette);

    if (isClass) {
      if (!courseName.trim()) {
        setError("Mata kuliah wajib diisi.");
        return;
      }
      if (!name.trim()) {
        setError("Judul tugas wajib diisi.");
        return;
      }
      if (!deadline) {
        setError("Tenggat pengumpulan wajib diisi.");
        return;
      }
    } else {
      if (!name.trim()) {
        setError("Nama task wajib diisi.");
        return;
      }

      if (type === "acara" && !eventId) {
        setError("Event wajib dipilih untuk task acara.");
        return;
      }

      if (type === "divisi") {
        if (!divisionId || !divisionId.trim()) {
          setError("Divisi pokok wajib dipilih untuk jobdesk tipe divisi.");
          return;
        }
        if (activeOrmawaDivisions.length > 0) {
          const isValidInActiveOrmawa = activeOrmawaDivisions.some((d) => d.id === divisionId);
          if (!isValidInActiveOrmawa) {
            setError("Divisi yang dipilih tidak valid untuk ormawa aktif.");
            return;
          }
        }
      }

      if (!picId || !coordinatorId || !deadline) {
        setError("PIC, koordinator, dan deadline wajib diisi.");
        return;
      }

      // Validasi source link saja (field tunggal yang masih require valid URL)
      if (sourceLink && !isValidUrl(sourceLink)) {
        setError("Link sumber/editable design harus valid (diawali http/https).");
        return;
      }

      // Validasi multi-link textarea (ringan — beri warning, tidak block)
      const invalidRedaction = getInvalidUrlsFromTextarea(redactionLinksText);
      const invalidDesignRef = getInvalidUrlsFromTextarea(designRefLinksText);
      const invalidDriveRef = getInvalidUrlsFromTextarea(driveRefLinksText);
      const allInvalid = [...invalidRedaction, ...invalidDesignRef, ...invalidDriveRef];
      if (allInvalid.length > 0) {
        setError(`URL berikut tidak valid: ${allInvalid.slice(0, 3).join(", ")}${allInvalid.length > 3 ? "..." : ""}`);
        return;
      }
    }

    // Parse multi-link textarea
    const redactionLinks: ReferenceLink[] = isClass ? [] : parseLinksFromTextarea(redactionLinksText);
    const designRefLinks: ReferenceLink[] = isClass ? [] : parseLinksFromTextarea(designRefLinksText);
    const driveRefLinks: ReferenceLink[] = isClass ? [] : parseLinksFromTextarea(driveRefLinksText);

    // Legacy single-URL: pakai URL pertama dari multi-link sebagai fallback
    const firstRedactionUrl = redactionLinks[0]?.url || "";
    const firstDesignRefUrl = designRefLinks[0]?.url || "";
    const firstDriveRefUrl = driveRefLinks[0]?.url || "";

    const rawClassWorkspaceId =
      (activeWorkspace as unknown as Record<string, unknown>)?.id ||
      activeWorkspace?.id ||
      activeWorkspace?.org_id ||
      "ws_ilkom_2024";
    const classWorkspaceId = String(rawClassWorkspaceId);

    const resolvedPicId = isClass
      ? (task?.pic_id || userProfile?.id || user?.uid || fallbackCoordinatorId || "admin")
      : picId;

    const resolvedCoordId = isClass
      ? (task?.coordinator_id || userProfile?.id || user?.uid || fallbackCoordinatorId || "admin")
      : coordinatorId;

    setIsSubmitting(true);

    try {
      await onSave(
        {
          workspace_id: isClass ? classWorkspaceId : (task?.workspace_id || activeWorkspace.org_id),
          course_name: courseName.trim(),
          subject_name: courseName.trim(),
          submission_url: submissionUrl.trim() || "E-Learning Undiksha",
          submission_link: submissionUrl.trim() || "E-Learning Undiksha",
          organization_id: isClass ? classWorkspaceId : (task?.organization_id || activeWorkspace.org_id || "default_org"),
          org_id: isClass ? classWorkspaceId : (task?.org_id || activeWorkspace.org_id || "default_org"),
          orgId: isClass ? classWorkspaceId : (task?.orgId || activeWorkspace.org_id || "default_org"),
          campus_id: task?.campus_id || activeWorkspace.campus_id || "univ-undiksha",
          campusId: task?.campusId || activeWorkspace.campus_id || "univ-undiksha",
          univ_id: task?.univ_id || activeWorkspace.campus_id || "univ-undiksha",
          univId: task?.univId || activeWorkspace.campus_id || "univ-undiksha",
          type: isClass ? "tugas_kuliah" : type,
          event_id: (!isClass && type === "acara") ? eventId : "",
          division_id: (!isClass && type === "divisi") ? divisionId : "",
          name: name.trim(),
          title: name.trim(),
          description: description.trim(),
          pic_id: resolvedPicId,
          coordinator_id: resolvedCoordId,
          deadline: isClass && deadline && !deadline.includes("T") ? `${deadline}T23:59` : deadline,
          status: isClass ? (task?.is_archived ? "belum_dimulai" : (task?.status || "belum_dimulai")) : status,
          priority: isClass ? (task?.priority || "sedang") : priority,
          is_archived: false,
          copywriting: isClass ? "" : copywriting,
          // Legacy single-URL fields (backward compat)
          copywriting_docs_url: isClass ? "" : firstRedactionUrl,
          design_reference_url: isClass ? "" : firstDesignRefUrl,
          drive_reference_url: isClass ? "" : firstDriveRefUrl,
          color_palette: isClass ? [] : colors,
          visual_direction: isClass ? "" : visualDirection.trim(),
          category_key: isClass ? "" : categoryKey,
          category_label: isClass ? "" : (MAIN_CATEGORIES.find((c) => c.key === categoryKey)?.label ?? ""),
          subcategory_key: isClass ? "" : subcategoryKey,
          subcategory_label:
            !isClass && categoryKey && subcategoryKey
              ? (getCategoryRule(categoryKey, subcategoryKey)?.subcategoryLabel ?? "")
              : "",
          output_types: isClass ? [] : outputTypes
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          archive_enabled: isClass ? false : archiveEnabled,
          reference_candidate_enabled: isClass ? false : referenceCandidateEnabled,
          requires_file: isClass ? false : requiresFile,
          requires_source_link: isClass ? false : requiresSourceLink,
          source_link: isClass ? "" : sourceLink.trim(),
          archive_notes: isClass ? "" : archiveNotes.trim(),
          data_sensitivity: (isClass ? "normal" : dataSensitivity) as "normal" | "internal" | "sensitive",
          // Fase 26A: Multi-link fields
          redaction_links: redactionLinks,
          design_ref_links: designRefLinks,
          drive_ref_links: driveRefLinks,
          design_kit_source: isClass ? null : designKitSource,
        },
        task?.id,
      );
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal menyimpan task. Periksa izin akses dan Firestore Rules.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 px-4 py-8">
      <div className="w-full max-w-4xl rounded-none bg-white dark:bg-slate-900 shadow-none border border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">
                {isClass
                  ? task
                    ? "Edit Tugas Kuliah"
                    : "Tambah Tugas Kuliah"
                  : task
                  ? "Edit Job Desk"
                  : "Tambah Job Desk"}
              </h2>
              {!isClass && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Upload, status log, dan approval workflow masuk fase berikutnya.
                </p>
              )}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="rounded-none">
              <X className="h-4 w-4" />
              Tutup
            </Button>
          </div>
        </div>

        <form className="grid max-h-[78vh] gap-4 overflow-y-auto p-5" onSubmit={handleSubmit}>
          {isClass ? (
            /* ===================================================
               PANGKAS TOTAL FORMULIR TUGAS KELAS (5 KOLOM BERURUTAN)
               =================================================== */
            <div className="space-y-4">
              {task?.is_archived && (
                <div className="p-3 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-none flex items-center gap-2">
                  <span>ℹ️</span>
                  <span>Tugas ini saat ini <strong>diarsipkan</strong>. Memperbarui tenggat atau menyimpan perubahan ini akan otomatis mengaktifkan kembali tugas kuliah.</span>
                </div>
              )}

              {/* 1. Mata Kuliah */}
              <Field label="Mata Kuliah">
                <Input
                  id="task-form-course-input"
                  placeholder="Contoh: Pemrograman Web, Basis Data Lanjut"
                  value={courseName}
                  onChange={(event) => setCourseName(event.target.value)}
                  className="rounded-none shadow-none"
                  autoFocus={!autoFocusField || autoFocusField === "course_name"}
                  required
                />
              </Field>

              {/* 2. Judul Tugas */}
              <Field label="Judul Tugas">
                <Input
                  id="task-form-name-input"
                  placeholder="Contoh: Praktikum REST API Next.js"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-none shadow-none"
                  required
                />
              </Field>

              {/* 3. Ketentuan / Deskripsi Tugas */}
              <TextArea
                id="task-form-description-input"
                label="Ketentuan / Deskripsi Tugas"
                value={description}
                onChange={setDescription}
                placeholder="Tuliskan ketentuan pengerjaan, format file tugas, petunjuk modul dosen, dll."
              />

              {/* 4. Tenggat Pengumpulan */}
              <Field label="Tenggat Pengumpulan">
                <NeoDatePicker id="task-form-deadline-input" value={deadline} onChange={setDeadline} />
              </Field>

              {/* 5. Tempat / Link Pengumpulan */}
              <Field label="Tempat / Link Pengumpulan">
                <Input
                  id="task-form-submission-input"
                  placeholder="Contoh: E-learning Undiksha"
                  value={submissionUrl}
                  onChange={(event) => setSubmissionUrl(event.target.value)}
                  className="rounded-none shadow-none"
                />
              </Field>
            </div>
          ) : (
            <>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nama task">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Tipe task">
              <select
                className={selectClassName}
                value={type}
                onChange={(event) => setType(event.target.value as TaskType)}
              >
                {isClassWorkspace ? (
                  <option value="tugas_kuliah">Tugas Kuliah / Akademik</option>
                ) : (
                  <>
                    <option value="divisi">Divisi</option>
                    <option value="acara">Acara</option>
                    <option value="tugas_kuliah">Tugas Kuliah</option>
                  </>
                )}
              </select>
            </Field>
          </div>

          {type === "tugas_kuliah" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Mata Kuliah (Course)">
                <Input
                  placeholder="Contoh: Pemrograman Web, Basis Data Lanjut"
                  value={courseName}
                  onChange={(event) => setCourseName(event.target.value)}
                />
              </Field>
              <Field label="Link / Tempat Pengumpulan (LMS / Drive / Teks)">
                <Input
                  placeholder="Contoh: E-learning Undiksha, https://..., atau Google Drive"
                  value={submissionUrl}
                  onChange={(event) => setSubmissionUrl(event.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {type === "acara" ? (
            <Field label="Event">
              <select
                className={selectClassName}
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
              >
                <option value="">Pilih event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
              {(() => {
                const selectedEvent = events.find((e) => e.id === eventId);
                if (selectedEvent && selectedEvent.division_id) {
                  const hostDiv = divisions?.find((d) => d.id === selectedEvent.division_id);
                  if (hostDiv) {
                    return (
                      <p className="mt-1 text-xs text-sky-600 dark:text-sky-400 font-semibold">
                        Divisi Penyelenggara: {hostDiv.name}
                      </p>
                    );
                  }
                }
                return null;
              })()}
            </Field>
          ) : null}

          {type === "divisi" ? (
            <Field label="Divisi">
              <select
                className={selectClassName}
                value={divisionId}
                disabled={userProfile?.role !== "super_admin"}
                onChange={(event) => setDivisionId(event.target.value)}
              >
                <option value="">Pilih divisi</option>
                {activeOrmawaDivisions.length > 0 ? (
                  activeOrmawaDivisions.map((div) => (
                    <option key={div.id} value={div.id}>
                      {div.name}
                    </option>
                  ))
                ) : (
                  <option value="humas_media_kreatif">Humas dan Media Kreatif</option>
                )}
              </select>
            </Field>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="PIC">
              <select
                className={selectClassName}
                value={picId}
                onChange={(event) => setPicId(event.target.value)}
              >
                <option value="">Pilih PIC</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Koordinator">
              <select
                className={selectClassName}
                value={coordinatorId}
                onChange={(event) => setCoordinatorId(event.target.value)}
              >
                <option value="">Pilih koordinator</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Deadline">
              <NeoDatePicker value={deadline} onChange={setDeadline} />
            </Field>
            <Field label="Status">
              <select
                className={selectClassName}
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
              >
                {TASK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prioritas">
              <select
                className={selectClassName}
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
              >
                {TASK_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <TextArea label="Deskripsi" value={description} onChange={setDescription} />
          <TextArea label="Redaksi/copywriting" value={copywriting} onChange={setCopywriting} />

          {/* ===================================================
              Multi-link fields — Fase 26A
              =================================================== */}

          {/* Indikator Design Kit Source */}
          {(designKitSource === "event" || designKitSource === "division") && designKitSourceLabel && (
            <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50/70 dark:border-violet-800/40 dark:bg-violet-950/20 px-3 py-2.5 text-xs text-violet-700 dark:text-violet-300">
              <Info className="h-3.5 w-3.5 shrink-0 text-violet-500" />
              <span>
                Menggunakan default dari:{" "}
                <strong>{designKitSourceLabel}</strong>
              </span>
            </div>
          )}
          {designKitSource === "manual" && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 dark:border-amber-800/40 dark:bg-amber-950/20 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              <Info className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>Sudah disesuaikan manual untuk jobdesk ini.</span>
            </div>
          )}

          {/* Link redaksi / brief — Multi-line */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Link redaksi / brief
            </label>
            <textarea
              value={redactionLinksText}
              onChange={(e) => {
                setRedactionLinksText(e.target.value);
                setDesignKitSource("manual");
              }}
              placeholder={"https://docs.google.com/document/d/...\nhttps://docs.google.com/spreadsheets/d/..."}
              className="min-h-20 w-full rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-100 dark:focus:ring-slate-800"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Satu link per baris. Isi link Google Docs berisi naskah, caption, redaksi, TOR, atau brief tugas.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Link referensi desain — Multi-line */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Link referensi desain
              </label>
              <textarea
                value={designRefLinksText}
                onChange={(e) => {
                  setDesignRefLinksText(e.target.value);
                  setDesignKitSource("manual");
                }}
                placeholder={"https://www.canva.com/design/...\nhttps://pinterest.com/..."}
                className="min-h-20 w-full rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-100 dark:focus:ring-slate-800"
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Satu link per baris. Isi inspirasi desain dari Canva, Pinterest, Drive, Figma, atau referensi tahun sebelumnya.
              </p>
            </div>

            {/* Folder Google Drive referensi — Multi-line */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Folder Google Drive referensi
              </label>
              <textarea
                value={driveRefLinksText}
                onChange={(e) => {
                  setDriveRefLinksText(e.target.value);
                  setDesignKitSource("manual");
                }}
                placeholder={"https://drive.google.com/drive/folders/...\nhttps://drive.google.com/drive/folders/..."}
                className="min-h-20 w-full rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-100 dark:focus:ring-slate-800"
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Satu link per baris. Isi folder Drive berisi aset, logo, desain lama, dokumentasi, atau file pendukung.
              </p>
            </div>
          </div>

          {/* Referensi arsip */}
          <div className="rounded-[8px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                  Butuh inspirasi desain?
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Buka arsip referensi desain untuk melihat style lama, link Drive, dan palette.
                </p>
              </div>
              <Button asChild type="button" variant="secondary" size="sm">
                <Link href="/dashboard/references" target="_blank" className="flex items-center gap-1.5">
                  <FolderOpen className="h-4 w-4" />
                  Buka Referensi
                </Link>
              </Button>
            </div>
          </div>

          {/* Color palette + Visual direction */}
          <Field label="Color palette">
            <Input
              value={colorPalette}
              onChange={(event) => handleColorPaletteChange(event.target.value)}
              placeholder="#0f172a, #22c55e"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Pisahkan dengan koma. Bisa hex (#0f172a) atau nama warna. Diwariskan dari Design Kit acara/divisi jika kosong.
            </p>
          </Field>
          <TextArea
            label="Arahan visual/supergrafis"
            value={visualDirection}
            onChange={handleVisualDirectionChange}
          />

          {/* Section: Pengarsipan & Referensi */}
          <div className="rounded-[8px] border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-slate-50">
                  Pengarsipan &amp; Referensi
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Rule otomatis berjalan berdasarkan kategori dan subkategori pilihan. Anda tetap dapat mengubah pilihan pengarsipan/referensi secara manual.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleManualDetect}
                disabled={isDetecting}
                className="text-xs shrink-0"
              >
                {isDetecting ? "Mendeteksi..." : "Deteksi otomatis dari judul"}
              </Button>
            </div>

            {suggestion &&
              categoryKey === suggestion.categoryKey &&
              subcategoryKey === suggestion.subcategoryKey ? (
              <div
                className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs font-medium ${suggestion.categoryKey
                  ? "border-sky-100 bg-sky-50/50 text-sky-800 dark:border-sky-950/30 dark:bg-sky-950/20 dark:text-sky-350"
                  : "border-amber-100 bg-amber-50/50 text-amber-800 dark:border-amber-950/30 dark:bg-amber-950/20 dark:text-amber-350"
                  }`}
              >
                <span
                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${suggestion.categoryKey
                    ? "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                    }`}
                >
                  {suggestion.categoryKey ? "Kategori disarankan otomatis" : "Deteksi Kategori"}
                </span>
                <span className="font-medium">{suggestion.reason}</span>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Kategori Utama">
                <select
                  className={selectClassName}
                  value={categoryKey}
                  onChange={(event) => handleCategoryChange(event.target.value)}
                >
                  <option value="">Pilih kategori utama (opsional)</option>
                  {getMainCategories().map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Subkategori">
                <select
                  className={selectClassName}
                  value={subcategoryKey}
                  onChange={(event) => handleSubcategoryChange(event.target.value)}
                  disabled={!categoryKey}
                >
                  <option value="">Pilih subkategori</option>
                  {categoryKey &&
                    getSubcategories(categoryKey).map((sub) => (
                      <option key={sub.key} value={sub.key}>
                        {sub.label}
                      </option>
                    ))}
                </select>
              </Field>
            </div>

            {localSuggestion && (
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Saran:</span>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryKey(localSuggestion.categoryKey);
                    setSubcategoryKey(localSuggestion.subcategoryKey);
                    const defaults = getDefaultArchiveSettings(
                      localSuggestion.categoryKey,
                      localSuggestion.subcategoryKey,
                    );
                    setArchiveEnabled(defaults.archiveEnabled);
                    setReferenceCandidateEnabled(defaults.referenceCandidateEnabled);
                    setRequiresFile(defaults.requiresFile);
                    setRequiresSourceLink(defaults.requiresSourceLink);
                    setOutputTypes(defaults.outputTypes.join(", "));
                    setDataSensitivity(defaults.dataSensitivity);
                    setLocalSuggestion(null);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-bold"
                >
                  {localSuggestion.categoryLabel} &gt; {localSuggestion.subcategoryLabel}
                </button>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  ({localSuggestion.reason})
                </span>
              </div>
            )}

            {categoryKey && subcategoryKey ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-center gap-2 p-3 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <input
                      type="checkbox"
                      id="archiveEnabled"
                      checked={archiveEnabled}
                      onChange={(e) => setArchiveEnabled(e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="archiveEnabled"
                      className="text-xs font-semibold text-slate-900 dark:text-slate-100 select-none cursor-pointer"
                    >
                      Masuk Arsip Acara
                      <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Direkomendasikan
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <input
                      type="checkbox"
                      id="referenceCandidateEnabled"
                      checked={referenceCandidateEnabled}
                      onChange={(e) => setReferenceCandidateEnabled(e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="referenceCandidateEnabled"
                      className="text-xs font-semibold text-slate-900 dark:text-slate-100 select-none cursor-pointer"
                    >
                      Kandidat Referensi
                      <span className="block text-[10px] text-slate-500 font-medium">
                        {dataSensitivity === "sensitive" ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            Sensitif (Tidak disarankan)
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Direkomendasikan
                          </span>
                        )}
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <input
                      type="checkbox"
                      id="requiresFile"
                      checked={requiresFile}
                      onChange={(e) => setRequiresFile(e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="requiresFile"
                      className="text-xs font-semibold text-slate-900 dark:text-slate-100 select-none cursor-pointer"
                    >
                      Wajib File Hasil
                      <span className="block text-[10px] text-slate-500 font-medium">
                        Soft warning saat upload
                      </span>
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-center gap-2 p-3 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <input
                      type="checkbox"
                      id="requiresSourceLink"
                      checked={requiresSourceLink}
                      onChange={(e) => setRequiresSourceLink(e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="requiresSourceLink"
                      className="text-xs font-semibold text-slate-900 dark:text-slate-100 select-none cursor-pointer"
                    >
                      Wajib Link Sumber
                      <span className="block text-[10px] text-slate-500 font-medium">
                        Canva/Figma/Docs/Sheets
                      </span>
                    </label>
                  </div>

                  <Field label="Sensitivitas Data">
                    <select
                      className="h-11 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 outline-none"
                      value={dataSensitivity}
                      onChange={(e) =>
                        setDataSensitivity(e.target.value as "normal" | "internal" | "sensitive")
                      }
                    >
                      <option value="normal">Normal (Public/Shareable)</option>
                      <option value="internal">Internal (Panitia saja)</option>
                      <option value="sensitive">Sensitive (Data Pribadi/Bayar)</option>
                    </select>
                  </Field>

                  <Field label="Jenis Output">
                    <Input
                      placeholder="image, pdf, canva_link"
                      value={outputTypes}
                      onChange={(e) => setOutputTypes(e.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Label baru: "Link sumber/editable design" */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Link sumber/editable design
                    </label>
                    <Input
                      placeholder="https://..."
                      value={sourceLink}
                      onChange={(e) => setSourceLink(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Isi link Canva, Figma, Google Docs, Google Sheets, atau file editable lain jika ada.
                    </p>
                  </div>

                  {/* Label baru: "Catatan arsip / catatan untuk penerus" */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Catatan arsip / catatan untuk penerus
                    </label>
                    <Input
                      placeholder="Contoh: Upload format PDF..."
                      value={archiveNotes}
                      onChange={(e) => setArchiveNotes(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Tulis catatan penting agar koordinator atau penerus berikutnya paham konteks file ini.
                    </p>
                  </div>
                </div>
              </>
            ) : null}
          </div>
            </>
          )}

          {error ? (
            <p className="rounded-none bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200 border border-red-200 dark:border-red-800">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} className="rounded-none">
              <X className="h-4 w-4" />
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="rounded-none">
              <Save className="h-4 w-4" />
              {isSubmitting
                ? "Menyimpan..."
                : isClass
                ? "Simpan Tugas"
                : "Simpan task"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <textarea
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 w-full rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-100 dark:focus:ring-slate-800"
      />
    </label>
  );
}
