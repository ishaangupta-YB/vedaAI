import { pathToFileURL } from "node:url";
import { Queue, Worker, type Job } from "bullmq";
import { JOB_NAMES, QUEUE_NAME } from "@veda-ai/shared";
import { connectMongo, createBullRedis, createRedis } from "@veda-ai/db";
import { config } from "./config.js";
import { createAnthropicClient, createGenerateFn } from "./anthropic.js";
import { createPublisher } from "./publisher.js";
import {
  handleGeneratePaper,
  markGenerationFailed,
  type GeneratePaperData,
} from "./jobs/generatePaper.js";
import { handleRenderPdf, type RenderPdfData } from "./jobs/renderPdf.js";
import type { GenerateFn } from "./generate.js";
import type { JobContext } from "./jobContext.js";

/** Handles returned by {@link startWorker} so a host can shut it down cleanly. */
export interface StartedWorker {
  worker: Worker;
  queue: Queue;
  close: () => Promise<void>;
}

/**
 * Boot the BullMQ worker for the `assessment` queue: connect Mongo, wire the
 * Redis connections (a dedicated blocking connection each for the Worker and
 * Queue, plus a cache client and a publisher client), build the job context,
 * and register the `generate-paper` / `render-pdf` processors.
 *
 * Exported so the API can optionally run the worker in-process in a co-located
 * deployment; when this module is the entrypoint it boots itself (see bottom).
 */
export async function startWorker(): Promise<StartedWorker> {
  await connectMongo(config.MONGODB_URI);

  // BullMQ requires dedicated connections (it uses long-lived blocking commands).
  const workerConnection = createBullRedis(config.REDIS_URL);
  const queueConnection = createBullRedis(config.REDIS_URL);
  // Separate, non-blocking clients for caching and pub/sub publishing.
  const cacheRedis = createRedis(config.REDIS_URL);
  const publisherRedis = createRedis(config.REDIS_URL);
  const publisher = createPublisher(publisherRedis);

  const queue = new Queue(QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: false,
    },
  });

  let generate: GenerateFn | null = null;
  if (config.ANTHROPIC_API_KEY) {
    const client = createAnthropicClient(config.ANTHROPIC_API_KEY);
    generate = createGenerateFn(client, {
      model: config.ANTHROPIC_MODEL,
      maxTokens: config.ANTHROPIC_MAX_TOKENS,
    });
  } else {
    console.warn(
      "[worker] ANTHROPIC_API_KEY not set — generate-paper jobs will fail until it is provided",
    );
  }

  const ctx: JobContext = {
    redis: cacheRedis,
    publisher,
    queue,
    generate,
    cacheTtlSeconds: config.PAPER_CACHE_TTL_SECONDS,
  };

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job): Promise<void> => {
      switch (job.name) {
        case JOB_NAMES.GENERATE_PAPER:
          await handleGeneratePaper(ctx, job.data as GeneratePaperData);
          return;
        case JOB_NAMES.RENDER_PDF:
          await handleRenderPdf(ctx, job.data as RenderPdfData);
          return;
        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    },
    { connection: workerConnection, concurrency: config.WORKER_CONCURRENCY },
  );

  worker.on("ready", () => {
    console.log("worker up");
  });

  worker.on("error", (err: Error) => {
    console.error("[worker] error:", err.message);
  });

  // Surface a terminal generation failure to the client exactly once: when a
  // generate-paper job has exhausted its retries.
  worker.on("failed", (job, err) => {
    if (!job) {
      return;
    }
    console.error(
      `[worker] job ${job.name} (${job.id ?? "no-id"}) failed: ${err.message}`,
    );
    if (job.name === JOB_NAMES.GENERATE_PAPER) {
      const attempts = job.opts.attempts ?? 1;
      if (job.attemptsMade >= attempts) {
        const { assignmentId } = job.data as GeneratePaperData;
        void markGenerationFailed(ctx, assignmentId, err);
      }
    }
  });

  const close = async (): Promise<void> => {
    await worker.close();
    await queue.close();
    workerConnection.disconnect();
    queueConnection.disconnect();
    cacheRedis.disconnect();
    publisherRedis.disconnect();
  };

  return { worker, queue, close };
}

/** True when this module was run directly (e.g. `node dist/index.js`). */
function isRunDirectly(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (isRunDirectly()) {
  console.log("[worker] starting, connecting to Mongo + Redis...");
  startWorker()
    .then((started) => {
      const shutdown = async (): Promise<void> => {
        console.log("[worker] shutting down...");
        await started.close();
        process.exit(0);
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    })
    .catch((err: unknown) => {
      console.error("[worker] failed to start:", err);
      process.exit(1);
    });
}
