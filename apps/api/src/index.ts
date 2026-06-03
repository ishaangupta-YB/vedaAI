import express, { type Express, type Request, type Response } from "express";
import { API_ROUTES } from "@veda-ai/shared";
import { config } from "./config.js";

/**
 * Build the Express app. Only the health endpoint exists in this phase; routes,
 * Socket.IO, and the worker bridge arrive later.
 */
export function createServer(): Express {
  const app = express();
  app.use(express.json());

  app.get(API_ROUTES.HEALTH, (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  return app;
}

const app = createServer();
app.listen(config.PORT, () => {
  console.log(`[api] listening on http://localhost:${config.PORT}`);
});
