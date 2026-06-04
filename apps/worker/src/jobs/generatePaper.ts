import { AssignmentModel, QuestionPaperModel } from "@veda-ai/db";
import { JOB_NAMES, WS_EVENTS, stableInputHash } from "@veda-ai/shared";
import { generatePaperContent } from "../generate.js";
import { buildPaperFields, toCreateAssignmentInput } from "../paper.js";
import { QuestionPaperContent } from "../paperSchema.js";
import type { JobContext } from "../jobContext.js";

/** Payload for the `generate-paper` job (CLAUDE.md queue contract). */
export interface GeneratePaperData {
  assignmentId: string;
}

/**
 * The generation job flow (CLAUDE.md "Generation job flow"):
 *  a. load the assignment, mark it `active`, announce `generation:active`;
 *  b. on a cache hit, reuse the cached content (fresh ids assigned below) and
 *     skip the LLM entirely;
 *  c-e. otherwise build a deterministic prompt, call the model with structured
 *     outputs, then re-validate (with one repair round-trip inside
 *     `generatePaperContent`);
 *  f. assign ids, recompute `totalMarks`, persist, link `paperId`, cache, then
 *     announce completion and enqueue the PDF render.
 *
 * Any thrown error is surfaced as `generation:failed` by the worker's failure
 * handler once retries are exhausted.
 */
export async function handleGeneratePaper(
  ctx: JobContext,
  data: GeneratePaperData,
): Promise<void> {
  const { assignmentId } = data;

  // a. Load, mark active, announce.
  const assignment = await AssignmentModel.findById(assignmentId).lean();
  if (!assignment) {
    throw new Error(`Assignment ${assignmentId} not found`);
  }
  await AssignmentModel.findByIdAndUpdate(assignmentId, { status: "active" });
  await ctx.publisher.publish(WS_EVENTS.GENERATION_ACTIVE, { assignmentId });

  const input = toCreateAssignmentInput(assignment);
  const cacheKey = `paper:${stableInputHash(input)}`;

  // b. Cache check — reuse content, assigning fresh ids below; no LLM call.
  const cachedRaw = await ctx.redis.get(cacheKey);
  let content: QuestionPaperContent;
  const cacheHit = cachedRaw !== null;

  // Observable, deliberate caching: one line per generation states whether the
  // identical-input paper was reused (HIT, no LLM call) or freshly generated
  // (MISS). See README "Paper caching".
  console.log(
    `[worker] generate-paper ${assignmentId} — paper cache ${
      cacheHit ? "HIT (reusing, no LLM call)" : "MISS (calling LLM)"
    } key=${cacheKey}`,
  );

  if (cachedRaw !== null) {
    content = QuestionPaperContent.parse(JSON.parse(cachedRaw));
  } else {
    // c. Build the deterministic prompt.
    await ctx.publisher.publish(WS_EVENTS.GENERATION_PROGRESS, {
      assignmentId,
      progress: 10,
      stage: "building prompt",
    });
    if (!ctx.generate) {
      throw new Error(
        "Bedrock is not configured (set AWS_BEARER_TOKEN_BEDROCK); cannot generate a paper",
      );
    }
    // d. Call the model with structured outputs.
    await ctx.publisher.publish(WS_EVENTS.GENERATION_PROGRESS, {
      assignmentId,
      progress: 40,
      stage: "calling model",
    });
    content = await generatePaperContent(ctx.generate, input);
    // e. Re-validated (incl. one repair round-trip) inside generatePaperContent.
    await ctx.publisher.publish(WS_EVENTS.GENERATION_PROGRESS, {
      assignmentId,
      progress: 80,
      stage: "validating",
    });
  }

  // f. Assign ids + totalMarks, persist, link, cache.
  const fields = buildPaperFields(content, assignmentId);
  const doc = await QuestionPaperModel.create(fields);
  const paperId = String(doc._id);

  await AssignmentModel.findByIdAndUpdate(assignmentId, {
    status: "completed",
    paperId,
  });

  if (!cacheHit) {
    await ctx.redis.set(
      cacheKey,
      JSON.stringify(content),
      "EX",
      ctx.cacheTtlSeconds,
    );
  }

  await ctx.publisher.publish(WS_EVENTS.GENERATION_PROGRESS, {
    assignmentId,
    progress: 100,
    stage: "done",
  });
  await ctx.publisher.publish(WS_EVENTS.GENERATION_COMPLETED, {
    assignmentId,
    paperId,
  });

  // Enqueue the follow-up PDF render (inherits the queue's default job options).
  await ctx.queue.add(JOB_NAMES.RENDER_PDF, { paperId, assignmentId });
}

/**
 * Mark the assignment failed and announce `generation:failed`. Called by the
 * worker once a generation job's retries are exhausted.
 */
export async function markGenerationFailed(
  ctx: JobContext,
  assignmentId: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  try {
    await AssignmentModel.findByIdAndUpdate(assignmentId, { status: "failed" });
  } catch (updateError) {
    console.error(
      `[worker] could not mark assignment ${assignmentId} failed:`,
      updateError,
    );
  }
  await ctx.publisher.publish(WS_EVENTS.GENERATION_FAILED, {
    assignmentId,
    error: message,
  });
}
