import { describe, expect, it } from "vitest";
import { Difficulty, QuestionType } from "@veda-ai/shared";
import { QUESTION_PAPER_JSON_SCHEMA, QuestionPaperContent } from "./paperSchema.js";

const baseQuestion = {
  text: "What is 2 + 2?",
  type: "mcq" as const,
  difficulty: "easy" as const,
  marks: 2,
  options: ["3", "4", "5", "6"],
  answer: "4",
};

const validPaper = {
  title: "Algebra Quiz",
  sections: [
    { title: "Section A", instruction: "Attempt all.", questions: [baseQuestion] },
  ],
};

describe("QUESTION_PAPER_JSON_SCHEMA", () => {
  it("stays in sync with the shared enums", () => {
    const serialized = JSON.stringify(QUESTION_PAPER_JSON_SCHEMA);
    for (const value of QuestionType.options) {
      expect(serialized).toContain(`"${value}"`);
    }
    for (const value of Difficulty.options) {
      expect(serialized).toContain(`"${value}"`);
    }
  });

  it("forbids server-assigned fields (no id/assignmentId/totalMarks)", () => {
    const serialized = JSON.stringify(QUESTION_PAPER_JSON_SCHEMA);
    expect(serialized).not.toContain("assignmentId");
    expect(serialized).not.toContain("totalMarks");
    expect(serialized).not.toContain("generatedAt");
  });
});

describe("QuestionPaperContent", () => {
  it("accepts well-formed content", () => {
    expect(QuestionPaperContent.safeParse(validPaper).success).toBe(true);
  });

  it("rejects an empty paper (no sections)", () => {
    expect(
      QuestionPaperContent.safeParse({ title: "x", sections: [] }).success,
    ).toBe(false);
  });

  it("rejects a section with no questions", () => {
    const paper = {
      title: "x",
      sections: [{ title: "Section A", instruction: "Go", questions: [] }],
    };
    expect(QuestionPaperContent.safeParse(paper).success).toBe(false);
  });

  it("rejects marks <= 0", () => {
    const paper = {
      title: "x",
      sections: [
        {
          title: "Section A",
          instruction: "Go",
          questions: [{ ...baseQuestion, marks: 0 }],
        },
      ],
    };
    expect(QuestionPaperContent.safeParse(paper).success).toBe(false);
  });

  it("rejects an mcq with fewer than 2 options", () => {
    const paper = {
      title: "x",
      sections: [
        {
          title: "Section A",
          instruction: "Go",
          questions: [{ ...baseQuestion, options: ["only"] }],
        },
      ],
    };
    expect(QuestionPaperContent.safeParse(paper).success).toBe(false);
  });

  it("allows non-mcq questions without options", () => {
    const paper = {
      title: "x",
      sections: [
        {
          title: "Section A",
          instruction: "Go",
          questions: [
            { text: "Explain X.", type: "long_answer", difficulty: "hard", marks: 5 },
          ],
        },
      ],
    };
    expect(QuestionPaperContent.safeParse(paper).success).toBe(true);
  });
});
