"use client";

import { Check, Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import type { GenerationStatus as Status } from "@/src/store/generation";
import { ProgressBar } from "@/src/components/generation/ProgressBar";
import { Button } from "@/src/components/ui/Button";
import { cn } from "@/src/lib/cn";

const STEPS: { label: string; at: number }[] = [
  { label: "Building prompt", at: 10 },
  { label: "Generating questions", at: 40 },
  { label: "Validating structure", at: 80 },
  { label: "Finalising paper", at: 100 },
];

function titleFor(status: Status): string {
  switch (status) {
    case "queued":
      return "Queued for generation";
    case "active":
      return "Generating your question paper";
    case "completed":
      return "Finalising your paper";
    default:
      return "Connecting…";
  }
}

/** Live progress view, driven purely by store state (never raw model output). */
export function GenerationStatus({
  status,
  progress,
  stage,
}: {
  status: Status;
  progress: number;
  stage: string | null;
}): React.ReactNode {
  return (
    <div className="mx-auto w-full max-w-xl rounded-panel bg-white p-7 text-center shadow-soft ring-1 ring-black/[0.04] sm:p-10">
      <div className="relative mx-auto flex size-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-200/60" />
        <span className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-pill">
          <Sparkles className="size-7" />
        </span>
      </div>

      <h2 className="mt-5 text-xl font-bold text-ink">{titleFor(status)}</h2>
      <p className="mt-1.5 text-sm text-muted">
        {stage ? stage : "This usually takes a few moments. Keep this page open."}
      </p>

      <div className="mt-6">
        <ProgressBar value={progress} />
        <div className="mt-2 flex items-center justify-between text-xs font-medium text-faint">
          <span>{stage ?? "Working…"}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      <ul className="mt-7 space-y-3 text-left">
        {STEPS.map((step, i) => {
          const prev = i === 0 ? 0 : STEPS[i - 1]!.at;
          const done = progress >= step.at;
          const activeStep = !done && progress >= prev;
          return (
            <li key={step.label} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full ring-1 transition",
                  done
                    ? "bg-status text-white ring-transparent"
                    : activeStep
                      ? "bg-white text-ink ring-ink/20"
                      : "bg-neutral-100 text-faint ring-transparent",
                )}
              >
                {done ? (
                  <Check className="size-3.5" />
                ) : activeStep ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              <span
                className={cn(
                  "text-sm",
                  done ? "font-medium text-ink" : activeStep ? "font-semibold text-ink" : "text-faint",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Terminal failure state with a retry path. */
export function GenerationFailed({
  error,
  onRetry,
  retrying,
}: {
  error: string | null;
  onRetry: () => void;
  retrying: boolean;
}): React.ReactNode {
  return (
    <div className="mx-auto w-full max-w-xl rounded-panel bg-white p-7 text-center shadow-soft ring-1 ring-black/[0.04] sm:p-10">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-hard-bg text-hard-fg ring-1 ring-hard-ring">
        <TriangleAlert className="size-7" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-ink">Generation failed</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
        {error || "Something went wrong while generating the paper."}
      </p>
      <div className="mt-6 flex justify-center">
        <Button onClick={onRetry} disabled={retrying}>
          <RefreshCw className={cn("size-[1.05rem]", retrying && "animate-spin")} />
          {retrying ? "Retrying…" : "Try again"}
        </Button>
      </div>
    </div>
  );
}
