import "server-only";
import {
  SandboxPaymentProvider,
  StripePaymentProvider,
  computeTotals,
  generateLicenseKey,
  validateCoupon,
  type LineInput,
  type PaymentEvent,
  type PaymentProvider,
} from "@agentforge/commerce";
import type { LicenseType, Product } from "@agentforge/catalog";
import { env } from "./env";
import { audit, id, mutate, now, read, type CartItem, type Order } from "./db";
import { getProducts, isPurchasable } from "./catalog";

// ───────────────────────── Payment provider ─────────────────────────

export function paymentProvider(): PaymentProvider {
  if (env.paymentProvider === "stripe") {
    if (!env.stripeSecretKey || !env.stripeWebhookSecret) throw new Error("Stripe selected but STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are missing.");
    return new StripePaymentProvider(env.stripeSecretKey, env.stripeWebhookSecret);
  }
  if (env.isProd && process.env.ALLOW_SANDBOX_PAYMENTS !== "true") throw new Error("The sandbox payment provider is disabled in production.");
  return new SandboxPaymentProvider(env.sandboxWebhookSecret, env.appUrl);
}

export const sandboxProvider = () => new SandboxPaymentProvider(env.sandboxWebhookSecret, env.appUrl);

// ───────────────────────── Licences ─────────────────────────

const UPGRADE: Partial<Record<LicenseType, { to: LicenseType; multiplier: number }>> = {
  personal: { to: "commercial", multiplier: 2 },
  commercial: { to: "agency", multiplier: 3 },
  developer: { to: "agency", multiplier: 2 },
};

export function licenseOptions(p: Product): { license: LicenseType; priceCents: number; note: string }[] {
  const opts = [{ license: p.license, priceCents: p.priceCents, note: "Included licence" }];
  const up = UPGRADE[p.license];
  if (up) opts.push({ license: up.to, priceCents: p.priceCents * up.multiplier, note: `Upgrade: ${up.to === "agency" ? "use for client work" : "use in a business"}` });
  return opts;
}

export function priceFor(p: Product, license: LicenseType): number | null {
  return licenseOptions(p).find((o) => o.license === license)?.priceCents ?? null;
}

// ───────────────────────── Cart ─────────────────────────

export interface CartLine extends CartItem {
  product: Product;
  unitCents: number;
}

export async function getCart(ownerKey: string | null): Promise<CartLine[]> {
  if (!ownerKey) return [];
  const [items, products] = await Promise.all([read((db) => db.cart.filter((c) => c.ownerKey === ownerKey)), getProducts()]);
  return items
    .map((c) => {
      const product = products.find((p) => p.slug === c.slug);
      if (!product) return null;
      return { ...c, product, unitCents: priceFor(product, c.license) ?? product.priceCents };
    })
    .filter((x): x is CartLine => !!x);
}

/** Source-code, workflow and hosted products are single-seat; quantity >1 only makes sense for team seats. */
export const allowsQuantity = (p: Product) => p.delivery === "subscription" || p.delivery === "cloud-agent";

export async function addToCart(ownerKey: string, slug: string, license?: LicenseType) {
  const products = await getProducts();
  const p = products.find((x) => x.slug === slug);
  if (!p) return { ok: false as const, error: "Product not found." };
  if (!isPurchasable(p)) return { ok: false as const, error: "This product is not available to buy yet." };
  const lic = license && priceFor(p, license) != null ? license : p.license;
  return mutate((db) => {
    const existing = db.cart.find((c) => c.ownerKey === ownerKey && c.slug === slug);
    if (existing) {
      existing.license = lic;
      if (allowsQuantity(p)) existing.quantity = Math.min(existing.quantity + 1, 50);
    } else db.cart.push({ ownerKey, slug, quantity: 1, license: lic, addedAt: now() });
    return { ok: true as const };
  });
}

export async function updateCartItem(ownerKey: string, slug: string, quantity: number) {
  const p = (await getProducts()).find((x) => x.slug === slug);
  await mutate((db) => {
    const it = db.cart.find((c) => c.ownerKey === ownerKey && c.slug === slug);
    if (!it) return;
    if (quantity <= 0) db.cart = db.cart.filter((c) => c !== it);
    else it.quantity = p && allowsQuantity(p) ? Math.min(Math.floor(quantity), 50) : 1;
  });
}

