"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useGeneration } from "@/src/hooks/useGeneration";
import { useGenerationStore } from "@/src/store/generation";
import { GenerationFailed, GenerationStatus } from "@/src/components/generation/GenerationStatus";
import { QuestionPaperView } from "@/src/components/output/QuestionPaperView";
import { ActionBar } from "@/src/components/output/ActionBar";
import { PageHeader } from "@/src/components/ui/PageHeader";
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
  const title = paper ? "Question Paper" : failed ? "Generation Failed" : "Generating Paper";
  const subtitle = paper
    ? "Review, regenerate or export your generated paper."
    : failed
      ? "We couldn't generate this paper."
      : "Your question paper is being created in the background.";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div data-print="hide">
        <PageHeader title={title} subtitle={subtitle} />
      </div>

      <div className="mt-5">
        {paper ? (
          <div className="space-y-5">
            <ActionBar paper={paper} assignmentId={id} />
            <QuestionPaperView paper={paper} />
          </div>
        ) : failed ? (
          <GenerationFailed error={error} onRetry={handleRetry} retrying={retrying} />
        ) : (
          <GenerationStatus status={status} progress={progress} stage={stage} />
        )}
      </div>
    </div>
  );
}
