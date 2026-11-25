import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const hmac = (secret: string, s: string) => createHmac("sha256", secret).update(s).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O, 1/I

function randomGroup(n: number): string {
  const bytes = randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

/**
 * Licence keys look like AF-XXXXX-XXXXX-XXXXX-CCCC where CCCC is an HMAC
 * checksum, so obviously forged keys are rejected before any database lookup.
 */
export function generateLicenseKey(secret: string): string {
  const body = `${randomGroup(5)}-${randomGroup(5)}-${randomGroup(5)}`;
  return `AF-${body}-${checksum(secret, body)}`;
}

function checksum(secret: string, body: string): string {
  const h = hmac(secret, body);
  let s = "";
  for (let i = 0; i < 4; i++) s += ALPHABET[parseInt(h.slice(i * 2, i * 2 + 2), 16) % ALPHABET.length];
  return s;
}

export function licenseKeyWellFormed(secret: string, key: string): boolean {
  const m = /^AF-([A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5})-([A-Z2-9]{4})$/.exec(key.trim().toUpperCase());
  return !!m && safeEqual(checksum(secret, m[1]), m[2]);
}

/** Signed, expiring download tokens: base64url(payload).sig */
export function signPayload(secret: string, payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(secret, body)}`;
}

export function verifyPayload<T extends { exp: number }>(secret: string, token: string, now = Date.now()): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(hmac(secret, body), sig)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T;
    if (typeof data.exp !== "number" || data.exp < now) return null;
    return data;
  } catch {
    return null;
  }
}