/** Move an anonymous cart into the signed-in user's cart. */
export async function mergeCarts(anonKey: string | null, userId: string) {
  if (!anonKey) return;
  await mutate((db) => {
    for (const c of db.cart.filter((x) => x.ownerKey === anonKey)) {
      if (!db.cart.some((x) => x.ownerKey === userId && x.slug === c.slug)) db.cart.push({ ...c, ownerKey: userId });
    }
    db.cart = db.cart.filter((x) => x.ownerKey !== anonKey);
  });
}

export async function cartTotals(lines: CartLine[], couponCode: string | null, country: string, vatId?: string | null) {
  const inputs: LineInput[] = lines.map((l) => ({ productId: l.product.id, slug: l.slug, title: l.product.title, unitCents: l.unitCents, quantity: l.quantity }));
  let couponError: string | null = null;
  let coupon = null;
  if (couponCode) {
    const rec = await read((db) => db.coupons.find((c) => c.code.toUpperCase() === couponCode.trim().toUpperCase()));
    const check = validateCoupon(rec, inputs);
    if (check.ok) coupon = check.coupon;
    else couponError = check.reason;
  }
  // VAT IDs are not validated in the sandbox, so reverse charge is never applied here.
  const totals = computeTotals(inputs, coupon, { country, vatId, vatIdValidated: false });
  return { totals, couponError, coupon };
}

// ───────────────────────── Checkout ─────────────────────────

export async function createOrderAndCheckout(opts: { userId: string; email: string; couponCode: string | null; country: string; vatId: string | null; digitalConsent: boolean }) {
  const lines = await getCart(opts.userId);
  if (!lines.length) return { ok: false as const, error: "Your cart is empty." };
  const unavailable = lines.filter((l) => !isPurchasable(l.product));
  if (unavailable.length) return { ok: false as const, error: `${unavailable.map((l) => l.product.title).join(", ")} can no longer be purchased. Remove it to continue.` };
  const owned = await read((db) => db.entitlements.filter((e) => e.userId === opts.userId && e.status === "active").map((e) => e.slug));
  const dupes = lines.filter((l) => owned.includes(l.slug) && !allowsQuantity(l.product));
  if (dupes.length) return { ok: false as const, error: `You already own ${dupes.map((d) => d.product.title).join(", ")}.` };
  if (!opts.digitalConsent) return { ok: false as const, error: "Please confirm the digital-content consent to continue." };

  const { totals, couponError } = await cartTotals(lines, opts.couponCode, opts.country, opts.vatId);
  if (couponError) return { ok: false as const, error: couponError };

  const orderId = id("ord");
  const order: Order = {
    id: orderId,
    number: "",
    userId: opts.userId,
    email: opts.email,
    status: "pending",
    items: lines.map((l) => ({ productId: l.product.id, slug: l.slug, title: l.product.title, unitCents: l.unitCents, quantity: l.quantity, license: l.license })),
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    taxCents: totals.taxCents,
    taxRate: totals.taxRate,
    taxNote: totals.taxNote,
    totalCents: totals.totalCents,
    currency: "EUR",
    country: opts.country,
    vatId: opts.vatId,
    couponCode: opts.couponCode?.toUpperCase() || null,
    provider: env.paymentProvider,
    sessionId: null,
    paymentRef: null,
    digitalConsent: true,
    createdAt: now(),
    paidAt: null,
    refundedCents: 0,
  };
  const provider = paymentProvider();
  const session = await provider.createCheckout({
    orderId,
    customerEmail: opts.email,
    lines: order.items.map((i) => ({ title: `${i.title} (${i.license} licence)`, unitCents: i.unitCents, quantity: i.quantity })),
    discountCents: order.discountCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    currency: "EUR",
    successUrl: `${env.appUrl}/checkout/success?order=${orderId}`,
    cancelUrl: `${env.appUrl}/cart?cancelled=1`,
    digitalContentConsent: true,
  });
  order.sessionId = session.sessionId;
  await mutate((db) => void db.orders.push(order));
  await audit(opts.userId, "order.created", orderId, { total: order.totalCents, provider: provider.id });
  return { ok: true as const, url: session.url, orderId };
}

// ───────────────────────── Fulfilment (webhook only) ─────────────────────────

