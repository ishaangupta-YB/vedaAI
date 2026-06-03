import { describe, expect, it } from "vitest";
import { AssignmentModel } from "./models/assignment.js";
import { QuestionPaperModel } from "./models/questionPaper.js";
import { createBullRedis, createRedis } from "./redis.js";

/**
 * These tests run fully offline: Mongoose schema validation (`validateSync`)
 * and ioredis option resolution do not require a live server, so `pnpm test`
 * stays CI-safe without docker.
 */

const validAssignment = () => ({
  title: "Algebra Quiz",
  dueDate: "2999-01-01T00:00:00.000Z",
  questionConfigs: [{ type: "mcq", count: 5, marksPerQuestion: 2 }],
  status: "queued",
});

const validPaper = () => ({
  assignmentId: "assignment-1",
  title: "Algebra Quiz",
  totalMarks: 10,
  generatedAt: "2999-01-01T00:00:00.000Z",
  sections: [
    {
      id: "s1",
      title: "Section A",
      instruction: "Attempt all questions.",
      questions: [
        {
          id: "q1",
          text: "What is 2 + 2?",
          type: "mcq",
          difficulty: "easy",
          marks: 2,
          options: ["1", "2", "3", "4"],
        },
      ],
    },
  ],
});

describe("AssignmentModel", () => {
  it("validates a well-formed assignment", () => {
    expect(new AssignmentModel(validAssignment()).validateSync()).toBeUndefined();
  });

  it("rejects an unknown status", () => {
    const doc = new AssignmentModel({ ...validAssignment(), status: "bogus" });
    expect(doc.validateSync()).toBeDefined();
  });

  it("rejects count < 1", () => {
    const doc = new AssignmentModel({
      ...validAssignment(),
      questionConfigs: [{ type: "mcq", count: 0, marksPerQuestion: 2 }],
    });
    expect(doc.validateSync()).toBeDefined();
  });

  it("rejects marksPerQuestion <= 0", () => {
    const doc = new AssignmentModel({
      ...validAssignment(),
      questionConfigs: [{ type: "mcq", count: 1, marksPerQuestion: 0 }],
    });
    expect(doc.validateSync()).toBeDefined();
  });
});

describe("QuestionPaperModel", () => {
  it("validates a well-formed paper", () => {
    expect(new QuestionPaperModel(validPaper()).validateSync()).toBeUndefined();
  });

  it("rejects marks <= 0", () => {
    const paper = validPaper();
    paper.sections[0]!.questions[0]!.marks = 0;
    expect(new QuestionPaperModel(paper).validateSync()).toBeDefined();
  });

  it("rejects an unknown difficulty", () => {
    const paper = validPaper();
    (paper.sections[0]!.questions[0] as { difficulty: string }).difficulty =
      "medium";
    expect(new QuestionPaperModel(paper).validateSync()).toBeDefined();
  });

  it("indexes assignmentId", () => {
    const hasAssignmentIdIndex = QuestionPaperModel.schema
      .indexes()
      .some(([fields]) => "assignmentId" in fields);
    expect(hasAssignmentIdIndex).toBe(true);
  });
});

describe("redis factories", () => {
  it("createBullRedis forces maxRetriesPerRequest: null", () => {
    const client = createBullRedis("redis://localhost:6379", {
      lazyConnect: true,
    });
    expect(client.options.maxRetriesPerRequest).toBeNull();
    client.disconnect();
  });

  it("createBullRedis cannot be overridden by caller opts", () => {
    const client = createBullRedis("redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 20,
    });
    expect(client.options.maxRetriesPerRequest).toBeNull();
    client.disconnect();
  });

  it("createRedis passes through caller options", () => {
    const client = createRedis("redis://localhost:6379", {
      lazyConnect: true,
      connectionName: "veda-test",
    });
    expect(client.options.connectionName).toBe("veda-test");
    client.disconnect();
  });
});
