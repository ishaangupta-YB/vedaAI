"use client";

import { useState } from "react";
import { Download, Loader2, Printer, RefreshCw } from "lucide-react";
import type { QuestionPaper } from "@veda-ai/shared";
import { ApiError, regenerate } from "@/src/lib/api";
import { useGenerationStore } from "@/src/store/generation";
import { cn } from "@/src/lib/cn";

const DARK_BTN =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition active:scale-[0.985] disabled:cursor-not-allowed";

export function ActionBar({
  paper,
  assignmentId,
}: {
  paper: QuestionPaper;
  assignmentId: string;
}): React.ReactNode {
  const pdfUrl = useGenerationStore((s) => s.pdfUrl);
  const beginRun = useGenerationStore((s) => s.beginRun);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerate(): Promise<void> {
    setRegenerating(true);
    setError(null);
    try {
      const { jobId } = await regenerate(assignmentId);
      // Re-enter the progress flow; the live socket subscription stays open.
      beginRun(assignmentId, jobId);
    } catch (e) {
      setRegenerating(false);
      setError(e instanceof ApiError ? e.message : "Could not start regeneration.");
    }
  }

  return (
    <div data-print="hide" className="rounded-panel bg-ink p-5 text-white shadow-float sm:p-6">
      <p className="text-[0.95rem] font-semibold leading-relaxed">
        Here&apos;s your generated question paper: <span className="text-brand-300">“{paper.title}”</span>.
        Review it below, then regenerate or export when you&apos;re happy with it.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {pdfUrl ? (
          <a
            href={pdfUrl}
            download
            className={cn(DARK_BTN, "bg-white text-ink hover:bg-neutral-100")}
          >
            <Download className="size-[1.05rem]" />
            Download as PDF
          </a>
        ) : (
          <span
            aria-live="polite"
            className={cn(DARK_BTN, "bg-white/15 text-white/70")}
            title="The PDF is being prepared"
          >
            <Loader2 className="size-[1.05rem] animate-spin" />
            Preparing PDF…
          </span>
        )}

        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          className={cn(DARK_BTN, "bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20")}
        >
          <RefreshCw className={cn("size-[1.05rem]", regenerating && "animate-spin")} />
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className={cn(DARK_BTN, "px-4 text-white/80 hover:bg-white/10")}
        >
          <Printer className="size-[1.05rem]" />
          Print
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-brand-200">{error}</p> : null}
    </div>
  );
}
