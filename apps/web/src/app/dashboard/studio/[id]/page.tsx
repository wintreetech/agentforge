import { notFound } from "next/navigation";
import { MODELS } from "@agentforge/ai-engine/models";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { env } from "@/lib/env";
import { NODE_TYPES } from "@/lib/studio";
import { providerKeysFor } from "@/lib/execute";
import { configuredProviders } from "@agentforge/ai-engine";
import { deleteConfigAction, rotateWebhookAction } from "@/app/actions/studio";
import { DashHeader } from "@/components/dash";
import { Card, buttonClass } from "@/components/ui";
import { StudioEditor } from "./studio-editor";

export default async function StudioConfig({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
  const { id } = await params;
  const { run } = await searchParams;
  const user = await requireUser();
  const [cfg, kbs, runs, owned] = await read((db) => [
    db.agentConfigs.find((c) => c.id === id && c.userId === user.id),
    db.knowledgeBases.filter((k) => k.userId === user.id).map((k) => ({ id: k.id, name: k.name })),
    db.studioRuns.filter((r) => r.configId === id && r.userId === user.id).slice(-15).reverse(),
    db.entitlements.filter((e) => e.userId === user.id && e.status === "active").map((e) => e.slug),
  ]);
  if (!cfg) notFound();
  const configured = configuredProviders(await providerKeysFor(user.id));
  const models = MODELS.map((m) => ({ id: m.id, label: m.label, available: configured.includes(m.provider) }));
  const initialRun = run ? runs.find((r) => r.id === run) ?? null : runs[0] ?? null;
  return (
    <>
      <DashHeader
        title={cfg.name}
        intro="Edit the workflow graph, configure the agent, then run it. Approval nodes and API requests pause the run until you decide."
        actions={<form action={deleteConfigAction}><input type="hidden" name="id" value={cfg.id} /><button className={buttonClass("danger", "sm")}>Delete</button></form>}
      />
      <StudioEditor
        config={{ id: cfg.id, name: cfg.name, instructions: cfg.instructions, model: cfg.model, tools: cfg.tools, kbId: cfg.kbId, memory: cfg.memory, memoryNotes: cfg.memoryNotes, schedule: cfg.schedule, scheduleInput: cfg.scheduleInput, allowedHosts: cfg.allowedHosts, graph: cfg.graph }}
        kbs={kbs}
        models={models}
        nodeTypes={Object.entries(NODE_TYPES).map(([k, v]) => ({ type: k, ...v }))}
        ownedProducts={owned}
        initialRun={initialRun}
        recentRuns={runs.map((r) => ({ id: r.id, status: r.status, createdAt: r.createdAt, trigger: r.trigger }))}
      />
      <Card className="mt-6 p-5">
        <p className="font-semibold">Webhook trigger</p>
        <p className="mt-1 text-[13px] text-muted">POST JSON <code className="font-mono">{`{"input": "..."}`}</code> to start a run. The run stops at approval nodes; approve it here.</p>
        <code className="mt-3 block select-all break-all rounded-lg bg-surface-2 p-3 font-mono text-[12.5px]">{`${env.appUrl}/api/hooks/studio/${cfg.webhookToken}`}</code>
        <form action={rotateWebhookAction} className="mt-3"><input type="hidden" name="id" value={cfg.id} /><button className={buttonClass("outline", "sm")}>Rotate webhook URL</button></form>
      </Card>
    </>
  );
}
