import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { blogPosts } from "@/content/blog-data";
import { Badge, Container, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Blog", description: "Guides on AI agents, automation, pricing transparency and building with MCP.", alternates: { canonical: "/blog" } };

export default function Blog() {
  const [first, ...rest] = blogPosts;
  return (
    <>
      <PageHeader eyebrow="Blog" title="Notes on building with AI, honestly" intro="How our products work, how we price them and how to build your own." />
      <Container className="py-12">
        <Link href={`/blog/${first.slug}`} className="group grid overflow-hidden rounded-3xl border border-border bg-surface md:grid-cols-2">
          <div className="relative aspect-[3/2]"><Image src={`/assets/blog/${first.slug}.svg`} alt="" fill sizes="50vw" className="object-cover transition duration-700 group-hover:scale-[1.02]" priority /></div>
          <div className="flex flex-col justify-center p-8">
            <Badge className="self-start">{first.tag}</Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">{first.title}</h2>
            <p className="mt-2 text-muted">{first.excerpt}</p>
            <p className="mt-4 text-[13px] text-subtle">{fmtDate(first.date)} · {first.readMinutes} min read</p>
          </div>
        </Link>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {rest.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="relative aspect-[3/2]"><Image src={`/assets/blog/${p.slug}.svg`} alt="" fill sizes="33vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" /></div>
              <div className="p-5">
                <Badge>{p.tag}</Badge>
                <h3 className="mt-2 font-semibold leading-snug">{p.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-[13.5px] text-muted">{p.excerpt}</p>
                <p className="mt-3 text-[12.5px] text-subtle">{fmtDate(p.date)} · {p.readMinutes} min</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
