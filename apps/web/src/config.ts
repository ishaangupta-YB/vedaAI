import { z } from "zod";

/**
 * Typed config for the web app. This is the ONLY place `process.env` is read.
 * Only `NEXT_PUBLIC_*` vars are exposed to the browser, and they must be
 * referenced statically (as below) so Next can inline them at build time.
 */
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_WS_URL: z.string().url().default("http://localhost:4000"),
  /**
   * When "true", the app runs against an in-memory mock of the REST + realtime
   * contract instead of a live backend. Purely a frontend dev/demo aid — it
   * implements no real backend, worker, or LLM logic.
   */
  NEXT_PUBLIC_USE_MOCK: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type WebConfig = z.infer<typeof envSchema>;

export const config: WebConfig = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK,
});
