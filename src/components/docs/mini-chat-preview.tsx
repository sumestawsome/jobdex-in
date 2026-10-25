"use client";

import { useState } from "react";
import { CheckCheck, Mic, Play, Info } from "lucide-react";

export interface MiniChatMessage {
  id: string;
  sender: "user" | "bot" | "friend";
  senderName?: string;
  senderColor?: string;
  text?: string;
  time: string;
  tooltip: string;
  isVoiceNote?: boolean;
  vnDuration?: string;
}

interface Props {
  title?: string;
  subtitle?: string;
  messages: MiniChatMessage[];
}

export function MiniChatPreview({ title, subtitle, messages }: Props) {
  const [activeTooltip, setActiveTooltip] = useState<{
    id: string;
    text: string;
    x: number;
    y: number;
  } | null>(null);

  function handleMouseMove(id: string, text: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveTooltip({
      id,
      text,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  function handleMouseLeave() {
    setActiveTooltip(null);
  }

  return (
    <div className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-none shadow-none overflow-hidden my-3">
      {/* Mini Header */}
      {title && (
        <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="size-2 bg-emerald-500 rounded-none" />
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{title}</span>
            {subtitle && (
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">
                • {subtitle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-400">
            <Info size={12} className="text-primary" />
            <span>Arahkan mouse ke chat untuk info</span>
          </div>
        </div>
      )}

      {/* Messages Canvas */}
      <div className="p-3 sm:p-4 space-y-3 bg-zinc-50 dark:bg-zinc-950/80 text-xs">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} w-full`}
            >
              <div
                className={`relative p-2.5 sm:p-3 rounded-none text-xs shadow-none max-w-sm sm:max-w-md cursor-default select-text transition-colors border ${
                  isUser
                    ? "bg-lime-100 dark:bg-lime-950/40 text-zinc-900 dark:text-zinc-100 border-lime-400 dark:border-lime-700"
                    : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800"
                }`}
                onMouseMove={(e) => handleMouseMove(msg.id, msg.tooltip, e)}
                onMouseLeave={handleMouseLeave}
              >
                {/* Floating Tooltip */}
                {activeTooltip?.id === msg.id && (
                  <div
                    className="absolute z-50 pointer-events-none p-2 rounded-none bg-zinc-900 dark:bg-black text-white text-[11px] leading-tight border border-zinc-700 shadow-none max-w-[280px] animate-in fade-in duration-100"
                    style={{
                      left: Math.max(10, Math.min(activeTooltip.x - 40, 200)),
                      top: Math.max(-65, activeTooltip.y - 70),
                    }}
                  >
                    {activeTooltip.text}
                  </div>
                )}

                {/* Friend Sender Name */}
                {msg.sender === "friend" && msg.senderName && (
                  <p
                    className={`font-bold text-[11px] mb-1 ${
                      msg.senderColor || "text-indigo-600 dark:text-indigo-400"
                    }`}
                  >
                    {msg.senderName}
                  </p>
                )}

                {/* Voice Note Layout */}
                {msg.isVoiceNote ? (
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <div className="size-8 rounded-none bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Play size={14} className="ml-0.5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-0.5 h-4">
                        {[40, 70, 30, 90, 60, 80, 50, 90, 40, 70, 80, 60, 40, 70, 50, 30].map(
                          (h, idx) => (
                            <span
                              key={idx}
                              className="w-1 bg-zinc-400 dark:bg-zinc-600 rounded-none"
                              style={{ height: `${h}%` }}
                            />
                          )
                        )}
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                        <span>{msg.vnDuration || "0:18"}</span>
                        <div className="flex items-center gap-1">
                          <span>{msg.time}</span>
                          <CheckCheck size={12} className="text-primary inline" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1 whitespace-pre-line leading-relaxed">
                      {msg.text}
                    </div>

                    {/* Timestamp */}
                    <div className="flex justify-end items-center gap-1 text-[10px] text-zinc-400 font-mono pt-1">
                      <span>{msg.time}</span>
                      {isUser && <CheckCheck size={12} className="text-primary inline" />}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
