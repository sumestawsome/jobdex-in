"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AIInput } from "@/components/ai/ai-input";
import { AIHistoryDateSeparator } from "@/components/ai/ai-history-date-separator";
import { AILoadingMessage } from "@/components/ai/ai-loading-message";
import { AIMessage } from "@/components/ai/ai-message";
import { AIQuickPrompts } from "@/components/ai/ai-quick-prompts";
import { AIQuotaWarning, countUserQuestionsToday, DEFAULT_AI_DAILY_LIMIT } from "@/components/ai/ai-quota-warning";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { getRecentAILogs } from "@/lib/firebase/ai-logs";
import { getMembers } from "@/lib/firebase/members";
import { formatDateSeparator, formatTime } from "@/lib/date-utils";
import type { AILog, UserProfile } from "@/types";

type AIQueryResponse = {
  answer?: string;
  error?: string;
};

type SendWhatsAppResponse = {
  error?: string;
};

// ─── Toast notification ───────────────────────────────────────────────────────
type ToastEntry = {
  id: string;
  type: "success" | "error";
  title: string;
  message: string;
};

function ToastList({ toasts, onDismiss }: { toasts: ToastEntry[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={`
            pointer-events-auto flex items-start gap-3 rounded-xl shadow-lg border px-4 py-3 min-w-[260px] max-w-xs
            animate-in slide-in-from-right-5 fade-in duration-200 cursor-pointer
            ${t.type === "success"
              ? "bg-white border-emerald-200 text-slate-800"
              : "bg-white border-red-200 text-slate-800"}
          `}
        >
          {t.type === "success"
            ? <CheckCircle2 className="size-5 text-emerald-500 mt-0.5 shrink-0" />
            : <XCircle className="size-5 text-red-500 mt-0.5 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">{t.title}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{t.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AIChat() {
  const { user, userProfile } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [logs, setLogs] = useState<AILog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const currentUserId = userProfile?.id || user?.uid;
  const usedToday = useMemo(
    () => countUserQuestionsToday(logs, currentUserId),
    [logs, currentUserId],
  );
  const isQuotaExhausted = usedToday >= DEFAULT_AI_DAILY_LIMIT || isRateLimited;

  const showToast = useCallback((type: ToastEntry["type"], title: string, message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Scroll to bottom instantly (no long smooth animation)
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    chatEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setError("");

    try {
      const [logData, userData] = await Promise.all([
        getRecentAILogs(activeWorkspace),
        getMembers(activeWorkspace.org_id, activeWorkspace.campus_id).catch(() => (userProfile ? [userProfile] : [])),
      ]);

      setLogs(logData);
      setUsers(userData);
    } catch {
      setError("Gagal memuat riwayat AI. Periksa Firestore Rules.");
    } finally {
      setHistoryLoading(false);
    }
  }, [userProfile, activeWorkspace]);

  const initialQueryProcessedRef = useRef(false);

  useEffect(() => {
    void Promise.resolve().then(loadHistory);
  }, [loadHistory]);

  useEffect(() => {
    if (typeof window !== "undefined" && !initialQueryProcessedRef.current && user && !historyLoading && !loading) {
      const searchParams = new URLSearchParams(window.location.search);
      const queryParam = searchParams.get("q");
      if (queryParam) {
        initialQueryProcessedRef.current = true;
        setTimeout(() => {
          ask(queryParam);
        }, 300);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, historyLoading, loading]);

  // Scroll when new messages arrive — instant so user doesn't see long animation from top
  useEffect(() => {
    scrollToBottom("instant");
  }, [logs, loading, scrollToBottom]);

  const usersById = useMemo(
    () => new Map(users.map((item) => [item.id, item])),
    [users],
  );
  const groupedLogs = useMemo(() => {
    const groups: Array<{ label: string; items: AILog[] }> = [];

    for (const log of logs) {
      const label = formatDateSeparator(log.created_at);
      const existingGroup = groups.find((group) => group.label === label);

      if (existingGroup) {
        existingGroup.items.push(log);
      } else {
        groups.push({ label, items: [log] });
      }
    }

    return groups;
  }, [logs]);

  async function ask(question: string) {
    if (!user || loading) {
      return;
    }

    if (isQuotaExhausted) {
      const quotaMsg = `Batas kuota harian (${DEFAULT_AI_DAILY_LIMIT} pertanyaan) telah tercapai. Coba lagi besok atau gunakan menu Referensi.`;
      setError(quotaMsg);
      showToast("error", "Kuota Habis", quotaMsg);
      return;
    }

    setError("");
    setLoading(true);
    // Immediately jump to bottom so loading bubble is visible
    setTimeout(() => scrollToBottom("instant"), 30);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/ai/query", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });
      const result = (await response.json()) as AIQueryResponse;

      if (response.status === 429) {
        setIsRateLimited(true);
        const limitMsg = result.error ?? `Batas kuota harian (${DEFAULT_AI_DAILY_LIMIT} pertanyaan) telah tercapai.`;
        showToast("error", "Batas Kuota Tercapai", limitMsg);
        throw new Error(limitMsg);
      }

      if (!response.ok || !result.answer) {
        throw new Error(result.error ?? "AI Assistant gagal menjawab.");
      }

      setLogs((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          organization_id: userProfile?.organization_id ?? "main_org",
          asked_by: userProfile?.id ?? "web",
          question,
          context_summary: "",
          answer: result.answer ?? "",
          model_used: "gemini-2.5-flash",
          source: "web",
          created_at: new Date(),
        },
      ]);
      void loadHistory();
    } catch (queryError) {
      setError(
        queryError instanceof Error
          ? queryError.message
          : "AI Assistant gagal menjawab.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyAnswer(answer: string) {
    await navigator.clipboard.writeText(answer);
    showToast("success", "Jawaban disalin", "Teks jawaban AI berhasil disalin ke clipboard.");
  }

  async function sendAnswerToWhatsApp(answer: string) {
    if (!user || sendingWhatsApp) {
      return;
    }

    setError("");
    setSendingWhatsApp(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/ai/send-whatsapp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answer }),
      });
      const result = (await response.json()) as SendWhatsAppResponse;

      if (!response.ok) {
        throw new Error(result.error ?? "Jawaban gagal dikirim ke WhatsApp.");
      }

      showToast("success", "Terkirim ke WhatsApp", "Jawaban AI berhasil dikirim ke grup/nomor tujuan.");
    } catch (sendError) {
      const msg = sendError instanceof Error ? sendError.message : "Jawaban gagal dikirim ke WhatsApp.";
      showToast("error", "Gagal mengirim", msg);
      setError(msg);
    } finally {
      setSendingWhatsApp(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Toast notifications (fixed position, outside scroll) */}
      <ToastList toasts={toasts} onDismiss={dismissToast} />

      {/* Quota Status & Warning (Always First) */}
      <AIQuotaWarning
        logs={logs}
        userId={currentUserId}
        dailyLimit={DEFAULT_AI_DAILY_LIMIT}
        isRateLimited={isRateLimited}
        className="mb-3 shrink-0"
      />

      {/* Scrollable Chat Area */}
      <section className="flex-1 min-h-0 overflow-y-auto space-y-4 jd-neo-card bg-[var(--secondary-background)] p-4 dark:bg-neutral-900/30 mb-4">
        {historyLoading ? (
          <div className="jd-neo-card p-4 text-sm font-normal text-slate-500 bg-white">
            Memuat riwayat chat...
          </div>
        ) : groupedLogs.length ? (
          groupedLogs.map((group) => (
            <div key={group.label} className="space-y-4">
              <AIHistoryDateSeparator label={group.label} />
              {group.items.map((log) => (
                <div key={log.id} className="space-y-3">
                  <AIMessage
                    role="user"
                    content={log.question}
                    authorName={
                      log.source === "whatsapp"
                        ? log.whatsapp_sender ?? "WhatsApp"
                        : usersById.get(log.asked_by)?.name ?? "User JobDex"
                    }
                    time={formatTime(log.created_at)}
                  />
                  <AIMessage
                    role="assistant"
                    content={log.answer}
                    time={formatTime(log.created_at)}
                    onCopy={copyAnswer}
                    onSendWhatsApp={sendAnswerToWhatsApp}
                    sendingWhatsApp={sendingWhatsApp}
                  />
                </div>
              ))}
            </div>
          ))
        ) : (
          <EmptyState
            title="Belum ada percakapan"
            description="Tanyakan progress, deadline, atau referensi desain."
          />
        )}
        {loading ? <AILoadingMessage /> : null}
        <div ref={chatEndRef} />
      </section>

      {/* Sticky Bottom Composer */}
      <div className="bg-[var(--background)] border-t border-border pt-3 space-y-3 shrink-0 sticky bottom-0 z-10 pb-2">
        {/* Error alert (inline, above input) */}
        {error ? (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-medium text-red-700">
            <XCircle className="size-3.5 shrink-0" />
            {error}
          </div>
        ) : null}

        {/* Quick Prompts Header */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pertanyaan Cepat</span>
          <button
            type="button"
            onClick={loadHistory}
            disabled={historyLoading}
            className="text-[11px] font-bold text-neutral-800 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white transition-colors underline cursor-pointer"
          >
            {historyLoading ? "Memuat..." : "Refresh Riwayat"}
          </button>
        </div>
        <AIQuickPrompts disabled={loading || isQuotaExhausted} onSelect={ask} />
        <AIInput
          disabled={loading || isQuotaExhausted}
          placeholder={
            isQuotaExhausted
              ? "Batas kuota harian tercapai (20/20). Coba lagi besok."
              : "Tanyakan progress, deadline, atau referensi desain..."
          }
          onSubmit={ask}
        />
      </div>
    </div>
  );
}
