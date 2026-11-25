import "server-only";
import { sha256 } from "@agentforge/commerce";
import { mutate, now, read } from "./db";
import { clientIp, rateLimit } from "./security";

export const API_RATE = { limit: 60, windowMs: 60_000 };

export function apiError(status: number, code: string, message: string, headers: Record<string, string> = {}) {
  return Response.json({ error: { code, message } }, { status, headers });
}

/** Authenticate `Authorization: Bearer afk_live_…`. Returns the user id or an error response. */
export async function authenticateApiKey(req: Request): Promise<{ userId: string; keyId: string; headers: Record<string, string> } | Response> {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(afk_live_[A-Za-z0-9_-]{20,})$/.exec(h);
  if (!m) return apiError(401, "unauthorized", "Missing or malformed API key. Use 'Authorization: Bearer afk_live_…'.");
  const hash = sha256(m[1]);
  const key = await read((db) => db.apiKeys.find((k) => k.hash === hash && !k.revokedAt));
  if (!key) return apiError(401, "unauthorized", "Invalid or revoked API key.");
  const rl = rateLimit(`api:${key.id}`, API_RATE.limit, API_RATE.windowMs);
  const headers = { "X-RateLimit-Limit": String(API_RATE.limit), "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-Reset": String(Math.ceil(rl.resetMs / 1000)) };
  if (!rl.ok) return apiError(429, "rate_limited", "Rate limit exceeded.", { ...headers, "Retry-After": String(Math.ceil(rl.resetMs / 1000)) });
  await mutate((db) => {
    const k = db.apiKeys.find((x) => x.id === key.id);
    if (k) k.lastUsedAt = now();
  });
  return { userId: key.userId, keyId: key.id, headers };
}

export function publicRateLimit(req: Request, bucket: string, limit = 30) {
  const rl = rateLimit(`pub:${bucket}:${clientIp(req)}`, limit, 60_000);
  return rl.ok ? null : apiError(429, "rate_limited", "Rate limit exceeded.", { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) });
}
