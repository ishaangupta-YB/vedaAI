import { QuestionPaperModel } from "@veda-ai/db";
import { API_ROUTES, WS_EVENTS, type Section } from "@veda-ai/shared";
import { toQuestionPaper } from "../paper.js";
import { renderPaperPdf } from "../pdf/render.js";
import type { JobContext } from "../jobContext.js";

/** Payload for the `render-pdf` job (CLAUDE.md queue contract). */
export interface RenderPdfData {
  paperId: string;
  assignmentId: string;
}

/**
 * Render the stored paper to a PDF buffer and persist it on the paper document
 * (the `pdf` field added in the contract change log), then announce `pdf:ready`
 * with the API download URL. Renders ONLY from validated, stored data.
 */
export async function handleRenderPdf(
  ctx: JobContext,
  data: RenderPdfData,
): Promise<void> {
  const { paperId, assignmentId } = data;

  const doc = await QuestionPaperModel.findById(paperId);
  if (!doc) {
    throw new Error(`Question paper ${paperId} not found`);
  }

  // Convert the stored document into the shared QuestionPaper shape. The Mongoose
  // enum strings are widened to `string`, so we re-narrow to the shared types.
  const plain = doc.toObject();
  const paper = toQuestionPaper(paperId, {
    assignmentId: plain.assignmentId,
    title: plain.title,
    totalMarks: plain.totalMarks,
    sections: plain.sections as unknown as Section[],
    generatedAt: plain.generatedAt,
  });

  const buffer = await renderPaperPdf(paper);
  doc.pdf = buffer;
  await doc.save();

  await ctx.publisher.publish(WS_EVENTS.PDF_READY, {
    assignmentId,
    paperId,
    url: API_ROUTES.PAPER_PDF(paperId),
  });
}

/**
 * Announce `pdf:failed` so the client can surface a real error + retry instead
 * of a download that 404s forever. Called by the worker once a `render-pdf`
 * job's retries are exhausted (its sibling to {@link markGenerationFailed}).
 * The paper itself stays valid — only its PDF render failed — so a retry just
 * re-enqueues `render-pdf` (see `POST /api/papers/:id/pdf`).
 */
export async function markPdfFailed(
  ctx: JobContext,
  data: RenderPdfData,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await ctx.publisher.publish(WS_EVENTS.PDF_FAILED, {
    assignmentId: data.assignmentId,
    paperId: data.paperId,
    error: message,
  });
}
