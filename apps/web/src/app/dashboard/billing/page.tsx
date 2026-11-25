import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { env } from "@/lib/env";
import { DashHeader } from "@/components/dash";
import { Card, Notice, Stat, Table, buttonClass } from "@/components/ui";
import { eur2, fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Billing & credits" };

export default async function Billing() {
  const user = await requireUser();
  const [ledger, orders] = await read((db) => [db.credits.filter((c) => c.userId === user.id).reverse(), db.orders.filter((o) => o.userId === user.id && o.status !== "pending")]);
  const balance = ledger.reduce((s, c) => s + c.delta, 0);
  return (
    <>
      <DashHeader title="Billing & credits" intro="Credits pay for live-model runs of hosted products (1 credit ≈ €0.01 of estimated provider cost). Sandbox runs and runs on your own API key don't use credits." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Credit balance" value={balance.toLocaleString("en")} />
        <Stat label="Orders" value={orders.length} />
        <Stat label="Payment provider" value={env.paymentProvider === "sandbox" ? "Sandbox" : "Stripe"} hint={env.paymentProvider === "sandbox" ? "Development — no real charges" : undefined} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="font-semibold">Credit packs</p>
          <p className="mt-1 text-[13.5px] text-muted">500 credits for €5 · 2,500 credits for €22.</p>
          <button disabled className={buttonClass("outline", "md", "mt-4")} title="Credit packs are sold through the subscription and top-up flow, which needs a configured Stripe account. Not available in the sandbox.">Buy credits (not available yet)</button>
          <p className="mt-2 text-[12px] text-subtle">Disabled: top-ups require the Stripe integration. Meanwhile, add your own API key under <Link href="/dashboard/integrations" className="underline">Integrations</Link>.</p>
        </Card>
        <Card className="p-5">
          <p className="font-semibold">Subscriptions</p>
          <p className="mt-1 text-[13.5px] text-muted">You have no active subscriptions. Hosted-agent subscriptions will appear here with renewal dates and cancellation controls.</p>
          <Link href="/dashboard/invoices" className={buttonClass("ghost", "sm", "mt-3 -ml-3")}>View invoices</Link>
        </Card>
      </div>
      {balance <= 0 && ledger.length > 0 && <Notice tone="warning" className="mt-6">Your credit balance is empty. Live-model runs will be blocked until you add credits or a provider key.</Notice>}
      <h2 className="mb-3 mt-8 font-semibold">Credit ledger</h2>
      {ledger.length === 0 ? <p className="text-[13.5px] text-muted">No credit activity yet. Buying a hosted tool or agent includes {env.creditsPerHostedPurchase} credits.</p> : (
        <Table>
          <thead><tr><th>When</th><th>Description</th><th className="text-right">Credits</th></tr></thead>
          <tbody>{ledger.slice(0, 100).map((c) => <tr key={c.id}><td className="text-muted">{fmtDateTime(c.at)}</td><td>{c.reason}</td><td className={`text-right tabular-nums ${c.delta > 0 ? "text-success" : ""}`}>{c.delta > 0 ? "+" : ""}{c.delta}</td></tr>)}</tbody>
        </Table>
      )}
      <p className="mt-6 text-[12.5px] text-subtle">Total paid to date: {eur2(orders.reduce((s, o) => s + (o.status === "paid" || o.status === "partially_refunded" ? o.totalCents - o.refundedCents : 0), 0))}</p>
    </>
  );
}
