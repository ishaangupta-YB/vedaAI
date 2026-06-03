import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { BadRequestError, NotFoundError, ValidationError } from "../lib/errors.js";

/** Fallback for unmatched routes: emit the contract's 404 shape. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "NotFound" });
}

/** Narrow an unknown error to a multer file-upload error by its tagged name. */
function isMulterError(err: unknown): err is Error & { code?: string } {
  return err instanceof Error && err.name === "MulterError";
}

/** Narrow the SyntaxError thrown by `express.json()` on a malformed body. */
function isBodyParseError(err: unknown): err is SyntaxError {
  return err instanceof SyntaxError && "body" in err;
}

/**
 * Central error handler. Translates typed/known errors into the exact wire
 * shapes from CLAUDE.md and never leaks internals on a 500. Must keep all four
 * parameters so Express recognizes it as an error handler.
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (res.headersSent) {
    return;
  }

  if (err instanceof ValidationError) {
    res.status(400).json({ error: "ValidationError", issues: err.issues });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: "NotFound" });
    return;
  }

  if (err instanceof BadRequestError) {
    res.status(400).json({ error: "BadRequest", message: err.message });
    return;
  }

  if (isMulterError(err)) {
    res.status(400).json({ error: "BadRequest", message: err.message });
    return;
  }

  if (isBodyParseError(err)) {
    res.status(400).json({ error: "BadRequest", message: "Malformed JSON body" });
    return;
  }

  logger.error("unhandled error", {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({ error: "InternalServerError" });
};
