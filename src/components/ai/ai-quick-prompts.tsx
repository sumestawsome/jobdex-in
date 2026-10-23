"use client";

import { AI_QUICK_PROMPTS } from "@/lib/ai-prompts";

type AIQuickPromptsProps = {
  disabled?: boolean;
  onSelect: (prompt: string) => void;
};

export function AIQuickPrompts({ disabled = false, onSelect }: AIQuickPromptsProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none whitespace-nowrap">
      {AI_QUICK_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-none cursor-pointer transition-colors disabled:opacity-50 shrink-0 select-none shadow-none active:scale-[0.98]"
        >
          <span className="normal-case">{prompt}</span>
        </button>
      ))}
    </div>
  );
}
