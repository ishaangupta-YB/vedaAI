import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";

/**
 * Assign each request a stable id (honoring an inbound `x-request-id` if the
 * caller/proxy set one), echo it back on the response, and log one line on
 * completion with method, path, status, and duration. Every downstream log can
 * reference `req.id` so a request can be traced end to end.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.header("x-request-id");
  req.id = inbound && inbound.length > 0 ? inbound : randomUUID();
  res.setHeader("x-request-id", req.id);

  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info("request", {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });

  next();
}
