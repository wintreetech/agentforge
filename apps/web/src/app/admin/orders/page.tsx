import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { DashHeader } from "@/components/dash";
import { Badge, Input, Table } from "@/components/ui";
import { eur2, fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Orders" };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdmin();
  const { q, status } = await searchParams;
  const orders = await read((db) => db.orders.filter((o) => (!status || o.status === status) && (!q || o.id.includes(q) || o.email.includes(q) || o.number.includes(q))).slice(-300).reverse());
  return (
    <>
      <DashHeader title="Orders" />
      <form className="mb-4 flex flex-wrap gap-2">
        <label htmlFor="oq" className="sr-only">Search</label><Input id="oq" name="q" defaultValue={q} placeholder="Order id, number or email" className="max-w-xs" />
        <select name="status" defaultValue={status ?? ""} className="h-10 rounded-xl border border-border bg-bg-2 px-3 text-sm" aria-label="Status"><option value="">All statuses</option>{["pending", "paid", "refunded", "partially_refunded", "expired", "failed"].map((s) => <option key={s}>{s}</option>)}</select>
        <button className="h-10 rounded-xl border border-border px-4 text-sm">Filter</button>
      </form>
      <Table>
        <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Status</th><th>Country</th><th className="text-right">VAT</th><th className="text-right">Total</th><th>Provider</th><th>Created</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td><span className="font-medium">{o.number || "—"}</span><span className="block font-mono text-[11px] text-subtle">{o.id}</span></td>
              <td className="text-muted">{o.email}</td>
              <td className="text-[12.5px]">{o.items.map((i) => i.title).join(", ")}</td>
              <td><Badge tone={o.status === "paid" ? "success" : o.status === "pending" ? "neutral" : "warning"}>{o.status}</Badge></td>
              <td>{o.country}</td>
              <td className="text-right tabular-nums">{eur2(o.taxCents)}</td>
              <td className="text-right tabular-nums">{eur2(o.totalCents)}{o.couponCode && <span className="block text-[11px] text-subtle">{o.couponCode}</span>}</td>
              <td>{o.provider}</td>
              <td className="text-muted">{fmtDateTime(o.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
