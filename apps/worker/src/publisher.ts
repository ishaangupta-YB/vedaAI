import type { Redis } from "@veda-ai/db";
import { WS_EVENTS, WS_PUBSUB_CHANNEL, type WsEvent } from "@veda-ai/shared";

/**
 * The worker is a separate process from the Socket.IO server, so it NEVER
 * touches sockets directly. Every real-time update is published as JSON
 * `{ event, payload }` to the Redis pub/sub channel `ws:events`; the API server
 * subscribes and re-emits to room `assignment:<assignmentId>`.
 *
 * Payload shapes mirror the "WebSocket contract" table in CLAUDE.md. Note the
 * worker only emits events from `generation:active` onward — `generation:queued`
 * is the API's responsibility (emitted when the job is enqueued).
 */
export interface WsEventPayloads {
  [WS_EVENTS.GENERATION_ACTIVE]: { assignmentId: string };
  [WS_EVENTS.GENERATION_PROGRESS]: {
    assignmentId: string;
    progress: number;
    stage: string;
  };
  [WS_EVENTS.GENERATION_COMPLETED]: { assignmentId: string; paperId: string };
  [WS_EVENTS.GENERATION_FAILED]: { assignmentId: string; error: string };
  [WS_EVENTS.PDF_READY]: { assignmentId: string; paperId: string; url: string };
}

export interface Publisher {
  /**
   * The single choke point for real-time updates: serialize `{ event, payload }`
   * and publish to `ws:events`.
   */
  publish<E extends keyof WsEventPayloads>(
    event: E,
    payload: WsEventPayloads[E],
  ): Promise<void>;
}

/**
 * Build a {@link Publisher} over a dedicated ioredis connection. The connection
 * is used purely for `PUBLISH`, so it can be a normal (non-subscriber) client.
 */
export function createPublisher(redis: Redis): Publisher {
  return {
    async publish(event, payload): Promise<void> {
      const message = JSON.stringify({ event: event as WsEvent, payload });
      await redis.publish(WS_PUBSUB_CHANNEL, message);
    },
  };
}
