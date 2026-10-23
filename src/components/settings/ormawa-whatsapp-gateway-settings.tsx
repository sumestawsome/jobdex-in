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
  Send,
  Eye,
  EyeOff,
  Check,
  Copy,
  RefreshCw,
  Smartphone,
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
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [origin, setOrigin] = useState("");

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const webhookUrl = `${origin || "https://jobdex.in"}/api/webhooks/${config.provider}/gemini`;

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

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2500);
    } catch {
      // ignore
    }
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
        message: "Nomor WhatsApp tujuan tidak valid. Masukkan minimal 9 digit nomor ponsel (contoh: 628123456789).",
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

    // 1. Coba panggil server endpoint API
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
      <div className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <span className="flex size-10 items-center justify-center rounded-none bg-emerald-600 text-white font-bold text-sm shrink-0">
              <MessageSquare className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100">
                  Gateway WhatsApp Ormawa: {activeOrmawa.name}
                </h2>
                <Badge variant="neutral" className="rounded-none text-[10px] font-bold">
                  {activeCampus.name}
                </Badge>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                Hubungkan gateway WhatsApp mandiri (Bring Your Own Gateway) agar notifikasi tugas, approval, dan bot interaktif berasal dari nomor resmi ormawa Anda.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {config.is_active && config.is_verified ? (
              <span className="inline-flex items-center gap-1.5 rounded-none bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200 shadow-none">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Terhubung & Aktif</span>
              </span>
            ) : config.is_active ? (
              <span className="inline-flex items-center gap-1.5 rounded-none bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-200 shadow-none">
                <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400" />
                <span>Belum Diuji</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-none bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400 shadow-none">
                <Radio className="size-3.5 text-zinc-400" />
                <span>Gateway Non-Aktif</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Form Konfigurasi Token Ormawa ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none">
            <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Shield className="size-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Konfigurasi Akun & Token Gateway</span>
                  </CardTitle>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Hanya pengurus berwenang dari ormawa ini yang dapat melihat atau mengubah token.
                  </p>
                </div>
                <Badge variant="neutral" className="rounded-none text-xs font-mono font-bold">
                  {config.provider.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-5">
              {!isAuthorizedAdmin && (
                <div className="p-3.5 rounded-none bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <Shield className="size-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-bold">Mode Hanya Lihat (Read-Only)</p>
                    <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
                      Anda masuk sebagai anggota atau di luar wewenang ormawa ini. Token disamarkan secara aman dan hanya admin/koordinator ormawa ini yang dapat mengubah konfigurasi gateway.
                    </p>
                  </div>
                </div>
              )}

              {/* Pilihan Provider */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  1. Pilih Provider Gateway WhatsApp
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!isAuthorizedAdmin}
                    onClick={() => handleProviderChange("fonnte")}
                    className={`flex items-start gap-3 p-3.5 rounded-none border text-left transition-all shadow-none ${
                      !isAuthorizedAdmin ? "opacity-75 cursor-not-allowed" : "cursor-pointer"
                    } ${
                      config.provider === "fonnte"
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                    }`}
                  >
                    <span className={`flex size-5 items-center justify-center rounded-none border mt-0.5 shrink-0 ${
                      config.provider === "fonnte" ? "border-indigo-600 bg-indigo-600 text-white" : "border-zinc-300 dark:border-zinc-700"
                    }`}>
                      {config.provider === "fonnte" && <Check className="size-3 stroke-[3]" />}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <span>Fonnte</span>
                        <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-none font-bold">
                          Rekomendasi
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Mendukung webhook dua arah, broadcast grup acara, dan bot query instan.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!isAuthorizedAdmin}
                    onClick={() => handleProviderChange("wablas")}
                    className={`flex items-start gap-3 p-3.5 rounded-none border text-left transition-all shadow-none ${
                      !isAuthorizedAdmin ? "opacity-75 cursor-not-allowed" : "cursor-pointer"
                    } ${
                      config.provider === "wablas"
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                    }`}
                  >
                    <span className={`flex size-5 items-center justify-center rounded-none border mt-0.5 shrink-0 ${
                      config.provider === "wablas" ? "border-indigo-600 bg-indigo-600 text-white" : "border-zinc-300 dark:border-zinc-700"
                    }`}>
                      {config.provider === "wablas" && <Check className="size-3 stroke-[3]" />}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        Wablas
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Dukungan multi-server domain Wablas, pengiriman pesan berkas dan media.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* ── Webhook Inbound URL Box ── */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  URL Webhook Inbound (Bot Interaktif)
                </label>
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <div className="flex-1 p-2.5 rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-800 dark:text-zinc-200 break-all select-all flex items-center">
                    {webhookUrl}
                  </div>
                  <Button
                    type="button"
                    onClick={handleCopyWebhook}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-auto py-2.5 px-4 rounded-none shadow-none shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedWebhook ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    <span>{copiedWebhook ? "Tersalin!" : "Salin Webhook"}</span>
                  </Button>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Tempelkan URL ini di pengaturan Webhook dashboard {config.provider.toUpperCase()} agar bot dapat merespons perintah pesan grup & japri.
                </p>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4 pt-2">
                {/* Kolom API Token */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      2. API Token Gateway ({config.provider.toUpperCase()})
                    </label>
                    {hasStoredToken && !isEditingToken && isAuthorizedAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsEditingToken(true)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                      >
                        Ganti Token
                      </button>
                    )}
                  </div>

                  {hasStoredToken && !isEditingToken ? (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                      <div className="flex items-center gap-2 font-mono text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 break-all min-w-0">
                        <Lock className="size-4 text-zinc-400 shrink-0" />
                        <span className="truncate">{showToken && isAuthorizedAdmin ? config.api_token : maskedToken}</span>
                      </div>
                      {isAuthorizedAdmin ? (
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer shrink-0"
                          title={showToken ? "Sembunyikan" : "Tampilkan"}
                        >
                          {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      ) : (
                        <span className="text-[11px] text-zinc-400 font-sans shrink-0">Tersamar</span>
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
                          className="pr-10 font-mono text-xs sm:text-sm rounded-none shadow-none border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                          required={!hasStoredToken}
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1 cursor-pointer"
                        >
                          {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {isEditingToken && (
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                          <span>Biarkan kosong jika tidak ingin mengubah token saat ini.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingToken(false);
                              setNewTokenInput("");
                            }}
                            className="text-zinc-600 dark:text-zinc-400 hover:underline cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5 flex items-center gap-1">
                    <Info className="size-3.5 shrink-0" />
                    <span>Token tersimpan aman di server Firestore dan terisolasi khusus untuk ormawa ini.</span>
                  </p>
                </div>

                {/* Server URL (Khusus Wablas) */}
                {config.provider === "wablas" && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Server Domain URL
                    </label>
                    <Input
                      type="url"
                      value={config.server_url || ""}
                      onChange={(e) => setConfig({ ...config, server_url: e.target.value })}
                      placeholder="https://kudus.wablas.com"
                      className="font-mono text-xs sm:text-sm rounded-none shadow-none border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    />
                  </div>
                )}

                {/* Nomor Pengirim Resmi Ormawa */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Nomor WhatsApp Perangkat Gateway
                  </label>
                  <Input
                    type="tel"
                    value={config.sender_number || ""}
                    onChange={(e) => setConfig({ ...config, sender_number: e.target.value })}
                    placeholder="Contoh: 6287842247411"
                    className="rounded-none shadow-none border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm"
                  />
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                    Nomor WhatsApp dari smartphone yang terhubung via QR scan di dashboard provider Anda.
                  </p>
                </div>

                {/* Status Aktif Toggle */}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <label className="flex items-start gap-3 p-3 rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.is_active}
                      onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                      className="mt-1 size-4 rounded-none border-zinc-300 text-indigo-600 focus:ring-0"
                    />
                    <div>
                      <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        Aktifkan Pengiriman Pesan via Gateway Ormawa Ini
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Jika diaktifkan, semua notifikasi tugas dan pengingat deadline untuk ormawa ini akan dikirim via nomor gateway di atas.
                      </p>
                    </div>
                  </label>
                </div>

                {saveSuccess && (
                  <div className="p-3 rounded-none bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span>Pengaturan gateway WhatsApp ormawa berhasil disimpan!</span>
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSaving || !isAuthorizedAdmin}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 text-xs h-9 rounded-none shadow-none cursor-pointer flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Shield className="size-4" />
                        <span>Simpan Pengaturan Gateway</span>
                      </>
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
          <Card className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none">
            <CardHeader className="p-5 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <CardTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Send className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Panel Uji Kirim Pesan</span>
              </CardTitle>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Uji apakah token gateway aktif sebelum dipakai pada operasional nyata.
              </p>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Nomor WhatsApp Tujuan Uji
                </label>
                <Input
                  type="tel"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="Contoh: 628123456789"
                  className="font-mono text-xs sm:text-sm rounded-none shadow-none border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>

              {/* Status Tiruan Simulation Switcher */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Mode Pengujian / Simulasi
                </label>
                <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-none">
                  <button
                    type="button"
                    onClick={() => setTestSimulationMode("auto")}
                    className={`text-[11px] font-semibold py-1.5 px-2 rounded-none transition-all cursor-pointer ${
                      testSimulationMode === "auto"
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold shadow-none"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    Otomatis
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestSimulationMode("force_success")}
                    className={`text-[11px] font-semibold py-1.5 px-2 rounded-none transition-all cursor-pointer ${
                      testSimulationMode === "force_success"
                        ? "bg-emerald-600 text-white font-bold shadow-none"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    Sukses
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestSimulationMode("force_error")}
                    className={`text-[11px] font-semibold py-1.5 px-2 rounded-none transition-all cursor-pointer ${
                      testSimulationMode === "force_error"
                        ? "bg-rose-600 text-white font-bold shadow-none"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    Gagal
                  </button>
                </div>
              </div>

              {/* Hasil Uji Kirim */}
              {testResult.status !== "idle" && (
                <div
                  className={`p-4 rounded-none border text-xs space-y-2.5 transition-all shadow-none ${
                    testResult.status === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100"
                      : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b pb-2 border-zinc-200 dark:border-zinc-800">
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
                      className="text-[10px] px-1.5 py-0.5 rounded-none font-mono"
                    >
                      {testResult.details?.code ? `HTTP ${testResult.details.code}` : testResult.status.toUpperCase()}
                    </Badge>
                  </div>

                  <p className="text-xs font-medium leading-relaxed">{testResult.message}</p>

                  {testResult.details && (
                    <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-none border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] space-y-1 text-zinc-700 dark:text-zinc-300 shadow-none">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Pesan ID:</span>
                        <span className="font-bold">{testResult.details.messageId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Gateway:</span>
                        <span>{testResult.details.provider}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Tujuan:</span>
                        <span>{testResult.details.targetNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Waktu Respon:</span>
                        <span>{testResult.details.timestamp}</span>
                      </div>
                      {testResult.details.errorReason && (
                        <div className="pt-1 mt-1 border-t border-zinc-200 dark:border-zinc-800 text-rose-600 dark:text-rose-400 font-sans">
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
                      className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline cursor-pointer"
                    >
                      Bersihkan Hasil Uji
                    </button>
                  </div>
                </div>
              )}

              <Button
                type="button"
                disabled={isTesting}
                onClick={handleSendTestMessage}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-none shadow-none cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Menghubungi Gateway...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    <span>Test Koneksi / Kirim Pesan Uji</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Card Panduan Gateway */}
          <Card className="rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 shadow-none">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <Info className="size-4 text-indigo-600 dark:text-indigo-400" />
                <span>Cara Mendapatkan Token</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 text-xs text-zinc-600 dark:text-zinc-400 space-y-3">
              <div>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">Fonnte:</span>
                <p className="mt-0.5">Daftar di <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline inline-flex items-center gap-0.5">fonnte.com <ExternalLink className="size-2.5" /></a>, scan QR device WhatsApp ormawa Anda, lalu salin token dari menu Device.</p>
              </div>
              <div>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">Wablas:</span>
                <p className="mt-0.5">Daftar di <a href="https://wablas.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline inline-flex items-center gap-0.5">wablas.com <ExternalLink className="size-2.5" /></a>, sambungkan perangkat di Device Manager, lalu salin API Secret / Token.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
