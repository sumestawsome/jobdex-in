import { cn } from "@/lib/utils";
import { Copy, MessageCircle, Bot, User } from "lucide-react";

type AIMessageProps = {
  role: "user" | "assistant";
  content: string;
  authorName?: string;
  time?: string;
  onCopy?: (content: string) => void;
  onSendWhatsApp?: (content: string) => void;
  sendingWhatsApp?: boolean;
};

export function AIMessage({
  role,
  content,
  authorName,
  time,
  onCopy,
  onSendWhatsApp,
  sendingWhatsApp = false,
}: AIMessageProps) {
  const isAssistant = role === "assistant";

  return (
    <div className={cn("flex my-2.5", isAssistant ? "justify-start" : "justify-end")}>
      <article
        className={cn(
          "max-w-[88%] md:max-w-[75%] rounded-xl p-4 shadow-2xs transition-all border",
          isAssistant
            ? "bg-white border-[#e1e2e3] text-[#242424]"
            : "bg-[#f7f7f8] border-[#e1e2e3] text-[#242424]",
        )}
      >
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#e1e2e3]/60 mb-2">
          <div className="flex items-center gap-1.5">
            {isAssistant ? (
              <span className="flex size-5 items-center justify-center rounded-md bg-[#242424] text-white text-[10px] font-bold">
                AI
              </span>
            ) : (
              <span className="flex size-5 items-center justify-center rounded-md bg-[#e1e2e3] text-[#242424] text-[10px] font-bold">
                <User className="size-3 text-[#242424]" />
              </span>
            )}
            <p className="text-[11px] font-semibold text-[#898989]">
              {authorName ?? (isAssistant ? "Gemini AI Assistant" : "Anda")}
            </p>
          </div>
          {time ? (
            <span className="text-[10px] font-medium text-[#898989]">
              {time}
            </span>
          ) : null}
        </div>

        <div
          style={{ overflowWrap: "anywhere" }}
          className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed break-words font-normal text-[#242424]"
        >
          {content}
        </div>

        {isAssistant ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#e1e2e3] pt-2.5">
            <button
              type="button"
              onClick={() => onCopy?.(content)}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-[11px] font-semibold transition-all shadow-2xs cursor-pointer"
            >
              <Copy className="size-3 text-[#898989]" />
              <span>Salin Jawaban</span>
            </button>
            <button
              type="button"
              onClick={() => onSendWhatsApp?.(content)}
              disabled={sendingWhatsApp}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#e1e2e3] bg-white text-[#242424] hover:bg-[#f7f7f8] text-[11px] font-semibold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <MessageCircle className="size-3 text-[#19a874]" />
              <span>{sendingWhatsApp ? "Mengirim..." : "Kirim ke WA"}</span>
            </button>
          </div>
        ) : null}
      </article>
    </div>
  );
}
