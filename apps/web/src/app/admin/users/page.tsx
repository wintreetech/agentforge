import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { setRoleAction } from "@/app/actions/admin";
import { DashHeader } from "@/components/dash";
import { Badge, Table, buttonClass } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Users & roles" };

export default async function AdminUsers() {
  const me = await requireAdmin();
  const rows = await read((db) => db.users.filter((u) => !u.deletedAt).map((u) => ({ ...u, orders: db.orders.filter((o) => o.userId === u.id && o.status === "paid").length, runs: db.executions.filter((e) => e.userId === u.id).length })).reverse());
  return (
    <>
      <DashHeader title="Users & roles" intro="Roles: customer (workspace owner) and platform admin. Admin access is enforced server-side on every admin page and action. Demoting a user signs them out." />
      <Table>
        <thead><tr><th>User</th><th>Verified</th><th>Role</th><th className="text-right">Paid orders</th><th className="text-right">Runs</th><th>Joined</th><th /></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td><span className="font-medium">{u.name}</span><span className="block text-[12px] text-subtle">{u.email}</span></td>
              <td>{u.emailVerifiedAt ? <Badge tone="success">yes</Badge> : <Badge>no</Badge>}</td>
              <td><Badge tone={u.role === "admin" ? "accent" : "neutral"}>{u.role}</Badge></td>
              <td className="text-right tabular-nums">{u.orders}</td>
              <td className="text-right tabular-nums">{u.runs}</td>
              <td className="text-muted">{fmtDate(u.createdAt)}</td>
              <td className="text-right">
                {u.id !== me.id && (
                  <form action={setRoleAction}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="role" value={u.role === "admin" ? "customer" : "admin"} /><button className={buttonClass("ghost", "sm")}>{u.role === "admin" ? "Remove admin" : "Make admin"}</button></form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
