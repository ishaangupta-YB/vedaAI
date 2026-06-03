import { describe, expect, it } from "vitest";
import type { CreateAssignmentInput } from "@veda-ai/shared";
import {
  buildSystemPrompt,
  buildUserPrompt,
  difficultySpread,
  sectionLabel,
} from "./prompt.js";

const fixedInput: CreateAssignmentInput = {
  title: "Chemistry Mid-Term",
  dueDate: "2999-01-01T00:00:00.000Z",
  questionConfigs: [
    { type: "mcq", count: 6, marksPerQuestion: 1 },
    { type: "short_answer", count: 3, marksPerQuestion: 2 },
    { type: "long_answer", count: 2, marksPerQuestion: 5 },
  ],
  additionalInstructions: "Cover the chemical effects of electric current.",
  sourceText: "Electrolysis deposits metals using electric current.",
};

describe("difficultySpread", () => {
  it("sums to the requested count", () => {
    for (const count of [1, 2, 3, 5, 7, 10, 13, 20]) {
      const spread = difficultySpread(count);
      expect(spread.easy + spread.moderate + spread.hard).toBe(count);
    }
  });

  it("approximates a 30/40/30 split with moderate as the largest band", () => {
    const spread = difficultySpread(10);
    expect(spread).toEqual({ easy: 3, moderate: 4, hard: 3 });
  });

  it("collapses tiny counts onto moderate", () => {
    expect(difficultySpread(1)).toEqual({ easy: 0, moderate: 1, hard: 0 });
  });
});

describe("sectionLabel", () => {
  it("labels sections A, B, C in order", () => {
    expect(sectionLabel(0)).toBe("Section A");
    expect(sectionLabel(1)).toBe("Section B");
    expect(sectionLabel(2)).toBe("Section C");
  });
});

describe("buildUserPrompt", () => {
  it("is deterministic for the same input", () => {
    expect(buildUserPrompt(fixedInput)).toBe(buildUserPrompt(fixedInput));
  });

  it("omits the source-material block when no sourceText is provided", () => {
    const { sourceText: _omitted, ...withoutSource } = fixedInput;
    expect(buildUserPrompt(withoutSource)).not.toContain("source material");
  });

  it("matches the snapshot for a fixed input", () => {
    expect(buildUserPrompt(fixedInput)).toMatchInlineSnapshot(`
      "Generate a question paper titled "Chemistry Mid-Term".

      Produce 11 question(s) across 3 section(s). Group questions by type into the sections below, in order. Title each section exactly "Section A", "Section B", and so on.

      Section A — Multiple Choice Questions
      - Number of questions: 6
      - Marks per question: 1
      - Section instruction: Choose the single best option for each question.
      - Target difficulty spread (easy/moderate/hard): 1/4/1
      - Provide exactly four answer options per question, with exactly one correct option.

      Section B — Short Answer Questions
      - Number of questions: 3
      - Marks per question: 2
      - Section instruction: Answer each question briefly in two or three sentences.
      - Target difficulty spread (easy/moderate/hard): 0/3/0

      Section C — Long Answer Questions
      - Number of questions: 2
      - Marks per question: 5
      - Section instruction: Answer each question in detail.
      - Target difficulty spread (easy/moderate/hard): 0/2/0

      Additional instructions from the teacher:
      Cover the chemical effects of electric current.

      Base the questions on the following source material:
      """
      Electrolysis deposits metals using electric current.
      """"
    `);
  });
});

describe("buildSystemPrompt", () => {
  it("matches the snapshot", () => {
    expect(buildSystemPrompt()).toMatchInlineSnapshot(`
      "You are an expert exam-paper author for school and university assessments.
      Produce a complete, well-formed question paper as structured data.

      Rules:
      - Every question must be clear, self-contained, and suitable for its stated difficulty.
      - Use only the difficulty levels easy, moderate, or hard.
      - Give each question exactly the marks specified for its section.
      - For multiple-choice questions, provide four plausible options with exactly one correct answer, and set the answer to the text of the correct option.
      - Provide a concise model answer in each question's answer field.
      - Group questions by type into the sections described, in the given order.
      - Do not add commentary, preamble, or any text outside the requested structure."
    `);
  });
});
