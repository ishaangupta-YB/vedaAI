import { describe, expect, it } from "vitest";
import { QuestionPaper } from "@veda-ai/shared";
import { QuestionPaperContent } from "./paperSchema.js";
import { buildPaperFields, toCreateAssignmentInput, toQuestionPaper } from "./paper.js";

const content = QuestionPaperContent.parse({
  title: "Mixed Paper",
  sections: [
    {
      title: "Section A",
      instruction: "Choose the best option.",
      questions: [
        {
          text: "2 + 2 = ?",
          type: "mcq",
          difficulty: "easy",
          marks: 2,
          options: ["3", "4", "5", "6"],
          answer: "4",
        },
      ],
    },
    {
      title: "Section B",
      instruction: "Answer in detail.",
      questions: [
        { text: "Explain entropy.", type: "long_answer", difficulty: "hard", marks: 5 },
        { text: "Define enthalpy.", type: "short_answer", difficulty: "moderate", marks: 3 },
      ],
    },
  ],
});

describe("buildPaperFields", () => {
  it("recomputes totalMarks from the questions (ignores any model total)", () => {
    const fields = buildPaperFields(content, "assignment-1");
    expect(fields.totalMarks).toBe(2 + 5 + 3);
    expect(fields.assignmentId).toBe("assignment-1");
  });

  it("assigns a unique, non-empty id to every section and question", () => {
    const fields = buildPaperFields(content, "assignment-1");
    const ids = [
      ...fields.sections.map((section) => section.id),
      ...fields.sections.flatMap((section) =>
        section.questions.map((question) => question.id),
      ),
    ];
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("produces a paper that satisfies the shared QuestionPaper schema", () => {
    const fields = buildPaperFields(content, "assignment-1");
    const paper = toQuestionPaper("paper-1", fields);
    expect(QuestionPaper.safeParse(paper).success).toBe(true);
  });

  it("stamps a fresh generatedAt and gives different ids each call", () => {
    const first = buildPaperFields(content, "assignment-1");
    const second = buildPaperFields(content, "assignment-1");
    expect(first.sections[0]!.id).not.toBe(second.sections[0]!.id);
  });
});

describe("toCreateAssignmentInput", () => {
  it("drops empty optional fields so the cache hash stays stable", () => {
    const result = toCreateAssignmentInput({
      title: "T",
      dueDate: "2999-01-01T00:00:00.000Z",
      questionConfigs: [{ type: "mcq", count: 2, marksPerQuestion: 1 }],
      additionalInstructions: "",
      sourceText: null,
    });
    expect(result).not.toHaveProperty("additionalInstructions");
    expect(result).not.toHaveProperty("sourceText");
  });

  it("keeps populated optional fields", () => {
    const result = toCreateAssignmentInput({
      title: "T",
      dueDate: "2999-01-01T00:00:00.000Z",
      questionConfigs: [{ type: "mcq", count: 2, marksPerQuestion: 1 }],
      additionalInstructions: "No calculators",
      sourceText: "Chapter 3",
    });
    expect(result.additionalInstructions).toBe("No calculators");
    expect(result.sourceText).toBe("Chapter 3");
  });
});