export type FulfilResult = "fulfilled" | "duplicate" | "ignored" | "amount_mismatch" | "unknown_order" | "refunded";

/**
 * Idempotent handler for verified provider events. Grants access ONLY here,
 * never from the browser redirect. Duplicate deliveries are recorded once.
 */
export async function handlePaymentEvent(evt: PaymentEvent): Promise<FulfilResult> {
  const products = await getProducts();
  const result = await mutate((db): FulfilResult => {
    if (db.paymentEvents.some((e) => e.id === evt.id)) return "duplicate";
    const order = db.orders.find((o) => o.id === evt.orderId);
    db.paymentEvents.push({ id: evt.id, type: evt.type, orderId: evt.orderId, processedAt: now() });
    if (!order) return "unknown_order";

    if (evt.type === "checkout.expired") {
      if (order.status === "pending") order.status = "expired";
      return "ignored";
    }

    if (evt.type === "refund.succeeded") {
      order.refundedCents = Math.min(order.totalCents, order.refundedCents + evt.amountCents);
      order.status = order.refundedCents >= order.totalCents ? "refunded" : "partially_refunded";
      if (order.status === "refunded") {
        for (const e of db.entitlements.filter((x) => x.orderId === order.id)) e.status = "revoked";
        const ents = new Set(db.entitlements.filter((x) => x.orderId === order.id).map((e) => e.id));
        for (const k of db.licenseKeys.filter((x) => ents.has(x.entitlementId))) k.status = "revoked";
      }
      const r = db.refunds.find((x) => x.orderId === order.id && x.status === "approved");
      if (r) r.status = "succeeded";
      return "refunded";
    }

    // checkout.completed
    if (order.status === "paid") return "duplicate";
    if (evt.amountCents !== order.totalCents || evt.currency.toUpperCase() !== order.currency) {
      order.status = "failed";
      return "amount_mismatch";
    }
    order.status = "paid";
    order.paidAt = now();
    order.paymentRef = evt.paymentRef;
    order.number = `AF-${new Date().getFullYear()}-${String(db.orders.filter((o) => o.number).length + 1).padStart(6, "0")}`;
    if (order.couponCode) {
      const c = db.coupons.find((x) => x.code === order.couponCode);
      if (c) c.redemptions = (c.redemptions ?? 0) + 1;
    }
    for (const item of order.items) {
      const p = products.find((x) => x.slug === item.slug);
      const entId = id("ent");
      db.entitlements.push({ id: entId, userId: order.userId, orderId: order.id, slug: item.slug, license: item.license, status: "active", createdAt: now() });
      db.licenseKeys.push({ key: generateLicenseKey(env.licenseSecret), entitlementId: entId, userId: order.userId, slug: item.slug, license: item.license, status: "active", createdAt: now(), activations: 0 });
      if (p && (p.delivery === "hosted-tool" || p.delivery === "cloud-agent")) {
        db.credits.push({ id: id("crd"), userId: order.userId, delta: db.settings.creditsPerHostedPurchase * item.quantity, reason: `Included credits: ${item.title}`, at: now() });
      }
    }
    db.cart = db.cart.filter((c) => !(c.ownerKey === order.userId && order.items.some((i) => i.slug === c.slug)));
    db.notifications.push({ id: id("ntf"), userId: order.userId, title: "Purchase complete", body: `Order ${order.number} is paid. Your products are ready in your dashboard.`, href: "/dashboard/purchases", readAt: null, createdAt: now() });
    db.outbox.push({ id: id("mail"), to: order.email, subject: `Your AgentForge AI order ${order.number}`, body: `Thank you for your purchase.\n\n${order.items.map((i) => `- ${i.title} (${i.license})`).join("\n")}\n\nInvoice: ${env.appUrl}/dashboard/invoices/${order.id}`, createdAt: now() });
    return "fulfilled";
  });
  await audit(null, `payment.${evt.type}`, evt.orderId, { eventId: evt.id, result });
  return result;
}

// ───────────────────────── Entitlements & credits ─────────────────────────

export async function ownsProduct(userId: string, slug: string) {
  return read((db) => db.entitlements.some((e) => e.userId === userId && e.slug === slug && e.status === "active"));
}

export async function creditBalance(userId: string) {
  return read((db) => db.credits.filter((c) => c.userId === userId).reduce((s, c) => s + c.delta, 0));
}
