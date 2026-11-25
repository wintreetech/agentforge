import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2, Eye, Scale, ShieldCheck } from "lucide-react";
import { Card, Container, LinkButton, PageHeader, SectionHeading } from "@/components/ui";

export const metadata: Metadata = { title: "About", description: "Why AgentForge AI exists and the principles behind the marketplace.", alternates: { canonical: "/about" } };

export default function About() {
  return (
    <>
      <PageHeader eyebrow="About" title="We sell AI products that actually work." intro="AgentForge AI is a marketplace for AI tools, agents and automation systems, built on one principle: a product is listed as available only when its deliverable is finished and tested." />
      <Container className="grid items-center gap-12 py-16 lg:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border"><Image src="/assets/pages/about.svg" alt="" fill sizes="50vw" className="object-cover" /></div>
        <div>
          <SectionHeading eyebrow="Why we exist" title="AI tooling has a trust problem" intro="Too many AI products are demos dressed as software: invented metrics, hidden running costs and features that only work in screenshots. We wanted a marketplace where what you see is what runs." />
          <p className="mt-4 text-[15px] leading-relaxed text-muted">Every hosted product runs on one shared execution engine, with the same limits, logging and approvals. That makes behaviour predictable and costs visible before you buy.</p>
        </div>
      </Container>
      <Container className="pb-16">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { icon: CheckCircle2, t: "Only working products", d: "Coming soon means coming soon. We don't sell placeholders." },
            { icon: Eye, t: "Visible costs", d: "Per-run provider cost estimates on every hosted product." },
            { icon: ShieldCheck, t: "Guardrails by default", d: "Budgets, approvals for side effects, and untrusted-content handling." },
            { icon: Scale, t: "People decide", d: "Recruitment, finance and legal products assist; humans decide." },
          ].map((v) => <Card key={v.t} className="p-5"><v.icon className="size-5 text-accent-2" /><p className="mt-3 font-semibold">{v.t}</p><p className="mt-1 text-[13.5px] text-muted">{v.d}</p></Card>)}
        </div>
        <div className="mt-12 flex flex-wrap gap-3"><LinkButton href="/marketplace">Browse the marketplace</LinkButton><LinkButton href="/careers" variant="outline">Careers</LinkButton><LinkButton href="/contact" variant="ghost">Contact</LinkButton></div>
      </Container>
    </>
  );
}
