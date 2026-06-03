import { createHash } from "node:crypto";
import type { CreateAssignmentInput } from "./schemas.js";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Recursively produce a value with object keys sorted, so that two inputs that
 * are deeply equal but differ only in key insertion order serialize
 * identically. Array order is preserved (it is semantically meaningful).
 * `undefined` entries are dropped so optional fields don't affect the hash.
 */
function canonicalize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === "object") {
    const result: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(value).sort()) {
      const entry = value[key];
      if (entry === undefined) {
        continue;
      }
      result[key] = canonicalize(entry);
    }
    return result;
  }
  return value;
}

/**
 * Deterministic SHA-256 hash of a `CreateAssignmentInput`, computed over a
 * canonical (sorted-key) serialization. Pure: equal inputs always produce the
 * same string regardless of key order. Used as the paper cache key
 * (`paper:<hash>`) so identical assignment configs reuse a generated paper.
 */
export function stableInputHash(input: CreateAssignmentInput): string {
  const canonical = canonicalize(input as unknown as JsonValue);
  const serialized = JSON.stringify(canonical);
  return createHash("sha256").update(serialized).digest("hex");
}
