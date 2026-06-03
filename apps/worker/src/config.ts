import { z } from "zod";

/**
 * Typed config for the worker. This is the ONLY place `process.env` is read in
 * this app — import `config` everywhere else. Defaults keep the worker bootable
 * for local dev without a populated `.env`.
 */
const envSchema = z.object({
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  MONGODB_URI: z.string().min(1).default("mongodb://localhost:27017/veda-ai"),
  ANTHROPIC_API_KEY: z.string().optional(),
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
