import { cn } from "@/src/lib/cn";

/** The VedaAI mark: a black squircle holding a two-tone "V" (orange + white). */
function LogoMark({ className }: { className?: string }): React.ReactNode {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[28%] bg-ink shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 40 40" className="size-[58%]" fill="none">
        <path
          d="M9 11 L20 30"
          stroke="var(--color-brand-500)"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M20 30 L31 11"
          stroke="#ffffff"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** Full lockup: mark + "VedaAI" wordmark. */
export function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}): React.ReactNode {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("size-10", markClassName)} />
      <span className="text-[1.45rem] font-extrabold tracking-tight text-ink">
        Veda<span>AI</span>
      </span>
    </span>
  );
}
