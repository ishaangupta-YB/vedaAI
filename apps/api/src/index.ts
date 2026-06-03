import { createServer as createHttpServer } from "node:http";
import { connectMongo } from "@veda-ai/db";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { createAssessmentQueue } from "./queue.js";
import { createSocketServer, startPubSubBridge } from "./socket.js";
import { logger } from "./lib/logger.js";

/**
 * API process entrypoint: connect Mongo, build the BullMQ producer queue and
 * the Express app, attach Socket.IO + the Redis pub/sub bridge to a single HTTP
 * server, then listen. Shuts everything down cleanly on SIGINT/SIGTERM.
 */
async function main(): Promise<void> {
  await connectMongo(config.MONGODB_URI);
  logger.info("mongo connected");

  const queue = createAssessmentQueue(config.REDIS_URL);
  const app = createApp({ queue });
  const httpServer = createHttpServer(app);

  const io = createSocketServer(httpServer, config.CLIENT_ORIGIN);
  const subscriber = startPubSubBridge(io, config.REDIS_URL);

  httpServer.listen(config.PORT, () => {
    logger.info("api listening", {
      port: config.PORT,
      url: `http://localhost:${config.PORT}`,
    });
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info("shutting down", { signal });
    try {
      await io.close();
      subscriber.disconnect();
      await queue.close();
      httpServer.close();
    } catch (err) {
      logger.error("error during shutdown", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  logger.error("failed to start api", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
