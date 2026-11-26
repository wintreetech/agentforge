import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Code2, LifeBuoy, Receipt } from "lucide-react";
import { HELP } from "@/content/help";
import { Card, Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Help center", alternates: { canonical: "/help" } };

export default function Help() {
  return (
    <>
      <PageHeader eyebrow="Help center" title="How can we help?" />
      <Container className="py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/docs", icon: BookOpen, t: "Product documentation" },
            { href: "/how-it-works", icon: Code2, t: "How it works" },
            { href: "/legal/refunds", icon: Receipt, t: "Refunds" },
            { href: "/contact", icon: LifeBuoy, t: "Contact us" },
          ].map((c) => <Link key={c.href} href={c.href} className="rounded-2xl border border-border bg-surface p-5 transition hover:border-border-strong"><c.icon className="size-5 text-accent-2" /><p className="mt-3 font-medium">{c.t}</p></Link>)}
        </div>
        {HELP.map((s) => (
          <section key={s.section} className="mt-12">
            <h2 className="text-xl font-semibold">{s.section}</h2>
            <Card className="mt-4 divide-y divide-border">
              {s.items.map((i) => (
                <details key={i.q} className="group p-5">
                  <summary className="flex cursor-pointer list-none justify-between gap-4 font-medium">{i.q}<span className="text-subtle group-open:rotate-45" aria-hidden="true">+</span></summary>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">{i.a}</p>
                </details>
              ))}
            </Card>
          </section>
        ))}
      </Container>
    </>
  );
}
