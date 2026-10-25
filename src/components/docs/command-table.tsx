"use client";

import { useState } from "react";
import { Copy, Check, Terminal, Users, Shield } from "lucide-react";

export interface BotCommandItem {
  command: string;
  parameters?: string;
  scope: "all" | "admin";
  location: "any" | "dm_only" | "group_or_dm";
  description: string;
  example: string;
}

interface Props {
  commands: BotCommandItem[];
}

export function CommandTable({ commands }: Props) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  function handleCopy(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="w-full border border-zinc-200 dark:border-zinc-800 rounded-none shadow-none overflow-x-auto bg-white dark:bg-zinc-900 my-4">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 font-bold">
            <th className="p-3">Perintah</th>
            <th className="p-3">Akses & Lokasi</th>
            <th className="p-3">Fungsi & Deskripsi</th>
            <th className="p-3">Contoh Pemakaian</th>
            <th className="p-3 text-right">Salin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
          {commands.map((cmd, idx) => {
            const isCopied = copiedIndex === idx;

            return (
              <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                {/* Command & Syntax */}
                <td className="p-3 align-top">
                  <div className="space-y-1">
                    <code className="font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-none">
                      {cmd.command}
                    </code>
                    {cmd.parameters && (
                      <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        {cmd.parameters}
                      </p>
                    )}
                  </div>
                </td>

                {/* Scope & Location */}
                <td className="p-3 align-top whitespace-nowrap">
                  <div className="space-y-1">
                    {cmd.scope === "admin" ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-none bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                        <Shield size={10} />
                        Khusus Korti
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-none bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700">
                        <Users size={10} />
                        Semua Anggota
                      </span>
                    )}

                    <p className="text-[10px] text-zinc-500">
                      {cmd.location === "dm_only" && "Hanya di Japri/DM"}
                      {cmd.location === "group_or_dm" && "Grup & Japri"}
                      {cmd.location === "any" && "Bisa di mana saja"}
                    </p>
                  </div>
                </td>

                {/* Description */}
                <td className="p-3 align-top leading-relaxed min-w-[200px]">
                  {cmd.description}
                </td>

                {/* Example */}
                <td className="p-3 align-top min-w-[220px]">
                  <code className="block font-mono text-[11px] p-1.5 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-none break-all text-zinc-800 dark:text-zinc-200">
                    {cmd.example}
                  </code>
                </td>

                {/* Action */}
                <td className="p-3 align-top text-right">
                  <button
                    type="button"
                    onClick={() => handleCopy(cmd.example, idx)}
                    className="p-1.5 rounded-none border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer shadow-none transition-colors"
                    title="Salin contoh perintah"
                    aria-label="Salin contoh perintah"
                  >
                    {isCopied ? (
                      <Check size={13} className="text-emerald-500" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
