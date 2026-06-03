import { describe, expect, it } from "vitest";
import { stableInputHash } from "./hash.js";
import type { CreateAssignmentInput } from "./schemas.js";

const input: CreateAssignmentInput = {
  title: "Algebra Quiz",
  dueDate: "2999-01-01T00:00:00.000Z",
  questionConfigs: [
    { type: "mcq", count: 5, marksPerQuestion: 2 },
    { type: "long_answer", count: 2, marksPerQuestion: 10 },
  ],
  additionalInstructions: "No calculators.",
  sourceText: "Chapter 3",
};

describe("stableInputHash", () => {
  it("is deterministic for the same input", () => {
    expect(stableInputHash(input)).toBe(stableInputHash(input));
  });

  it("returns a 64-char hex sha256 digest", () => {
    expect(stableInputHash(input)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is independent of object key insertion order", () => {
    const reordered: CreateAssignmentInput = {
      sourceText: "Chapter 3",
      additionalInstructions: "No calculators.",
      questionConfigs: [
        { marksPerQuestion: 2, type: "mcq", count: 5 },
        { count: 2, marksPerQuestion: 10, type: "long_answer" },
      ],
      dueDate: "2999-01-01T00:00:00.000Z",
      title: "Algebra Quiz",
    };
    expect(stableInputHash(reordered)).toBe(stableInputHash(input));
  });

  it("changes when a meaningful field changes", () => {
    const changed: CreateAssignmentInput = { ...input, title: "Geometry Quiz" };
    expect(stableInputHash(changed)).not.toBe(stableInputHash(input));
  });

  it("treats a missing optional field differently from an empty string", () => {
    const withoutSource: CreateAssignmentInput = { ...input };
    delete withoutSource.sourceText;
    expect(stableInputHash(withoutSource)).not.toBe(stableInputHash(input));
  });

  it("is sensitive to questionConfigs order (arrays are ordered)", () => {
    const swapped: CreateAssignmentInput = {
      ...input,
      questionConfigs: [
        { type: "long_answer", count: 2, marksPerQuestion: 10 },
        { type: "mcq", count: 5, marksPerQuestion: 2 },
      ],
    };
    expect(stableInputHash(swapped)).not.toBe(stableInputHash(input));
  });
});
