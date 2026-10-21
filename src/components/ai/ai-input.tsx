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
    <form className="sticky bottom-0 bg-white/95 backdrop-blur-xs py-1" onSubmit={handleSubmit}>
      <div className="flex items-center gap-2.5 rounded-xl border border-[#e1e2e3] bg-white px-3.5 py-2 shadow-2xs focus-within:border-[#242424] focus-within:ring-1 focus-within:ring-[#242424]/10 transition-all">
        <textarea
          id="ai-question"
          rows={1}
          value={question}
          disabled={disabled}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 max-h-32 min-h-[24px] resize-none bg-transparent py-1 text-xs sm:text-sm text-[#242424] outline-none disabled:cursor-not-allowed placeholder:text-[#898989] overflow-y-auto"
        />
        <button
          type="submit"
          disabled={disabled || !question.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#242424] hover:bg-[#141414] text-white shadow-2xs transition-all active:scale-[0.98] shrink-0 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          title="Kirim pertanyaan"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </form>
  );
}
