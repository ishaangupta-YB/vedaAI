import { z } from "zod";
import { Difficulty, Question, QuestionType, Section } from "@veda-ai/shared";

/**
 * The model produces only the *content* of a question paper. The server assigns
 * the rest: the paper `id`/`assignmentId`/`generatedAt` and `totalMarks`, plus a
 * fresh `id` for every section and question (CLAUDE.md "Generation job flow",
 * step 5). These "content" schemas are derived from the shared schemas via
 * `.omit(...)` so they can never drift from the contract — they are not parallel
 * hand-written types.
 */
export const QuestionContent = Question.omit({ id: true });
export type QuestionContent = z.infer<typeof QuestionContent>;

export const SectionContent = Section.omit({ id: true, questions: true }).extend({
  questions: z
    .array(QuestionContent)
    .min(1, "each section must contain at least one question"),
});
export type SectionContent = z.infer<typeof SectionContent>;

/**
 * The full re-validation target for the LLM output. Even though the response is
 * schema-constrained by structured outputs, we re-validate here AND enforce our
 * own semantic invariants that a JSON schema can't express:
 *  - every section is non-empty (via `SectionContent.questions.min(1)`)
 *  - every question carries marks > 0 (inherited from the shared `Question`)
 *  - every `mcq` ships at least 2 options
 * A failure here triggers exactly one repair round-trip in `generate.ts`.
 */
export const QuestionPaperContent = z
  .object({
    title: z.string().min(1),
    sections: z.array(SectionContent).min(1, "paper must have at least one section"),
  })
  .superRefine((paper, ctx) => {
    paper.sections.forEach((section, sectionIndex) => {
      section.questions.forEach((question, questionIndex) => {
        if (
          question.type === "mcq" &&
          (question.options === undefined || question.options.length < 2)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["sections", sectionIndex, "questions", questionIndex, "options"],
            message: "mcq questions must include at least 2 options",
          });
        }
      });
    });
  });
export type QuestionPaperContent = z.infer<typeof QuestionPaperContent>;

/**
 * JSON Schema handed to Anthropic via `output_config.format` (the structured
 * outputs layer). It is the `QuestionPaper` shape minus all server-assigned
 * fields (paper/section/question ids, `assignmentId`, `totalMarks`,
 * `generatedAt`). Enum values are sourced from the shared enums so they cannot
 * drift; semantic invariants are intentionally left to Zod re-validation.
 */
export const QUESTION_PAPER_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["title", "sections"],
  properties: {
    title: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "instruction", "questions"],
        properties: {
          title: { type: "string" },
          instruction: { type: "string" },
          questions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "type", "difficulty", "marks"],
              properties: {
                text: { type: "string" },
                type: { type: "string", enum: [...QuestionType.options] },
                difficulty: { type: "string", enum: [...Difficulty.options] },
                marks: { type: "number" },
                options: { type: "array", items: { type: "string" } },
                answer: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};
