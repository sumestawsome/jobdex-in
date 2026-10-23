"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sun,
  Moon,
  Layout,
  Columns,
  Info,
  Save,
  Loader2,
  Plus,
  X,
  Pencil,
  Settings,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertTriangle,
  Radio,
  SlidersHorizontal,
  Palette,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { getMembers } from "@/lib/firebase/members";
import {
  getDivisions,
  updateDivisionDesignKit,
  canEditDivisionDesignKit,
  createDivision,
  updateDivision,
} from "@/lib/firebase/divisions";
import {
  getWhatsAppSystemSettingsClient,
  updateWhatsAppSystemSettingsClient,
  DEFAULT_SANDBOX_TEST_GROUP_ID,
} from "@/lib/firebase/system-settings";
import {
  parseLinksFromTextarea,
  formatLinksToTextarea,
} from "@/lib/link-utils";
import { showSuccess, showError } from "@/lib/swal";
import { OrmawaWhatsAppGatewaySettings } from "@/components/settings/ormawa-whatsapp-gateway-settings";
import type { Division, UserProfile } from "@/types";

const selectClassName =
  "h-9 w-full rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-xs font-medium text-zinc-900 dark:text-zinc-100 outline-none transition-colors focus:border-indigo-600 focus:ring-0 shadow-none disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-400 cursor-pointer";

