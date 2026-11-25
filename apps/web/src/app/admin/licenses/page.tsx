import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { revokeLicenseAction } from "@/app/actions/admin";
import { DashHeader } from "@/components/dash";
import { Badge, Input, Table, buttonClass } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Licences" };

export default async function AdminLicenses() {
  await requireAdmin();
  const rows = await read((db) => db.licenseKeys.map((k) => ({ ...k, email: db.users.find((u) => u.id === k.userId)?.email ?? "—" })).reverse());
  return (
    <>
      <DashHeader title="Licences" intro="Revoke only where the licence agreement permits it (e.g. chargebacks, abuse). A reason is required and recorded in the audit log." />
      <Table>
        <thead><tr><th>Key</th><th>Product</th><th>Customer</th><th>Licence</th><th>Status</th><th>Issued</th><th /></tr></thead>
        <tbody>
          {rows.map((k) => (
            <tr key={k.key}>
              <td className="font-mono text-[12px]">{k.key}</td>
              <td>{k.slug}</td>
              <td className="text-muted">{k.email}</td>
              <td>{k.license}</td>
              <td><Badge tone={k.status === "active" ? "success" : "danger"}>{k.status}</Badge></td>
              <td className="text-muted">{fmtDate(k.createdAt)}</td>
              <td>
                {k.status === "active" && (
                  <form action={revokeLicenseAction} className="flex gap-1.5">
                    <input type="hidden" name="key" value={k.key} />
                    <label htmlFor={`rr-${k.key}`} className="sr-only">Reason</label>
                    <Input id={`rr-${k.key}`} name="reason" placeholder="Reason" required minLength={5} className="h-8 w-36 text-[12.5px]" />
                    <button className={buttonClass("danger", "sm")}>Revoke</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
