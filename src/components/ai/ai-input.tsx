"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

type AIInputProps = {
  disabled?: boolean;
  placeholder?: string;
  onSubmit: (question: string) => Promise<void>;
};

export function AIInput({
  disabled = false,
  placeholder = "Tanyakan progress, deadline, atau referensi desain...",
  onSubmit,
}: AIInputProps) {
  const [question, setQuestion] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuestion = question.trim();

    if (!nextQuestion) {
      return;
    }

    await onSubmit(nextQuestion);
    setQuestion("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form className="sticky bottom-0 bg-[var(--jd-neo-bg)]/90 backdrop-blur py-2 jd-sticky-bottom-safe" onSubmit={handleSubmit}>
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-[var(--secondary-background)] px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 transition-all">
        <textarea
          id="ai-question"
          rows={1}
          value={question}
          disabled={disabled}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 max-h-32 min-h-[24px] resize-none bg-transparent py-1 text-sm text-[var(--foreground)] outline-none disabled:cursor-not-allowed placeholder:text-slate-400 dark:placeholder:text-slate-500 overflow-y-auto"
        />
        <button
          type="submit"
          disabled={disabled || !question.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors shrink-0 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          title="Kirim pesan"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
