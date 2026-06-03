import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

/**
 * Integration tests for the validation + enqueue path. The DB layer is mocked
 * so these run fully offline (no Mongo/Redis), matching the rest of the repo's
 * CI-safe test strategy. The BullMQ queue is injected as a fake, so we can
 * assert exactly what the route enqueues.
 */
vi.mock("@veda-ai/db", () => ({
  AssignmentModel: {
    create: vi.fn(),
    findById: vi.fn(),
  },
  QuestionPaperModel: {
    findById: vi.fn(),
  },
  mongoose: {
    isValidObjectId: vi.fn(() => true),
  },
  // Imported transitively elsewhere; unused by these tests.
  connectMongo: vi.fn(),
  createRedis: vi.fn(),
  createBullRedis: vi.fn(),
}));

import { AssignmentModel } from "@veda-ai/db";
import { createApp } from "./app.js";
import type { AssessmentQueue } from "./queue.js";

const FAKE_ID = "651f1c2a9b1e8a0012345678";

const validBody = {
  title: "Algebra Quiz",
  dueDate: "2999-01-01T00:00:00.000Z",
  questionConfigs: [{ type: "mcq", count: 5, marksPerQuestion: 2 }],
};

function buildApp(queueAdd = vi.fn().mockResolvedValue({ id: "job-123" })) {
  const queue = { add: queueAdd } as unknown as AssessmentQueue;
  return { app: createApp({ queue }), queueAdd };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("POST /api/assignments", () => {
  it("persists with status queued, enqueues a generate-paper job, and returns 201", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    vi.mocked(AssignmentModel.create).mockResolvedValue({
      _id: FAKE_ID,
      jobId: undefined,
      save,
    } as never);

    const { app, queueAdd } = buildApp();
    const res = await request(app).post("/api/assignments").send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ assignmentId: FAKE_ID, jobId: "job-123" });

    expect(AssignmentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...validBody, status: "queued" }),
    );
    expect(queueAdd).toHaveBeenCalledTimes(1);
    expect(queueAdd).toHaveBeenCalledWith("generate-paper", { assignmentId: FAKE_ID });
    // jobId is written back onto the persisted assignment.
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid body with 400 ValidationError and does NOT enqueue", async () => {
    const { app, queueAdd } = buildApp();
    const res = await request(app)
      .post("/api/assignments")
      .send({ title: "", questionConfigs: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(res.body.issues.length).toBeGreaterThan(0);

    expect(AssignmentModel.create).not.toHaveBeenCalled();
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("rejects a past dueDate (future-only refinement)", async () => {
    const { app, queueAdd } = buildApp();
    const res = await request(app)
      .post("/api/assignments")
      .send({ ...validBody, dueDate: "2000-01-01T00:00:00.000Z" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400", async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post("/api/assignments")
      .set("Content-Type", "application/json")
      .send("{ not valid json");

    expect(res.status).toBe(400);
  });
});

describe("not found", () => {
  it("returns 404 when the assignment does not exist", async () => {
    vi.mocked(AssignmentModel.findById).mockResolvedValue(null as never);
    const { app } = buildApp();
    const res = await request(app).get(`/api/assignments/${FAKE_ID}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "NotFound" });
  });

  it("returns 404 for an unknown route", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "NotFound" });
  });
});
