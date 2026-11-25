import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { getProducts } from "@/lib/catalog";
import { dailySeries } from "@/lib/series";
import { DashHeader } from "@/components/dash";
import { SimpleBars, TimeArea } from "@/components/charts";
import { Badge, Card, Notice, Stat, Table } from "@/components/ui";
import { eur2, fmtDateTime, daysAgoIso } from "@/lib/utils";
import { env } from "@/lib/env";

export default async function AdminHome() {
  await requireAdmin();
  const products = await getProducts();
  const d = await read((db) => {
    const paid = db.orders.filter((o) => ["paid", "partially_refunded", "refunded"].includes(o.status));
    const since = daysAgoIso(30);
    return {
      paid,
      revenue: paid.reduce((s, o) => s + o.totalCents - o.taxCents - o.refundedCents, 0),
      customers: db.users.filter((u) => !u.deletedAt).length,
      buyers: new Set(paid.map((o) => o.userId)).size,
      runs30: db.executions.filter((e) => e.createdAt >= since).length,
      cost30: db.executions.filter((e) => e.createdAt >= since).reduce((s, e) => s + e.costEur, 0),
      recent: db.orders.slice(-8).reverse(),
      newsletter: db.newsletter.length,
    };
  });
  const bySlug = Object.entries(d.paid.flatMap((o) => o.items).reduce<Record<string, number>>((m, i) => ((m[i.title] = (m[i.title] ?? 0) + i.unitCents * i.quantity / 100), m), {}))
    .map(([name, value]) => ({ name: name.replace(/^AI /, ""), value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  return (
    <>
      <DashHeader title="Overview" intro="Live figures from the data store. Nothing on this page is estimated or seeded." />
      {env.paymentProvider === "sandbox" && <Notice tone="sandbox" className="mb-6">Payments are in sandbox mode: revenue below comes from simulated payments.</Notice>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Net revenue (excl. VAT, after refunds)" value={eur2(d.revenue)} />
        <Stat label="Paid orders" value={d.paid.length} />
        <Stat label="Accounts / paying customers" value={`${d.customers} / ${d.buyers}`} />
        <Stat label="Runs (30d) · est. AI cost" value={`${d.runs30} · €${d.cost30.toFixed(2)}`} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5"><p className="mb-3 font-semibold">Revenue per day (EUR, excl. VAT)</p><TimeArea data={dailySeries(d.paid, (o) => o.paidAt ?? o.createdAt, (o) => (o.totalCents - o.taxCents) / 100)} dataKey="value" label="Revenue" format="eur" /></Card>
        <Card className="p-5"><p className="mb-3 font-semibold">Revenue by product</p>{bySlug.length ? <SimpleBars data={bySlug} label="EUR" /> : <p className="text-[13.5px] text-muted">No sales yet.</p>}</Card>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Products published / total" value={`${products.filter((p) => p.status === "published").length} / ${products.length}`} />
        <Stat label="Newsletter subscribers" value={d.newsletter} />
        <Stat label="Avg. order value" value={d.paid.length ? eur2(Math.round(d.paid.reduce((s, o) => s + o.totalCents, 0) / d.paid.length)) : "—"} />
      </div>
      <h2 className="mb-3 mt-8 font-semibold">Recent orders</h2>
      <Table>
        <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="text-right">Total</th><th>Created</th></tr></thead>
        <tbody>{d.recent.map((o) => <tr key={o.id}><td><Link href={`/admin/orders?q=${o.id}`} className="font-medium hover:underline">{o.number || o.id}</Link></td><td className="text-muted">{o.email}</td><td><Badge tone={o.status === "paid" ? "success" : o.status === "pending" ? "neutral" : "warning"}>{o.status}</Badge></td><td className="text-right tabular-nums">{eur2(o.totalCents)}</td><td className="text-muted">{fmtDateTime(o.createdAt)}</td></tr>)}</tbody>
      </Table>
    </>
  );
}
