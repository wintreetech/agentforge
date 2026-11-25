import type { Metadata } from "next";
import Link from "next/link";
import { allIntegrations } from "@agentforge/catalog";
import { getProducts } from "@/lib/catalog";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Integration directory", description: "Tools and platforms supported by AgentForge AI products.", alternates: { canonical: "/integrations" } };

export default async function Integrations() {
  const products = await getProducts();
  const list = allIntegrations(products).map((i) => ({ name: i, products: products.filter((p) => p.integrations.includes(i)) })).sort((a, b) => b.products.length - a.products.length);
  return (
    <>
      <PageHeader eyebrow="Integrations" title="Integration directory" intro="Every integration referenced by a product in the catalogue, with the products that use it. Third-party names describe compatibility and are trademarks of their owners; no endorsement is implied." />
      <Container className="py-12">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((i) => (
            <div key={i.name} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between"><p className="font-medium">{i.name}</p><span className="text-[12px] text-subtle">{i.products.length} product{i.products.length === 1 ? "" : "s"}</span></div>
              <ul className="mt-2 space-y-0.5 text-[13px]">
                {i.products.slice(0, 4).map((p) => <li key={p.slug}><Link href={`/products/${p.slug}`} className="text-muted hover:text-fg">{p.title}</Link>{p.status === "published" && <span className="ml-1.5 text-[11px] text-success">available</span>}</li>)}
                {i.products.length > 4 && <li><Link href={`/marketplace?integration=${encodeURIComponent(i.name)}`} className="text-accent-2">+{i.products.length - 4} more</Link></li>}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </>
  );
}
