import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { createCouponAction, toggleCouponAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/forms";
import { DashHeader } from "@/components/dash";
import { Badge, Card, Input, Label, Select, Table, buttonClass } from "@/components/ui";
import { eur2, fmtDate } from "@/lib/utils";

export const metadata = { title: "Coupons" };

export default async function AdminCoupons() {
  await requireAdmin();
  const coupons = await read((db) => db.coupons.slice().reverse());
  return (
    <>
      <DashHeader title="Coupons" />
      <Card className="p-5">
        <ActionForm action={createCouponAction} className="grid gap-3 sm:grid-cols-[1fr_130px_110px_130px_150px_auto] sm:items-end" resetOnSuccess>
          <div><Label htmlFor="cc">Code</Label><Input id="cc" name="code" required placeholder="SPRING20" /></div>
          <div><Label htmlFor="ck">Type</Label><Select id="ck" name="kind"><option value="percent">Percent</option><option value="fixed">Fixed (€)</option></Select></div>
          <div><Label htmlFor="cv">Value</Label><Input id="cv" name="value" type="number" step="0.01" min="0.01" required /></div>
          <div><Label htmlFor="cm">Max uses</Label><Input id="cm" name="maxRedemptions" type="number" min="1" /></div>
          <div><Label htmlFor="ce">Expires</Label><Input id="ce" name="expiresAt" type="date" /></div>
          <SubmitButton>Create</SubmitButton>
        </ActionForm>
      </Card>
      <Table className="mt-6">
        <thead><tr><th>Code</th><th>Discount</th><th>Used</th><th>Expires</th><th>Status</th><th /></tr></thead>
        <tbody>
          {coupons.map((c) => (
            <tr key={c.id}>
              <td className="font-mono font-medium">{c.code}{c.note && <span className="block font-sans text-[11.5px] text-subtle">{c.note}</span>}</td>
              <td>{c.kind === "percent" ? `${c.value}%` : eur2(c.value)}</td>
              <td className="tabular-nums">{c.redemptions ?? 0}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</td>
              <td className="text-muted">{c.expiresAt ? fmtDate(c.expiresAt) : "Never"}</td>
              <td><Badge tone={c.active ? "success" : "neutral"}>{c.active ? "active" : "inactive"}</Badge></td>
              <td className="text-right"><form action={toggleCouponAction}><input type="hidden" name="id" value={c.id} /><button className={buttonClass("ghost", "sm")}>{c.active ? "Deactivate" : "Activate"}</button></form></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
