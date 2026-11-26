import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { DashHeader } from "@/components/dash";
import { Badge, Card, EmptyState, LinkButton } from "@/components/ui";
import { eur2, fmtDate, licenseLabel } from "@/lib/utils";
import { RefundForm } from "./refund-form";

export const metadata = { title: "My purchases" };

export default async function Purchases() {
  const user = await requireUser();
  const [orders, refunds] = await read((db) => [db.orders.filter((o) => o.userId === user.id && o.status !== "pending").reverse(), db.refunds.filter((r) => r.userId === user.id)]);
  return (
    <>
      <DashHeader title="My purchases" intro="Orders, their payment status and refund requests." />
      {orders.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="size-5" />} title="No purchases yet" action={<LinkButton href="/marketplace?availability=available">Browse available products</LinkButton>} />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const r = refunds.find((x) => x.orderId === o.id);
            return (
              <Card key={o.id} className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-semibold">{o.number || o.id}</p>
                  <Badge tone={o.status === "paid" ? "success" : o.status.includes("refund") ? "warning" : "danger"}>{o.status.replace("_", " ")}</Badge>
                  <span className="text-[13px] text-subtle">{fmtDate(o.paidAt ?? o.createdAt)}</span>
                  <span className="ml-auto font-semibold tabular-nums">{eur2(o.totalCents)}</span>
                </div>
                <ul className="mt-3 space-y-1 text-[13.5px]">
                  {o.items.map((i) => <li key={i.slug}><Link href={`/products/${i.slug}`} className="hover:underline">{i.title}</Link> <span className="text-subtle">{i.quantity > 1 ? ` × ${i.quantity}` : ""}</span></li>)}
                </ul>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px]">
                  {o.number && <Link href={`/dashboard/invoices/${o.id}`} className="text-accent-2">Invoice</Link>}
                  {r ? <span className="text-muted">Refund {r.status}{r.status === "rejected" ? "" : ` · ${eur2(r.amountCents)}`}</span> : o.status === "paid" && <RefundForm orderId={o.id} />}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
