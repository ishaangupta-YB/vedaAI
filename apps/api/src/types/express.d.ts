/**
 * Augment Express's request type with the per-request id assigned by the
 * request-id middleware. Express's `Request` extends the global `Express.Request`
 * interface, so augmenting that namespace adds `req.id` everywhere. Kept as a
 * `.d.ts` so it is picked up project-wide by `tsc` without a runtime import.
 */
declare global {
  namespace Express {
    interface Request {
      /** Unique id for this request (from `x-request-id` or generated). */
      id: string;
    }
  }
}

export {};
