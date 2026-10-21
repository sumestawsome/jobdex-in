import {
  cloneElement,
  isValidElement,
  type ComponentPropsWithoutRef,
} from "react";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "light"
  | "dark"
  | "warning"
  | "success"
  | "destructive"
  | "heroPrimary"
  | "heroOutline"
  | "info";

type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 shadow-none rounded-none",
  secondary: "bg-lime-600 hover:bg-lime-700 text-white border border-lime-700 shadow-none rounded-none",
  outline: "border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-none rounded-none",
  ghost: "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white shadow-none rounded-none",
  light: "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 shadow-none rounded-none",
  dark: "bg-zinc-900 hover:bg-zinc-950 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 border border-zinc-900 shadow-none rounded-none",
  warning: "bg-amber-500 hover:bg-amber-600 text-zinc-950 border border-amber-600 shadow-none rounded-none",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 shadow-none rounded-none",
  destructive: "bg-red-600 hover:bg-red-700 text-white border border-red-700 shadow-none rounded-none",
  heroPrimary: "bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-700 shadow-none rounded-none",
  heroOutline: "border border-zinc-300 bg-transparent hover:bg-zinc-100 text-zinc-900 dark:text-zinc-100 shadow-none rounded-none",
  info: "bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-700 shadow-none rounded-none",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-none shadow-none",
  md: "h-9 px-4 text-sm rounded-none shadow-none",
  lg: "h-10 px-5 text-sm rounded-none shadow-none",
  icon: "h-8 w-8 p-0 rounded-none shadow-none",
};

function sanitizeClassName(className?: string): string {
  if (!className) return "";
  return className
    .split(/\s+/)
    .filter((cls) => {
      // Protects button contrast by stripping custom caller colors
      const isBg = /^(dark:|hover:|focus:|active:)?bg-/i.test(cls);
      const isText = /^(dark:|hover:|focus:|active:)?text-/i.test(cls);
      const isBorderColor = /^(dark:|hover:|focus:|active:)?border-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)/i.test(cls);
      return !isBg && !isText && !isBorderColor;
    })
    .join(" ");
}

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  const sanitizedClassName = sanitizeClassName(className);
  return cn(
    "inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-600 disabled:pointer-events-none disabled:opacity-50 [&_svg]:text-current [&_svg]:shrink-0 rounded-none shadow-none",
    variantClasses[variant],
    sizeClasses[size],
    sanitizedClassName,
  );
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  asChild = false,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const composedClassName = buttonStyles({ variant, size, className });

  if (asChild && isValidElement<{ className?: string }>(children)) {
    return cloneElement(children, {
      className: cn(children.props.className, composedClassName),
    });
  }

  return (
    <button className={composedClassName} {...props}>
      {children}
    </button>
  );
}
