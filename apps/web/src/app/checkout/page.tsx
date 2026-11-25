import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EU_VAT_STANDARD_RATES } from "@agentforge/commerce";
import { requireUser } from "@/lib/auth";
import { cartTotals, getCart } from "@/lib/commerce";
import { env } from "@/lib/env";
import { Container, Notice } from "@/components/ui";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

const COUNTRIES: [string, string][] = [
  ...Object.keys(EU_VAT_STANDARD_RATES).map((c) => [c, new Intl.DisplayNames(["en"], { type: "region" }).of(c) ?? c] as [string, string]),
  ["GB", "United Kingdom"], ["CH", "Switzerland"], ["NO", "Norway"], ["US", "United States"], ["CA", "Canada"], ["AU", "Australia"], ["IN", "India"], ["SG", "Singapore"], ["AE", "United Arab Emirates"],
].sort((a, b) => a[1].localeCompare(b[1])) as [string, string][];

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ country?: string; coupon?: string }> }) {
  const user = await requireUser("/checkout");
  const sp = await searchParams;
  const lines = await getCart(user.id);
  if (!lines.length) redirect("/cart");
  const country = sp.country && /^[A-Z]{2}$/.test(sp.country) ? sp.country : "DE";
  const { totals, couponError } = await cartTotals(lines, sp.coupon ?? null, country);
  return (
    <Container className="max-w-5xl py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
      {env.paymentProvider === "sandbox" && (
        <Notice tone="sandbox" className="mt-4" title="Development payment sandbox">
          No payment provider credentials are configured, so checkout uses the built-in sandbox. No money moves. Fulfilment still happens only through a signed webhook, exactly as with a real provider.
        </Notice>
      )}
      {!user.emailVerifiedAt && (
        <Notice tone="warning" className="mt-4" title="Verify your email first">
          We need a verified email to send your receipt and licence keys. <a className="underline" href="/verify">Resend verification</a>.
        </Notice>
      )}
      <CheckoutForm
        countries={COUNTRIES}
        country={country}
        coupon={sp.coupon ?? ""}
        couponError={couponError}
        lines={lines.map((l) => ({ slug: l.slug, title: l.product.title, license: l.license, quantity: l.quantity, unitCents: l.unitCents }))}
        totals={totals}
        email={user.email}
      />
    </Container>
  );
}
