import type { Metadata } from "next";
import Image from "next/image";
import { Building2, FileLock2, KeyRound, ScrollText, Server, Users } from "lucide-react";
import { Card, Container, LinkButton, PageHeader, SectionHeading } from "@/components/ui";

export const metadata: Metadata = { title: "Enterprise", description: "AI agents and workflows with organisation workspaces, approvals, audit logs, BYO keys and self-hosting.", alternates: { canonical: "/enterprise" } };

export default function Enterprise() {
  return (
    <>
      <PageHeader eyebrow="Enterprise" title="AI operations your security team can sign off" intro="Run agents with explicit permissions, approval steps for anything consequential, spend caps and a complete audit trail. Self-host where data residency matters.">
        <div className="flex flex-wrap gap-3"><LinkButton href="/contact" size="lg">Talk to sales</LinkButton><LinkButton href="/security" size="lg" variant="outline">Security overview</LinkButton></div>
      </PageHeader>
      <Container className="py-16">
        <div className="relative aspect-[21/8] overflow-hidden rounded-3xl border border-border"><Image src="/assets/pages/enterprise.svg" alt="" fill sizes="100vw" className="object-cover" /></div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { icon: Users, t: "Organisation workspaces", d: "Workspaces with owner, admin and member roles; tenant isolation enforced on every query." },
            { icon: ScrollText, t: "Audit logs", d: "Sign-ins, purchases, runs, approvals, downloads and admin changes, append-only." },
            { icon: FileLock2, t: "Approval policies", d: "Human approval nodes and mandatory approval for external API calls." },
            { icon: KeyRound, t: "Bring your own keys", d: "Use your own OpenAI, Anthropic or Gemini contracts; keys encrypted at rest." },
            { icon: Server, t: "Self-hosting", d: "Self-hosted agents and source kits run in your infrastructure via Docker." },
            { icon: Building2, t: "Procurement-ready", d: "DPA, security questionnaire and invoicing on request. (SSO/SAML is on the roadmap, not yet available.)" },
          ].map((f) => <Card key={f.t} className="p-6"><f.icon className="size-5 text-accent-2" /><p className="mt-3 font-semibold">{f.t}</p><p className="mt-1 text-[14px] text-muted">{f.d}</p></Card>)}
        </div>
        <SectionHeading className="mt-20" title="What we won't promise" intro="We don't publish customer logos, uptime percentages or certifications we haven't earned. Ask us for current status of SOC 2 and ISO 27001 programmes; today, neither is certified." />
      </Container>
    </>
  );
}
