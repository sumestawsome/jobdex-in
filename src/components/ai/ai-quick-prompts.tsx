"use client";

import { AI_QUICK_PROMPTS } from "@/lib/ai-prompts";

type AIQuickPromptsProps = {
  disabled?: boolean;
  onSelect: (prompt: string) => void;
};

export function AIQuickPrompts({ disabled = false, onSelect }: AIQuickPromptsProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none whitespace-nowrap -mx-1 px-1">
      {AI_QUICK_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-[#f7f7f8] text-[#242424] border border-[#e1e2e3] rounded-full cursor-pointer hover:bg-[#eaeaeb] transition-colors disabled:opacity-50 shrink-0 select-none shadow-2xs active:scale-[0.98]"
        >
          <span className="normal-case">{prompt}</span>
        </button>
      ))}
    </div>
  );
}
