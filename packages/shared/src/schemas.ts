import { z } from "zod";
import { Difficulty, JobStatus, QuestionType } from "./enums.js";

/**
 * Zod is the single source of truth for the data model. Every TypeScript type
 * below is derived via `z.infer` — do NOT hand-write parallel types.
 *
 * The same `CreateAssignmentInput` schema is used for client-side form
 * validation (react-hook-form + zod resolver) and server-side request
 * validation (Express middleware). One schema, validated on both ends.
 */

/** ISO 8601 datetime string (with timezone offset / Z). */
const isoDatetime = z.string().datetime({ offset: true });

/** ISO datetime that must be strictly in the future (enforced at input time). */
const futureIsoDatetime = isoDatetime.refine(
  (value) => new Date(value).getTime() > Date.now(),
  { message: "dueDate must be in the future" },
);

export const QuestionConfig = z.object({
  type: QuestionType,
  count: z.number().int().min(1),
  marksPerQuestion: z.number().positive(),
});
export type QuestionConfig = z.infer<typeof QuestionConfig>;

export const CreateAssignmentInput = z.object({
  title: z.string().min(1).max(200),
  dueDate: futureIsoDatetime,
  questionConfigs: z.array(QuestionConfig).min(1).max(20),
  additionalInstructions: z.string().max(2000).optional(),
  sourceText: z.string().max(50_000).optional(),
});
export type CreateAssignmentInput = z.infer<typeof CreateAssignmentInput>;

export const Question = z.object({
  id: z.string(),
  text: z.string(),
  type: QuestionType,
  difficulty: Difficulty,
  marks: z.number().positive(),
  options: z.array(z.string()).optional(),
  answer: z.string().optional(),
});
export type Question = z.infer<typeof Question>;

export const Section = z.object({
  id: z.string(),
  title: z.string(),
  instruction: z.string(),
  questions: z.array(Question),
});
export type Section = z.infer<typeof Section>;

export const QuestionPaper = z.object({
  id: z.string(),
  assignmentId: z.string(),
  title: z.string(),
  totalMarks: z.number(),
  sections: z.array(Section),
  generatedAt: isoDatetime,
});
export type QuestionPaper = z.infer<typeof QuestionPaper>;

export const Assignment = CreateAssignmentInput.extend({
  id: z.string(),
  status: JobStatus,
  jobId: z.string().optional(),
  paperId: z.string().optional(),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});
export type Assignment = z.infer<typeof Assignment>;
