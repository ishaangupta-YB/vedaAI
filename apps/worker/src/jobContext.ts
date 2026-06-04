import type { Queue } from "bullmq";
import type { Redis } from "@veda-ai/db";
import type { GenerateFn } from "./generate.js";
import type { Publisher } from "./publisher.js";

/**
 * Dependencies shared by every job handler. Passing this explicitly (rather than
 * reaching for module-level singletons) keeps the handlers easy to wire and to
 * test in isolation.
 */
export interface JobContext {
  /** General-purpose Redis client for the `paper:<hash>` generation cache. */
  redis: Redis;
  /** Publishes real-time events to the `ws:events` channel. */
  publisher: Publisher;
  /** The `assessment` queue, used to enqueue follow-up jobs (e.g. render-pdf). */
  queue: Queue;
  /** Model caller, or `null` when Bedrock credentials are not configured. */
  generate: GenerateFn | null;
  /** TTL (seconds) applied to cached papers. */
  cacheTtlSeconds: number;
}
