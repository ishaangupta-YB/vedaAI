import { describe, expect, it } from "vitest";
import { CreateAssignmentInput } from "./schemas.js";

const futureIso = (): string =>
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastIso = (): string =>
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const baseValid = () => ({
  title: "Algebra Quiz",
  dueDate: futureIso(),
  questionConfigs: [{ type: "mcq", count: 5, marksPerQuestion: 2 }],
});

describe("CreateAssignmentInput", () => {
  it("accepts a minimal valid input", () => {
    expect(CreateAssignmentInput.safeParse(baseValid()).success).toBe(true);
  });

  it("accepts a full valid input with optional fields", () => {
    const result = CreateAssignmentInput.safeParse({
      ...baseValid(),
      questionConfigs: [
        { type: "mcq", count: 5, marksPerQuestion: 2 },
        { type: "long_answer", count: 2, marksPerQuestion: 10 },
      ],
      additionalInstructions: "No calculators.",
      sourceText: "Chapter 3: linear equations...",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(
      CreateAssignmentInput.safeParse({ ...baseValid(), title: "" }).success,
    ).toBe(false);
  });

  it("rejects a title longer than 200 chars", () => {
    expect(
      CreateAssignmentInput.safeParse({ ...baseValid(), title: "a".repeat(201) })
        .success,
    ).toBe(false);
  });

  it("rejects a non-ISO dueDate", () => {
    expect(
      CreateAssignmentInput.safeParse({ ...baseValid(), dueDate: "2025-13-40" })
        .success,
    ).toBe(false);
  });

  it("rejects a dueDate in the past", () => {
    expect(
      CreateAssignmentInput.safeParse({ ...baseValid(), dueDate: pastIso() })
        .success,
    ).toBe(false);
  });

  it("rejects zero questionConfigs", () => {
    expect(
      CreateAssignmentInput.safeParse({ ...baseValid(), questionConfigs: [] })
        .success,
    ).toBe(false);
  });

  it("rejects more than 20 questionConfigs", () => {
    const many = Array.from({ length: 21 }, () => ({
      type: "mcq" as const,
      count: 1,
      marksPerQuestion: 1,
    }));
    expect(
      CreateAssignmentInput.safeParse({ ...baseValid(), questionConfigs: many })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown question type", () => {
    expect(
      CreateAssignmentInput.safeParse({
        ...baseValid(),
        questionConfigs: [{ type: "essay", count: 1, marksPerQuestion: 1 }],
      }).success,
    ).toBe(false);
  });

  it("rejects count < 1", () => {
    expect(
      CreateAssignmentInput.safeParse({
        ...baseValid(),
        questionConfigs: [{ type: "mcq", count: 0, marksPerQuestion: 1 }],
      }).success,
    ).toBe(false);
  });

  it("rejects non-integer count", () => {
    expect(
      CreateAssignmentInput.safeParse({
        ...baseValid(),
        questionConfigs: [{ type: "mcq", count: 1.5, marksPerQuestion: 1 }],
      }).success,
    ).toBe(false);
  });

  it("rejects marksPerQuestion <= 0", () => {
    expect(
      CreateAssignmentInput.safeParse({
        ...baseValid(),
        questionConfigs: [{ type: "mcq", count: 1, marksPerQuestion: 0 }],
      }).success,
    ).toBe(false);
  });

  it("rejects additionalInstructions longer than 2000 chars", () => {
    expect(
      CreateAssignmentInput.safeParse({
        ...baseValid(),
        additionalInstructions: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("rejects sourceText longer than 50000 chars", () => {
    expect(
      CreateAssignmentInput.safeParse({
        ...baseValid(),
        sourceText: "x".repeat(50001),
      }).success,
    ).toBe(false);
  });
});
