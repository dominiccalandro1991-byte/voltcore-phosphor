import type { JsonMap } from "./types";

export function asRecord(value: unknown): JsonMap {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonMap;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as JsonMap;
      }
    } catch {
      return { raw: value };
    }
  }
  return {};
}

export function iso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}
