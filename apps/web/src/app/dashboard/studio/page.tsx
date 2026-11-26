import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { createConfigAction } from "@/app/actions/studio";
import { DashHeader } from "@/components/dash";
import { Badge, Card, EmptyState, LinkButton, Notice, buttonClass } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Agent Studio" };

const STUDIO = [
  { slug: "ai-knowledge-base-agent", title: "AI Knowledge Base Agent" },
];

export default async function Studio({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const [configs, owned, runs] = await read((db) => [
    db.agentConfigs.filter((c) => c.userId === user.id),
    db.entitlements.filter((e) => e.userId === user.id && e.status === "active").map((e) => e.slug),
    db.studioRuns.filter((r) => r.userId === user.id),
  ]);
  const ownedStudio = STUDIO.filter((s) => owned.includes(s.slug));
  return (
    <>
      <DashHeader title="Agent Studio" intro="Configure purchased agents: instructions, model, knowledge, memory, tools, schedules, webhooks and a visual workflow with approval steps." />
      {sp.error && <Notice tone="danger" className="mb-4">You need to own that agent to configure it.</Notice>}
      <div data-tour="studio" className="relative mb-6 overflow-hidden rounded-2xl border border-border">
        <Image src="/assets/pages/studio.svg" alt="" width={1200} height={300} className="h-36 w-full object-cover" />
        <div className="absolute inset-0 flex items-center bg-gradient-to-r from-black/70 to-transparent p-6 text-white">
          <div><p className="text-lg font-semibold">Visual workflows with guardrails</p><p className="text-sm opacity-80">AI model · retrieval · extraction · API request · condition · approval · formatting · handoff</p></div>
        </div>
      </div>
      {ownedStudio.length === 0 ? (
        <EmptyState title="No configurable agents yet" action={<LinkButton href="/products/ai-knowledge-base-agent">See the Knowledge Base Agent</LinkButton>}>
          Agent Studio works with agents you own. The Knowledge Base Agent is available now.
        </EmptyState>
      ) : (
        <Card className="p-5">
          <p className="font-semibold">New workflow</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ownedStudio.map((s) => (
              <form key={s.slug} action={createConfigAction}><input type="hidden" name="slug" value={s.slug} /><button className={buttonClass("outline", "sm")}>+ {s.title}</button></form>
            ))}
          </div>
        </Card>
      )}
      {configs.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {configs.map((c) => {
            const rs = runs.filter((r) => r.configId === c.id);
            const waiting = rs.filter((r) => r.status === "awaiting_approval").length;
            return (
              <Link key={c.id} href={`/dashboard/studio/${c.id}`} className="rounded-2xl border border-border bg-surface p-5 transition hover:border-border-strong">
                <div className="flex items-center gap-2"><p className="font-semibold">{c.name}</p>{waiting > 0 && <Badge tone="warning">{waiting} awaiting approval</Badge>}</div>
                <p className="mt-1 text-[13px] text-muted">{c.graph.nodes.length} nodes · {c.model} · schedule {c.schedule} · {rs.length} runs</p>
                <p className="mt-1 text-[12px] text-subtle">Updated {fmtDateTime(c.updatedAt)}</p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
