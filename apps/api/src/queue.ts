import { Queue, type JobsOptions } from "bullmq";
import { JOB_NAMES, QUEUE_NAME } from "@veda-ai/shared";
import { createBullRedis } from "@veda-ai/db";

/**
 * Producer side of the BullMQ "assessment" queue. The API only ever enqueues
 * `generate-paper` jobs (regenerate enqueues the same job again); the worker
 * owns `render-pdf` and the actual processing. Job-data shapes mirror the
 * contract in CLAUDE.md — the API's view of what it produces.
 */
export interface GeneratePaperJobData {
  assignmentId: string;
}

/** Job data for the `render-pdf` job, re-enqueued by `POST /papers/:id/pdf`. */
export interface RenderPdfJobData {
  paperId: string;
  assignmentId: string;
}

/** Either job the API can enqueue onto the assessment queue. */
export type AssessmentJobData = GeneratePaperJobData | RenderPdfJobData;

export type AssessmentQueue = Queue<AssessmentJobData>;

/**
 * Default job options applied to every produced job (CLAUDE.md "Queue + job
 * contract"): 3 attempts with exponential backoff (1s base), trim completed
 * jobs to the last 100, and keep failed jobs for inspection.
 */
const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { count: 100 },
  removeOnFail: false,
};

/**
 * Create the assessment queue using a BullMQ-configured ioredis connection
 * (`maxRetriesPerRequest: null`, enforced by `createBullRedis`). An optional
 * `prefix` overrides BullMQ's default key namespace — used by the e2e test to
 * isolate its queue from any other worker on the same Redis.
 */
export function createAssessmentQueue(
  redisUrl: string,
  prefix?: string,
): AssessmentQueue {
  const connection = createBullRedis(redisUrl);
  return new Queue<AssessmentJobData>(QUEUE_NAME, {
    connection,
    defaultJobOptions,
    ...(prefix ? { prefix } : {}),
  });
}

/**
 * Enqueue a `generate-paper` job for an assignment and return the BullMQ job id.
 * Used by both `POST /assignments` and `POST /assignments/:id/regenerate`.
 */
export async function enqueueGeneratePaper(
  queue: AssessmentQueue,
  assignmentId: string,
): Promise<string | undefined> {
  const job = await queue.add(JOB_NAMES.GENERATE_PAPER, { assignmentId });
  return job.id;
}

/**
 * Enqueue a `render-pdf` job to (re)render a paper's PDF. Used by
 * `POST /papers/:id/pdf` so the client can recover from a `pdf:failed` event
 * without re-running the (expensive) LLM generation.
 */
export async function enqueueRenderPdf(
  queue: AssessmentQueue,
  paperId: string,
  assignmentId: string,
): Promise<string | undefined> {
  const job = await queue.add(JOB_NAMES.RENDER_PDF, { paperId, assignmentId });
  return job.id;
}
