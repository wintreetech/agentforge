import type { Metadata } from "next";
import Link from "next/link";
import { RUNNABLE } from "@agentforge/product-registry/fields";
import { getAnonKey, getUser } from "@/lib/auth";
import { ownsProduct } from "@/lib/commerce";
import { availableModels, demoRunsToday } from "@/lib/execute";
import { read } from "@/lib/db";
import { ProductRunner } from "@/components/runner";
import { Card, Container, PageHeader } from "@/components/ui";
import { cn, fmtDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "AI Playground",
  description: "Test AgentForge AI products before you buy: resume builder, prompt optimizer, PDF summarizer, invoice extractor, knowledge base agent and multi-agent research team.",
  alternates: { canonical: "/playground" },
};

export default async function Playground({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product } = await searchParams;
  const demos = RUNNABLE.filter((r) => r.policy.demo.enabled);
  const meta = demos.find((d) => d.slug === product) ?? demos[0];
  const user = await getUser();
  const anon = user ? null : await getAnonKey();
  const owned = user ? await ownsProduct(user.id, meta.slug) : false;
  const [models, used, limit, history] = await Promise.all([
    availableModels(user?.id ?? null, !owned),
    demoRunsToday(user?.id ?? null, anon),
    read((db) => db.settings.demoRunsPerDay),
    user ? read((db) => db.executions.filter((e) => e.userId === user.id).slice(-8).reverse()) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader eyebrow="AI Playground" title="Test before you buy" intro={<>Run real products through the same engine used after purchase. Demo runs use the sandbox (no AI model, clearly labelled) and are limited to {limit} per 24 hours. Provider keys never reach your browser.</>} />
      <Container className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[240px_1fr]">
        <aside className="min-w-0">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-subtle">Products</p>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Playground products">
            {demos.map((d) => (
              <Link key={d.slug} href={`/playground?product=${d.slug}`} aria-current={d.slug === meta.slug ? "page" : undefined} className={cn("shrink-0 rounded-lg px-3 py-2 text-[13.5px] transition", d.slug === meta.slug ? "bg-surface-2 font-medium text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg")}>
                {d.title}
              </Link>
            ))}
          </nav>
          {user && history.length > 0 && (
            <div className="mt-8 hidden lg:block">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-subtle">Your recent runs</p>
              <ul className="space-y-1.5 text-[12.5px]">
                {history.map((h) => (
                  <li key={h.id}><Link href={`/dashboard/executions/${h.id}`} className="block truncate text-muted hover:text-fg">{h.status === "succeeded" ? "✓" : "✕"} {h.slug.replace(/^ai-/, "")} · {fmtDateTime(h.createdAt)}</Link></li>
                ))}
              </ul>
            </div>
          )}
          {!user && <p className="mt-6 text-[12.5px] text-subtle"><Link href="/signin?next=/playground" className="text-accent-2 underline">Sign in</Link> to keep a session history.</p>}
        </aside>
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{meta.title}</h2>
            <Link href={`/products/${meta.slug}`} className="text-[13.5px] text-accent-2">Product details →</Link>
          </div>
          <Card className="p-5 sm:p-6">
            <ProductRunner meta={meta} models={models} mode={owned ? "owned" : "demo"} demoLeft={Math.max(0, limit - used)} key={meta.slug} />
          </Card>
        </div>
      </Container>
    </>
  );
}
