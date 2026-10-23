import { cn } from "@/lib/utils";
import { Copy, MessageCircle, User } from "lucide-react";

type AIMessageProps = {
  role: "user" | "assistant";
  content: string;
  authorName?: string;
  time?: string;
  onCopy?: (content: string) => void;
  onSendWhatsApp?: (content: string) => void;
  sendingWhatsApp?: boolean;
  canSendWhatsApp?: boolean;
};

export function AIMessage({
  role,
  content,
  authorName,
  time,
  onCopy,
  onSendWhatsApp,
  sendingWhatsApp = false,
  canSendWhatsApp = false,
}: AIMessageProps) {
  const isAssistant = role === "assistant";

  return (
    <div className={cn("flex my-2.5", isAssistant ? "justify-start" : "justify-end")}>
      <article
        className={cn(
          "max-w-[92%] md:max-w-[80%] rounded-none p-4 shadow-none transition-all border",
          isAssistant
            ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
            : "bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100",
        )}
      >
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-zinc-800 mb-2">
          <div className="flex items-center gap-1.5">
            {isAssistant ? (
              <span className="flex size-5 items-center justify-center rounded-none bg-indigo-600 text-white text-[10px] font-bold shadow-none">
                AI
              </span>
            ) : (
              <span className="flex size-5 items-center justify-center rounded-none bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-[10px] font-bold shadow-none">
                <User className="size-3 text-zinc-700 dark:text-zinc-300" />
              </span>
            )}
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              {authorName ?? (isAssistant ? "AI Assistant" : "Anda")}
            </p>
          </div>
          {time ? (
            <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
              {time}
            </span>
          ) : null}
        </div>

        <div
          style={{ overflowWrap: "anywhere" }}
          className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed break-words font-normal text-zinc-900 dark:text-zinc-100"
        >
          {content}
        </div>

        {isAssistant ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-zinc-200 dark:border-zinc-800 pt-2.5">
            <button
              type="button"
              onClick={() => onCopy?.(content)}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-none bg-zinc-100 hover:bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 text-[11px] font-semibold transition-all shadow-none border border-zinc-300 dark:border-zinc-700 cursor-pointer"
            >
              <Copy className="size-3 text-zinc-500 dark:text-zinc-400" />
              <span>Salin Jawaban</span>
            </button>
            {canSendWhatsApp && onSendWhatsApp && (
              <button
                type="button"
                onClick={() => onSendWhatsApp?.(content)}
                disabled={sendingWhatsApp}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-none bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-[11px] font-semibold transition-all shadow-none border border-emerald-700 dark:border-emerald-500 cursor-pointer disabled:opacity-50"
              >
                <MessageCircle className="size-3 text-white/90" />
                <span>{sendingWhatsApp ? "Mengirim..." : "Kirim ke WA"}</span>
              </button>
            )}
          </div>
        ) : null}
      </article>
    </div>
  );
}
