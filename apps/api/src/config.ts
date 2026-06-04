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
 * Typed config for the API server. This is the ONLY place `process.env` is read
 * in this app — import `config` everywhere else. Defaults keep the server
 * bootable for local dev without a populated `.env`. The API never calls the
 * LLM (that is the worker's job), so it holds no Bedrock credentials.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default("mongodb://localhost:27017/veda-ai"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  CLIENT_ORIGIN: z.string().min(1).default("http://localhost:3000"),
});

export type ApiConfig = z.infer<typeof envSchema>;

let cached: ApiConfig | undefined;

export function loadConfig(): ApiConfig {
  if (cached) {
    return cached;
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid API environment: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const config: ApiConfig = loadConfig();
