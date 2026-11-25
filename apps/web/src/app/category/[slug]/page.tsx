import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categories, getCategory, type CategorySlug } from "@agentforge/catalog";
import { getProducts } from "@/lib/catalog";
import { CatalogBrowser } from "@/components/catalog-browser";
import { Container, Eyebrow } from "@/components/ui";
import { eur } from "@/lib/utils";
import { JsonLd } from "@/components/json-ld";
import { env } from "@/lib/env";

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = getCategory((await params).slug);
  if (!c) return {};
  return { title: c.name, description: `${c.tagline} ${c.description}`.slice(0, 160), alternates: { canonical: `/category/${c.slug}` }, openGraph: { images: [`/assets/categories/${c.slug}.svg`] } };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const c = getCategory(slug);
  if (!c) notFound();
  const sp = await searchParams;
  const ps = (await getProducts()).filter((p) => p.category === slug);
  const prices = ps.map((p) => p.priceCents);
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Marketplace", item: `${env.appUrl}/marketplace` }, { "@type": "ListItem", position: 2, name: c.name, item: `${env.appUrl}/category/${c.slug}` }] }} />
      <section className="relative overflow-hidden border-b border-border">
        <Container className="grid grid-cols-1 [&>*]:min-w-0 items-center gap-8 py-12 lg:grid-cols-[1.1fr_1fr] lg:py-16">
          <div>
            <nav aria-label="Breadcrumb" className="text-[13px] text-subtle"><Link href="/marketplace" className="hover:text-fg">Marketplace</Link> / <span className="text-muted">{c.name}</span></nav>
            <Eyebrow className="mt-6">{c.navLabel}</Eyebrow>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{c.name}</h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted">{c.description}</p>
            <dl className="mt-6 flex flex-wrap gap-8 text-sm">
              <div><dt className="text-subtle">Products</dt><dd className="mt-0.5 text-lg font-semibold">{ps.length}</dd></div>
              <div><dt className="text-subtle">Available now</dt><dd className="mt-0.5 text-lg font-semibold">{ps.filter((p) => p.status === "published").length}</dd></div>
              <div><dt className="text-subtle">Price range</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums">{eur(Math.min(...prices))}–{eur(Math.max(...prices))}</dd></div>
            </dl>
          </div>
          <div className="relative aspect-[3/2] overflow-hidden rounded-3xl border border-border">
            <Image src={`/assets/categories/${c.slug}.svg`} alt={`${c.name} illustration`} fill priority sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover" />
          </div>
        </Container>
      </section>
      <Container className="py-10">
        <CatalogBrowser searchParams={sp} fixed={{ category: [slug as CategorySlug] }} basePath={`/category/${slug}`} />
      </Container>
    </>
  );
}
