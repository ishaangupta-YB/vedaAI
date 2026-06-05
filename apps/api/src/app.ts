import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import { API_ROUTES } from "@veda-ai/shared";
import { config } from "./config.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { createUploadsRouter } from "./routes/uploads.js";
import { createAssignmentsRouter } from "./routes/assignments.js";
import { createPapersRouter } from "./routes/papers.js";
import type { AssessmentQueue } from "./queue.js";

/** Dependencies injected into the app (kept minimal so it is easy to test). */
export interface AppDeps {
  queue: AssessmentQueue;
}

/**
 * Build the Express application: CORS for the browser client, JSON parsing,
 * request-id logging, the REST routes, then the 404 + central error handlers
 * (registered last so they catch everything). The HTTP server, Socket.IO, and
 * the Redis bridge are wired in `index.ts` — this stays pure for testing.
 */
export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
  app.use(requestId);
  app.use(express.json({ limit: "1mb" }));

  app.get(API_ROUTES.HEALTH, (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.use(createUploadsRouter());
  app.use(createAssignmentsRouter(deps.queue));
  app.use(createPapersRouter(deps.queue));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
