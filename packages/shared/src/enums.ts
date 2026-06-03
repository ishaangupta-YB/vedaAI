import { z } from "zod";

/**
 * Canonical enums. Use these exact string values everywhere (see CLAUDE.md).
 * Each enum is exported both as a Zod schema (value) and as a TS type derived
 * via `z.infer` (type) — never hand-write a parallel union.
 */

export const QuestionType = z.enum([
  "mcq",
  "short_answer",
  "long_answer",
  "true_false",
  "fill_blank",
]);
export type QuestionType = z.infer<typeof QuestionType>;

export const Difficulty = z.enum(["easy", "moderate", "hard"]);
export type Difficulty = z.infer<typeof Difficulty>;

export const JobStatus = z.enum(["queued", "active", "completed", "failed"]);
export type JobStatus = z.infer<typeof JobStatus>;
