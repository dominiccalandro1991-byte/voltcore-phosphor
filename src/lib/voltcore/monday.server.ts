import { timingSafeEqual } from "node:crypto";
import type { MondayWebhookPayload } from "./types";

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/** Optional Monday JWT/HMAC gate. Fail-open when secret is unset (preview). */
export async function verifyMondaySignature(request: Request, rawBody: string): Promise<boolean> {
  const secret = env("MONDAY_SIGNING_SECRET");
  if (!secret) return true;
  const header = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${parts[0]}.${parts[1]}`));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const a = Buffer.from(computed);
    const b = Buffer.from(parts[2]);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parseMondayBody(raw: unknown): MondayWebhookPayload {
  if (!raw || typeof raw !== "object") return {};
  return raw as MondayWebhookPayload;
}
