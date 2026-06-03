import type { ZodIssue } from "zod";

/**
 * Typed errors that the central error handler maps to the wire shapes defined
 * in CLAUDE.md. Throw these from routes/middleware; never `res.json` an error
 * shape by hand so the contract lives in exactly one place.
 */

/** 400 — request body/params failed Zod validation. Carries the Zod issues. */
export class ValidationError extends Error {
  readonly issues: ZodIssue[];

  constructor(issues: ZodIssue[]) {
    super("ValidationError");
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/** 404 — a requested resource does not exist. */
export class NotFoundError extends Error {
  constructor(message = "NotFound") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** 400 — a well-formed request we still cannot accept (e.g. wrong file type). */
export class BadRequestError extends Error {
  constructor(message = "BadRequest") {
    super(message);
    this.name = "BadRequestError";
  }
}
