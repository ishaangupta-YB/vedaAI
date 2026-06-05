"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useGeneration } from "@/src/hooks/useGeneration";
import { useGenerationStore } from "@/src/store/generation";
import {
  GenerationFailed,
  GenerationStatus,
} from "@/src/components/generation/GenerationStatus";
import { QuestionPaperView } from "@/src/components/output/QuestionPaperView";
import { ActionBar } from "@/src/components/output/ActionBar";
import { ApiError, regenerate } from "@/src/lib/api";

export default function AssignmentPage(): React.ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;

  useGeneration(id);

  const status = useGenerationStore((s) => s.status);
  const progress = useGenerationStore((s) => s.progress);
  const stage = useGenerationStore((s) => s.stage);
  const paper = useGenerationStore((s) => s.paper);
  const error = useGenerationStore((s) => s.error);
  const beginRun = useGenerationStore((s) => s.beginRun);

  const [retrying, setRetrying] = useState(false);

  async function handleRetry(): Promise<void> {
    if (!id) return;
    setRetrying(true);
    try {
      const { jobId } = await regenerate(id);
      beginRun(id, jobId);
    } catch (e) {
      setRetrying(false);
      useGenerationStore.getState().setError(
        e instanceof ApiError ? e.message : "Could not start regeneration.",
      );
    }
  }

  if (!id) return null;

  const failed = !paper && (status === "failed" || Boolean(error));

  return (
    <div className="mx-auto w-full max-w-3xl">
      {paper ? (
        <div className="space-y-5">
          <ActionBar paper={paper} />
          <QuestionPaperView paper={paper} />
        </div>
      ) : failed ? (
        <GenerationFailed error={error} onRetry={handleRetry} retrying={retrying} />
      ) : status === null ? (
        // Recovering the assignment's state on load — show a neutral loader
        // instead of briefly flashing the "generating" UI. `<output>` carries an
        // implicit `role="status"` live region for screen readers.
        <output aria-label="Loading paper" className="flex min-h-[55vh] items-center justify-center">
          <Loader2 className="size-7 animate-spin text-muted" />
        </output>
      ) : (
        <GenerationStatus status={status} progress={progress} stage={stage} />
      )}
    </div>
  );
}
