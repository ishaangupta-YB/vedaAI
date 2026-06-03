import { cn } from "@/src/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[transform,background-color,box-shadow,opacity] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white shadow-pill hover:bg-ink-soft",
  secondary:
    "bg-white text-ink ring-1 ring-black/[0.06] shadow-soft hover:bg-neutral-50",
  ghost: "text-ink hover:bg-black/5",
  danger: "bg-white text-hard-fg ring-1 ring-hard-ring hover:bg-hard-bg",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[0.8rem]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[0.95rem]",
};

/** Shared pill styling so `<Link>`/`<a>` can reuse the exact button look. */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}
