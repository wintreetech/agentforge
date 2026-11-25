import "server-only";
import { createHash } from "node:crypto";

/**
 * Centralised, validated environment access. Secrets never leave the server.
 * In development, missing secrets fall back to clearly-named, per-install
 * derived values so the sandbox works out of the box; in production they are
 * required and the app refuses to start a payment or sign a token without them.
 */

const isProd = process.env.NODE_ENV === "production";

function secret(name: string): string {
  const v = process.env[name];
  if (v && v.length >= 16) return v;
  if (isProd) throw new Error(`${name} must be set (min 16 chars) in production`);
  // Deterministic dev-only fallback so restarts keep sessions valid locally.
  return createHash("sha256").update(`agentforge-dev-only:${name}:${process.cwd()}`).digest("hex");
}

export const env = {
  isProd,
  appUrl: process.env.APP_URL ?? "http://localhost:3100",
  get sessionSecret() {
    return secret("SESSION_SECRET");
  },
  get licenseSecret() {
    return secret("LICENSE_SIGNING_SECRET");
  },
  get downloadSecret() {
    return secret("DOWNLOAD_SIGNING_SECRET");
  },
  get encryptionKey() {
    return secret("APP_ENCRYPTION_KEY");
  },
  get sandboxWebhookSecret() {
    return secret("SANDBOX_WEBHOOK_SECRET");
  },
  paymentProvider: (process.env.PAYMENT_PROVIDER ?? "sandbox") as "sandbox" | "stripe",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  providerKeys: {
    openai: process.env.OPENAI_API_KEY || undefined,
    anthropic: process.env.ANTHROPIC_API_KEY || undefined,
    gemini: process.env.GEMINI_API_KEY || undefined,
  },
  aiServiceUrl: process.env.AI_SERVICE_URL || "",
  redisUrl: process.env.REDIS_URL || "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  dataDir: process.env.DATA_DIR || ".data",
  adminEmails: (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  demoRunsPerDay: Number(process.env.DEMO_RUNS_PER_DAY ?? 5),
  demoAllowProviders: process.env.DEMO_ALLOW_PROVIDERS === "true",
  creditsPerHostedPurchase: Number(process.env.CREDITS_PER_HOSTED_PURCHASE ?? 300),
  sellersEnabled: process.env.FEATURE_SELLERS === "true",
};
