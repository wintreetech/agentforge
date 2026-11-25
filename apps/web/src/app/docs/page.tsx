import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getProducts } from "@/lib/catalog";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Documentation", alternates: { canonical: "/docs" } };

export default async function Docs() {
  const products = (await getProducts()).filter((p) => p.functional);
  return (
    <>
      <PageHeader eyebrow="Documentation" title="Product documentation" intro="Set-up, inputs, outputs, limits and troubleshooting for every available product." />
      <Container className="py-12">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link key={p.slug} href={`/docs/products/${p.slug}`} className="flex gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-border-strong">
              <BookOpen className="mt-0.5 size-4 shrink-0 text-accent-2" />
              <span><span className="block font-medium">{p.title}</span><span className="text-[13px] text-muted">v{p.version}</span></span>
            </Link>
          ))}
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[["/developers", "Developer portal", "REST API, authentication, rate limits"], ["/dashboard/studio", "Agent Studio", "Visual workflows, approvals, schedules"], ["/help", "Help center", "Buying, credits, accounts"]].map(([h, t, d]) => (
            <Link key={h} href={h} className="rounded-2xl border border-border p-5 hover:border-border-strong"><p className="font-semibold">{t}</p><p className="mt-1 text-[13.5px] text-muted">{d}</p></Link>
          ))}
        </div>
      </Container>
    </>
  );
}
