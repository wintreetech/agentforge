import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./env";

/** Reject cross-site state-changing requests to route handlers (CSRF). Server Actions have Next's own origin check. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin) {
    // Non-browser clients (no Origin) must authenticate with an API key, not cookies.
    if (req.headers.get("cookie")?.includes("af_session")) throw new HttpError(403, "Missing Origin header");
    return;
  }
  if (!host || new URL(origin).host !== host) throw new HttpError(403, "Cross-origin request rejected");
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ───────────── Rate limiting (fixed window, in-memory; use Redis when REDIS_URL is set in production) ─────────────
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetMs: number } {
  const t = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < t) {
    buckets.set(key, { count: 1, reset: t + windowMs });
    if (buckets.size > 50_000) for (const [k, v] of buckets) if (v.reset < t) buckets.delete(k);
    return { ok: true, remaining: limit - 1, resetMs: windowMs };
  }
  b.count++;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), resetMs: b.reset - t };
}

export function clientIp(req: Request | Headers): string {
  const h = req instanceof Headers ? req : req.headers;
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

// ───────────── Encryption for stored third-party credentials (AES-256-GCM) ─────────────
const key = () => createHash("sha256").update(env.encryptionKey).digest();
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}
export function decrypt(token: string): string {
  const [v, iv, tag, data] = token.split(".");
  if (v !== "v1") throw new Error("Unknown ciphertext version");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

// ───────────── Upload validation ─────────────
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export type UploadKind = "pdf" | "text";

export function sniffUpload(name: string, bytes: Uint8Array): UploadKind {
  if (bytes.length > MAX_UPLOAD_BYTES) throw new HttpError(413, "File is larger than 5 MB.");
  if (bytes.length === 0) throw new HttpError(400, "File is empty.");
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
  const lower = name.toLowerCase();
  if (isPdf) return "pdf";
  if (/\.(txt|md|markdown|csv)$/.test(lower)) {
    // Reject binary content disguised as text.
    const sample = bytes.subarray(0, 4096);
    if (sample.some((b) => b === 0)) throw new HttpError(415, "File does not look like plain text.");
    return "text";
  }
  throw new HttpError(415, "Unsupported file type. Upload a PDF, TXT or Markdown file.");
}

/** Malware-scanning hook. Wire to ClamAV/a scanning API via MALWARE_SCAN_URL in production. */
export async function scanUpload(_name: string, _bytes: Uint8Array): Promise<{ clean: boolean; scanner: string }> {
  if (!process.env.MALWARE_SCAN_URL) return { clean: true, scanner: "not-configured" };
  const res = await fetch(process.env.MALWARE_SCAN_URL, { method: "POST", body: Buffer.from(_bytes), signal: AbortSignal.timeout(15_000) });
  const j = (await res.json().catch(() => ({}))) as { clean?: boolean };
  return { clean: j.clean === true, scanner: "remote" };
}
