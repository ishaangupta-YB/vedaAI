import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Load the monorepo-root `.env` so a single file configures api + worker for
// local dev. Real environment variables (shell / CI) always take precedence —
// dotenv never overrides an already-set value. Resolves to the repo root from
// both `src/` (tsx dev) and `dist/` (built) since both are two levels deep.
loadDotenv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../..", ".env"),
});

/**
 * Typed config for the worker. This is the ONLY place `process.env` is read in
 * this app — import `config` everywhere else. Defaults keep the worker bootable
 * for local dev without a populated `.env`.
 */
const envSchema = z.object({
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  MONGODB_URI: z.string().min(1).default("mongodb://localhost:27017/veda-ai"),
  /** AWS region hosting the Bedrock model / inference profile. */
  AWS_REGION: z.string().min(1).default("us-east-1"),
  /** Bedrock API key (bearer token); consumed by the AWS SDK, never logged. */
  AWS_BEARER_TOKEN_BEDROCK: z.string().optional(),
  /** Bedrock model id / cross-region inference profile (CLAUDE.md "Tech + versions"). */
  BEDROCK_MODEL_ID: z
    .string()
    .min(1)
    .default("us.anthropic.claude-sonnet-4-5-20250929-v1:0"),
  /** Max output tokens for a generation call. */
  BEDROCK_MAX_TOKENS: z.coerce.number().int().positive().default(8192),
  /** BullMQ worker concurrency (CLAUDE.md: 5). */
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  /** TTL (seconds) for the `paper:<hash>` generation cache (CLAUDE.md: 24h). */
  PAPER_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24),
});

export type WorkerConfig = z.infer<typeof envSchema>;

let cached: WorkerConfig | undefined;

export function loadConfig(): WorkerConfig {
  if (cached) {
    return cached;
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid worker environment: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const config: WorkerConfig = loadConfig();
