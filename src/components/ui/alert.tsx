import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type AlertVariant = "default" | "destructive" | "warning" | "success";

const variantClasses: Record<AlertVariant, string> = {
  default: "border border-[#e1e2e3] dark:border-[#2e2e32] bg-[#f7f7f8] dark:bg-[#1a1a1d] text-[#242424] dark:text-[#ededed] shadow-2xs",
  destructive: "border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/10 text-red-800 dark:text-red-300",
  warning: "border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/10 text-amber-800 dark:text-amber-300",
  success: "border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/10 text-emerald-805 dark:text-emerald-300",
};

export function Alert({
  className,
  variant = "default",
  ...props
}: ComponentPropsWithoutRef<"div"> & { variant?: AlertVariant }) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-lg p-4 text-sm flex gap-3.5 items-start shadow-xs",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <h5
      className={cn(
        "font-heading font-bold tracking-tight leading-none text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "text-xs font-medium leading-relaxed [&_p]:leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}
