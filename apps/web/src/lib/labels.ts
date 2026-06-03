import type { Difficulty, QuestionType } from "@veda-ai/shared";

/**
 * Presentation maps for the shared enums. The wire values stay canonical
 * (mcq / short_answer / …); only the human-facing copy lives here.
 */

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Multiple Choice Questions",
  short_answer: "Short Answer Questions",
  long_answer: "Long Answer Questions",
  true_false: "True / False",
  fill_blank: "Fill in the Blanks",
};

/** Order used to render the question-type dropdown. */
export const QUESTION_TYPE_ORDER: QuestionType[] = [
  "mcq",
  "short_answer",
  "long_answer",
  "true_false",
  "fill_blank",
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
};

/** Tailwind token classes for each difficulty badge (bg / text / ring). */
export const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  easy: "bg-easy-bg text-easy-fg ring-easy-ring",
  moderate: "bg-moderate-bg text-moderate-fg ring-moderate-ring",
  hard: "bg-hard-bg text-hard-fg ring-hard-ring",
};
