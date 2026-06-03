import { WS_EVENTS } from "@veda-ai/shared";

/**
 * Typed payloads for the server -> client Socket.IO events. These mirror the
 * "WebSocket contract" table in CLAUDE.md. The event NAMES come from the shared
 * `WS_EVENTS` constant (the contract); only the payload shapes are typed here.
 */

export interface GenerationQueuedPayload {
  assignmentId: string;
  jobId: string;
}
export interface GenerationActivePayload {
  assignmentId: string;
}
export interface GenerationProgressPayload {
  assignmentId: string;
  progress: number;
  stage: string;
}
export interface GenerationCompletedPayload {
  assignmentId: string;
  paperId: string;
}
export interface GenerationFailedPayload {
  assignmentId: string;
  error: string;
}
export interface PdfReadyPayload {
  assignmentId: string;
  paperId: string;
  url: string;
}

/** Discriminated envelope used by the mock channel + internal dispatch. */
export type WsEnvelope =
  | { event: typeof WS_EVENTS.GENERATION_QUEUED; payload: GenerationQueuedPayload }
  | { event: typeof WS_EVENTS.GENERATION_ACTIVE; payload: GenerationActivePayload }
  | { event: typeof WS_EVENTS.GENERATION_PROGRESS; payload: GenerationProgressPayload }
  | { event: typeof WS_EVENTS.GENERATION_COMPLETED; payload: GenerationCompletedPayload }
  | { event: typeof WS_EVENTS.GENERATION_FAILED; payload: GenerationFailedPayload }
  | { event: typeof WS_EVENTS.PDF_READY; payload: PdfReadyPayload };
