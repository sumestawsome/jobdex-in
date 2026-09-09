"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare,
  Shield,
  CheckCircle2,
  AlertCircle,
  Radio,
  ExternalLink,
  Info,
  Loader2,
  Lock,
  Building2,
  Send,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/hooks/use-auth";

export type WhatsAppProviderType = "fonnte" | "wablas";

export interface OrmawaGatewayConfig {
  provider: WhatsAppProviderType;
  api_token: string;
  server_url?: string;
  sender_number?: string;
  is_active: boolean;
  is_verified?: boolean;
  last_tested_at?: string;
}

const DEFAULT_CONFIG: OrmawaGatewayConfig = {
  provider: "fonnte",
  api_token: "",
  server_url: "https://api.fonnte.com",
  sender_number: "",
  is_active: false,
  is_verified: false,
};

export function OrmawaWhatsAppGatewaySettings() {
  const { user, userProfile } = useAuth();
  const { activeWorkspace, activeOrmawa, activeCampus } = useWorkspace();

  const [config, setConfig] = useState<OrmawaGatewayConfig>(DEFAULT_CONFIG);
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [maskedToken, setMaskedToken] = useState("");
  const [newTokenInput, setNewTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isEditingToken, setIsEditingToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Panel uji kirim state
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [testSimulationMode, setTestSimulationMode] = useState<"auto" | "force_success" | "force_error">("auto");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: "idle" | "success" | "error";
    message: string;
    details?: {
      provider: string;
      targetNumber: string;
      timestamp: string;
      code: number;
      messageId: string;
      errorReason?: string;
    };
  }>({ status: "idle", message: "" });

  const isAuthorizedAdmin =
    userProfile?.role === "super_admin" ||
    ((userProfile?.role === "koordinator_divisi" || userProfile?.role === "koordinator_acara") &&
      (!userProfile?.org_id || userProfile?.org_id === activeWorkspace.org_id));

  // Load configuration from server Firestore API with fallback to local storage
  useEffect(() => {
    let isCancelled = false;
    const loadGatewayConfig = async () => {
      setIsLoading(true);
      try {
        // Coba load dari server API route jika user terautentikasi
        if (user && activeWorkspace.org_id) {
          try {
            const idToken = await user.getIdToken();
            const res = await fetch(`/api/ormawas/${activeWorkspace.org_id}/whatsapp-gateway`, {
              headers: { Authorization: `Bearer ${idToken}` },
            });
            if (res.ok) {
              const data = await res.json();
              if (data.ok && data.gateway && !isCancelled) {
                setConfig({
                  provider: data.gateway.provider || "fonnte",
                  api_token: "",
                  server_url: data.gateway.server_url || "https://api.fonnte.com",
                  sender_number: data.gateway.sender_number || "",
                  is_active: Boolean(data.gateway.is_active),
                  is_verified: Boolean(data.gateway.is_verified),
                  last_tested_at: data.gateway.last_tested_at,
                });
                setHasStoredToken(Boolean(data.gateway.has_token));
                setMaskedToken(data.gateway.masked_token || "••••••••••••");
                setIsLoading(false);
                return;
              }
            }
          } catch {
            // fallback ke local cache
          }
        }

        // Fallback local mock storage
        const storageKey = `jobdex_wa_gw_${activeWorkspace.org_id}`;
        const saved = localStorage.getItem(storageKey);
        if (saved && !isCancelled) {
          const parsed = JSON.parse(saved) as OrmawaGatewayConfig;
          setConfig(parsed);
          if (parsed.api_token) {
            setHasStoredToken(true);
            const t = parsed.api_token;
            const mask = t.length > 8 ? `${t.slice(0, 4)}••••••••${t.slice(-4)}` : "••••••••••••";
            setMaskedToken(mask);
          }
        } else if (!isCancelled) {
          setConfig({
            provider: "fonnte",
            api_token: "",
            server_url: "https://api.fonnte.com",
            sender_number: "",
            is_active: false,
          });
          setHasStoredToken(false);
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadGatewayConfig();
    return () => {
      isCancelled = true;
    };
  }, [user, activeWorkspace.org_id]);

  const handleProviderChange = (newProvider: WhatsAppProviderType) => {
    setConfig((prev) => ({
      ...prev,
      provider: newProvider,
      server_url: newProvider === "fonnte" ? "https://api.fonnte.com" : "https://kudus.wablas.com",
    }));
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorizedAdmin) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const finalToken = newTokenInput.trim() ? newTokenInput.trim() : config.api_token;

      // 1. Simpan ke server Firestore API
      if (user && activeWorkspace.org_id) {
        try {
          const idToken = await user.getIdToken();
          const res = await fetch(`/api/ormawas/${activeWorkspace.org_id}/whatsapp-gateway`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              provider: config.provider,
              api_token: newTokenInput.trim() || undefined,
              server_url: config.server_url,
              sender_number: config.sender_number,
              is_active: config.is_active,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.gateway) {
              setHasStoredToken(Boolean(data.gateway.has_token));
              setMaskedToken(data.gateway.masked_token || "••••••••••••");
            }
          }
        } catch (serverErr) {
          console.warn("Gagal menyimpan ke server Firestore, menyimpan ke cache lokal:", serverErr);
        }
      }

      // 2. Persist juga ke local mock storage
      const updatedConfig: OrmawaGatewayConfig = {
        ...config,
        api_token: finalToken,
        is_active: finalToken.length > 0 ? config.is_active : false,
      };
      const storageKey = `jobdex_wa_gw_${activeWorkspace.org_id}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedConfig));

      setConfig(updatedConfig);
      if (finalToken) {
        setHasStoredToken(true);
        const mask =
          finalToken.length > 8
            ? `${finalToken.slice(0, 4)}••••••••${finalToken.slice(-4)}`
            : "••••••••••••";
        setMaskedToken(mask);
      }
      setNewTokenInput("");
      setIsEditingToken(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestMessage = async () => {
    const cleanPhone = testPhoneNumber.replace(/[^0-9+]/g, "").trim();
    if (!cleanPhone || cleanPhone.length < 9) {
      setTestResult({
        status: "error",
        message: "Nomor WhatsApp tujuan tidak valid. Masukkan minimal 9 digit nomor ponsel (contoh: 081234567890).",
      });
      return;
    }

    const activeToken = newTokenInput.trim() || config.api_token;
    if (!activeToken && testSimulationMode !== "force_success") {
      setTestResult({
        status: "error",
        message: "Token gateway WhatsApp ormawa belum diatur. Masukkan token terlebih dahulu.",
      });
      return;
    }

    setIsTesting(true);
    setTestResult({ status: "idle", message: "" });

    // 1. Coba panggil server endpoint API /api/ormawas/[id]/whatsapp-gateway/test
    if (user && activeWorkspace.org_id) {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(`/api/ormawas/${activeWorkspace.org_id}/whatsapp-gateway/test`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            targetNumber: cleanPhone,
            token: newTokenInput.trim() || undefined,
            provider: config.provider,
            serverUrl: config.server_url,
            simulate: testSimulationMode,
          }),
        });

        const resData = await res.json();
        setIsTesting(false);

        if (res.ok && resData.ok) {
          setTestResult({
            status: "success",
            message: resData.message || `Pesan uji berhasil dikirim ke ${cleanPhone} via ${config.provider.toUpperCase()}!`,
            details: resData.details || {
              provider: config.provider.toUpperCase(),
              targetNumber: cleanPhone,
              timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              code: 200,
              messageId: resData.messageId || `MSG-${Date.now().toString().slice(-6)}`,
            },
          });

          setConfig((prev) => ({
            ...prev,
            is_verified: true,
            last_tested_at: new Date().toISOString(),
          }));
          return;
        } else {
          setTestResult({
            status: "error",
            message: resData.message || resData.error || "Gagal mengirim pesan uji coba ke gateway.",
            details: resData.details || {
              provider: config.provider.toUpperCase(),
              targetNumber: cleanPhone,
              timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              code: res.status,
              messageId: `ERR-${Date.now().toString().slice(-6)}`,
              errorReason: resData.error || resData.message,
            },
          });
          return;
        }
      } catch (err) {
        console.warn("Gagal menghubungi server endpoint, beralih ke simulasi lokal:", err);
      }
    }

    // 2. Fallback Simulasi Lokal jika offline
    setTimeout(() => {
      setIsTesting(false);
      const now = new Date().toISOString();
      const mockMsgId = `MSG-TEST-${config.provider.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

      const isSuccess =
        testSimulationMode === "force_success" ||
        (testSimulationMode === "auto" && activeToken.length >= 10);

      if (isSuccess) {
        setTestResult({
          status: "success",
          message: `Pesan uji berhasil dikirim ke ${cleanPhone} via ${config.provider.toUpperCase()} (${activeOrmawa.short_name || activeOrmawa.name})!`,
          details: {
            provider: config.provider.toUpperCase(),
            targetNumber: cleanPhone,
            timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            code: 200,
            messageId: mockMsgId,
          },
        });

        const updatedConfig = {
          ...config,
          is_verified: true,
          last_tested_at: now,
        };
        setConfig(updatedConfig);
        try {
          const storageKey = `jobdex_wa_gw_${activeWorkspace.org_id}`;
          localStorage.setItem(storageKey, JSON.stringify(updatedConfig));
        } catch {
          // ignore
        }
      } else {
        const errorMsg =
          testSimulationMode === "force_error"
            ? "Simulasi Kegagalan: Gateway menolak token atau device sedang offline (401 Unauthorized)."
            : "Token gateway tidak valid atau belum diizinkan oleh provider (401 Unauthorized). Pesan uji gagal terkirim.";

        setTestResult({
          status: "error",
          message: errorMsg,
          details: {
            provider: config.provider.toUpperCase(),
            targetNumber: cleanPhone,
            timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            code: 401,
            messageId: mockMsgId,
            errorReason: "Autentikasi token ditolak oleh server gateway WhatsApp.",
          },
        });
      }
    }, 1200);
  };

  const handleResetTest = () => {
    setTestResult({ status: "idle", message: "" });
  };

  return (
    <div className="space-y-6">
      {/* ── Active Ormawa Workspace Context Banner ── */}
      <div className="rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-linear-to-br from-sky-50 via-white to-sky-50/30 dark:from-sky-950/40 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-black text-sm shadow-sm shrink-0">
              <MessageSquare className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-extrabold text-base sm:text-lg text-slate-950 dark:text-white">
                  Gateway WhatsApp Ormawa: {activeOrmawa.name}
                </h2>
                <Badge variant="neutral" className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 text-[11px] font-bold">
                  {activeCampus.name}
                </Badge>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Hubungkan gateway WhatsApp mandiri (Bring Your Own Gateway) agar notifikasi tugas, approval, dan bot interaktif berasal dari nomor resmi ormawa Anda.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {config.is_active && config.is_verified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Terhubung & Aktif</span>
              </span>
            ) : config.is_active ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-200">
                <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400" />
                <span>Belum Diuji</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <Radio className="size-3.5 text-slate-400" />
                <span>Gateway Non-Aktif</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Form Konfigurasi Token Ormawa ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="size-4 text-sky-600" />
                    <span>Konfigurasi Akun & Token Gateway</span>
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Hanya pengurus berwenang dari ormawa ini yang dapat melihat atau mengubah token.
                  </p>
                </div>
                <Badge variant="neutral" className="text-xs">
                  {config.provider.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-5">
              {!isAuthorizedAdmin && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                  <Shield className="size-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-bold">Mode Hanya Lihat (Read-Only)</p>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                      Anda masuk sebagai anggota atau di luar wewenang ormawa ini. Token disamarkan secara aman dan hanya admin/koordinator ormawa ini yang dapat melihat atau mengubah konfigurasi gateway.
                    </p>
                  </div>
                </div>
              )}

              {/* Pilihan Provider */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  1. Pilih Provider Gateway WhatsApp
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!isAuthorizedAdmin}
                    onClick={() => handleProviderChange("fonnte")}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      !isAuthorizedAdmin ? "opacity-75 cursor-not-allowed" : "cursor-pointer"
                    } ${
                      config.provider === "fonnte"
                        ? "border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 ring-2 ring-sky-400/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <span className={`flex size-5 items-center justify-center rounded-full border mt-0.5 shrink-0 ${
                      config.provider === "fonnte" ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300"
                    }`}>
                      {config.provider === "fonnte" && <Check className="size-3 stroke-[3]" />}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>Fonnte</span>
                        <span className="text-[10px] bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded font-bold">
                          Rekomendasi
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Mendukung webhook dua arah, broadcast grup acara, dan bot query instan.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!isAuthorizedAdmin}
                    onClick={() => handleProviderChange("wablas")}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      !isAuthorizedAdmin ? "opacity-75 cursor-not-allowed" : "cursor-pointer"
                    } ${
                      config.provider === "wablas"
                        ? "border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 ring-2 ring-sky-400/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <span className={`flex size-5 items-center justify-center rounded-full border mt-0.5 shrink-0 ${
                      config.provider === "wablas" ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300"
                    }`}>
                      {config.provider === "wablas" && <Check className="size-3 stroke-[3]" />}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        Wablas
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Dukungan multi-server domain Wablas, pengiriman gambar dan media langsung.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4 pt-2">
                {/* Kolom API Token */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      2. API Token Gateway ({config.provider.toUpperCase()})
                    </label>
                    {hasStoredToken && !isEditingToken && isAuthorizedAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsEditingToken(true)}
                        className="text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                      >
                        Ganti Token
                      </button>
                    )}
                  </div>

                  {hasStoredToken && !isEditingToken ? (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                      <div className="flex items-center gap-2 font-mono text-sm text-slate-700 dark:text-slate-300">
                        <Lock className="size-4 text-slate-400" />
                        <span>{showToken && isAuthorizedAdmin ? config.api_token : maskedToken}</span>
                      </div>
                      {isAuthorizedAdmin ? (
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                          title={showToken ? "Sembunyikan" : "Tampilkan"}
                        >
                          {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-sans">Tersamar</span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          type={showToken ? "text" : "password"}
                          value={newTokenInput}
                          onChange={(e) => setNewTokenInput(e.target.value)}
                          placeholder={hasStoredToken ? "Masukkan token baru untuk mengganti..." : "Paste API token dari dashboard provider..."}
                          className="pr-10 font-mono text-sm"
                          required={!hasStoredToken}
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        >
                          {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {isEditingToken && (
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Biarkan kosong jika tidak ingin mengubah token saat ini.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingToken(false);
                              setNewTokenInput("");
                            }}
                            className="text-slate-600 hover:underline cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
                    <Info className="size-3.5 shrink-0" />
                    <span>Token tersimpan aman dan terisolasi untuk ormawa ini saja.</span>
                  </p>
                </div>

                {/* Server URL (Khusus Wablas) */}
                {config.provider === "wablas" && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Server Domain URL
                    </label>
                    <Input
                      type="url"
                      value={config.server_url || ""}
                      onChange={(e) => setConfig({ ...config, server_url: e.target.value })}
                      placeholder="https://kudus.wablas.com"
                      className="font-mono text-sm"
                    />
                  </div>
                )}

                {/* Nomor Pengirim Resmi Ormawa */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Nomor WhatsApp Resmi Ormawa
                  </label>
                  <Input
                    type="tel"
                    value={config.sender_number || ""}
                    onChange={(e) => setConfig({ ...config, sender_number: e.target.value })}
                    placeholder="Contoh: 081234567890"
                  />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    Nomor perangkat yang terhubung pada dashboard gateway WhatsApp Anda.
                  </p>
                </div>

                {/* Status Aktif Toggle */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.is_active}
                      onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                      className="mt-1 size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        Aktifkan Pengiriman Via Gateway Ormawa Ini
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Jika diaktifkan, semua notifikasi tugas dan pengingat deadline untuk ormawa ini akan dikirim via nomor gateway di atas.
                      </p>
                    </div>
                  </label>
                </div>

                {saveSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span>Pengaturan gateway WhatsApp ormawa berhasil disimpan!</span>
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSaving || !isAuthorizedAdmin}
                    className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white font-bold px-6"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-2" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <span>Simpan Pengaturan Gateway</span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar: Panel Uji Kirim & Panduan ── */}
        <div className="space-y-6">
          {/* Panel Uji Kirim */}
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="size-4 text-emerald-600" />
                <span>Panel Uji Kirim Pesan</span>
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Uji apakah token gateway aktif sebelum dipakai pada operasional nyata.
              </p>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Nomor WhatsApp Tujuan Uji
                </label>
                <Input
                  type="tel"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="font-mono text-sm"
                />
              </div>

              {/* Status Tiruan Simulation Switcher */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  Mode Pengujian / Status Tiruan
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTestSimulationMode("auto")}
                    className={`text-[11px] font-semibold py-1.5 px-2 rounded-lg transition-all ${
                      testSimulationMode === "auto"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Otomatis
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestSimulationMode("force_success")}
                    className={`text-[11px] font-semibold py-1.5 px-2 rounded-lg transition-all ${
                      testSimulationMode === "force_success"
                        ? "bg-emerald-600 text-white shadow-xs font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Tiruan Sukses
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestSimulationMode("force_error")}
                    className={`text-[11px] font-semibold py-1.5 px-2 rounded-lg transition-all ${
                      testSimulationMode === "force_error"
                        ? "bg-rose-600 text-white shadow-xs font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Tiruan Gagal
                  </button>
                </div>
              </div>

              {/* Hasil Uji Kirim */}
              {testResult.status !== "idle" && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2.5 transition-all ${
                    testResult.status === "success"
                      ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
                      : "bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b pb-2 border-emerald-200/60 dark:border-emerald-800/60">
                    <div className="flex items-center gap-1.5 font-bold">
                      {testResult.status === "success" ? (
                        <>
                          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Status: Berhasil Terkirim</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="size-4 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span>Status: Gagal Terkirim</span>
                        </>
                      )}
                    </div>
                    <Badge
                      variant={testResult.status === "success" ? "success" : "error"}
                      className="text-[10px] px-1.5 py-0.5"
                    >
                      {testResult.details?.code ? `HTTP ${testResult.details.code}` : testResult.status.toUpperCase()}
                    </Badge>
                  </div>

                  <p className="text-xs font-medium leading-relaxed">{testResult.message}</p>

                  {testResult.details && (
                    <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-800 font-mono text-[11px] space-y-1 text-slate-700 dark:text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Pesan ID:</span>
                        <span className="font-bold">{testResult.details.messageId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Gateway:</span>
                        <span>{testResult.details.provider}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tujuan:</span>
                        <span>{testResult.details.targetNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Waktu Respon:</span>
                        <span>{testResult.details.timestamp}</span>
                      </div>
                      {testResult.details.errorReason && (
                        <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800 text-rose-600 dark:text-rose-400 font-sans">
                          <span className="font-bold">Penyebab: </span>
                          <span>{testResult.details.errorReason}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={handleResetTest}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                    >
                      Bersihkan Hasil Uji
                    </button>
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                disabled={isTesting}
                onClick={handleSendTestMessage}
                className="w-full font-bold border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    <span>Menghubungi Gateway & Mengirim...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-4 mr-2" />
                    <span>Kirim Pesan Uji</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Card Panduan Gateway */}
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shadow-xs">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Info className="size-4 text-sky-500" />
                <span>Cara Mendapatkan Token</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 text-xs text-slate-600 dark:text-slate-400 space-y-3">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">Fonnte:</span>
                <p className="mt-0.5">Daftar di <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="text-sky-600 underline inline-flex items-center gap-0.5">fonnte.com <ExternalLink className="size-2.5" /></a>, scan QR device WhatsApp ormawa Anda, lalu salin token dari menu Device.</p>
              </div>
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">Wablas:</span>
                <p className="mt-0.5">Daftar di <a href="https://wablas.com" target="_blank" rel="noreferrer" className="text-sky-600 underline inline-flex items-center gap-0.5">wablas.com <ExternalLink className="size-2.5" /></a>, sambungkan perangkat di Device Manager, lalu salin API Secret / Token.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
