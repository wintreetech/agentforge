/**
 * Order totals, coupons and EU VAT.
 *
 * IMPORTANT: VAT handling here is a configurable approximation for development
 * and for the sandbox provider. In production, use the payment provider's tax
 * engine (Stripe Tax / Paddle as merchant of record) and have the rules
 * verified by a tax professional. Rates below are standard rates and must be
 * kept up to date.
 */

export const EU_VAT_STANDARD_RATES: Record<string, number> = {
  AT: 20, BE: 21, BG: 20, HR: 25, CY: 19, CZ: 21, DK: 25, EE: 24, FI: 25.5, FR: 20,
  DE: 19, GR: 24, HU: 27, IE: 23, IT: 22, LV: 21, LT: 21, LU: 17, MT: 18, NL: 21,
  PL: 23, PT: 23, RO: 21, SK: 23, SI: 22, ES: 21, SE: 25,
};

export interface LineInput {
  productId: string;
  slug: string;
  title: string;
  unitCents: number;
  quantity: number;
}

export interface Coupon {
  code: string;
  kind: "percent" | "fixed";
  /** percent: 1–100; fixed: cents */
  value: number;
  active: boolean;
  minSubtotalCents?: number;
  expiresAt?: string | null;
  maxRedemptions?: number | null;
  redemptions?: number;
  productSlugs?: string[] | null;
}

export type CouponCheck = { ok: true; coupon: Coupon } | { ok: false; reason: string };

export function validateCoupon(coupon: Coupon | undefined, lines: LineInput[], now = new Date()): CouponCheck {
  if (!coupon) return { ok: false, reason: "This code does not exist." };
  if (!coupon.active) return { ok: false, reason: "This code is no longer active." };
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) < now.getTime()) return { ok: false, reason: "This code has expired." };
  if (coupon.maxRedemptions != null && (coupon.redemptions ?? 0) >= coupon.maxRedemptions)
    return { ok: false, reason: "This code has reached its redemption limit." };
  const eligible = eligibleSubtotal(coupon, lines);
  if (eligible <= 0) return { ok: false, reason: "This code does not apply to the items in your cart." };
  if (coupon.minSubtotalCents && subtotal(lines) < coupon.minSubtotalCents)
    return { ok: false, reason: `This code requires a subtotal of at least €${(coupon.minSubtotalCents / 100).toFixed(2)}.` };
  if (coupon.kind === "percent" && (coupon.value <= 0 || coupon.value > 100)) return { ok: false, reason: "Invalid code configuration." };
  return { ok: true, coupon };
}

const subtotal = (lines: LineInput[]) => lines.reduce((s, l) => s + l.unitCents * l.quantity, 0);
const eligibleSubtotal = (c: Coupon, lines: LineInput[]) =>
  lines.filter((l) => !c.productSlugs?.length || c.productSlugs.includes(l.slug)).reduce((s, l) => s + l.unitCents * l.quantity, 0);

export interface TaxContext {
  country: string; // ISO 3166-1 alpha-2
  /** A VAT ID supplied by a business customer. Must be validated (VIES) by the provider before reverse charge is applied. */
  vatId?: string | null;
  vatIdValidated?: boolean;
}

export interface Totals {
  subtotalCents: number;
  discountCents: number;
  taxableCents: number;
  taxRate: number; // percent
  taxCents: number;
  totalCents: number;
  currency: "EUR";
  taxNote: string;
}

export function computeTotals(lines: LineInput[], coupon: Coupon | null, tax: TaxContext): Totals {
  for (const l of lines) {
    if (!Number.isInteger(l.unitCents) || l.unitCents < 0) throw new Error("Invalid unit price");
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 50) throw new Error("Invalid quantity");
  }
  const sub = subtotal(lines);
  let discount = 0;
  if (coupon) {
    const eligible = eligibleSubtotal(coupon, lines);
    discount = coupon.kind === "percent" ? Math.round((eligible * coupon.value) / 100) : Math.min(coupon.value, eligible);
  }
  const taxable = Math.max(0, sub - discount);
  const country = tax.country.toUpperCase();
  let rate = 0;
  let note = "VAT not applicable for this country (export of services).";
  if (EU_VAT_STANDARD_RATES[country] != null) {
    if (tax.vatId && tax.vatIdValidated) {
      note = "EU B2B reverse charge: VAT to be accounted for by the recipient.";
    } else {
      rate = EU_VAT_STANDARD_RATES[country];
      note = `VAT ${rate}% (${country}) for electronically supplied services.`;
    }
  }
  const taxCents = Math.round((taxable * rate) / 100);
  return {
    subtotalCents: sub,
    discountCents: discount,
    taxableCents: taxable,
    taxRate: rate,
    taxCents,
    totalCents: taxable + taxCents,
    currency: "EUR",
    taxNote: note,
  };
}
