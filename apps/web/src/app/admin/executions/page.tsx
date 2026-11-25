import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { dailySeries } from "@/lib/series";
import { DashHeader } from "@/components/dash";
import { TimeArea } from "@/components/charts";
import { Badge, Card, Stat, Table } from "@/components/ui";
import { fmtDateTime, daysAgoIso } from "@/lib/utils";

export const metadata = { title: "Executions & cost" };

export default async function AdminExecutions() {
  await requireAdmin();
  const [ex, studio] = await read((db) => [db.executions.slice(-2000), db.studioRuns.slice(-200)]);
  const since = daysAgoIso(30);
  const recent = ex.filter((e) => e.createdAt >= since);
  const byProvider = recent.reduce<Record<string, { runs: number; cost: number; tokens: number }>>((m, e) => {
    m[e.provider] ??= { runs: 0, cost: 0, tokens: 0 };
    m[e.provider].runs++;
    m[e.provider].cost += e.costEur;
    m[e.provider].tokens += e.inputTokens + e.outputTokens;
    return m;
  }, {});
  const failed = recent.filter((e) => e.status !== "succeeded");
  return (
    <>
      <DashHeader title="Executions & cost" intro="Agent execution monitoring and AI usage cost (estimated from model price tables)." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Runs (30d)" value={recent.length} />
        <Stat label="Failure rate" value={recent.length ? `${Math.round((failed.length / recent.length) * 100)}%` : "—"} />
        <Stat label="Est. AI cost (30d)" value={`€${recent.reduce((s, e) => s + e.costEur, 0).toFixed(3)}`} />
        <Stat label="Studio runs awaiting approval" value={studio.filter((r) => r.status === "awaiting_approval").length} />
      </div>
      <Card className="mt-6 p-5"><p className="mb-3 font-semibold">AI cost per day (EUR)</p><TimeArea data={dailySeries(recent, (e) => e.createdAt, (e) => e.costEur)} dataKey="value" label="Cost" format="eur" /></Card>
      <h2 className="mb-3 mt-8 font-semibold">By provider (30d)</h2>
      <Table><thead><tr><th>Provider</th><th className="text-right">Runs</th><th className="text-right">Tokens</th><th className="text-right">Est. cost</th></tr></thead><tbody>{Object.entries(byProvider).map(([p, v]) => <tr key={p}><td>{p}</td><td className="text-right tabular-nums">{v.runs}</td><td className="text-right tabular-nums">{v.tokens.toLocaleString("en")}</td><td className="text-right tabular-nums">€{v.cost.toFixed(4)}</td></tr>)}</tbody></Table>
      <h2 className="mb-3 mt-8 font-semibold">Recent failures</h2>
      <Table>
        <thead><tr><th>When</th><th>Product</th><th>Mode</th><th>Error</th></tr></thead>
        <tbody>{failed.slice(-50).reverse().map((e) => <tr key={e.id}><td className="text-muted">{fmtDateTime(e.createdAt)}</td><td>{e.slug}</td><td><Badge>{e.mode}</Badge></td><td className="text-[12.5px] text-danger">{e.error}</td></tr>)}</tbody>
      </Table>
    </>
  );
}
