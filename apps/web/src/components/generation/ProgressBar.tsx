import { cn } from "@/src/lib/cn";

/** Slim progress track. Falls back to an indeterminate sweep at 0%. */
export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}): React.ReactNode {
  const indeterminate = value <= 0;
  return (
    <div
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-neutral-200/80", className)}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {indeterminate ? (
        <div className="h-full w-1/3 rounded-full bg-ink/70 [animation:progress-slide_1.2s_ease-in-out_infinite]" />
      ) : (
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-[width] duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      )}
    </div>
  );
}
