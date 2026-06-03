import { Worker, type Job } from "bullmq";
import { QUEUE_NAME } from "@veda-ai/shared";
import { createBullRedis } from "@veda-ai/db";
import { config } from "./config.js";

/**
 * Empty BullMQ worker for this phase: it connects to Redis and logs "worker up".
 * Job processing (generate-paper, render-pdf) is added in a later phase.
 */
const connection = createBullRedis(config.REDIS_URL);

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job): Promise<void> => {
    // No processing yet — generation/PDF logic arrives in a later phase.
    console.log(`[worker] received job ${job.name} (${job.id ?? "no-id"})`);
  },
  { connection, concurrency: 5 },
);

worker.on("ready", () => {
  console.log("worker up");
});

worker.on("error", (err: Error) => {
  console.error("[worker] error:", err.message);
});

const shutdown = async (): Promise<void> => {
  await worker.close();
  connection.disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[worker] starting, connecting to Redis...");
