import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Coupon } from "@agentforge/commerce";
import type { ProductStatus, LicenseType } from "@agentforge/catalog";
import { env } from "./env";
import { deliverMail } from "./mailer";

/**
 * Development data store.
 *
 * A single JSON document persisted atomically to DATA_DIR. It implements the
 * same entities as supabase/migrations/0001_init.sql so the repository layer
 * can be swapped for Postgres/Supabase without touching pages. All access goes
 * through `read`/`mutate`, which serialise writes in-process. This store is
 * for local development and tests; it is NOT suitable for multi-instance
 * production deployments (see PROGRESS.md → blockers).
 */

export type Role = "customer" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  role: Role;
  emailVerifiedAt: string | null;
  createdAt: string;
  orgId: string;
  marketingConsent: boolean;
  deletedAt?: string | null;
}
export interface Org { id: string; name: string; ownerId: string; createdAt: string }
export interface OrgMember { orgId: string; userId: string; role: "owner" | "admin" | "member" }
export interface Session { tokenHash: string; userId: string; createdAt: string; expiresAt: string; userAgent: string }
export interface EmailToken { tokenHash: string; userId: string; kind: "verify" | "reset"; expiresAt: string; usedAt: string | null }
export interface OutboxMail { id: string; to: string; subject: string; body: string; createdAt: string }
export interface CartItem { ownerKey: string; slug: string; quantity: number; license: LicenseType; addedAt: string }
export interface WishItem { userId: string; slug: string; addedAt: string }
export interface OrderItem { productId: string; slug: string; title: string; unitCents: number; quantity: number; license: LicenseType }
export type OrderStatus = "pending" | "paid" | "refunded" | "partially_refunded" | "expired" | "failed";
export interface Order {
  id: string;
  number: string;
  userId: string;
  email: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  taxRate: number;
  taxNote: string;
  totalCents: number;
  currency: "EUR";
  country: string;
  vatId: string | null;
  couponCode: string | null;
  provider: string;
  sessionId: string | null;
  paymentRef: string | null;
  digitalConsent: boolean;
  createdAt: string;
  paidAt: string | null;
  refundedCents: number;
}
export interface PaymentEventRecord { id: string; type: string; orderId: string; processedAt: string }
export interface Entitlement { id: string; userId: string; orderId: string; slug: string; license: LicenseType; status: "active" | "revoked"; createdAt: string }
export interface LicenseKeyRecord { key: string; entitlementId: string; userId: string; slug: string; license: LicenseType; status: "active" | "revoked"; createdAt: string; activations: number }
export interface DownloadRecord { id: string; userId: string; slug: string; version: string; at: string }
export interface CreditEntry { id: string; userId: string; delta: number; reason: string; at: string; executionId?: string }
export interface ExecutionRecord {
  id: string;
  userId: string | null;
  anonKey: string | null;
  slug: string;
  provider: string;
  model: string;
  status: "succeeded" | "failed" | "cancelled";
  mode: "demo" | "owned" | "api";
  inputPreview: string;
  output: string | null;
  error: string | null;
  steps: { id: string; label: string; agent?: string; status: string; ms?: number; tokens?: number; detail?: string }[];
  inputTokens: number;
  outputTokens: number;
  costEur: number;
  credits: number;
  simulated: boolean;
  ms: number;
  createdAt: string;
}
export interface KnowledgeBase { id: string; userId: string; name: string; createdAt: string }
export interface KbDocument { id: string; kbId: string; userId: string; name: string; pages: string[]; bytes: number; createdAt: string }
export interface GraphNode { id: string; type: string; position: { x: number; y: number }; data: Record<string, any> }
export interface GraphEdge { id: string; source: string; target: string; sourceHandle?: string | null; label?: string }
export interface AgentConfig {
  id: string;
  userId: string;
  slug: string;
  name: string;
  instructions: string;
  model: string;
  tools: string[];
  kbId: string | null;
  memory: boolean;
  memoryNotes: string[];
  schedule: "off" | "hourly" | "daily" | "weekly";
  scheduleInput: string;
  lastScheduledAt: string | null;
  webhookToken: string;
  allowedHosts: string[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  updatedAt: string;
}
export interface StudioRun {
  id: string;
  configId: string;
  userId: string;
  trigger: "manual" | "webhook" | "schedule";
  status: "running" | "paused" | "awaiting_approval" | "completed" | "failed" | "cancelled";
  input: string;
  vars: Record<string, string>;
  nodeStates: Record<string, { status: "pending" | "running" | "done" | "failed" | "skipped" | "awaiting_approval"; output?: string; error?: string; ms?: number; tokens?: number }>;
  queue: string[];
  logs: { at: string; level: "info" | "warn" | "error"; message: string; nodeId?: string }[];
  inputTokens: number;
  outputTokens: number;
  costEur: number;
  steps: number;
  createdAt: string;
  updatedAt: string;
}
export interface ApiKeyRecord { id: string; userId: string; name: string; prefix: string; hash: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }
export interface ProviderSecret { userId: string; provider: "openai" | "anthropic" | "gemini"; ciphertext: string; last4: string; createdAt: string }
export interface CouponRecord extends Coupon { id: string; createdAt: string; note?: string }
export interface RefundRecord { id: string; orderId: string; userId: string; reason: string; amountCents: number; status: "requested" | "approved" | "rejected" | "succeeded"; providerRef: string | null; createdAt: string; decidedAt: string | null; decidedBy: string | null }
export interface Ticket { id: string; userId: string; subject: string; status: "open" | "answered" | "closed"; messages: { from: "customer" | "staff"; authorId: string; body: string; at: string }[]; createdAt: string }
export interface Review { id: string; userId: string; slug: string; rating: number; title: string; body: string; createdAt: string; authorName: string }
export interface NewsletterSub { email: string; consentAt: string; source: string }
export interface AuditEntry { id: string; actorId: string | null; action: string; target: string; meta?: Record<string, unknown>; at: string }
export interface ProductOverride { slug: string; status?: ProductStatus; priceCents?: number; shortDescription?: string; updatedAt: string; updatedBy: string }
export interface Notification { id: string; userId: string; title: string; body: string; href?: string; readAt: string | null; createdAt: string }
export interface ContactMessage { id: string; name: string; email: string; topic: string; message: string; createdAt: string }
export interface SellerApplication { id: string; userId: string | null; name: string; email: string; company: string; products: string; status: "submitted" | "approved" | "rejected"; createdAt: string }
export interface Referral { id: string; code: string; ownerId: string; clicks: number; conversions: number; createdAt: string }

export interface DB {
  version: number;
  users: User[];
  orgs: Org[];
  orgMembers: OrgMember[];
  sessions: Session[];
  emailTokens: EmailToken[];
  outbox: OutboxMail[];
  cart: CartItem[];
  wishlist: WishItem[];
  orders: Order[];
  paymentEvents: PaymentEventRecord[];
  entitlements: Entitlement[];
  licenseKeys: LicenseKeyRecord[];
  downloads: DownloadRecord[];
  credits: CreditEntry[];
  executions: ExecutionRecord[];
  knowledgeBases: KnowledgeBase[];
  kbDocuments: KbDocument[];
  agentConfigs: AgentConfig[];
  studioRuns: StudioRun[];
  apiKeys: ApiKeyRecord[];
  providerSecrets: ProviderSecret[];
  coupons: CouponRecord[];
  refunds: RefundRecord[];
  tickets: Ticket[];
  reviews: Review[];
  newsletter: NewsletterSub[];
  audit: AuditEntry[];
  productOverrides: ProductOverride[];
  notifications: Notification[];
  contactMessages: ContactMessage[];
  sellerApplications: SellerApplication[];
  referrals: Referral[];
  settings: { demoRunsPerDay: number; creditsPerHostedPurchase: number; disabledProviders: string[]; maintenanceBanner: string };
}

const empty = (): DB => ({
  version: 1,
  users: [], orgs: [], orgMembers: [], sessions: [], emailTokens: [], outbox: [], cart: [], wishlist: [], orders: [],
  paymentEvents: [], entitlements: [], licenseKeys: [], downloads: [], credits: [], executions: [], knowledgeBases: [],
  kbDocuments: [], agentConfigs: [], studioRuns: [], apiKeys: [], providerSecrets: [], refunds: [], tickets: [], reviews: [],
  newsletter: [], audit: [], productOverrides: [], notifications: [], contactMessages: [], sellerApplications: [], referrals: [],
  // Development seed coupon — clearly a test code, editable in Admin → Coupons.
  coupons: [{ id: "cpn_dev_launch", code: "DEVTEST10", kind: "percent", value: 10, active: !env.isProd, redemptions: 0, maxRedemptions: null, expiresAt: null, createdAt: new Date().toISOString(), note: "Development seed coupon (inactive in production)" }],
  settings: { demoRunsPerDay: env.demoRunsPerDay, creditsPerHostedPurchase: env.creditsPerHostedPurchase, disabledProviders: [], maintenanceBanner: "" },
});

const g = globalThis as unknown as { __afdb?: DB; __afdbQueue?: Promise<unknown> };

function file() {
  const dir = path.isAbsolute(env.dataDir) ? env.dataDir : path.join(/* turbopackIgnore: true */ process.cwd(), env.dataDir);
  return { dir, file: path.join(dir, "db.json") };
}

async function load(): Promise<DB> {
  if (g.__afdb) return g.__afdb;
  const { file: f } = file();
  let data = empty();
  if (existsSync(f)) {
    try {
      data = { ...empty(), ...JSON.parse(await readFile(f, "utf8")) };
    } catch (e) {
      console.error("[db] could not parse data file; starting empty", e);
    }
  }
  g.__afdb = data;
  return data;
}

async function persist(db: DB) {
  const { dir, file: f } = file();
  await mkdir(dir, { recursive: true });
  const tmp = `${f}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(db));
  await rename(tmp, f);
}

/** Read-only snapshot access. Do not mutate the returned object. */
export async function read<T>(fn: (db: Readonly<DB>) => T): Promise<T> {
  await (g.__afdbQueue ?? Promise.resolve());
  return fn(await load());
}

/** Serialised mutation followed by an atomic write. */
export async function mutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const prev = g.__afdbQueue ?? Promise.resolve();
  let result!: T;
  let newMail: OutboxMail[] = [];
  const next = prev
    .catch(() => {})
    .then(async () => {
      const db = await load();
      const outboxBefore = db.outbox.length;
      result = await fn(db);
      await persist(db);
      newMail = db.outbox.slice(outboxBefore);
    });
  g.__afdbQueue = next;
  await next;
  if (newMail.length) void deliverMail(newMail);
  return result;
}

export const id = (prefix: string) => `${prefix}_${randomBytes(9).toString("base64url")}`;
export const now = () => new Date().toISOString();

export async function audit(actorId: string | null, action: string, target: string, meta?: Record<string, unknown>) {
  await mutate((db) => {
    db.audit.push({ id: id("aud"), actorId, action, target, meta, at: now() });
    if (db.audit.length > 20_000) db.audit.splice(0, db.audit.length - 20_000);
  });
}
