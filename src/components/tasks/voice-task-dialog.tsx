"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles, X, AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

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

export interface ExtractedVoiceTaskData {
  status?: "ready" | "needs_clarification";
  course_name: string;
  name: string;
  description: string;
  deadline: string;
  submission_url: string;
  missing_fields?: string[];
  clarification_question?: string | null;
}

interface VoiceTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onTaskExtracted: (data: ExtractedVoiceTaskData) => void;
}

export function VoiceTaskDialog({ open, onClose, onTaskExtracted }: VoiceTaskDialogProps) {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Initialize SpeechRecognition on mount or open
  useEffect(() => {
    if (!open) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore abort error
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
        console.warn("[VoiceTaskDialog] Speech recognition event:", event.error);
        if (event.error === "not-allowed") {
          setErrorMsg("Izin mikrofon ditolak oleh browser. Mohon izinkan akses mikrofon atau ketik manual di bawah.");
          setIsListening(false);
        } else if (event.error === "no-speech") {
          // No speech detected yet, continue listening
        } else {
          setErrorMsg(`Peringatan mikrofon: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("[VoiceTaskDialog] Failed to start recognition:", err);
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

  const handleProcessAI = async () => {
    const textToProcess = transcript.trim();
    if (!textToProcess) {
      setErrorMsg("Belum ada suara atau teks yang terdeteksi. Silakan berbicara atau ketik detail tugas terlebih dahulu.");
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
      const res = await fetch("/api/tasks/parse-voice-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ transcript: textToProcess }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal memproses suara dengan AI.");
      }

      const extracted: ExtractedVoiceTaskData = {
        status: (json.status || json.data?.status || "ready") as "ready" | "needs_clarification",
        course_name: String(json.course_name ?? json.data?.course_name ?? "").trim(),
        name: String(json.name ?? json.data?.name ?? "").trim(),
        description: String(json.description ?? json.data?.description ?? "").trim(),
        deadline: String(json.deadline ?? json.data?.deadline ?? "").trim(),
        submission_url: String(json.submission_url ?? json.data?.submission_url ?? "E-Learning Undiksha").trim(),
        missing_fields: Array.isArray(json.missing_fields)
          ? json.missing_fields
          : Array.isArray(json.data?.missing_fields)
          ? json.data.missing_fields
          : [],
        clarification_question: json.clarification_question ?? json.data?.clarification_question ?? null,
      };

      onTaskExtracted(extracted);
      onClose();
    } catch (err) {
      console.error("[VoiceTaskDialog] Process AI error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Gagal memproses suara.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-none bg-primary/10 text-primary">
              <Mic className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Input Tugas via Suara
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Didukung oleh Gemini AI &amp; Web Speech Recognition
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-none text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
          >
            <X className="size-4" />
            <span className="sr-only">Tutup</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          {/* Animated Listening / Processing Banner */}
          <div className="flex flex-col items-center justify-center p-6 rounded-none border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-center">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex size-14 items-center justify-center rounded-none border border-primary/40 bg-primary/10 text-primary animate-pulse">
                  <Sparkles className="size-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Sedang mengekstrak detail tugas dengan AI...
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Mata kuliah, judul, tenggat, dan ketentuan sedang dipetakan.
                  </p>
                </div>
              </div>
            ) : isListening ? (
              <div className="flex flex-col items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <div className="absolute size-16 rounded-full bg-red-500/20 animate-ping" />
                  <button
                    type="button"
                    onClick={toggleListening}
                    className="relative flex size-14 items-center justify-center rounded-none border border-red-500 bg-red-600 text-white cursor-pointer active:scale-95 transition-transform"
                    title="Klik untuk jeda perekaman"
                  >
                    <Mic className="size-6" />
                  </button>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 tracking-wide uppercase">
                    Mendengarkan...
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-xs leading-relaxed">
                    Sebutkan mata kuliah, judul tugas, dan tenggat waktu secara jelas.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={toggleListening}
                  className="flex size-14 items-center justify-center rounded-none border border-zinc-300 dark:border-zinc-700 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 cursor-pointer transition-colors active:scale-95"
                  title="Klik untuk mulai mendengarkan"
                >
                  <MicOff className="size-6 text-zinc-500" />
                </button>
                <div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Mikrofon Dijeda
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Klik tombol mikrofon di atas untuk melanjutkan berbicara.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Fallback Warning if Browser doesn't support Web Speech API */}
          {!isSupported && (
            <div className="flex items-start gap-2.5 p-3 rounded-none border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Browser Belum Mendukung Perekaman Suara Otomatis</p>
                <p className="mt-0.5 text-[11px] opacity-90">
                  Gunakan Google Chrome atau Microsoft Edge untuk mikrofon langsung, atau ketikkan kalimat tugas Anda pada kotak di bawah ini.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-none border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Real-time Live Transcript Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>Transkrip Suara Langsung:</span>
                {isListening && (
                  <span className="inline-block size-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </label>
              {transcript && (
                <button
                  type="button"
                  onClick={() => setTranscript("")}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <RotateCcw className="size-3" />
                  <span>Hapus</span>
                </button>
              )}
            </div>

            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Contoh: 'Tugas mata kuliah Pemrograman Web membuat REST API dikumpulkan hari Rabu depan di E-Learning Undiksha'..."
              rows={4}
              className="w-full p-3 text-xs sm:text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/60 dark:bg-zinc-950/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-none shadow-none text-xs"
          >
            Batal
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleProcessAI}
            disabled={isProcessing || !transcript.trim()}
            className="rounded-none shadow-none text-xs gap-1.5 bg-primary hover:bg-primary-hover text-primary-foreground"
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Memproses AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                <span>Berhenti &amp; Proses AI</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
