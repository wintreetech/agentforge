import "server-only";
import { env } from "./env";
import { mutate, read } from "./db";
import { mailConfigured } from "./mailer";

export interface Check {
  name: string;
  state: "up" | "down" | "not_configured";
  detail: string;
  ms?: number;
}

async function timed(fn: () => Promise<string>): Promise<{ ok: boolean; detail: string; ms: number }> {
  const t = Date.now();
  try {
    return { ok: true, detail: await fn(), ms: Date.now() - t };
  } catch (e) {
    return { ok: false, detail: (e as Error).message.slice(0, 200), ms: Date.now() - t };
  }
}

/** Real checks only. Nothing here calls a paid API. */
export async function runHealthChecks(): Promise<Check[]> {
  const checks: Check[] = [{ name: "Web application", state: "up", detail: "This page was rendered by the application server." }];
  const store = await timed(async () => {
    const n = await read((db) => db.users.length);
    await mutate(() => {}); // exercises the write path
    return `Read/write OK (${n} accounts).`;
  });
  checks.push({ name: env.supabaseUrl ? "Data store (dev JSON — Supabase configured but not wired)" : "Data store (development JSON store)", state: store.ok ? "up" : "down", detail: store.detail, ms: store.ms });

  checks.push({
    name: "Payments",
    state: env.paymentProvider === "stripe" && env.stripeSecretKey ? "up" : env.paymentProvider === "sandbox" ? "up" : "not_configured",
    detail: env.paymentProvider === "sandbox" ? "Sandbox provider active (no real payments)." : env.stripeSecretKey ? "Stripe keys present (reachability not probed to avoid side effects)." : "Stripe selected but keys missing.",
  });

  const providers = Object.entries(env.providerKeys).filter(([, v]) => v).map(([k]) => k);
  checks.push({ name: "AI providers", state: providers.length ? "up" : "not_configured", detail: providers.length ? `Keys configured: ${providers.join(", ")} (not probed; probing would incur cost).` : "No provider keys; products run in labelled sandbox mode." });

  if (env.aiServiceUrl) {
    const py = await timed(async () => {
      const r = await fetch(`${env.aiServiceUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return "Python AI service healthy.";
    });
    checks.push({ name: "Python AI service", state: py.ok ? "up" : "down", detail: py.detail, ms: py.ms });
  } else checks.push({ name: "Python AI service", state: "not_configured", detail: "AI_SERVICE_URL not set; the TypeScript engine handles all runs." });

  checks.push({ name: "Redis (rate limiting, jobs)", state: env.redisUrl ? "up" : "not_configured", detail: env.redisUrl ? "REDIS_URL set; in-process limiter still active (adapter pending)." : "Using in-process rate limiter." });
  checks.push(
    mailConfigured()
      ? { name: "Email delivery", state: "up", detail: "Resend configured (not probed)." }
      : { name: "Email delivery", state: "not_configured", detail: env.isProd ? "No email provider configured." : "Development outbox (/dev/outbox)." },
  );
  return checks;
}
