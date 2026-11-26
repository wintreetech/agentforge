import { hmac, safeEqual } from "./crypto.ts";

/**
 * Interchangeable payment provider interface. Fulfilment must only ever be
 * triggered by a verified webhook event — never by the browser redirect.
 */

export interface CheckoutRequest {
  orderId: string;
  customerEmail: string;
  lines: { title: string; unitCents: number; quantity: number }[];
  discountCents: number;
  taxCents: number;
  totalCents: number;
  currency: "EUR";
  successUrl: string;
  cancelUrl: string;
  /** Explicit consent to immediate delivery of digital content (EU withdrawal-right waiver). */
  digitalContentConsent: boolean;
}

export interface CheckoutSession {
  provider: string;
  sessionId: string;
  url: string;
}

export type PaymentEventType = "checkout.completed" | "checkout.expired" | "refund.succeeded";

export interface PaymentEvent {
  id: string; // provider event id — used for idempotency
  type: PaymentEventType;
  orderId: string;
  paymentRef: string;
  amountCents: number;
  currency: string;
}

export interface PaymentProvider {
  readonly id: "sandbox" | "stripe";
  readonly isSandbox: boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /** Throws if the signature is invalid. */
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent | null>;
  refund(paymentRef: string, amountCents: number): Promise<{ refundRef: string; status: "succeeded" | "pending" }>;
}

export class WebhookSignatureError extends Error {}

// ───────────────────────── Sandbox ─────────────────────────

/**
 * Development sandbox. It never moves money. The hosted "checkout" page is part
 * of this app and is clearly labelled as a sandbox; completing it posts an
 * HMAC-signed webhook to /api/webhooks/payments exactly like a real provider would.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly id = "sandbox" as const;
  readonly isSandbox = true;
  constructor(private secret: string, private baseUrl: string) {}

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const sessionId = `sbx_cs_${req.orderId}`;
    return { provider: this.id, sessionId, url: `${this.baseUrl}/checkout/sandbox/${encodeURIComponent(sessionId)}` };
  }

  sign(rawBody: string, timestamp = Math.floor(Date.now() / 1000)): string {
    return `t=${timestamp},v1=${hmac(this.secret, `${timestamp}.${rawBody}`)}`;
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent | null> {
    verifyTimestampedSignature(this.secret, rawBody, headers.get("x-agentforge-signature"));
    const data = JSON.parse(rawBody) as PaymentEvent;
    if (!data.id || !data.type || !data.orderId) throw new WebhookSignatureError("Malformed event");
    return data;
  }

  async refund(paymentRef: string): Promise<{ refundRef: string; status: "succeeded" }> {
    return { refundRef: `sbx_re_${paymentRef}`, status: "succeeded" };
  }
}

export function verifyTimestampedSignature(secret: string, rawBody: string, header: string | null, toleranceSec = 300, now = Date.now()) {
  if (!header) throw new WebhookSignatureError("Missing signature header");
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) throw new WebhookSignatureError("Malformed signature header");
  if (Math.abs(now / 1000 - t) > toleranceSec) throw new WebhookSignatureError("Signature timestamp outside tolerance");
  if (!safeEqual(hmac(secret, `${t}.${rawBody}`), v1)) throw new WebhookSignatureError("Signature mismatch");
}

// ───────────────────────── Stripe ─────────────────────────

/**
 * Stripe Checkout via the REST API (no SDK dependency). Requires
 * STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. Use test-mode keys in development.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly id = "stripe" as const;
  readonly isSandbox = false;
  constructor(private secretKey: string, private webhookSecret: string, private fetchImpl: typeof fetch = fetch) {}

  private async call(path: string, form: URLSearchParams, idempotencyKey?: string) {
    const res = await this.fetchImpl(`https://api.stripe.com/v1/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: form,
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error(`Stripe error: ${(json.error as { message?: string })?.message ?? res.status}`);
    return json;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const f = new URLSearchParams();
    f.set("mode", "payment");
    f.set("success_url", req.successUrl);
    f.set("cancel_url", req.cancelUrl);
    f.set("customer_email", req.customerEmail);
    f.set("client_reference_id", req.orderId);
    f.set("metadata[order_id]", req.orderId);
    f.set("automatic_tax[enabled]", "true");
    f.set("tax_id_collection[enabled]", "false");
    req.lines.forEach((l, i) => {
      f.set(`line_items[${i}][quantity]`, String(l.quantity));
      f.set(`line_items[${i}][price_data][currency]`, "eur");
      f.set(`line_items[${i}][price_data][unit_amount]`, String(l.unitCents));
      f.set(`line_items[${i}][price_data][tax_behavior]`, "exclusive");
      f.set(`line_items[${i}][price_data][product_data][name]`, l.title);
    });
    if (req.discountCents > 0) {
      // A one-off coupon object for the order-level discount.
      const coupon = await this.call(
        "coupons",
        new URLSearchParams({ amount_off: String(req.discountCents), currency: "eur", duration: "once" }),
        `coupon_${req.orderId}`,
      );
      f.set("discounts[0][coupon]", String(coupon.id));
    }
    const s = await this.call("checkout/sessions", f, `checkout_${req.orderId}`);
    return { provider: this.id, sessionId: String(s.id), url: String(s.url) };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent | null> {
    verifyTimestampedSignature(this.webhookSecret, rawBody, headers.get("stripe-signature"));
    const evt = JSON.parse(rawBody) as { id: string; type: string; data: { object: Record<string, any> } };
    const o = evt.data.object;
    switch (evt.type) {
      case "checkout.session.completed":
        if (o.payment_status !== "paid") return null;
        return {
          id: evt.id,
          type: "checkout.completed",
          orderId: o.metadata?.order_id ?? o.client_reference_id,
          paymentRef: String(o.payment_intent),
          amountCents: o.amount_total,
          currency: String(o.currency).toUpperCase(),
        };
      case "checkout.session.expired":
        return { id: evt.id, type: "checkout.expired", orderId: o.metadata?.order_id, paymentRef: "", amountCents: 0, currency: "EUR" };
      case "charge.refunded":
        return {
          id: evt.id,
          type: "refund.succeeded",
          orderId: o.metadata?.order_id ?? "",
          paymentRef: String(o.payment_intent),
          amountCents: o.amount_refunded,
          currency: String(o.currency).toUpperCase(),
        };
      default:
        return null;
    }
  }

  async refund(paymentRef: string, amountCents: number) {
    const r = await this.call("refunds", new URLSearchParams({ payment_intent: paymentRef, amount: String(amountCents) }), `refund_${paymentRef}_${amountCents}`);
    return { refundRef: String(r.id), status: r.status === "succeeded" ? ("succeeded" as const) : ("pending" as const) };
  }
}
