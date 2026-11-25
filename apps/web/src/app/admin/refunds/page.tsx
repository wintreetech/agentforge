import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { decideRefundAction } from "@/app/actions/admin";
import { DashHeader } from "@/components/dash";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import { eur2, fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Refunds" };

export default async function AdminRefunds() {
  await requireAdmin();
  const [refunds, orders] = await read((db) => [db.refunds.slice().reverse(), db.orders]);
  return (
    <>
      <DashHeader title="Refunds" intro="Approving sends the refund through the payment provider. Access is revoked when the provider confirms the refund by webhook." />
      {refunds.length === 0 ? <EmptyState title="No refund requests" /> : (
        <div className="space-y-3">
          {refunds.map((r) => {
            const o = orders.find((x) => x.id === r.orderId);
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{o?.number ?? r.orderId}</p><Badge tone={r.status === "requested" ? "warning" : r.status === "rejected" ? "danger" : "success"}>{r.status}</Badge><span className="text-[12.5px] text-subtle">{o?.email} · {fmtDateTime(r.createdAt)}</span><span className="ml-auto font-semibold tabular-nums">{eur2(r.amountCents)}</span></div>
                <p className="mt-2 text-[14px] text-muted">“{r.reason}”</p>
                <p className="mt-1 text-[12.5px] text-subtle">{o?.items.map((i) => i.title).join(", ")}</p>
                {r.status === "requested" && (
                  <div className="mt-3 flex gap-2">
                    <form action={decideRefundAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approve" /><button className={buttonClass("primary", "sm")}>Approve & refund</button></form>
                    <form action={decideRefundAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="reject" /><button className={buttonClass("outline", "sm")}>Reject</button></form>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
