import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "neutral"
  | "orange"
  | "purple"
  | "cyan"
  | "lime";

const variants: Record<BadgeVariant, string> = {
  default: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 shadow-none",
  neutral: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[11px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 shadow-none",
  info: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 shadow-none",
  success: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 shadow-none",
  warning: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 shadow-none",
  error: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 shadow-none",
  orange: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800 shadow-none",
  purple: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 shadow-none",
  cyan: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800 shadow-none",
  lime: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[11px] font-semibold bg-lime-50 text-lime-800 border border-lime-300 dark:bg-lime-950/40 dark:text-lime-300 dark:border-lime-800 shadow-none",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
