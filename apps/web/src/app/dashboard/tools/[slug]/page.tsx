import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRunnable } from "@agentforge/product-registry/fields";
import { requireUser } from "@/lib/auth";
import { creditBalance, ownsProduct } from "@/lib/commerce";
import { availableModels } from "@/lib/execute";
import { read } from "@/lib/db";
import { getProduct } from "@/lib/catalog";
import { ProductRunner } from "@/components/runner";
import { DashHeader } from "@/components/dash";
import { Card, Notice } from "@/components/ui";

export default async function RunTool({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/dashboard/tools/${slug}`);
  const [p, meta] = [await getProduct(slug), getRunnable(slug)];
  if (!p || !meta) notFound();
  if (meta.policy.kind === "download") redirect("/dashboard/downloads");
  // Server-side entitlement check: owning the product is required here.
  if (!(await ownsProduct(user.id, slug))) redirect(`/products/${slug}?error=${encodeURIComponent("Purchase this product to use it in your dashboard. You can try it in the Playground.")}`);
  const [models, credits, kbs] = await Promise.all([availableModels(user.id, false), creditBalance(user.id), read((db) => db.knowledgeBases.filter((k) => k.userId === user.id).map((k) => ({ id: k.id, name: k.name })))]);
  return (
    <>
      <DashHeader title={p.title} intro={<>Version {p.version}. <Link href={`/docs/products/${slug}`} className="text-accent-2">Documentation</Link>{meta.agents && <> · <Link href="/dashboard/studio" className="text-accent-2">Configure in Agent Studio</Link></>}</>} />
      {credits <= 0 && <Notice tone="warning" className="mb-4">You have no credits left. Sandbox runs are free; live-model runs need credits or your own API key (Integrations).</Notice>}
      <Card className="p-5 sm:p-6">
        <ProductRunner meta={meta} models={models} mode="owned" kbs={kbs} creditsLeft={credits} />
      </Card>
    </>
  );
}
