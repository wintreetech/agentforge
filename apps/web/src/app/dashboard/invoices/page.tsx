import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { DashHeader } from "@/components/dash";
import { Badge, EmptyState, Table } from "@/components/ui";
import { eur2, fmtDate } from "@/lib/utils";

export const metadata = { title: "Invoices" };

export default async function Invoices() {
  const user = await requireUser();
  const orders = await read((db) => db.orders.filter((o) => o.userId === user.id && o.number).reverse());
  return (
    <>
      <DashHeader title="Invoices" intro="An invoice is issued for every paid order." />
      {orders.length === 0 ? <EmptyState icon={<Receipt className="size-5" />} title="No invoices yet" /> : (
        <Table>
          <thead><tr><th>Invoice</th><th>Date</th><th>Status</th><th className="text-right">Total</th></tr></thead>
          <tbody>{orders.map((o) => <tr key={o.id}><td><Link href={`/dashboard/invoices/${o.id}`} className="font-medium hover:underline">{o.number}</Link></td><td className="text-muted">{fmtDate(o.paidAt)}</td><td><Badge tone={o.status === "paid" ? "success" : "warning"}>{o.status.replace("_", " ")}</Badge></td><td className="text-right tabular-nums">{eur2(o.totalCents)}</td></tr>)}</tbody>
        </Table>
      )}
    </>
  );
}
