import { daysAgoIso } from "@/lib/utils";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { dailySeries } from "@/lib/series";
import { DashHeader } from "@/components/dash";
import { SimpleBars, TimeArea } from "@/components/charts";
import { Card, Stat } from "@/components/ui";

export const metadata = { title: "Usage analytics" };

export default async function Usage() {
  const user = await requireUser();
  const ex = await read((db) => db.executions.filter((e) => e.userId === user.id));
  const since = daysAgoIso(30);
  const recent = ex.filter((e) => e.createdAt >= since);
  const tokens = recent.reduce((s, e) => s + e.inputTokens + e.outputTokens, 0);
  const cost = recent.reduce((s, e) => s + e.costEur, 0);
  const byProduct = Object.entries(recent.reduce<Record<string, number>>((m, e) => ((m[e.slug] = (m[e.slug] ?? 0) + 1), m), {}))
    .map(([name, value]) => ({ name: name.replace(/^ai-/, ""), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  return (
    <>
      <DashHeader title="Usage analytics" intro="Last 30 days of runs in your workspace. Costs are estimates based on model prices; sandbox runs cost nothing." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Runs" value={recent.length} />
        <Stat label="Success rate" value={recent.length ? `${Math.round((recent.filter((e) => e.status === "succeeded").length / recent.length) * 100)}%` : "—"} />
        <Stat label="Tokens" value={tokens.toLocaleString("en")} />
        <Stat label="Est. provider cost" value={`€${cost.toFixed(3)}`} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5"><p className="mb-3 font-semibold">Runs per day</p><TimeArea data={dailySeries(recent, (e) => e.createdAt, () => 1)} dataKey="value" label="Runs" /></Card>
        <Card className="p-5"><p className="mb-3 font-semibold">Tokens per day</p><TimeArea data={dailySeries(recent, (e) => e.createdAt, (e) => e.inputTokens + e.outputTokens)} dataKey="value" label="Tokens" /></Card>
        <Card className="p-5 xl:col-span-2"><p className="mb-3 font-semibold">Runs by product</p>{byProduct.length ? <SimpleBars data={byProduct} label="Runs" /> : <p className="text-[13.5px] text-muted">No runs in the last 30 days.</p>}</Card>
      </div>
    </>
  );
}
