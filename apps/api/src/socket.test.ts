import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";
import type { Server as IoServer } from "socket.io";
import { createSocketServer, handleBridgeMessage } from "./socket.js";

/**
 * Verifies the worker -> browser path that matters most: a message "published"
 * to the bridge is delivered only to sockets in the matching assignment room.
 * We call `handleBridgeMessage` directly (the same function the Redis subscriber
 * calls), so this runs offline — no live Redis needed — while still exercising
 * the real Socket.IO server + client and room routing.
 */
let httpServer: HttpServer;
let io: IoServer;
let port: number;

beforeAll(async () => {
  httpServer = createServer();
  io = createSocketServer(httpServer, "*");
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => io.close(() => resolve()));
});

function connectClient(): Promise<ClientSocket> {
  const socket = connect(`http://localhost:${port}`, {
    transports: ["websocket"],
    forceNew: true,
  });
  return new Promise((resolve, reject) => {
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
  });
}

/** Resolve once a room has (or no longer has) at least one member. */
function waitForRoomSize(room: string, present: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = (): void => {
      const members = io.sockets.adapter.rooms.get(room);
      const has = Boolean(members && members.size > 0);
      if (has === present) {
        resolve();
        return;
      }
      if (Date.now() - start > 2000) {
        reject(new Error(`room ${room} membership never became ${present}`));
        return;
      }
      setTimeout(tick, 10);
    };
    tick();
  });
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe("Socket.IO pub/sub bridge", () => {
  it("re-emits a published event to a socket joined to the matching room", async () => {
    const client = await connectClient();
    try {
      client.emit("join", { assignmentId: "A1" });
      await waitForRoomSize("assignment:A1", true);

      const received = waitForEvent<{ assignmentId: string; paperId: string }>(
        client,
        "generation:completed",
      );
      const forwarded = handleBridgeMessage(
        io,
        JSON.stringify({
          event: "generation:completed",
          payload: { assignmentId: "A1", paperId: "P1" },
        }),
      );
      expect(forwarded).toBe(true);

      await expect(received).resolves.toEqual({ assignmentId: "A1", paperId: "P1" });
    } finally {
      client.disconnect();
    }
  });

  it("does not deliver to a socket in a different room", async () => {
    const client = await connectClient();
    try {
      client.emit("join", { assignmentId: "OTHER" });
      await waitForRoomSize("assignment:OTHER", true);

      let leaked = false;
      client.on("generation:completed", () => {
        leaked = true;
      });
      handleBridgeMessage(
        io,
        JSON.stringify({ event: "generation:completed", payload: { assignmentId: "A1" } }),
      );
      await new Promise((r) => setTimeout(r, 150));
      expect(leaked).toBe(false);
    } finally {
      client.disconnect();
    }
  });

  it("stops delivering after the socket leaves the room", async () => {
    const client = await connectClient();
    try {
      client.emit("join", { assignmentId: "A2" });
      await waitForRoomSize("assignment:A2", true);
      client.emit("leave", { assignmentId: "A2" });
      await waitForRoomSize("assignment:A2", false);

      let leaked = false;
      client.on("generation:completed", () => {
        leaked = true;
      });
      handleBridgeMessage(
        io,
        JSON.stringify({ event: "generation:completed", payload: { assignmentId: "A2" } }),
      );
      await new Promise((r) => setTimeout(r, 150));
      expect(leaked).toBe(false);
    } finally {
      client.disconnect();
    }
  });

  it("drops malformed or schema-invalid messages without throwing", () => {
    expect(handleBridgeMessage(io, "{ not json")).toBe(false);
    expect(handleBridgeMessage(io, JSON.stringify({ event: "x" }))).toBe(false);
    expect(handleBridgeMessage(io, JSON.stringify({ payload: { assignmentId: "A1" } }))).toBe(
      false,
    );
  });
});
