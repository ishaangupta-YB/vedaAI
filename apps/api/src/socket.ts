import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { z } from "zod";
import { WS_PUBSUB_CHANNEL } from "@veda-ai/shared";
import { createRedis, type Redis } from "@veda-ai/db";
import { logger } from "./lib/logger.js";

/** Socket.IO room a client joins to receive a given assignment's events. */
function assignmentRoom(assignmentId: string): string {
  return `assignment:${assignmentId}`;
}

const roomPayload = z.object({ assignmentId: z.string().min(1) });

/**
 * Attach a Socket.IO server to the shared HTTP server. Clients send `join` /
 * `leave` with `{ assignmentId }` to enter/exit room `assignment:<id>`; the
 * pub/sub bridge (below) re-emits worker events into those rooms.
 */
export function createSocketServer(httpServer: HttpServer, clientOrigin: string): Server {
  const io = new Server(httpServer, {
    cors: { origin: clientOrigin, methods: ["GET", "POST"], credentials: true },
  });

  io.on("connection", (socket) => {
    logger.info("socket connected", { socketId: socket.id });

    socket.on("join", (raw: unknown) => {
      const parsed = roomPayload.safeParse(raw);
      if (!parsed.success) {
        return;
      }
      void socket.join(assignmentRoom(parsed.data.assignmentId));
    });

    socket.on("leave", (raw: unknown) => {
      const parsed = roomPayload.safeParse(raw);
      if (!parsed.success) {
        return;
      }
      void socket.leave(assignmentRoom(parsed.data.assignmentId));
    });

    socket.on("disconnect", (reason) => {
      logger.info("socket disconnected", { socketId: socket.id, reason });
    });
  });

  return io;
}

/** Shape the worker publishes to `ws:events`: `{ event, payload }`. */
const bridgeMessage = z.object({
  event: z.string().min(1),
  payload: z.object({ assignmentId: z.string().min(1) }).passthrough(),
});

/**
 * Parse one raw `ws:events` message and re-emit it to the matching room. Kept
 * separate from the Redis subscription so the routing/parsing discipline can be
 * tested without a live Redis. Returns whether the message was forwarded.
 * Malformed JSON or messages that fail the schema are dropped (logged, not
 * thrown) — a bad publish must never crash the bridge.
 */
export function handleBridgeMessage(io: Server, message: string): boolean {
  let json: unknown;
  try {
    json = JSON.parse(message);
  } catch {
    logger.warn("ws:events message was not valid JSON", { message });
    return false;
  }
  const result = bridgeMessage.safeParse(json);
  if (!result.success) {
    logger.warn("ws:events message failed schema", { message });
    return false;
  }
  const { event, payload } = result.data;
  io.to(assignmentRoom(payload.assignmentId)).emit(event, payload);
  return true;
}

/**
 * THE PUB/SUB BRIDGE. The worker is a separate process and does not own the
 * sockets; it publishes `{ event, payload }` JSON to the `ws:events` Redis
 * channel. Here (and only here) we subscribe on a dedicated connection — a
 * subscriber connection cannot run normal commands — and re-emit each message
 * to room `assignment:<payload.assignmentId>` so it reaches the browser.
 */
export function startPubSubBridge(io: Server, redisUrl: string): Redis {
  const subscriber = createRedis(redisUrl);

  subscriber.subscribe(WS_PUBSUB_CHANNEL, (err) => {
    if (err) {
      logger.error("failed to subscribe to ws:events", { error: err.message });
      return;
    }
    logger.info("ws:events bridge subscribed", { channel: WS_PUBSUB_CHANNEL });
  });

  subscriber.on("message", (channel, message) => {
    if (channel !== WS_PUBSUB_CHANNEL) {
      return;
    }
    handleBridgeMessage(io, message);
  });

  return subscriber;
}
