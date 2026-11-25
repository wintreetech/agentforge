import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { env } from "@/lib/env";
import { Notice } from "@/components/ui";
import { eur2, fmtDate, licenseLabel } from "@/lib/utils";
import { PrintButton } from "./print-button";

export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const o = await read((db) => db.orders.find((x) => x.id === id && x.userId === user.id && x.number));
  if (!o) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end gap-2 print:hidden"><PrintButton /></div>
      {env.paymentProvider === "sandbox" && <Notice tone="sandbox" className="mb-4 print:hidden">Sandbox order: this invoice records a simulated payment and is not a tax document.</Notice>}
      <article className="rounded-2xl border border-border bg-surface p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap justify-between gap-6">
          <div>
            <p className="text-xl font-semibold">AgentForge AI</p>
            <p className="mt-1 text-[13px] text-muted">Seller details are configured via environment before launch.</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold">Invoice</p>
            <p className="text-[13.5px] text-muted">{o.number}</p>
            <p className="text-[13.5px] text-muted">Issued {fmtDate(o.paidAt)}</p>
          </div>
        </header>
        <div className="mt-8 grid gap-4 text-[13.5px] sm:grid-cols-2">
          <div><p className="text-subtle">Billed to</p><p className="mt-1">{user.name}</p><p className="text-muted">{o.email}</p><p className="text-muted">Country: {o.country}{o.vatId ? ` · VAT ID ${o.vatId}` : ""}</p></div>
          <div className="sm:text-right"><p className="text-subtle">Payment</p><p className="mt-1">{o.provider === "sandbox" ? "Sandbox (simulated)" : "Card via Stripe"}</p><p className="text-muted">Ref {o.paymentRef}</p></div>
        </div>
        <table className="mt-8 w-full text-[13.5px]">
          <thead><tr className="border-b border-border text-left text-subtle"><th className="py-2 font-medium">Item</th><th className="py-2 text-right font-medium">Qty</th><th className="py-2 text-right font-medium">Unit</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
          <tbody>{o.items.map((i) => <tr key={i.slug} className="border-b border-border"><td className="py-2.5">{i.title}<span className="block text-[12px] text-subtle">{licenseLabel[i.license]} licence</span></td><td className="py-2.5 text-right">{i.quantity}</td><td className="py-2.5 text-right tabular-nums">{eur2(i.unitCents)}</td><td className="py-2.5 text-right tabular-nums">{eur2(i.unitCents * i.quantity)}</td></tr>)}</tbody>
        </table>
        <dl className="ml-auto mt-4 max-w-xs space-y-1.5 text-[13.5px]">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{eur2(o.subtotalCents)}</dd></div>
          {o.discountCents > 0 && <div className="flex justify-between"><dt className="text-muted">Discount {o.couponCode ? `(${o.couponCode})` : ""}</dt><dd className="tabular-nums">−{eur2(o.discountCents)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">VAT {o.taxRate}%</dt><dd className="tabular-nums">{eur2(o.taxCents)}</dd></div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold"><dt>Total (EUR)</dt><dd className="tabular-nums">{eur2(o.totalCents)}</dd></div>
          {o.refundedCents > 0 && <div className="flex justify-between text-warning"><dt>Refunded</dt><dd className="tabular-nums">−{eur2(o.refundedCents)}</dd></div>}
        </dl>
        <p className="mt-8 text-[12px] text-subtle">{o.taxNote} Digital content supplied with the customer&apos;s consent to immediate delivery.</p>
      </article>
    </div>
  );
}
