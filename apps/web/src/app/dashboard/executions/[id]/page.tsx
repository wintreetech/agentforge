import { notFound } from "next/navigation";
import { Check, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { DashHeader } from "@/components/dash";
import { Markdown } from "@/components/markdown";
import { Badge, Card, Notice } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { ExportButtons } from "./export-buttons";

export default async function Execution({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  // Tenant isolation: only the owner's runs are visible.
  const e = await read((db) => db.executions.find((x) => x.id === id && x.userId === user.id));
  if (!e) notFound();
  return (
    <>
      <DashHeader title={e.slug} intro={`${fmtDateTime(e.createdAt)} · ${e.model} · ${e.mode} run`} actions={e.output ? <ExportButtons name={`${e.slug}-${e.id}`} markdown={e.output} /> : undefined} />
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          {e.simulated && <Notice tone="sandbox">Simulated output (sandbox) — produced by deterministic code, not an AI model.</Notice>}
          {e.error && <Notice tone="danger">{e.error}</Notice>}
          {e.output && <Card className="p-5"><Markdown source={e.output} /></Card>}
        </div>
        <div className="space-y-4">
          <Card className="p-5 text-[13.5px]">
            <p className="font-semibold">Run details</p>
            <dl className="mt-3 space-y-1.5">
              {[["Status", <Badge key="s" tone={e.status === "succeeded" ? "success" : "danger"}>{e.status}</Badge>], ["Duration", `${(e.ms / 1000).toFixed(2)}s`], ["Input tokens", e.inputTokens], ["Output tokens", e.outputTokens], ["Est. cost", `€${e.costEur.toFixed(4)}`], ["Credits", e.credits]].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="tabular-nums">{v}</dd></div>
              ))}
            </dl>
          </Card>
          <Card className="p-5">
            <p className="text-[13.5px] font-semibold">Steps</p>
            <ol className="mt-3 space-y-2 text-[13px]">
              {e.steps.map((s) => (
                <li key={s.id} className="flex gap-2">
                  {s.status === "done" ? <Check className="mt-0.5 size-3.5 text-success" /> : <XCircle className="mt-0.5 size-3.5 text-danger" />}
                  <span className="flex-1">{s.agent && <span className="text-subtle">{s.agent} · </span>}{s.label}{s.detail && <span className="block text-[12px] text-subtle">{s.detail}</span>}</span>
                  <span className="font-mono text-[11.5px] text-subtle">{s.ms ?? 0}ms</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="p-5"><p className="text-[13.5px] font-semibold">Input (preview)</p><pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[11.5px] text-muted">{e.inputPreview}</pre></Card>
        </div>
      </div>
    </>
  );
}
