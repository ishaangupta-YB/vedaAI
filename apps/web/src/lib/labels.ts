import type { Difficulty, QuestionType } from "@veda-ai/shared";

/**
 * Presentation maps for the shared enums. The human-facing copy is single-
 * sourced in `@veda-ai/shared` (so the web UI and the PDF can never drift) and
 * re-exported here; only web-only concerns (dropdown order, Tailwind badge
 * classes) are defined locally.
 */

export { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from "@veda-ai/shared";

/** Order used to render the question-type dropdown. */
export const QUESTION_TYPE_ORDER: QuestionType[] = [
  "mcq",
  "short_answer",
  "long_answer",
  "true_false",
  "fill_blank",
];

/**
 * Tailwind token classes for each difficulty badge (bg / text / ring). The
 * underlying hex values live in `apps/web/app/globals.css` `@theme` and mirror
 * `DIFFICULTY_COLORS` in `@veda-ai/shared`, which the PDF badge consumes.
 */
export const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  easy: "bg-easy-bg text-easy-fg ring-easy-ring",
  moderate: "bg-moderate-bg text-moderate-fg ring-moderate-ring",
  hard: "bg-hard-bg text-hard-fg ring-hard-ring",
};
