"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles, X, AlertCircle, Loader2, RotateCcw, Volume2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import type { Event } from "@/types";
import type { ParsedJobdeskTask, SkippedJobdeskTask } from "@/lib/server/ai-bulk-jobdesk-parser";

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultWrapper {
  isFinal: boolean;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultWrapper;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export interface BulkExtractionData {
  eventName: string;
  eventId: string;
  tasks: ParsedJobdeskTask[];
  skippedTasks: SkippedJobdeskTask[];
  missingDeadlinesSummary?: string;
}

interface VoiceJobdeskDialogProps {
  open: boolean;
  onClose: () => void;
  events: Event[];
  defaultEventId?: string;
  onExtracted: (data: BulkExtractionData) => void;
}

export function VoiceJobdeskDialog({
  open,
  onClose,
  events,
  defaultEventId,
  onExtracted,
}: VoiceJobdeskDialogProps) {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Set default event saat dialog dibuka
  useEffect(() => {
    if (open) {
      if (defaultEventId) {
        setSelectedEventId(defaultEventId);
      } else if (events.length > 0) {
        // Cari acara yang sedang dalam status persiapan terlebih dahulu
        const persiapanEvent = events.find((e) => e.status === "persiapan");
        setSelectedEventId(persiapanEvent ? persiapanEvent.id : events[0].id);
      }
    }
  }, [open, defaultEventId, events]);

  // Inisialisasi Web Speech API saat modal dibuka
  useEffect(() => {
    if (!open) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      setTranscript("");
      setErrorMsg("");
      setIsProcessing(false);
      return;
    }

    const SpeechRec =
      typeof window !== "undefined"
        ? ((window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
            (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition)
        : null;

    if (!SpeechRec) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "id-ID";

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg("");
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let finalStr = "";
        let interimStr = "";

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          const textPart = res[0]?.transcript || "";
          if (res.isFinal) {
            finalStr += textPart + " ";
          } else {
            interimStr += textPart;
          }
        }

        const combined = (finalStr + interimStr).trim();
        if (combined) {
          setTranscript(combined);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        console.warn("[VoiceJobdeskDialog] Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setErrorMsg(
            "Izin mikrofon ditolak oleh browser. Mohon izinkan akses mikrofon di pengaturan browser atau ketik teks secara manual."
          );
          setIsListening(false);
        } else if (event.error === "no-speech") {
          // Tidak ada suara terdeteksi, biarkan terus mendengarkan
        } else {
          setErrorMsg(`Peringatan audio: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;

      // Otomatis mulai mendengarkan saat modal dibuka
      try {
        recognition.start();
      } catch {
        // ignore auto-start failure
      }
    } catch (err) {
      console.warn("[VoiceJobdeskDialog] Gagal inisialisasi SpeechRecognition:", err);
      setIsListening(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [open]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      setErrorMsg("");
      try {
        recognitionRef.current.start();
      } catch {
        // ignore
      }
      setIsListening(true);
    }
  };

  const handleClear = () => {
    setTranscript("");
    setErrorMsg("");
  };

  const handleProcessAI = async () => {
    const textToProcess = transcript.trim();
    if (!textToProcess) {
      setErrorMsg(
        "Belum ada suara atau teks yang terdeteksi. Silakan mulai bicara atau ketik daftar tugas terlebih dahulu."
      );
      return;
    }

    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    setIsProcessing(true);
    setErrorMsg("");

    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch("/api/jobdesk/bulk-parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: textToProcess,
          event_id: selectedEventId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal mengekstrak jobdesk dari rekaman suara.");
      }

      if (!data.tasks || data.tasks.length === 0) {
        setErrorMsg(
          "Tidak ada tugas pra-acara atau pasca-acara yang berhasil diidentifikasi. Silakan periksa kembali ucapan Anda."
        );
        setIsProcessing(false);
        return;
      }

      toast.success(`Berhasil mengekstrak ${data.tasks.length} job desk!`);

      onExtracted({
        eventName: data.event_name || "Acara",
        eventId: selectedEventId,
        tasks: data.tasks,
        skippedTasks: data.skipped_tasks || [],
        missingDeadlinesSummary: data.missing_deadlines_summary,
      });

      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses AI.";
      console.error("[VoiceJobdeskDialog] Extraction error:", err);
      setErrorMsg(message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!open) return null;

  const currentEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-950 border-2 border-zinc-900 dark:border-zinc-100 rounded-none shadow-none flex flex-col max-h-[90vh] overflow-hidden">
        {/* ── Dialog Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-none bg-secondary flex items-center justify-center text-secondary-foreground">
              <Mic className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Input Suara AI (Voice Yapping)</span>
                {isListening && (
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 border border-emerald-300 dark:border-emerald-800">
                    <span className="size-1.5 rounded-none bg-emerald-500 animate-ping" />
                    MEREKAM SUARA
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Sebutkan pembagian tugas panitia dan PIC secara santai, AI akan merapikannya otomatis.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-none transition-colors"
            title="Tutup dialog"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* ── Dialog Body ───────────────────────────────────────────────────── */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Target Event Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Calendar className="size-3.5 text-zinc-500" />
              <span>Target Acara:</span>
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full text-xs font-medium h-9 px-3 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary shadow-none"
            >
              <option value="" disabled>
                -- Pilih Acara Panitia --
              </option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.status.toUpperCase()})
                </option>
              ))}
            </select>
            {currentEvent && (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Jobdesk akan otomatis dipetakan ke panitia acara <strong>{currentEvent.name}</strong>.
              </p>
            )}
          </div>

          {/* Browser Support Warning */}
          {!isSupported && (
            <div className="flex items-start gap-2 p-3 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-none">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <strong>Browser tidak mendukung Speech Recognition otomatis.</strong>
                <p className="mt-0.5">
                  Anda tetap dapat mengetik atau menempelkan daftar jobdesk panitia secara manual di kotak transkrip di bawah.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-none">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Audio Wave Visualizer Indicator */}
          <div
            className={`p-4 border transition-colors flex flex-col items-center justify-center gap-3 ${
              isListening
                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-800"
                : "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800"
            }`}
          >
            {isListening ? (
              <div className="flex items-center gap-1.5 h-10">
                <span className="w-1.5 bg-emerald-500 animate-[bounce_1s_infinite_100ms] h-4" />
                <span className="w-1.5 bg-emerald-500 animate-[bounce_1s_infinite_200ms] h-8" />
                <span className="w-1.5 bg-emerald-500 animate-[bounce_1s_infinite_300ms] h-10" />
                <span className="w-1.5 bg-emerald-500 animate-[bounce_1s_infinite_400ms] h-6" />
                <span className="w-1.5 bg-emerald-500 animate-[bounce_1s_infinite_200ms] h-9" />
                <span className="w-1.5 bg-emerald-500 animate-[bounce_1s_infinite_350ms] h-5" />
                <span className="w-1.5 bg-emerald-500 animate-[bounce_1s_infinite_150ms] h-7" />
              </div>
            ) : (
              <div className="size-10 rounded-none bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                <Volume2 className="size-5" />
              </div>
            )}

            <div className="text-center">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {isListening
                  ? "Mikrofon aktif — silakan berbicara..."
                  : transcript
                  ? "Perekaman selesai. Anda dapat mengedit teks sebelum diproses."
                  : "Klik tombol 'Mulai Bicara' untuk memulai input suara"}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Contoh: &quot;Tolong buat pamflet FGS buat Kak Wardana deadline lusa, terus RAB buat Darma sama Agus, dan desain sertifikat buat Cici.&quot;
              </p>
            </div>

            {/* Toggle Mic Button */}
            {isSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-none transition-all shadow-none cursor-pointer ${
                  isListening
                    ? "bg-rose-600 hover:bg-rose-700 text-white border border-rose-700"
                    : "bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="size-4" />
                    <span>Jeda / Berhenti</span>
                  </>
                ) : (
                  <>
                    <Mic className="size-4" />
                    <span>{transcript ? "Lanjut Bicara" : "Mulai Bicara"}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Live Editable Transcript Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-zinc-700 dark:text-zinc-300">
                Transkrip Suara / Teks Daftar Jobdesk:
              </label>
              {transcript && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[11px] text-zinc-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="size-3" />
                  <span>Bersihkan</span>
                </button>
              )}
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Hasil suara akan muncul di sini secara langsung. Anda juga bisa mengedit atau mengetik manual jika ada nama/istilah yang perlu disesuaikan..."
              rows={5}
              className="w-full text-xs font-sans p-3 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary shadow-none resize-y"
            />
          </div>
        </div>

        {/* ── Dialog Footer ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold rounded-none border border-zinc-300 dark:border-zinc-700 bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-none transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleProcessAI}
            disabled={isProcessing || !transcript.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Mengekstrak AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                <span>✨ Ekstrak dengan AI</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
