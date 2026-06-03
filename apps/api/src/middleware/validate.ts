import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ValidationError } from "../lib/errors.js";

/**
 * Build middleware that validates `req.body` against a Zod schema. On success
 * the parsed (and thus type-narrowed/normalized) value replaces `req.body`; on
 * failure a `ValidationError` carrying the Zod issues is forwarded to the error
 * handler, which renders the contract's `400 { error, issues }` shape.
 *
 * This is the SAME `CreateAssignmentInput` schema the web app uses client-side —
 * one schema validated on both ends.
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError(result.error.issues));
      return;
    }
    req.body = result.data;
    next();
  };
}
