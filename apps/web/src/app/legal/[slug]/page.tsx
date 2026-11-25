import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL } from "@/content/legal";
import { Markdown } from "@/components/markdown";
import { Container, Notice } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export function generateStaticParams() {
  return Object.keys(LEGAL).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = LEGAL[(await params).slug];
  return d ? { title: d.title, alternates: { canonical: `/legal/${(await params).slug}` } } : {};
}

export default async function Legal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = LEGAL[slug];
  if (!d) notFound();
  return (
    <Container className="grid grid-cols-1 [&>*]:min-w-0 gap-10 py-14 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Legal documents" className="space-y-1 text-[13.5px]">
        {Object.entries(LEGAL).map(([s, v]) => <Link key={s} href={`/legal/${s}`} aria-current={s === slug ? "page" : undefined} className={`block rounded-lg px-3 py-1.5 ${s === slug ? "bg-surface-2 font-medium" : "text-muted hover:text-fg"}`}>{v.title}</Link>)}
        <Link href="/security" className="block rounded-lg px-3 py-1.5 text-muted hover:text-fg">Security</Link>
      </nav>
      <article className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">{d.title}</h1>
        <p className="mt-2 text-[13px] text-subtle">Last updated {fmtDate(d.updated)}</p>
        <Notice tone="warning" className="mt-5" title="Draft — pending legal review">This document is a draft prepared for development. It must be reviewed by a qualified lawyer and completed before the marketplace launches.</Notice>
        <Markdown source={d.body} className="mt-6" />
      </article>
    </Container>
  );
}
