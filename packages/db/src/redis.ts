import { Redis, type RedisOptions } from "ioredis";

/**
 * Create a general-purpose ioredis client (caching, pub/sub publisher, the
 * Socket.IO bridge subscriber, etc.). The caller supplies the URL from its
 * typed config module.
 */
export function createRedis(url: string, opts?: RedisOptions): Redis {
  return new Redis(url, opts ?? {});
}

/**
 * Create an ioredis client configured for BullMQ (Queue / Worker / QueueEvents).
 *
 * BullMQ REQUIRES `maxRetriesPerRequest: null` on its connection. BullMQ relies
 * on long-lived blocking commands (e.g. BZPOPMIN / BRPOPLPUSH) that can stay
 * pending far longer than ioredis's default per-request retry limit. With the
 * default limit, ioredis aborts those commands with "Reached the max retries
 * per request limit", which breaks the worker. Setting it to `null` disables
 * that limit, so we force it here and prevent callers from overriding it.
 */
export function createBullRedis(url: string, opts?: RedisOptions): Redis {
  return new Redis(url, {
    ...opts,
    maxRetriesPerRequest: null,
  });
}

export type { RedisOptions };
export { Redis };