const textareaClassName =
  "min-h-20 w-full rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-normal text-zinc-900 dark:text-zinc-100 outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-indigo-600 focus:ring-0 shadow-none";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, userProfile } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Navigation Tabs state
  const [activeTab, setActiveTab] = useState<"preferences" | "design-kit" | "divisions" | "whatsapp">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (
        tabParam === "whatsapp" ||
        tabParam === "design-kit" ||
        tabParam === "divisions" ||
        tabParam === "preferences"
      ) {
        return tabParam;
      }
    }
    return "preferences";
  });

  // WhatsApp Sandbox states
  const [waIsTestMode, setWaIsTestMode] = useState(false);
  const [waTestGroupId, setWaTestGroupId] = useState(DEFAULT_SANDBOX_TEST_GROUP_ID);
  const [waSettingsLoading, setWaSettingsLoading] = useState(false);
  const [waSaving, setWaSaving] = useState(false);
  const [waPinging, setWaPinging] = useState(false);

  // Division Design Kit & CRUD states
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);
  const [dkLoading, setDkLoading] = useState(false);
  const [dkSaving, setDkSaving] = useState(false);

  // Design Kit form fields
  const [dkColorPalette, setDkColorPalette] = useState("");
  const [dkVisualDirection, setDkVisualDirection] = useState("");
  const [dkSupergraphicNotes, setDkSupergraphicNotes] = useState("");
  const [dkDesignRefLinks, setDkDesignRefLinks] = useState("");
  const [dkDriveRefLinks, setDkDriveRefLinks] = useState("");
  const [dkArchiveDriveLinks, setDkArchiveDriveLinks] = useState("");
  const [dkNotesForMembers, setDkNotesForMembers] = useState("");

  // Division CRUD Form Modal state
  const [crudModalOpen, setCrudModalOpen] = useState(false);
  const [crudEditingDiv, setCrudEditingDiv] = useState<Division | null>(null);
  const [crudName, setCrudName] = useState("");
  const [crudSlug, setCrudSlug] = useState("");
  const [crudDescription, setCrudDescription] = useState("");
  const [crudCoordinatorId, setCrudCoordinatorId] = useState("");
  const [crudIsActive, setCrudIsActive] = useState(true);
  const [crudError, setCrudError] = useState("");
  const [crudSubmitting, setCrudSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("jobdex-sidebar-collapsed");

    const handleToggleEvent = () => {
      const currentSaved = localStorage.getItem("jobdex-sidebar-collapsed");
      setIsCollapsed(currentSaved === "true");
    };

    window.addEventListener("jobdex-sidebar-toggle", handleToggleEvent);

    const timer = setTimeout(() => {
      setIsCollapsed(saved === "true");
      setMounted(true);
    }, 0);

    return () => {
      window.removeEventListener("jobdex-sidebar-toggle", handleToggleEvent);
      clearTimeout(timer);
    };
  }, []);

  const canManageDivisionKit = useMemo(() => {
    return userProfile?.role === "super_admin" || userProfile?.role === "koordinator_divisi";
  }, [userProfile]);

  const isSuperAdmin = useMemo(() => {
    return userProfile?.role === "super_admin";
  }, [userProfile]);

  // Load WhatsApp Sandbox settings
  const loadWhatsAppSettings = useCallback(async () => {
    setWaSettingsLoading(true);
    try {
      const settings = await getWhatsAppSystemSettingsClient();
      setWaIsTestMode(settings.isTestMode);
      setWaTestGroupId(settings.testGroupId || DEFAULT_SANDBOX_TEST_GROUP_ID);
    } catch (err) {
      console.error("Gagal memuat setting WhatsApp Sandbox:", err);
    } finally {
      setWaSettingsLoading(false);
    }
  }, []);

  const selectDivisionForEdit = useCallback((div: Division) => {
    setEditingDivision(div);
    setDkColorPalette(div.design_kit_color_palette?.join(", ") ?? "");
    setDkVisualDirection(div.design_kit_visual_direction ?? "");
    setDkSupergraphicNotes(div.design_kit_supergraphic_notes ?? "");
    setDkDesignRefLinks(formatLinksToTextarea(div.design_kit_design_reference_links));
    setDkDriveRefLinks(formatLinksToTextarea(div.design_kit_drive_reference_links));
    setDkArchiveDriveLinks(formatLinksToTextarea(div.design_kit_archive_drive_links));
    setDkNotesForMembers(div.design_kit_notes_for_members ?? "");
  }, []);

  // Load divisi dan anggota
  const loadData = useCallback(async () => {
    setDkLoading(true);
    try {
      const [divs, allMembers] = await Promise.all([
        getDivisions(activeWorkspace.org_id, activeWorkspace.campus_id),
        getMembers(activeWorkspace.org_id, activeWorkspace.campus_id).catch(() => []),
        loadWhatsAppSettings(),
      ]);
      setDivisions(divs);
      setMembers(allMembers);

      // Default selection for Design Kit edit
      if (userProfile?.role === "koordinator_divisi" && userProfile.division_id) {
        const myDiv = divs.find((d) => d.id === userProfile.division_id) || divs[0] || null;
        if (myDiv) selectDivisionForEdit(myDiv);
      } else if (divs.length > 0) {
        selectDivisionForEdit(divs[0]);
      }
    } catch (err) {
      console.error("Gagal memuat data pengaturan:", err);
    } finally {
      setDkLoading(false);
    }
  }, [userProfile, activeWorkspace, loadWhatsAppSettings, selectDivisionForEdit]);

  async function handleSaveWhatsAppSettings() {
    if (!userProfile) return;
    setWaSaving(true);
    try {
      await updateWhatsAppSystemSettingsClient(
        {
          isTestMode: waIsTestMode,
          testGroupId: waTestGroupId.trim() || DEFAULT_SANDBOX_TEST_GROUP_ID,
        },
        userProfile.id,
        userProfile.name
      );
      await showSuccess(
        `Pengaturan WhatsApp Sandbox berhasil disimpan!\nStatus: ${
          waIsTestMode ? "AKTIF (Semua pesan dialihkan ke grup test)" : "NONAKTIF (Mode Produksi Normal)"
        }`,
        "Pengaturan Disimpan"
      );
    } catch (err) {
      console.error("Gagal menyimpan setting WhatsApp Sandbox:", err);
      await showError("Gagal menyimpan pengaturan WhatsApp Sandbox.", "Error");
    } finally {
      setWaSaving(false);
    }
  }

  async function handlePingWhatsAppTest() {
    if (!user) return;
    setWaPinging(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/debug/whatsapp/send-test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "sandbox_ping",
          target: waTestGroupId.trim() || DEFAULT_SANDBOX_TEST_GROUP_ID,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirim pesan ping test");
      }
      await showSuccess(
        `Pesan ping test berhasil dikirim ke grup:\n${waTestGroupId}\n\nPeriksa WhatsApp untuk memastikan pesan diterima.`,
        "Ping Test Berhasil!"
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim pesan test.";
      await showError(msg, "Ping Test Gagal");
    } finally {
      setWaPinging(false);
    }
  }

  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(() => {
        void loadData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [mounted, loadData]);

  // Simpan Design Kit
  async function handleSaveDivisionKit() {
    if (!editingDivision || !userProfile) return;

    if (!canEditDivisionDesignKit(userProfile, editingDivision.id)) {
      await showError("Anda tidak memiliki akses untuk mengubah Design Kit divisi ini.", "Akses ditolak");
      return;
    }

    setDkSaving(true);
    try {
      const colorPaletteArr = dkColorPalette
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      await updateDivisionDesignKit(editingDivision.id, {
        color_palette: colorPaletteArr,
        visual_direction: dkVisualDirection.trim(),
        supergraphic_notes: dkSupergraphicNotes.trim(),
        design_reference_links: parseLinksFromTextarea(dkDesignRefLinks),
        drive_reference_links: parseLinksFromTextarea(dkDriveRefLinks),
        archive_drive_links: parseLinksFromTextarea(dkArchiveDriveLinks),
        notes_for_members: dkNotesForMembers.trim(),
      });

      await showSuccess(`Design Kit untuk divisi "${editingDivision.name}" berhasil disimpan.`, "Sukses");
      void loadData();
    } catch (err) {
      console.error("Gagal menyimpan Design Kit divisi:", err);
      await showError("Gagal menyimpan Design Kit divisi. Periksa koneksi dan Firestore Rules.", "Error");
    } finally {
      setDkSaving(false);
    }
  }

  // CRUD Divisi Functions
  function openAddDivisionModal() {
    setCrudEditingDiv(null);
    setCrudName("");
    setCrudSlug("");
    setCrudDescription("");
    setCrudCoordinatorId("");
    setCrudIsActive(true);
    setCrudError("");
    setCrudModalOpen(true);
  }

  function openEditDivisionModal(div: Division) {
    setCrudEditingDiv(div);
    setCrudName(div.name);
    setCrudSlug(div.slug || div.id);
    setCrudDescription(div.description || "");
    setCrudCoordinatorId(div.coordinator_id || "");
    setCrudIsActive(div.is_active !== false);
    setCrudError("");
    setCrudModalOpen(true);
  }

  async function handleSaveDivision(e: React.FormEvent) {
    e.preventDefault();
    setCrudError("");

    const nameTrimmed = crudName.trim();
    const slugTrimmed = crudSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const descriptionTrimmed = crudDescription.trim();

    if (!nameTrimmed) {
      setCrudError("Nama divisi wajib diisi.");
      return;
    }

    if (!slugTrimmed) {
      setCrudError("ID / Slug divisi wajib diisi dan hanya boleh huruf, angka, strip, atau underscore.");
      return;
    }

    setCrudSubmitting(true);

    try {
      const payload = {
        name: nameTrimmed,
        slug: slugTrimmed,
        description: descriptionTrimmed,
        coordinator_id: crudCoordinatorId,
        is_active: crudIsActive,
      };

      if (crudEditingDiv) {
        await updateDivision(crudEditingDiv.id, payload);
        await showSuccess("Divisi berhasil diperbarui!");
      } else {
        const exists = divisions.some((d) => d.id === slugTrimmed);
        if (exists) {
          setCrudError(`Divisi dengan ID "${slugTrimmed}" sudah terdaftar.`);
          setCrudSubmitting(false);
          return;
        }

        await createDivision(slugTrimmed, payload);
        await showSuccess("Divisi baru berhasil ditambahkan!");
      }

      setCrudModalOpen(false);
      void loadData();
    } catch (err) {
      console.error("Gagal menyimpan divisi:", err);
      setCrudError("Gagal menyimpan divisi. Periksa koneksi dan rules.");
    } finally {
      setCrudSubmitting(false);
    }
  }

  const handleSidebarToggle = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    localStorage.setItem("jobdex-sidebar-collapsed", String(collapsed));
    window.dispatchEvent(new Event("jobdex-sidebar-toggle"));
  };

  const membersMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <section>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Pengaturan</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Memuat preferensi Anda...
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-16">
      {/* ── Header Section ──────────────────────────────────────────────────── */}
      <header className="pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Pengaturan & Konfigurasi
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          Kelola preferensi antarmuka pengguna, aset visual Design Kit divisi, struktur divisi, dan integrasi WhatsApp Gateway.
        </p>
      </header>

      {/* ── Settings Navigation Tabs (Sharp Box Style) ───────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full sm:w-fit overflow-x-auto rounded-none shadow-none">
        <button
          type="button"
          onClick={() => setActiveTab("preferences")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-none transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 ${
            activeTab === "preferences"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 font-bold shadow-none"
              : "text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <SlidersHorizontal className="size-3.5" />
          <span>Preferensi UX</span>
        </button>

        {canManageDivisionKit && (
          <button
            type="button"
            onClick={() => setActiveTab("design-kit")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-none transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 ${
              activeTab === "design-kit"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 font-bold shadow-none"
              : "text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Palette className="size-3.5" />
            <span>Design Kit Divisi</span>
          </button>
        )}

        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab("divisions")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-none transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 ${
              activeTab === "divisions"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 font-bold shadow-none"
              : "text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Users className="size-3.5" />
            <span>Manajemen Divisi</span>
          </button>
        )}

        {(isSuperAdmin || canManageDivisionKit) && (
          <button
            type="button"
            onClick={() => setActiveTab("whatsapp")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-none transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 ${
              activeTab === "whatsapp"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 font-bold shadow-none"
              : "text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <MessageSquare className="size-3.5" />
            <span>WhatsApp Gateway</span>
          </button>
        )}
      </div>

      {/* ── Tab 1: Preferensi UX ── */}
      {activeTab === "preferences" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Tampilan Tema */}
          <Card className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none">
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                {theme === "dark" ? (
                  <Moon className="size-5 text-zinc-900 dark:text-zinc-100" />
                ) : (
                  <Sun className="size-5 text-zinc-900 dark:text-zinc-100" />
                )}
                <span>Tampilan Tema</span>
              </CardTitle>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Pilih mode tampilan gelap atau terang untuk antarmuka dashboard JobDex.in.
              </p>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-none border font-bold text-xs sm:text-sm transition-all duration-150 cursor-pointer shadow-none ${
                    theme === "light"
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <Sun className="size-4" />
                  <span>Mode Terang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-none border font-bold text-xs sm:text-sm transition-all duration-150 cursor-pointer shadow-none ${
                    theme === "dark"
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <Moon className="size-4" />
                  <span>Mode Gelap</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Tampilan Sidebar */}
          <Card className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none">
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                {isCollapsed ? (
                  <Columns className="size-5 text-zinc-900 dark:text-zinc-100" />
                ) : (
                  <Layout className="size-5 text-zinc-900 dark:text-zinc-100" />
                )}
                <span>Menu Sidebar</span>
              </CardTitle>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Pilih gaya menu navigasi sidebar: lebar penuh (full) atau ringkas ikon saja (compact).
              </p>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => handleSidebarToggle(false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-none border font-bold text-xs sm:text-sm transition-all duration-150 cursor-pointer shadow-none ${
                    !isCollapsed
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <Layout className="size-4" />
                  <span>Lebar Penuh</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSidebarToggle(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-none border font-bold text-xs sm:text-sm transition-all duration-150 cursor-pointer shadow-none ${
                    isCollapsed
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <Columns className="size-4" />
                  <span>Ikon Saja</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab 2: Design Kit Divisi ── */}
      {activeTab === "design-kit" && canManageDivisionKit && (
        <section className="space-y-4">
          <div className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-none">
            {dkLoading ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 py-6 justify-center">
                <Loader2 className="size-5 animate-spin text-indigo-600" />
                <span>Memuat data divisi...</span>
              </div>
            ) : divisions.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 py-6 text-center">
                Belum ada divisi yang terdaftar.
              </p>
            ) : (
              <div className="space-y-5">
                {/* Pilih divisi (hanya untuk super_admin) */}
                {userProfile?.role === "super_admin" && divisions.length > 1 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Pilih Divisi
                    </label>
                    <select
                      className={selectClassName}
                      value={editingDivision?.id ?? ""}
                      onChange={(e) => {
                        const div = divisions.find((d) => d.id === e.target.value);
                        if (div) selectDivisionForEdit(div);
                      }}
                    >
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editingDivision && (
                  <>
                    <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 rounded-none border border-zinc-200 dark:border-zinc-800 px-3 py-2">
                      <Info className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>
                        Mengedit Design Kit untuk: <strong className="text-zinc-900 dark:text-zinc-100">{editingDivision.name}</strong>
                      </span>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Color Palette Default
                      </label>
                      <Input
                        value={dkColorPalette}
                        onChange={(e) => setDkColorPalette(e.target.value)}
                        placeholder="Contoh: Indigo, Lime, Zinc-900, Amber-500"
                        className="rounded-none shadow-none border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm"
                      />
                      <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Pisahkan dengan koma. Gunakan token warna semantik atau hex.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Arahan Visual Default
                      </label>
                      <textarea
                        value={dkVisualDirection}
                        onChange={(e) => setDkVisualDirection(e.target.value)}
                        placeholder="Contoh: Tipografi tegas, dominasi kontras tinggi, geometri serba kotak tajam (rounded-none)..."
                        className={textareaClassName}
                        style={{ minHeight: "80px" }}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Catatan Supergrafis Divisi
                      </label>
                      <textarea
                        value={dkSupergraphicNotes}
                        onChange={(e) => setDkSupergraphicNotes(e.target.value)}
                        placeholder="Catatan elemen visual atau supergrafis khas ormawa/divisi..."
                        className={textareaClassName}
                        style={{ minHeight: "70px" }}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Link Referensi Desain Divisi
                      </label>
                      <textarea
                        value={dkDesignRefLinks}
                        onChange={(e) => setDkDesignRefLinks(e.target.value)}
                        placeholder={"https://www.canva.com/design/...\nhttps://pinterest.com/..."}
                        className={textareaClassName}
                        style={{ minHeight: "70px" }}
                      />
                      <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Satu link per baris (Canva, Figma, Pinterest, atau moodboard divisi).
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Folder Drive Referensi Divisi
                      </label>
                      <textarea
                        value={dkDriveRefLinks}
                        onChange={(e) => setDkDriveRefLinks(e.target.value)}
                        placeholder={"https://drive.google.com/drive/folders/..."}
                        className={textareaClassName}
                        style={{ minHeight: "60px" }}
                      />
                      <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Folder Drive berisi aset resmi, template, dan logo divisi.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Folder Arsip Divisi
                      </label>
                      <textarea
                        value={dkArchiveDriveLinks}
                        onChange={(e) => setDkArchiveDriveLinks(e.target.value)}
                        placeholder={"https://drive.google.com/drive/folders/..."}
                        className={textareaClassName}
                        style={{ minHeight: "60px" }}
                      />
                      <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Folder Drive untuk arsip master karya desain yang telah diselesaikan.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Catatan untuk Anggota Divisi
                      </label>
                      <textarea
                        value={dkNotesForMembers}
                        onChange={(e) => setDkNotesForMembers(e.target.value)}
                        placeholder="Panduan atau instruksi kerja standar untuk anggota yang baru bergabung..."
                        className={textareaClassName}
                        style={{ minHeight: "80px" }}
                      />
                    </div>

                    <div className="flex justify-end pt-3 border-t border-zinc-200 dark:border-zinc-800">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveDivisionKit}
                        disabled={dkSaving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-none shadow-none cursor-pointer flex items-center gap-1.5"
                      >
                        {dkSaving ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                        <span>{dkSaving ? "Menyimpan..." : "Simpan Design Kit Divisi"}</span>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Tab 3: Manajemen Divisi (Super Admin Only) ── */}
      {activeTab === "divisions" && isSuperAdmin && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Settings className="size-5 text-indigo-600 dark:text-indigo-400" />
              <span>Daftar Divisi Organisasi</span>
            </h2>
            <Button
              type="button"
              size="sm"
              onClick={openAddDivisionModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-3.5 rounded-none shadow-none flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Tambah Divisi</span>
            </Button>
          </div>

          <div className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto shadow-none">
            {dkLoading ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 py-10 justify-center">
                <Loader2 className="size-5 animate-spin text-indigo-600" />
                <span>Memuat data divisi...</span>
              </div>
            ) : divisions.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 py-10 text-center">
                Belum ada divisi yang dibuat.
              </p>
            ) : (
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="p-4">ID/Slug</th>
                    <th className="p-4">Nama Divisi</th>
                    <th className="p-4">Koordinator</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs sm:text-sm">
                  {divisions.map((div) => {
                    const coord = div.coordinator_id ? membersMap.get(div.coordinator_id) : null;
                    return (
                      <tr key={div.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="p-4 font-mono text-xs">{div.id}</td>
                        <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{div.name}</td>
                        <td className="p-4">
                          {coord ? (
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                              {coord.name}
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-xs">Belum ditentukan</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant={div.is_active !== false ? "success" : "neutral"} className="rounded-none text-[10px] uppercase font-bold">
                            {div.is_active !== false ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDivisionModal(div)}
                              className="text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 p-1 rounded-none h-8 w-8"
                              title="Edit Divisi"
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* ── Tab 4: WhatsApp Sandbox & Test Mode ── */}
      {activeTab === "whatsapp" && (
        <div className="space-y-8">
          {/* Ormawa BYO WhatsApp Gateway Configuration */}
          <OrmawaWhatsAppGatewaySettings />

          {/* WhatsApp Sandbox Settings (Developer / Testing) */}
          <div
            className={`rounded-none border p-5 sm:p-6 transition-all shadow-none ${
              waIsTestMode
                ? "bg-amber-50 dark:bg-amber-950/30 border-amber-500 dark:border-amber-700 text-amber-950 dark:text-amber-100"
                : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2.5 rounded-none shrink-0 ${
                    waIsTestMode
                      ? "bg-amber-600 text-white"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {waIsTestMode ? (
                    <AlertTriangle className="size-6" />
                  ) : (
                    <CheckCircle2 className="size-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold">
                      {waIsTestMode
                        ? "SANDBOX TEST MODE AKTIF"
                        : "MODE PRODUKSI NORMAL"}
                    </h3>
                    <Badge
                      variant={waIsTestMode ? "warning" : "success"}
                      className="text-[10px] uppercase font-bold rounded-none"
                    >
                      {waIsTestMode ? "Sandbox ON" : "Live ON"}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm mt-1 opacity-90 leading-relaxed">
                    {waIsTestMode
                      ? "SEMUA pesan notifikasi WhatsApp dari Web (Approval, update status, tugas baru, upload hasil) & Cron reminder DIALIHKAN PAKSA ke grup pengujian. Grup official dan nomor PIC 100% aman dari pesan uji coba."
                      : "Pesan notifikasi WhatsApp dikirim secara normal ke grup resmi masing-masing acara, divisi, dan nomor WhatsApp PIC yang bersangkutan."}
                  </p>
                </div>
              </div>

              {/* Quick Toggle Button in banner */}
              <button
                type="button"
                onClick={() => setWaIsTestMode(!waIsTestMode)}
                className={`px-4 py-2 rounded-none font-bold text-xs shrink-0 cursor-pointer shadow-none transition-all border ${
                  waIsTestMode
                    ? "bg-white dark:bg-zinc-900 border-amber-600 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950"
                    : "bg-amber-600 hover:bg-amber-700 border-amber-600 text-white"
                }`}
              >
                {waIsTestMode ? "Matikan Sandbox (Kembali ke Live)" : "Aktifkan Sandbox"}
              </button>
            </div>
          </div>

          {/* Configuration Card */}
          <Card className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none">
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                <Settings className="size-5 text-amber-600 dark:text-amber-400" />
                <span>Konfigurasi WhatsApp Sandbox & Target Grup</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Toggle Switch */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                <div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span>WhatsApp Sandbox / Test Mode</span>
                    <Badge variant={waIsTestMode ? "default" : "neutral"} className="text-[10px] rounded-none uppercase font-bold">
                      {waIsTestMode ? "AKTIF" : "NONAKTIF"}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Aktifkan opsi ini saat developer atau pengurus melakukan pengujian sistem agar tidak mengganggu grup operasional.
                  </p>
                </div>

                {/* Sharp square toggle switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={waIsTestMode}
                  onClick={() => setWaIsTestMode(!waIsTestMode)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-none border border-zinc-300 dark:border-zinc-700 transition-colors duration-150 focus:outline-none ${
                    waIsTestMode ? "bg-amber-600" : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block size-5 transform bg-white dark:bg-zinc-100 rounded-none shadow-none transition duration-150 ${
                      waIsTestMode ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Target Test Group ID */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Target Test Group ID (WhatsApp JID)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={waTestGroupId}
                    onChange={(e) => setWaTestGroupId(e.target.value)}
                    placeholder="Contoh: 120363406824082148@g.us"
                    className="font-mono text-xs sm:text-sm flex-1 rounded-none shadow-none border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWaTestGroupId(DEFAULT_SANDBOX_TEST_GROUP_ID)}
                    className="text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap rounded-none shadow-none"
                  >
                    Reset Default ID
                  </Button>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Default ID Grup Uji Coba: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded-none font-mono text-amber-600 dark:text-amber-400 font-bold break-all">{DEFAULT_SANDBOX_TEST_GROUP_ID}</code>.
                </p>
              </div>

              {/* Banner Preview Example */}
              <div className="p-4 rounded-none border border-dashed border-amber-300 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                  <Radio className="size-3.5" />
                  <span>Preview Header Pesan WhatsApp (Otomatis ditambahkan saat Sandbox ON):</span>
                </div>
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-none border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 leading-relaxed shadow-none">
                  <p className="font-bold text-amber-600 dark:text-amber-400">🧪 *[TEST / SANDBOX MODE]*</p>
                  <p className="italic text-zinc-500 dark:text-zinc-400">_(Aslinya ditujukan ke: Grup Humediktif Official / Acara PKKMB)_</p>
                  <p className="mt-2 text-zinc-900 dark:text-zinc-100">📌 [JobDex.in] ... (Isi pesan notifikasi normal) ...</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={waPinging}
                  onClick={handlePingWhatsAppTest}
                  className="w-full sm:w-auto font-bold flex items-center justify-center gap-1.5 rounded-none shadow-none text-xs h-9 px-4 border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  {waPinging ? (
                    <Loader2 className="size-4 animate-spin text-emerald-600" />
                  ) : (
                    <Send className="size-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>{waPinging ? "Mengirim Ping..." : "Kirim Pesan Tes (Ping Test)"}</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={waSaving || waSettingsLoading}
                  onClick={handleSaveWhatsAppSettings}
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center justify-center gap-1.5 rounded-none shadow-none text-xs h-9 px-5"
                >
                  {waSaving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  <span>{waSaving ? "Menyimpan..." : "Simpan Pengaturan Sandbox"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Crud Modal Form (Sharp Geometry) ── */}
      {crudModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-none bg-white dark:bg-zinc-900 shadow-none border border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 dark:border-zinc-800 p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {crudEditingDiv ? "Edit Divisi" : "Tambah Divisi"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Atur slug, nama, dan koordinator divisi pada form ini.
                </p>
              </div>
              <button
                onClick={() => setCrudModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDivision} className="p-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Nama Divisi
                </label>
                <Input
                  value={crudName}
                  onChange={(e) => {
                    setCrudName(e.target.value);
                    if (!crudEditingDiv) {
                      const slugified = e.target.value
                        .trim()
                        .toLowerCase()
                        .replace(/\s+/g, "_")
                        .replace(/[^a-z0-9_-]/g, "");
                      setCrudSlug(slugified);
                    }
                  }}
                  placeholder="Contoh: Media Kreatif & Desain"
                  className="rounded-none shadow-none border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  ID / Slug Divisi
                </label>
                <Input
                  value={crudSlug}
                  onChange={(e) => setCrudSlug(e.target.value)}
                  placeholder="Contoh: media_kreatif"
                  disabled={!!crudEditingDiv}
                  className="rounded-none shadow-none border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm font-mono"
                  required
                />
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                  Digunakan sebagai database key. Tidak dapat diubah setelah dibuat.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Deskripsi
                </label>
                <textarea
                  value={crudDescription}
                  onChange={(e) => setCrudDescription(e.target.value)}
                  placeholder="Penjelasan tugas/tanggung jawab divisi..."
                  className={textareaClassName}
                  style={{ minHeight: "70px" }}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Koordinator Divisi
                </label>
                <select
                  className={selectClassName}
                  value={crudCoordinatorId}
                  onChange={(e) => setCrudCoordinatorId(e.target.value)}
                >
                  <option value="">-- Tanpa Koordinator --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                  Saat di-set, user terpilih akan otomatis memiliki role koordinator_divisi.
                </p>
              </div>

              <label className="flex items-center gap-3 rounded-none border border-zinc-200 dark:border-zinc-800 p-3 text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer bg-zinc-50 dark:bg-zinc-950">
                <input
                  type="checkbox"
                  checked={crudIsActive}
                  onChange={(e) => setCrudIsActive(e.target.checked)}
                  className="size-4 rounded-none border-zinc-300 text-indigo-600 focus:ring-0"
                />
                <span>Divisi Aktif</span>
              </label>

              {crudError && (
                <div className="bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-200 text-xs p-3 rounded-none border border-red-300 dark:border-red-800">
                  {crudError}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCrudModalOpen(false)}
                  className="rounded-none shadow-none text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={crudSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-none shadow-none flex items-center gap-1.5"
                >
                  {crudSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  <span>{crudSubmitting ? "Menyimpan..." : "Simpan Divisi"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Info Lanjutan Alert ── */}
      <Alert variant="default" className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none">
        <div className="flex flex-col gap-1.5">
          <AlertTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-xs sm:text-sm">
            <Info className="size-4 text-indigo-600 dark:text-indigo-400" />
            <span>Konfigurasi Workspace & Cloud Data</span>
          </AlertTitle>
          <AlertDescription className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Pengaturan token WhatsApp gateway, status sandbox pengujian, dan konfigurasi Design Kit divisi disinkronisasikan ke Firestore secara real-time. Perubahan berlaku langsung pada seluruh sesi anggota aktif.
          </AlertDescription>
        </div>
      </Alert>
    </div>
  );
}
