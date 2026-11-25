import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { recommend } from "@agentforge/catalog";
import { getProducts } from "@/lib/catalog";
import { ProblemSearch } from "@/components/problem-search";
import { StatusBadge } from "@/components/product-card";
import { Card, Container, Notice, PageHeader } from "@/components/ui";
import { eur } from "@/lib/utils";

export const metadata: Metadata = { title: "Product assistant", description: "Describe your business and budget; get recommendations from the real AgentForge catalogue." };

export default async function Assistant({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const products = await getProducts();
  const r = q && q.trim().length > 3 ? recommend(products, q.slice(0, 600), { limit: 8 }) : null;
  return (
    <>
      <PageHeader eyebrow="Product assistant" title="Tell us what you need. We'll find what exists." intro="The assistant searches the actual catalogue, respects your budget and explains running costs. It never invents products, prices or capabilities. Anything not yet available is labelled." />
      <Container className="py-10">
        <ProblemSearch large />
        {r && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold">Results for “{q}”</h2>
            <p className="mt-1 text-[13.5px] text-muted">
              {r.needs.length ? <>Needs: {r.needs.join(", ")}.</> : "No specific need detected; showing best text matches."} {r.budgetEur != null && <>Budget: €{r.budgetEur}.</>}
            </p>
            {r.notes.map((n) => <Notice key={n} className="mt-3">{n}</Notice>)}
            <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[720px] text-left text-[13.5px]">
                <thead className="bg-surface-2/60 text-[12px] text-muted"><tr><th className="p-3">Product</th><th className="p-3">Why</th><th className="p-3">Status</th><th className="p-3">Running cost / run</th><th className="p-3 text-right">Price</th></tr></thead>
                <tbody>
                  {r.recommendations.map(({ product: p, reasons }) => (
                    <tr key={p.slug} className="border-t border-border">
                      <td className="p-3"><Link href={`/products/${p.slug}`} className="flex items-center gap-3 font-medium hover:underline"><Image src={p.thumbnail} alt="" width={72} height={48} className="rounded-md" />{p.title}</Link></td>
                      <td className="p-3 text-muted">{reasons.filter((x) => !/Available|Coming|provider cost/.test(x)).join(" · ") || "Text match"}</td>
                      <td className="p-3"><StatusBadge status={p.status} /></td>
                      <td className="p-3 tabular-nums text-muted">{p.costPerRunEur ? `€${p.costPerRunEur[0].toFixed(3)}–€${p.costPerRunEur[1].toFixed(2)}` : "—"}</td>
                      <td className="p-3 text-right font-semibold tabular-nums">{eur(p.priceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.bundle && (
              <Card className="mt-6 p-5">
                <p className="font-semibold">Suggested combination within budget</p>
                <p className="mt-1 text-[14px] text-muted">{r.bundle.items.map((b) => b.title).join(" + ")}</p>
                <p className="mt-2 text-lg font-semibold">Total €{r.bundle.totalEur}</p>
                <Link href={`/compare?ids=${r.bundle.items.map((b) => b.slug).join(",")}`} className="mt-3 inline-block text-[13.5px] text-accent-2">Compare these →</Link>
              </Card>
            )}
          </div>
        )}
      </Container>
    </>
  );
}
