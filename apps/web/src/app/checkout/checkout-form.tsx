"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import type { Totals } from "@agentforge/commerce";
import { checkoutAction } from "@/app/actions/shop";
import { SubmitButton } from "@/components/forms";
import { Card, Input, Label, Notice, Select, buttonClass } from "@/components/ui";
import { eur2 } from "@/lib/utils";

export function CheckoutForm({ countries, country, coupon, couponError, lines, totals, email }: { countries: [string, string][]; country: string; coupon: string; couponError: string | null; lines: { slug: string; title: string; license: string; quantity: number; unitCents: number }[]; totals: Totals; email: string }) {
  const [state, action] = useActionState(checkoutAction, undefined);
  const router = useRouter();
  const refresh = (c: string, cp: string) => router.replace(`/checkout?country=${c}${cp ? `&coupon=${encodeURIComponent(cp)}` : ""}`, { scroll: false });

  return (
    <form action={action} className="mt-8 grid grid-cols-1 [&>*]:min-w-0 gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card className="p-5">
          <p className="font-semibold">Billing</p>
          <p className="mt-1 text-[13px] text-muted">Your receipt goes to {email}.</p>
          <div className="mt-4">
            <div>
              <Label htmlFor="country">Country</Label>
              <Select id="country" name="country" defaultValue={country} onChange={(e) => refresh(e.target.value, coupon)}>
                {countries.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </Select>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <Label htmlFor="coupon">Discount code</Label>
          <div className="flex gap-2">
            <Input id="coupon" name="coupon" defaultValue={coupon} maxLength={40} placeholder="Code" />
            <button type="button" className={buttonClass("outline")} onClick={() => refresh(country, (document.getElementById("coupon") as HTMLInputElement).value.trim())}>Apply</button>
          </div>
          {couponError && <p className="mt-2 text-[13px] text-danger" role="alert">{couponError}</p>}
          {!couponError && totals.discountCents > 0 && <p className="mt-2 text-[13px] text-success">Code applied.</p>}
        </Card>
        <Card className="space-y-3 p-5 text-[13.5px]">
          <label className="flex items-start gap-2.5">
            <input type="checkbox" name="consent" required className="mt-1 accent-[var(--accent)]" />
            <span>I request immediate access to the digital content and acknowledge that I lose my 14-day right of withdrawal once delivery begins.</span>
          </label>
          <label className="flex items-start gap-2.5">
            <input type="checkbox" name="terms" required className="mt-1 accent-[var(--accent)]" />
            <span>I accept the <a href="/legal/terms" target="_blank" className="underline">Terms of Service</a> and <a href="/legal/license" target="_blank" className="underline">Licence Agreement</a>.</span>
          </label>
        </Card>
      </div>
      <Card className="h-fit p-5 lg:sticky lg:top-24">
        <p className="font-semibold">Order summary</p>
        <ul className="mt-4 space-y-2 text-[13.5px]">
          {lines.map((l) => (
            <li key={l.slug} className="flex justify-between gap-3"><span>{l.title} {l.quantity > 1 && <span className="text-subtle"> × {l.quantity}</span>}</span><span className="tabular-nums">{eur2(l.unitCents * l.quantity)}</span></li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-[14px]">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{eur2(totals.subtotalCents)}</dd></div>
          {totals.discountCents > 0 && <div className="flex justify-between text-success"><dt>Discount</dt><dd className="tabular-nums">−{eur2(totals.discountCents)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">VAT {totals.taxRate ? `(${totals.taxRate}%)` : ""}</dt><dd className="tabular-nums">{eur2(totals.taxCents)}</dd></div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{eur2(totals.totalCents)}</dd></div>
        </dl>
        <p className="mt-2 text-[12px] text-subtle">{totals.taxNote}</p>
        {state?.error && <Notice tone="danger" className="mt-4">{state.error}</Notice>}
        <SubmitButton size="lg" className="mt-5 w-full" pendingText="Starting secure checkout…"><Lock className="size-4" /> Pay {eur2(totals.totalCents)}</SubmitButton>
        <p className="mt-3 text-center text-[12px] text-subtle">You’ll complete payment on the payment provider’s hosted page.</p>
      </Card>
    </form>
  );
}
