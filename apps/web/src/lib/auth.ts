import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sha256 } from "@agentforge/commerce";
import { env } from "./env";
import { audit, id, mutate, now, read, type User } from "./db";

/**
 * Development authentication provider (email + password, server sessions).
 * Passwords: scrypt (N=2^15, r=8, p=1) with per-user salt. Sessions: random
 * 256-bit token in an HttpOnly, SameSite=Lax cookie; only its SHA-256 is stored.
 * In production, swap for Supabase Auth (see ARCHITECTURE.md) — the rest of the
 * app only uses getUser()/requireUser()/requireAdmin().
 */

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SESSION_COOKIE = "af_session";
const ANON_COOKIE = "af_anon";
const SESSION_DAYS = 30;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [alg, n, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt") return false;
  const key = await scrypt(pw, Buffer.from(saltB64, "base64"), 64, { N: Number(n), r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const expected = Buffer.from(keyB64, "base64");
  return expected.length === key.length && timingSafeEqual(expected, key);
}

export function passwordProblems(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 200) return "Password is too long.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9\W]/.test(pw)) return "Use a mix of letters and numbers or symbols.";
  return null;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? "";
  await mutate((db) => {
    db.sessions = db.sessions.filter((s) => Date.parse(s.expiresAt) > Date.now());
    db.sessions.push({ tokenHash: sha256(token), userId, createdAt: now(), expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString(), userAgent: ua });
  });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/", maxAge: SESSION_DAYS * 86400 });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await mutate((db) => void (db.sessions = db.sessions.filter((s) => s.tokenHash !== sha256(token))));
  jar.delete(SESSION_COOKIE);
}

export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const h = sha256(token);
  return read((db) => {
    const s = db.sessions.find((x) => x.tokenHash === h && Date.parse(x.expiresAt) > Date.now());
    if (!s) return null;
    const u = db.users.find((x) => x.id === s.userId && !x.deletedAt);
    return u ? { ...u } : null;
  });
});

export async function requireUser(next = "/dashboard"): Promise<User> {
  const u = await getUser();
  if (!u) redirect(`/signin?next=${encodeURIComponent(next)}`);
  return u;
}

/** Server-side admin gate. Every admin page and admin action calls this. */
export async function requireAdmin(): Promise<User> {
  const u = await requireUser("/admin");
  if (u.role !== "admin") redirect("/dashboard?error=forbidden");
  return u;
}

/** Stable anonymous id for carts and demo quotas before sign-in. */
export async function getAnonKey(create = false): Promise<string | null> {
  const jar = await cookies();
  let v = jar.get(ANON_COOKIE)?.value ?? null;
  if (!v && create) {
    v = randomBytes(16).toString("base64url");
    jar.set(ANON_COOKIE, v, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/", maxAge: 60 * 86400 });
  }
  return v;
}

export async function registerUser(input: { email: string; name: string; password: string; marketingConsent: boolean }) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  return mutate((db) => {
    if (db.users.some((u) => u.email === email && !u.deletedAt)) return { ok: false as const, error: "An account with this email already exists." };
    const userId = id("usr");
    const orgId = id("org");
    const role = env.adminEmails.includes(email) ? "admin" : "customer";
    db.users.push({ id: userId, email, name: input.name.trim(), passwordHash, role, emailVerifiedAt: process.env.AUTO_VERIFY_EMAIL === "true" ? now() : null, createdAt: now(), orgId, marketingConsent: input.marketingConsent });
    db.orgs.push({ id: orgId, name: `${input.name.trim().split(" ")[0]}'s workspace`, ownerId: userId, createdAt: now() });
    db.orgMembers.push({ orgId, userId, role: "owner" });
    return { ok: true as const, userId };
  });
}

/** Issue an email token. In development the email goes to the local outbox (/dev/outbox). */
export async function sendEmailToken(userId: string, kind: "verify" | "reset") {
  const token = randomBytes(32).toString("base64url");
  const user = await read((db) => db.users.find((u) => u.id === userId));
  if (!user) return;
  const url = `${env.appUrl}/${kind === "verify" ? "verify" : "reset-password"}?token=${token}`;
  await mutate((db) => {
    db.emailTokens.push({ tokenHash: sha256(token), userId, kind, expiresAt: new Date(Date.now() + (kind === "verify" ? 48 : 1) * 3600e3).toISOString(), usedAt: null });
    db.outbox.push({
      id: id("mail"),
      to: user.email,
      subject: kind === "verify" ? "Verify your AgentForge AI email" : "Reset your AgentForge AI password",
      body: kind === "verify" ? `Confirm your email address:\n${url}\n\nThis link expires in 48 hours.` : `Reset your password:\n${url}\n\nThis link expires in 1 hour. If you did not request it, ignore this email.`,
      createdAt: now(),
    });
  });
}

export async function consumeEmailToken(token: string, kind: "verify" | "reset"): Promise<string | null> {
  const h = sha256(token);
  return mutate((db) => {
    const t = db.emailTokens.find((x) => x.tokenHash === h && x.kind === kind && !x.usedAt && Date.parse(x.expiresAt) > Date.now());
    if (!t) return null;
    t.usedAt = now();
    return t.userId;
  });
}

export async function signInWithPassword(email: string, password: string) {
  const u = await read((db) => db.users.find((x) => x.email === email.trim().toLowerCase() && !x.deletedAt));
  // Always run a hash comparison to avoid user enumeration via timing.
  const ok = await verifyPassword(password, u?.passwordHash ?? "scrypt$32768$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==");
  if (!u || !ok) {
    await audit(u?.id ?? null, "auth.signin_failed", email.slice(0, 200));
    return null;
  }
  await createSession(u.id);
  await audit(u.id, "auth.signin", u.id);
  return u;
}
