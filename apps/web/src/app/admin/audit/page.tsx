import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { DashHeader } from "@/components/dash";
import { Input, Table } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Audit log" };

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const rows = await read((db) => db.audit.filter((a) => !q || a.action.includes(q) || a.target.includes(q) || a.actorId === q).slice(-500).reverse().map((a) => ({ ...a, actor: db.users.find((u) => u.id === a.actorId)?.email ?? (a.actorId ? a.actorId : "system") })));
  return (
    <>
      <DashHeader title="Audit log" intro="Security- and money-relevant events: sign-ins, purchases, webhooks, refunds, admin changes, downloads, Studio runs. Append-only; there is no control to disable it." />
      <form className="mb-4 max-w-sm"><label htmlFor="aq" className="sr-only">Filter</label><Input id="aq" name="q" defaultValue={q} placeholder="Filter by action, target or actor id" /></form>
      <Table>
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
        <tbody>{rows.map((a) => <tr key={a.id}><td className="whitespace-nowrap text-muted">{fmtDateTime(a.at)}</td><td className="text-[12.5px]">{a.actor}</td><td className="font-mono text-[12px]">{a.action}</td><td className="max-w-48 truncate font-mono text-[12px]">{a.target}</td><td className="max-w-72 truncate font-mono text-[11.5px] text-subtle">{a.meta ? JSON.stringify(a.meta) : ""}</td></tr>)}</tbody>
      </Table>
    </>
  );
}
