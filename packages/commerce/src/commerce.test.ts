import { describe, expect, it } from "vitest";
import {
  computeTotals,
  validateCoupon,
  generateLicenseKey,
  licenseKeyWellFormed,
  signPayload,
  verifyPayload,
  SandboxPaymentProvider,
  StripePaymentProvider,
  WebhookSignatureError,
  createZip,
  crc32,
  hmac,
  type Coupon,
  type LineInput,
} from "./index.ts";

const lines: LineInput[] = [
  { productId: "p1", slug: "a", title: "A", unitCents: 1000, quantity: 1 },
  { productId: "p2", slug: "b", title: "B", unitCents: 9900, quantity: 1 },
];

describe("totals and VAT", () => {
  it("applies the buyer-country VAT rate for EU consumers", () => {
    const t = computeTotals(lines, null, { country: "DE" });
    expect(t.subtotalCents).toBe(10900);
    expect(t.taxRate).toBe(19);
    expect(t.taxCents).toBe(2071);
    expect(t.totalCents).toBe(12971);
  });
  it("applies reverse charge only for validated EU VAT IDs", () => {
    expect(computeTotals(lines, null, { country: "FR", vatId: "FR123", vatIdValidated: true }).taxCents).toBe(0);
    expect(computeTotals(lines, null, { country: "FR", vatId: "FR123", vatIdValidated: false }).taxRate).toBe(20);
  });
  it("charges no VAT outside the EU", () => {
    expect(computeTotals(lines, null, { country: "US" }).taxCents).toBe(0);
  });
  it("rejects invalid quantities and prices", () => {
    expect(() => computeTotals([{ ...lines[0], quantity: 0 }], null, { country: "DE" })).toThrow();
    expect(() => computeTotals([{ ...lines[0], unitCents: 10.5 }], null, { country: "DE" })).toThrow();
  });
});

describe("coupons", () => {
  const base: Coupon = { code: "LAUNCH10", kind: "percent", value: 10, active: true };
  it("computes percentage discounts", () => {
    const t = computeTotals(lines, base, { country: "US" });
    expect(t.discountCents).toBe(1090);
    expect(t.totalCents).toBe(9810);
  });
  it("caps fixed discounts at the eligible subtotal", () => {
    const t = computeTotals([lines[0]], { ...base, kind: "fixed", value: 5000 }, { country: "US" });
    expect(t.discountCents).toBe(1000);
    expect(t.totalCents).toBe(0);
  });
  it("rejects expired, inactive, exhausted and non-applicable coupons", () => {
    expect(validateCoupon(undefined, lines).ok).toBe(false);
    expect(validateCoupon({ ...base, active: false }, lines).ok).toBe(false);
    expect(validateCoupon({ ...base, expiresAt: "2020-01-01" }, lines).ok).toBe(false);
    expect(validateCoupon({ ...base, maxRedemptions: 1, redemptions: 1 }, lines).ok).toBe(false);
    expect(validateCoupon({ ...base, productSlugs: ["zzz"] }, lines).ok).toBe(false);
    expect(validateCoupon({ ...base, minSubtotalCents: 50000 }, lines).ok).toBe(false);
    expect(validateCoupon(base, lines).ok).toBe(true);
  });
});

describe("licence keys and signed tokens", () => {
  it("generates keys that verify, and rejects tampered keys", () => {
    const k = generateLicenseKey("secret");
    expect(k).toMatch(/^AF-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{4}$/);
    expect(licenseKeyWellFormed("secret", k)).toBe(true);
    expect(licenseKeyWellFormed("other", k)).toBe(false);
    const tampered = k.slice(0, 3) + (k[3] === "A" ? "B" : "A") + k.slice(4);
    expect(licenseKeyWellFormed("secret", tampered)).toBe(false);
  });
  it("signed payloads expire and detect tampering", () => {
    const tok = signPayload("s", { f: 1, exp: Date.now() + 1000 });
    expect(verifyPayload("s", tok)).not.toBeNull();
    expect(verifyPayload("x", tok)).toBeNull();
    expect(verifyPayload("s", tok, Date.now() + 5000)).toBeNull();
    const [body, sig] = tok.split(".");
    expect(verifyPayload("s", body + "x." + sig)).toBeNull();
  });
});

describe("payment webhooks", () => {
  const evt = { id: "evt_1", type: "checkout.completed", orderId: "ord_1", paymentRef: "pay_1", amountCents: 100, currency: "EUR" };
  it("sandbox accepts correctly signed events and rejects forged ones", async () => {
    const p = new SandboxPaymentProvider("whsec", "http://localhost");
    const raw = JSON.stringify(evt);
    const ok = await p.parseWebhook(raw, new Headers({ "x-agentforge-signature": p.sign(raw) }));
    expect(ok?.orderId).toBe("ord_1");
    await expect(p.parseWebhook(raw, new Headers({ "x-agentforge-signature": new SandboxPaymentProvider("wrong", "").sign(raw) }))).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    await expect(p.parseWebhook(raw, new Headers())).rejects.toBeInstanceOf(WebhookSignatureError);
    const old = p.sign(raw, Math.floor(Date.now() / 1000) - 3600);
    await expect(p.parseWebhook(raw, new Headers({ "x-agentforge-signature": old }))).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it("stripe verifies Stripe-Signature and maps checkout.session.completed", async () => {
    const p = new StripePaymentProvider("sk_test_x", "whsec_test");
    const raw = JSON.stringify({
      id: "evt_s",
      type: "checkout.session.completed",
      data: { object: { payment_status: "paid", metadata: { order_id: "ord_9" }, payment_intent: "pi_1", amount_total: 1000, currency: "eur" } },
    });
    const t = Math.floor(Date.now() / 1000);
    const header = `t=${t},v1=${hmac("whsec_test", `${t}.${raw}`)}`;
    const e = await p.parseWebhook(raw, new Headers({ "stripe-signature": header }));
    expect(e).toMatchObject({ type: "checkout.completed", orderId: "ord_9", amountCents: 1000, currency: "EUR" });
  });

  it("stripe createCheckout sends idempotency keys and never exposes the secret in the URL", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = new StripePaymentProvider("sk_test_x", "whsec", fake);
    const s = await p.createCheckout({
      orderId: "ord_1", customerEmail: "a@example.com", lines: [{ title: "A", unitCents: 1000, quantity: 1 }],
      discountCents: 0, taxCents: 0, totalCents: 1000, currency: "EUR", successUrl: "http://x/s", cancelUrl: "http://x/c", digitalContentConsent: true,
    });
    expect(s.url).toContain("checkout.stripe.com");
    expect((calls[0].init.headers as Record<string, string>)["Idempotency-Key"]).toBe("checkout_ord_1");
    expect(calls[0].url).not.toContain("sk_test");
  });
});

describe("zip writer", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("writes a valid archive signature and directory", () => {
    const z = createZip([{ path: "a.txt", data: new TextEncoder().encode("hello") }]);
    const dv = new DataView(z.buffer);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    expect(dv.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(dv.getUint16(z.length - 22 + 10, true)).toBe(1);
  });
});
