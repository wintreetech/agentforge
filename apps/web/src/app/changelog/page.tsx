import type { Metadata } from "next";
import Link from "next/link";
import { getProducts } from "@/lib/catalog";
import { Badge, Container, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Changelog", alternates: { canonical: "/changelog" } };

const PLATFORM = [
  { date: "2026-11-25", title: "Marketplace foundation", notes: ["60-product catalogue with honest availability", "Shared AI execution engine with budgets and audit events", "Agent Studio with visual workflows and approvals", "Developer API: catalogue, licence verification, execution, usage"] },
];

export default async function Changelog() {
  const releases = (await getProducts()).flatMap((p) => p.changelog.map((c) => ({ ...c, product: p }))).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHeader eyebrow="Changelog" title="What's new" />
      <Container className="max-w-3xl py-12">
        <ol className="relative space-y-8 border-l border-border pl-6">
          {PLATFORM.map((p) => (
            <li key={p.title}>
              <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-accent" />
              <p className="text-[12.5px] text-subtle">{fmtDate(p.date)}</p>
              <p className="mt-1 font-semibold">{p.title} <Badge tone="accent">Platform</Badge></p>
              <ul className="mt-2 list-disc pl-5 text-[14px] text-muted">{p.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </li>
          ))}
          {releases.map((r) => (
            <li key={r.product.slug + r.version}>
              <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-accent-3" />
              <p className="text-[12.5px] text-subtle">{fmtDate(r.date)}</p>
              <p className="mt-1 font-semibold"><Link href={`/products/${r.product.slug}`} className="hover:underline">{r.product.title}</Link> v{r.version}</p>
              <ul className="mt-2 list-disc pl-5 text-[14px] text-muted">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </li>
          ))}
        </ol>
      </Container>
    </>
  );
}
