/**
 * Shared constants: WebSocket event names, REST routes, queue + job names, and
 * the Redis pub/sub channel that bridges the worker to the Socket.IO server.
 * These are the wire contract — do not redefine them inside apps.
 */

import type { Difficulty, QuestionType } from "./enums.js";

/** Server -> client Socket.IO events (see CLAUDE.md "WebSocket contract"). */
export const WS_EVENTS = {
  GENERATION_QUEUED: "generation:queued",
  GENERATION_ACTIVE: "generation:active",
  GENERATION_PROGRESS: "generation:progress",
  GENERATION_COMPLETED: "generation:completed",
  GENERATION_FAILED: "generation:failed",
  PDF_READY: "pdf:ready",
} as const;
export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

/** REST API routes (base path `/api`). Functions build parameterized paths. */
export const API_ROUTES = {
  HEALTH: "/api/health",
  UPLOADS: "/api/uploads",
  ASSIGNMENTS: "/api/assignments",
  ASSIGNMENT: (id: string): string => `/api/assignments/${id}`,
  ASSIGNMENT_REGENERATE: (id: string): string => `/api/assignments/${id}/regenerate`,
  PAPER: (id: string): string => `/api/papers/${id}`,
  PAPER_PDF: (id: string): string => `/api/papers/${id}/pdf`,
} as const;

/** BullMQ queue name. */
export const QUEUE_NAME = "assessment" as const;

/** BullMQ job names and their (future) payload contracts live with the worker. */
export const JOB_NAMES = {
  GENERATE_PAPER: "generate-paper",
  RENDER_PDF: "render-pdf",
} as const;
export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

/**
 * Redis pub/sub channel. The worker publishes `{ event, payload }` JSON here;
 * the API server subscribes and re-emits to room `assignment:<assignmentId>`.
 */
export const WS_PUBSUB_CHANNEL = "ws:events" as const;

/** A difficulty badge's three colors: fill, text, and border. */
export interface DifficultyColor {
  bg: string;
  fg: string;
  ring: string;
}

/**
 * Presentation (not wire) constant: the single source of truth for the
 * difficulty colour-coding shared by the web UI badge and the PDF badge, so the
 * two renderers can never drift. The web's Tailwind `@theme` difficulty tokens
 * (`apps/web/app/globals.css`) mirror these exact hex values; the worker's
 * `@react-pdf/renderer` document consumes them directly (it has no Tailwind).
 */
export const DIFFICULTY_COLORS: Record<Difficulty, DifficultyColor> = {
  easy: { bg: "#e9f8ef", fg: "#157a3a", ring: "#bce8cd" },
  moderate: { bg: "#fff2df", fg: "#b45309", ring: "#fbd8a4" },
  hard: { bg: "#fce9e9", fg: "#bb1c1c", ring: "#f3c2c2" },
};

/** Title-cased difficulty labels used in both the web UI and the PDF. */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
};

/**
 * Human-facing labels for each question type, used as section sub-headings in
 * both the web output and the PDF. Wire values stay canonical (`mcq`, …); only
 * the copy lives here.
 */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Multiple Choice Questions",
  short_answer: "Short Answer Questions",
  long_answer: "Long Answer Questions",
  true_false: "True / False",
  fill_blank: "Fill in the Blanks",
};
