/**
 * Shared constants: WebSocket event names, REST routes, queue + job names, and
 * the Redis pub/sub channel that bridges the worker to the Socket.IO server.
 * These are the wire contract — do not redefine them inside apps.
 */

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
