/**
 * Minimal structured logger. Every line carries a context object so logs can be
 * grepped/parsed by request or job id. Kept dependency-free on purpose — this is
 * an assessment app, not a place for a logging framework.
 */
type LogMeta = Record<string, unknown>;

function emit(
  stream: "log" | "warn" | "error",
  level: string,
  message: string,
  meta?: LogMeta,
): void {
  const base = { level, time: new Date().toISOString(), message };
  const line = meta ? { ...base, ...meta } : base;
  console[stream](JSON.stringify(line));
}

export const logger = {
  info: (message: string, meta?: LogMeta): void => emit("log", "info", message, meta),
  warn: (message: string, meta?: LogMeta): void => emit("warn", "warn", message, meta),
  error: (message: string, meta?: LogMeta): void => emit("error", "error", message, meta),
};
