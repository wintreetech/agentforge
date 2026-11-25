import Link from "next/link";
import { History } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { DashHeader } from "@/components/dash";
import { Badge, EmptyState, Table } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Execution history" };

export default async function Executions() {
  const user = await requireUser();
  const [runs, studio] = await read((db) => [db.executions.filter((e) => e.userId === user.id).slice(-200).reverse(), db.studioRuns.filter((r) => r.userId === user.id).slice(-50).reverse()]);
  return (
    <>
      <DashHeader title="Execution history" intro="Every product run and Agent Studio workflow run, with steps, tokens and cost." />
      {runs.length + studio.length === 0 ? (
        <EmptyState icon={<History className="size-5" />} title="No runs yet" />
      ) : (
        <div className="space-y-8">
          {runs.length > 0 && (
            <Table>
              <thead><tr><th>Product</th><th>Status</th><th>Mode</th><th>Model</th><th className="text-right">Tokens</th><th className="text-right">Cost</th><th>When</th></tr></thead>
              <tbody>
                {runs.map((e) => (
                  <tr key={e.id}>
                    <td><Link href={`/dashboard/executions/${e.id}`} className="font-medium hover:underline">{e.slug}</Link></td>
                    <td><Badge tone={e.status === "succeeded" ? "success" : "danger"}>{e.status}</Badge></td>
                    <td>{e.mode}{e.simulated && <Badge tone="cyan" className="ml-1.5">sandbox</Badge>}</td>
                    <td className="text-muted">{e.model}</td>
                    <td className="text-right tabular-nums">{(e.inputTokens + e.outputTokens).toLocaleString("en")}</td>
                    <td className="text-right tabular-nums">€{e.costEur.toFixed(4)}</td>
                    <td className="text-muted">{fmtDateTime(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {studio.length > 0 && (
            <div>
              <h2 className="mb-3 font-semibold">Agent Studio runs</h2>
              <Table>
                <thead><tr><th>Run</th><th>Status</th><th>Trigger</th><th className="text-right">Steps</th><th>When</th></tr></thead>
                <tbody>
                  {studio.map((r) => (
                    <tr key={r.id}>
                      <td><Link href={`/dashboard/studio/${r.configId}?run=${r.id}`} className="font-medium hover:underline">{r.id}</Link></td>
                      <td><Badge tone={r.status === "completed" ? "success" : r.status === "failed" ? "danger" : "warning"}>{r.status.replace("_", " ")}</Badge></td>
                      <td>{r.trigger}</td>
                      <td className="text-right tabular-nums">{r.steps}</td>
                      <td className="text-muted">{fmtDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
