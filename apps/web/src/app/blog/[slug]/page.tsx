import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { blogPosts } from "@/content/blog-data";
import { Markdown } from "@/components/markdown";
import { JsonLd } from "@/components/json-ld";
import { Badge, Container } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { env } from "@/lib/env";

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = blogPosts.find((x) => x.slug === slug);
  return p ? { title: p.title, description: p.excerpt, alternates: { canonical: `/blog/${p.slug}` }, openGraph: { type: "article", publishedTime: p.date, images: [`/assets/blog/${p.slug}.svg`] } } : {};
}

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = blogPosts.find((x) => x.slug === slug);
  if (!p) notFound();
  const more = blogPosts.filter((x) => x.slug !== slug).slice(0, 2);
  return (
    <Container className="max-w-3xl py-12">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, datePublished: p.date, description: p.excerpt, image: `${env.appUrl}/assets/blog/${p.slug}.svg`, publisher: { "@type": "Organization", name: "AgentForge AI" } }} />
      <Link href="/blog" className="text-[13px] text-subtle hover:text-fg">← Blog</Link>
      <Badge className="mt-6">{p.tag}</Badge>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">{p.title}</h1>
      <p className="mt-3 text-[13.5px] text-subtle">{fmtDate(p.date)} · {p.readMinutes} min read · AgentForge AI team</p>
      <div className="relative mt-8 aspect-[2/1] overflow-hidden rounded-3xl border border-border"><Image src={`/assets/blog/${p.slug}.svg`} alt="" fill priority sizes="768px" className="object-cover" /></div>
      <Markdown source={p.body} className="mt-8 text-[16px]" />
      <hr className="my-12 border-border" />
      <p className="font-semibold">Keep reading</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{more.map((m) => <Link key={m.slug} href={`/blog/${m.slug}`} className="rounded-2xl border border-border p-4 hover:border-border-strong"><p className="font-medium">{m.title}</p><p className="mt-1 text-[13px] text-muted">{m.excerpt}</p></Link>)}</div>
    </Container>
  );
}
