import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { QuestionPaper } from "@veda-ai/shared";
import { createRedis, mongoose } from "@veda-ai/db";
import { startWorker, type StartedWorker } from "@veda-ai/worker";
import { createApp } from "./app.js";
import { createAssessmentQueue, type AssessmentQueue } from "./queue.js";

/**
 * End-to-end happy path against the LOCAL stack (docker Mongo + Redis):
 * POST /assignments -> BullMQ -> in-process worker -> Mongo -> completed -> paper.
 *
 * CI-safe by design:
 *  - the LLM is a deterministic stub (no AWS / no network), and
 *  - the whole suite auto-skips when Mongo or Redis are unreachable,
 * so `pnpm test` stays green in environments without docker.
 *
 * A unique BullMQ prefix + a dedicated test database isolate this run from any
 * other worker/data on the same Redis/Mongo.
 */

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const MONGO_URL =
  process.env.MONGODB_URI_E2E ?? "mongodb://localhost:27017/veda-ai-e2e";
const PREFIX = `e2e:${randomUUID()}`;

/**
 * A valid QuestionPaper *content* payload (the server assigns ids + totalMarks).
 * The stub returns it regardless of the prompt — it only needs to satisfy the
 * worker's Zod re-validation, standing in for a real Bedrock structured output.
 */
const STUB_CONTENT = JSON.stringify({
  title: "E2E Generated Paper",
  sections: [
    {
      title: "Section A",
      instruction: "Choose the single best option for each question.",
      questions: [
        {
          text: "What is 2 + 2?",
          type: "mcq",
          difficulty: "easy",
          marks: 2,
          options: ["1", "2", "3", "4"],
          answer: "4",
        },
        {
          text: "Water boils at 100C at sea level.",
          type: "true_false",
          difficulty: "easy",
          marks: 1,
          answer: "True",
        },
      ],
    },
    {
      title: "Section B",
      instruction: "Answer each question in detail.",
      questions: [
        {
          text: "Explain Newton's second law of motion.",
          type: "long_answer",
          difficulty: "moderate",
          marks: 5,
          answer: "Force equals mass times acceleration (F = ma).",
        },
      ],
    },
  ],
});

async function canReachRedis(): Promise<boolean> {
  const client = createRedis(REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 1500,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}

async function canReachMongo(): Promise<boolean> {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 1500 });
    return true;
  } catch {
    return false;
  }
}

let available = false;
let app: Express;
let queue: AssessmentQueue;
let started: StartedWorker;

beforeAll(async () => {
  available = (await canReachRedis()) && (await canReachMongo());
  if (!available) {
    return;
  }
  queue = createAssessmentQueue(REDIS_URL, PREFIX);
  app = createApp({ queue });
  // Inject a deterministic stub generator (no AWS) and isolate via the prefix.
  started = await startWorker({
    generate: async () => STUB_CONTENT,
    prefix: PREFIX,
  });
}, 30000);

afterAll(async () => {
  if (!available) {
    return;
  }
  await started.close();
  await queue.obliterate({ force: true }).catch(() => undefined);
  await queue.close();
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}, 30000);

async function pollUntilCompleted(
  id: string,
  timeoutMs = 25000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request(app).get(`/api/assignments/${id}`);
    const status = res.body?.assignment?.status as string | undefined;
    if (res.status === 200 && status === "completed" && res.body.assignment.paperId) {
      return res.body.assignment.paperId as string;
    }
    if (status === "failed") {
      throw new Error("generation failed before completion");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("timed out waiting for generation to complete");
}

describe("e2e: create -> generate -> completed -> paper", () => {
  it(
    "creates an assignment, processes it via the worker, and stores a valid paper",
    async (ctx) => {
      if (!available) {
        ctx.skip();
        return;
      }

      const body = {
        title: `E2E ${randomUUID()}`,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        questionConfigs: [
          { type: "mcq", count: 2, marksPerQuestion: 2 },
          { type: "long_answer", count: 1, marksPerQuestion: 5 },
        ],
      };

      const createRes = await request(app).post("/api/assignments").send(body);
      expect(createRes.status).toBe(201);
      const assignmentId = createRes.body.assignmentId as string;
      expect(assignmentId).toBeTruthy();
      expect(createRes.body.jobId).toBeTruthy();

      const paperId = await pollUntilCompleted(assignmentId);
      expect(paperId).toBeTruthy();

      const paperRes = await request(app).get(`/api/papers/${paperId}`);
      expect(paperRes.status).toBe(200);

      // The acceptance check that matters: the stored result is a valid
      // QuestionPaper per the shared contract.
      const paper = QuestionPaper.parse(paperRes.body);
      expect(paper.assignmentId).toBe(assignmentId);
      expect(paper.sections.length).toBeGreaterThan(0);
      expect(paper.totalMarks).toBeGreaterThan(0);

      // totalMarks is server-computed from the questions, not trusted from the
      // model output.
      const summed = paper.sections
        .flatMap((section) => section.questions)
        .reduce((total, question) => total + question.marks, 0);
      expect(paper.totalMarks).toBe(summed);
    },
    40000,
  );
});
