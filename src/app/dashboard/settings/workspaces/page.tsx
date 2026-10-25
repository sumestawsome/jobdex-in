"use client";

import { useEffect, useState, useId } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import {
  Building2,
  Plus,
  ArrowLeft,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Radio,
  Send,
  Users,
  MessageSquare,
  KeyRound,
  ExternalLink,
  RefreshCw,
  Info,
  Server,
  Zap,
} from "lucide-react";
import { showSuccess, showError } from "@/lib/swal";

type GatewayConfig = {
  interactive_instance_id?: string;
  interactive_token?: string;
  broadcast_instance_id?: string;
  broadcast_token?: string;
};

type AdminMember = {
  phone: string;
  name?: string;
  allow_voice_note_dm?: boolean;
  allow_voice_note_group?: boolean;
};

type ClassWorkspaceItem = {
  id: string;
  name: string;
  short_name?: string;
  type: string;
  status: string;
  whatsapp_settings: {
    announcement_group_id: string;
    discussion_group_id: string;
    gateways?: GatewayConfig;
  };
  authorized_admins: {
    admin_1: AdminMember;
    admin_2?: AdminMember;
    super_admin?: AdminMember;
  };
  created_at?: unknown;
};

export default function SuperAdminWorkspacesPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<ClassWorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [announcementGroupId, setAnnouncementGroupId] = useState("");
  const [discussionGroupId, setDiscussionGroupId] = useState("");
  const [admin1Name, setAdmin1Name] = useState("");
  const [admin1Phone, setAdmin1Phone] = useState("");
  const [admin2Name, setAdmin2Name] = useState("");
  const [admin2Phone, setAdmin2Phone] = useState("");
  const [superAdminPhone, setSuperAdminPhone] = useState("6285119459703");
  const [useCustomGateway, setUseCustomGateway] = useState(false);
  const [interactiveInstanceId, setInteractiveInstanceId] = useState("");
  const [interactiveToken, setInteractiveToken] = useState("");
  const [broadcastInstanceId, setBroadcastInstanceId] = useState("");
  const [broadcastToken, setBroadcastToken] = useState("");

  // Testing states
  const [testingA, setTestingA] = useState(false);
  const [testResultA, setTestResultA] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingB, setTestingB] = useState(false);
  const [testResultB, setTestResultB] = useState<{ ok: boolean; message: string } | null>(null);

  // Status check for cards
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);

  // Form field IDs
  const nameInputId = useId();
  const slugInputId = useId();
  const announcementInputId = useId();
  const discussionInputId = useId();
  const admin1NameId = useId();
  const admin1PhoneId = useId();
  const admin2NameId = useId();
  const admin2PhoneId = useId();
  const superAdminPhoneId = useId();
  const interactiveInstanceInputId = useId();
  const interactiveTokenInputId = useId();
  const broadcastInstanceInputId = useId();
  const broadcastTokenInputId = useId();

  // Auto-generate slug from name
  function handleNameChange(val: string) {
    setName(val);
    const generated = "ws_" + val.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    setSlug(generated);
  }

  async function fetchWorkspaces() {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/workspaces/classes", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setWorkspaces(data.workspaces || []);
      } else {
        showError(data.error || "Gagal memuat daftar kelas.", "Kesalahan");
      }
    } catch (err) {
      console.error("Failed to fetch workspaces:", err);
      showError("Gagal menghubungi server backend.", "Kesalahan Jaringan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user && userProfile?.role === "super_admin") {
      void fetchWorkspaces();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, userProfile, authLoading]);

  // Test Instance connection helper
  async function testInstance(idInst: string, tokInst: string, type: "A" | "B") {
    if (!user) return;
    if (!idInst || !tokInst) {
      showError("ID Instance dan Token Instance harus diisi terlebih dahulu.", "Peringatan");
      return;
    }

    if (type === "A") {
      setTestingA(true);
      setTestResultA(null);
    } else {
      setTestingB(true);
      setTestResultB(null);
    }

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/workspaces/classes/test-instance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          idInstance: idInst,
          apiTokenInstance: tokInst,
        }),
      });
      const data = await res.json();

      const result = {
        ok: res.ok && data.ok && data.isAuthorized,
        message: data.message || data.error || (data.isAuthorized ? "Terhubung & Terotorisasi" : "Status: " + data.stateInstance),
      };

      if (type === "A") {
        setTestResultA(result);
      } else {
        setTestResultB(result);
      }
    } catch {
      const failed = { ok: false, message: "Koneksi ke endpoint test instance gagal." };
      if (type === "A") setTestResultA(failed);
      else setTestResultB(failed);
    } finally {
      if (type === "A") setTestingA(false);
      else setTestingB(false);
    }
  }

  // Handle Form Submit
  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!name.trim()) {
      showError("Nama kelas wajib diisi.", "Validasi Gagal");
      return;
    }
    if (!slug.trim()) {
      showError("Slug ruang kerja wajib diisi.", "Validasi Gagal");
      return;
    }
    if (!announcementGroupId.trim() || !announcementGroupId.endsWith("@g.us")) {
      showError("ID Grup Pengumuman harus berakhiran @g.us (contoh: 120363411033795051@g.us).", "Validasi Gagal");
      return;
    }
    if (!discussionGroupId.trim() || !discussionGroupId.endsWith("@g.us")) {
      showError("ID Grup Diskusi harus berakhiran @g.us (contoh: 120363432766465224@g.us).", "Validasi Gagal");
      return;
    }
    if (!admin1Phone.trim()) {
      showError("Nomor WhatsApp Admin Komunitas 1 wajib diisi.", "Validasi Gagal");
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/workspaces/classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          id: slug.trim(),
          announcement_group_id: announcementGroupId.trim(),
          discussion_group_id: discussionGroupId.trim(),
          admin_1_name: admin1Name.trim() || "Korti",
          admin_1_phone: admin1Phone.trim(),
          admin_2_name: admin2Name.trim() || undefined,
          admin_2_phone: admin2Phone.trim() || undefined,
          super_admin_phone: superAdminPhone.trim() || "6285119459703",
          use_custom_gateway: useCustomGateway,
          gateways: useCustomGateway
            ? {
                interactive_instance_id: interactiveInstanceId.trim(),
                interactive_token: interactiveToken.trim(),
                broadcast_instance_id: broadcastInstanceId.trim(),
                broadcast_token: broadcastToken.trim(),
              }
            : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        await showSuccess(data.message || "Ruang kerja kelas berhasil ditambahkan!", "Berhasil");
        setIsModalOpen(false);
        // Reset form
        setName("");
        setSlug("");
        setAnnouncementGroupId("");
        setDiscussionGroupId("");
        setAdmin1Name("");
        setAdmin1Phone("");
        setAdmin2Name("");
        setAdmin2Phone("");
        setUseCustomGateway(false);
        setInteractiveInstanceId("");
        setInteractiveToken("");
        setBroadcastInstanceId("");
        setBroadcastToken("");
        setTestResultA(null);
        setTestResultB(null);
        void fetchWorkspaces();
      } else {
        showError(data.error || "Gagal membuat ruang kerja kelas.", "Gagal");
      }
    } catch {
      showError("Terjadi kesalahan jaringan saat mengirim data kelas.", "Kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  // Role Guard
  if (authLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (userProfile?.role !== "super_admin") {
    return (
      <div className="mx-auto max-w-4xl p-6 sm:p-10">
        <div className="rounded-none border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-6 text-zinc-900 dark:text-zinc-100 shadow-none">
          <div className="flex items-start gap-4">
            <ShieldAlert className="size-8 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h2 className="text-lg font-bold">Akses Dibatasi: Khusus Super Admin</h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Halaman Manajemen Ruang Kerja Kelas dan Perutean Gateway WhatsApp ini hanya dapat diakses oleh akun dengan hak Super Admin sistem JobDex.in.
              </p>
              <div className="pt-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-none bg-primary text-white hover:opacity-90 transition-opacity shadow-none"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Kembali ke Dashboard</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ── TOP NAV & BREADCRUMB ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="size-3" />
              <span>Pengaturan</span>
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Ruang Kerja Kelas</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            Manajemen & Penambahan Kelas Baru
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Cetak biru ruang kerja kelas, pemetaan Admin Komunitas, dan arsitektur perutean dual instance WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchWorkspaces}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer shadow-none transition-colors"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-none bg-primary text-white hover:opacity-90 cursor-pointer shadow-none transition-opacity"
          >
            <Plus className="size-4" />
            <span>Tambah Kelas Baru</span>
          </button>
        </div>
      </div>

      {/* ── ARSITEKTUR BLUEPRINT INFO ───────────────────────────────────────── */}
      <div className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 text-xs text-zinc-700 dark:text-zinc-300 space-y-2 shadow-none">
        <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
          <Zap className="size-4 text-amber-500 shrink-0" />
          <span>Arsitektur Dual Green-API & 3-Chat Limit Guard (JobDex.in Standard)</span>
        </div>
        <p className="leading-relaxed text-[11px] text-zinc-600 dark:text-zinc-400">
          Untuk menjaga kuota gratis Green-API (maksimal 3 room chat), sistem mengisolasi interaksi:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none space-y-1">
            <span className="font-bold text-primary flex items-center gap-1.5">
              <MessageSquare className="size-3.5" />
              <span>Instance A (Interaktif & Webhook Voice Note)</span>
            </span>
            <ul className="list-disc list-inside text-[11px] text-zinc-600 dark:text-zinc-400 space-y-0.5">
              <li>Chat 1: Admin 1 / Korti (Jalur DM dibuka)</li>
              <li>Chat 2: Admin 2 / Wakil Korti (Jalur DM dibuka)</li>
              <li>Chat 3: Grup Diskusi Kelas (Admin 1, 2, & Super Admin bisa VN)</li>
              <li className="text-amber-600 dark:text-amber-400 font-semibold">Super Admin di DM dibatasi untuk menghemat slot kuota chat.</li>
            </ul>
          </div>
          <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none space-y-1">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Send className="size-3.5" />
              <span>Instance B (Siaran Pengumuman Outbound Murni)</span>
            </span>
            <ul className="list-disc list-inside text-[11px] text-zinc-600 dark:text-zinc-400 space-y-0.5">
              <li>Khusus siaran tugas ke Grup Pengumuman Komunitas</li>
              <li>Webhook dinonaktifkan total (0% risiko echo loop)</li>
              <li>Pesan keluar 100% bersih tanpa watermark penyedia</li>
              <li>Dapat menggunakan instance kustom mandiri atau gateway sistem</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── DAFTAR RUANG KERJA KELAS ────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            Ruang Kerja Kelas Terdaftar ({workspaces.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-none shadow-none">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="border border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center bg-white dark:bg-zinc-900 rounded-none shadow-none space-y-3">
            <Building2 className="size-8 mx-auto text-zinc-400" />
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Belum ada ruang kerja kelas terdaftar dengan tipe <code>kelas</code>.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-none bg-primary text-white hover:opacity-90 shadow-none cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Tambah Kelas Pertama</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workspaces.map((ws) => {
              const a1 = ws.authorized_admins?.admin_1;
              const a2 = ws.authorized_admins?.admin_2;
              const sa = ws.authorized_admins?.super_admin;
              const hasCustomGw = Boolean(
                ws.whatsapp_settings?.gateways?.interactive_instance_id &&
                ws.whatsapp_settings?.gateways?.broadcast_instance_id
              );

              return (
                <div
                  key={ws.id}
                  className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-none"
                >
                  {/* Header Card */}
                  <div className="flex items-start justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{ws.name}</h3>
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-none bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                          {ws.status}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Slug: {ws.id}
                      </p>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-none border border-primary/30 text-primary bg-primary/5 uppercase">
                      Kelas
                    </span>
                  </div>

                  {/* Saluran WhatsApp */}
                  <div className="space-y-2 text-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Grup WhatsApp Terhubung
                    </p>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center justify-between p-2 rounded-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850">
                        <span className="text-zinc-500 font-medium">📢 Pengumuman (Siaran):</span>
                        <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]" title={ws.whatsapp_settings.announcement_group_id}>
                          {ws.whatsapp_settings.announcement_group_id || "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850">
                        <span className="text-zinc-500 font-medium">💬 Diskusi & Voice Note:</span>
                        <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]" title={ws.whatsapp_settings.discussion_group_id}>
                          {ws.whatsapp_settings.discussion_group_id || "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Admin Komunitas Berwenang */}
                  <div className="space-y-2 text-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Admin Komunitas (Slot 3-Chat Guard)
                    </p>
                    <div className="space-y-1.5 text-[11px]">
                      {a1 && (
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {a1.name || "Admin 1"} ({a1.phone || "-"})
                          </span>
                          <span className="px-1.5 py-0.2 rounded-none bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] border border-zinc-200 dark:border-zinc-700">
                            DM & Grup
                          </span>
                        </div>
                      )}
                      {a2?.phone && (
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {a2.name || "Admin 2"} ({a2.phone})
                          </span>
                          <span className="px-1.5 py-0.2 rounded-none bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] border border-zinc-200 dark:border-zinc-700">
                            DM & Grup
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {sa?.name || "Super Admin"} ({sa?.phone || "6285119459703"})
                        </span>
                        <span className="px-1.5 py-0.2 rounded-none bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] border border-amber-300 dark:border-amber-800" title="Super Admin VN dialihkan ke grup untuk menjaga kuota 3-chat DM">
                          Grup Diskusi Saja
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Konfigurasi Gateway */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Server className="size-3.5 text-zinc-400" />
                      <span className="text-[11px] text-zinc-500">
                        {hasCustomGw ? (
                          <span className="text-primary font-bold">Dual Green-API Kustom</span>
                        ) : (
                          <span className="text-zinc-600 dark:text-zinc-400 font-medium">Gateway Sistem (.env)</span>
                        )}
                      </span>
                    </div>

                    <Link
                      href={`/jadwal-tugas-ilkom-b`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <span>Lihat Jadwal</span>
                      <ExternalLink className="size-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL TAMBAH KELAS BARU ─────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-none my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Formulir Tambah Ruang Kerja Kelas Baru
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Konfigurasikan identitas kelas, grup WhatsApp, dan pemetaan admin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateClass} className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
              {/* Seksi 1: Identitas Kelas */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1">
                  <Building2 className="size-3.5 text-primary" />
                  <span>1. Identitas Kelas</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={nameInputId} className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Nama Kelas <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id={nameInputId}
                      type="text"
                      required
                      placeholder="contoh: Kelas Ilmu Komputer B 2024"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary shadow-none text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor={slugInputId} className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Slug / ID Workspace <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id={slugInputId}
                      type="text"
                      required
                      placeholder="ws_ilkom_b_2024"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="w-full px-3 py-2 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary shadow-none font-mono text-xs"
                    />
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">
                      Wajib diawali <code>ws_</code>.
                    </span>
                  </div>
                </div>
              </div>

              {/* Seksi 2: Saluran WhatsApp */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1">
                  <MessageSquare className="size-3.5 text-primary" />
                  <span>2. Saluran Grup WhatsApp</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={announcementInputId} className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      ID Grup Pengumuman (Siaran) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id={announcementInputId}
                      type="text"
                      required
                      placeholder="120363411033795051@g.us"
                      value={announcementGroupId}
                      onChange={(e) => setAnnouncementGroupId(e.target.value)}
                      className="w-full px-3 py-2 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary shadow-none font-mono text-xs"
                    />
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">
                      Target siaran pengumuman tugas. Format <code>... @g.us</code>.
                    </span>
                  </div>
                  <div>
                    <label htmlFor={discussionInputId} className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      ID Grup Diskusi Kelas <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id={discussionInputId}
                      type="text"
                      required
                      placeholder="120363432766465224@g.us"
                      value={discussionGroupId}
                      onChange={(e) => setDiscussionGroupId(e.target.value)}
                      className="w-full px-3 py-2 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary shadow-none font-mono text-xs"
                    />
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">
                      Wadah interaksi & pembuatan tugas via VN bersama.
                    </span>
                  </div>
                </div>
              </div>

              {/* Seksi 3: Pemetaan Admin Komunitas */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1">
                  <Users className="size-3.5 text-primary" />
                  <span>3. Admin Komunitas Berwenang (3-Chat Limit Guard)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={admin1NameId} className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Nama Admin 1 (Korti)
                    </label>
                    <input
                      id={admin1NameId}
                      type="text"
                      placeholder="contoh: Sumesta (Korti)"
                      value={admin1Name}
                      onChange={(e) => setAdmin1Name(e.target.value)}
                      className="w-full px-3 py-2 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary shadow-none text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor={admin1PhoneId} className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Nomor WA Admin 1 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id={admin1PhoneId}
                      type="text"
                      required
                      placeholder="6285119459703"
                      value={admin1Phone}
                      onChange={(e) => setAdmin1Phone(e.target.value)}
                      className="w-full px-3 py-2 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary shadow-none font-mono text-xs"
                    />
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">
                      Format <code>628...</code> (Memiliki hak akses VN di DM & Grup).
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label htmlFor={admin2NameId} className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Nama Admin 2 (Wakil Korti - Opsional)
                    </label>
                    <input
                      id={admin2NameId}
                      type="text"
                      placeholder="contoh: Made Darma Tanaya"
                      value={admin2Name}
                      onChange={(e) => setAdmin2Name(e.target.value)}
                      className="w-full px-3 py-2 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary shadow-none text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor={admin2PhoneId} className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Nomor WA Admin 2 (Opsional)
                    </label>
                    <input
                      id={admin2PhoneId}
                      type="text"
                      placeholder="628814878194"
                      value={admin2Phone}
                      onChange={(e) => setAdmin2Phone(e.target.value)}
                      className="w-full px-3 py-2 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary shadow-none font-mono text-xs"
                    />
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">
                      Slot chat ke-2 untuk akses VN via DM & Grup.
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <label htmlFor={superAdminPhoneId} className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Nomor WhatsApp Super Admin Sistem
                  </label>
                  <input
                    id={superAdminPhoneId}
                    type="text"
                    value={superAdminPhone}
                    onChange={(e) => setSuperAdminPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-none border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none shadow-none font-mono text-xs"
                  />
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 block">
                    Khusus Super Admin: VN hanya diproses di Grup Diskusi Kelas untuk menjaga kuota 3-chat DM tetap utuh.
                  </span>
                </div>
              </div>

              {/* Seksi 4: Konfigurasi Gateway Green-API */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider">
                    <Server className="size-3.5 text-primary" />
                    <span>4. Gateway WhatsApp Multi-Instance</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomGateway}
                      onChange={(e) => setUseCustomGateway(e.target.checked)}
                      className="rounded-none border-zinc-300 text-primary focus:ring-0"
                    />
                    <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                      Gunakan Instance Mandiri
                    </span>
                  </label>
                </div>

                {!useCustomGateway ? (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-none text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                    <Info className="size-4 text-primary shrink-0" />
                    <span>
                      Kelas ini akan menggunakan gateway WhatsApp default sistem dari file <code>.env.local</code>.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    {/* Instance A: Interaktif & VN */}
                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-none space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-primary flex items-center gap-1">
                          <MessageSquare className="size-3.5" />
                          <span>Instance A (Interaktif & Webhook Voice Note)</span>
                        </span>
                        <button
                          type="button"
                          disabled={testingA || !interactiveInstanceId || !interactiveToken}
                          onClick={() => testInstance(interactiveInstanceId, interactiveToken, "A")}
                          className="px-2.5 py-1 text-[10px] font-semibold rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-none cursor-pointer disabled:opacity-50"
                        >
                          {testingA ? "Menguji..." : "Uji Koneksi A"}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label htmlFor={interactiveInstanceInputId} className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                            ID Instance A
                          </label>
                          <input
                            id={interactiveInstanceInputId}
                            type="text"
                            placeholder="contoh: 710722779829"
                            value={interactiveInstanceId}
                            onChange={(e) => setInteractiveInstanceId(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label htmlFor={interactiveTokenInputId} className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                            Token Instance A
                          </label>
                          <input
                            id={interactiveTokenInputId}
                            type="password"
                            placeholder="token_instance_a"
                            value={interactiveToken}
                            onChange={(e) => setInteractiveToken(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                          />
                        </div>
                      </div>
                      {testResultA && (
                        <div className={`p-2 text-[10px] rounded-none border ${testResultA.ok ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300" : "border-rose-400 bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-300"}`}>
                          {testResultA.ok ? "✓ " : "✗ "} {testResultA.message}
                        </div>
                      )}
                    </div>

                    {/* Instance B: Siaran Pengumuman */}
                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-none space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Send className="size-3.5" />
                          <span>Instance B (Siaran Pengumuman Outbound Murni)</span>
                        </span>
                        <button
                          type="button"
                          disabled={testingB || !broadcastInstanceId || !broadcastToken}
                          onClick={() => testInstance(broadcastInstanceId, broadcastToken, "B")}
                          className="px-2.5 py-1 text-[10px] font-semibold rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-none cursor-pointer disabled:opacity-50"
                        >
                          {testingB ? "Menguji..." : "Uji Koneksi B"}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label htmlFor={broadcastInstanceInputId} className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                            ID Instance B
                          </label>
                          <input
                            id={broadcastInstanceInputId}
                            type="text"
                            placeholder="contoh: 710799887766"
                            value={broadcastInstanceId}
                            onChange={(e) => setBroadcastInstanceId(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label htmlFor={broadcastTokenInputId} className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                            Token Instance B
                          </label>
                          <input
                            id={broadcastTokenInputId}
                            type="password"
                            placeholder="token_instance_b"
                            value={broadcastToken}
                            onChange={(e) => setBroadcastToken(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                          />
                        </div>
                      </div>
                      {testResultB && (
                        <div className={`p-2 text-[10px] rounded-none border ${testResultB.ok ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300" : "border-rose-400 bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-300"}`}>
                          {testResultB.ok ? "✓ " : "✗ "} {testResultB.message}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer shadow-none"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-none bg-primary text-white hover:opacity-90 cursor-pointer shadow-none disabled:opacity-50"
                >
                  {submitting && <Loader2 className="size-3.5 animate-spin" />}
                  <span>{submitting ? "Menyimpan..." : "Simpan Ruang Kerja Kelas"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
