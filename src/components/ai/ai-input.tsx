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
    <form className="sticky bottom-0 bg-transparent py-0.5" onSubmit={handleSubmit}>
      <div className="flex items-center gap-2.5 rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 shadow-none focus-within:border-zinc-400 dark:focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-400/20 transition-all">
        <textarea
          id="ai-question"
          rows={1}
          value={question}
          disabled={disabled}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 max-h-32 min-h-[26px] resize-none bg-transparent py-1 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none disabled:cursor-not-allowed placeholder:text-zinc-400 dark:placeholder:text-zinc-500 overflow-y-auto"
        />
        <button
          type="submit"
          disabled={disabled || !question.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-none bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white shadow-none transition-all shrink-0 cursor-pointer disabled:opacity-40 disabled:pointer-events-none border border-indigo-700 dark:border-indigo-500"
          title="Kirim pertanyaan"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </form>
  );
}
