"use client";

import { useState } from "react";
import { Download, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { QuestionPaper } from "@veda-ai/shared";
import { paperPdfUrl, renderPdf } from "@/src/lib/api";
import { useGenerationStore } from "@/src/store/generation";
import { cn } from "@/src/lib/cn";

/** Build a filesystem-safe download name from the paper title. */
function pdfFilename(title: string): string {
  const base = title
    .trim()
    .replace(/[^\w\d-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `${base || "question-paper"}.pdf`;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch the rendered PDF, retrying briefly while it is still being produced by
 * the follow-up render job (which can 404 for a moment right after the paper
 * completes). Written recursively so the retry delays stay sequential without an
 * await-in-loop.
 */
async function fetchPdf(url: string, retriesLeft = 8): Promise<Response> {
  const res = await fetch(url);
  if (res.ok || res.status !== 404 || retriesLeft <= 0) return res;
  await sleep(1200);
  return fetchPdf(url, retriesLeft - 1);
}

export function ActionBar({ paper }: { paper: QuestionPaper }): React.ReactNode {
  const pdfUrl = useGenerationStore((s) => s.pdfUrl);
  const pdfError = useGenerationStore((s) => s.pdfError);
  const setPdfUrl = useGenerationStore((s) => s.setPdfUrl);
  const setPdfError = useGenerationStore((s) => s.setPdfError);
  const [downloading, setDownloading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  async function handleDownload(): Promise<void> {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetchPdf(paperPdfUrl(paper.id));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Save via a same-origin object URL (a cross-origin `<a download>` is
      // ignored by browsers). Revoke LATER — revoking right after click() can
      // cancel the in-flight download in some browsers (e.g. Safari).
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = pdfFilename(paper.title);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      window.setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(objectUrl);
      }, 20000);

      setPdfUrl(paperPdfUrl(paper.id));
    } catch {
      // The PDF never materialised after the retries: surface a real, retryable
      // error instead of a download that silently does nothing.
      setPdfError("We couldn't prepare this PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  // Recover from a failed render: re-enqueue render-pdf (no LLM re-run). The
  // pdf:ready event flips the button back to Download; a repeat failure re-arms
  // pdf:failed.
  async function handleRetry(): Promise<void> {
    if (retrying) return;
    setRetrying(true);
    setPdfError(null);
    try {
      await renderPdf(paper.id);
      toast.success("Re-rendering your PDF. This only takes a moment.");
    } catch {
      setPdfError("Couldn't start the PDF render. Please try again.");
    } finally {
      setRetrying(false);
    }
  }

  const preparing = !pdfUrl && !pdfError;

  return (
    <div data-print="hide" className="rounded-panel bg-ink p-5 text-white shadow-float sm:p-6">
      {pdfError ? (
        <>
          <p className="flex items-start gap-2 text-[0.95rem] font-semibold leading-relaxed text-white/90">
            <TriangleAlert className="mt-0.5 size-[1.05rem] shrink-0 text-amber-300" />
            <span>{pdfError}</span>
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex h-11 items-center justify-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-5 text-sm font-semibold text-ink shadow-sm transition hover:bg-neutral-100 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-ink text-white">
                <RefreshCw className={cn("size-4", retrying && "animate-spin")} />
              </span>
              {retrying ? "Retrying…" : "Try again"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[0.95rem] font-semibold leading-relaxed text-white/90">
            Here&apos;s your generated question paper,{" "}
            <span className="text-brand-300">“{paper.title}”</span>. Download it as a PDF below.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex h-11 items-center justify-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-5 text-sm font-semibold text-ink shadow-sm transition hover:bg-neutral-100 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-ink text-white">
                {downloading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
              </span>
              {downloading ? "Preparing…" : "Download as PDF"}
            </button>
            {preparing && !downloading ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-white/60">
                <Loader2 className="size-3.5 animate-spin" />
                Finishing your PDF…
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
