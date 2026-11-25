import type { Metadata } from "next";
import { Check } from "lucide-react";
import { categories } from "@agentforge/catalog";
import { MODELS } from "@agentforge/ai-engine/models";
import { getProducts } from "@/lib/catalog";
import { env } from "@/lib/env";
import { Card, Container, LinkButton, PageHeader, SectionHeading, Table } from "@/components/ui";
import { eur } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing", description: "One-time product prices from €10 to €800, transparent running costs, credits and licences.", alternates: { canonical: "/pricing" } };

export default async function Pricing() {
  const products = await getProducts();
  return (
    <>
      <PageHeader eyebrow="Pricing" title="Pay once for the product. See the running cost upfront." intro="Products are one-time purchases from €10 to €800, excluding VAT. Hosted products include credits for live-model runs; you can also bring your own API key." />
      <Container className="py-14">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { t: "One-time products", p: "€10–€800", d: "Tools, agents, kits and suites. Licence included.", items: ["Personal, commercial, developer, agency or white-label licence", "Versioned downloads and updates for the major version", "Licence key and verification API"] },
            { t: "Hosted credits", p: `${env.creditsPerHostedPurchase} included`, d: "With each hosted tool or agent purchase.", items: ["1 credit ≈ €0.01 of estimated provider cost", "Sandbox runs are free", "Bring your own key: no credits used"] },
            { t: "Licence upgrades", p: "×2 – ×3", d: "Upgrade one tier at checkout.", items: ["Personal → Commercial: 2× price", "Commercial or Developer → Agency: 2–3× price", "White-label on selected products"] },
          ].map((c) => (
            <Card key={c.t} className="flex flex-col p-6">
              <p className="font-semibold">{c.t}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{c.p}</p>
              <p className="mt-1 text-[13.5px] text-muted">{c.d}</p>
              <ul className="mt-5 space-y-2 text-[13.5px]">{c.items.map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" />{i}</li>)}</ul>
            </Card>
          ))}
        </div>

        <SectionHeading className="mt-20" eyebrow="Catalogue" title="Price ranges by category" />
        <Table className="mt-6">
          <thead><tr><th>Category</th><th className="text-right">Products</th><th className="text-right">Available now</th><th className="text-right">From</th><th className="text-right">To</th></tr></thead>
          <tbody>{categories.map((c) => { const ps = products.filter((p) => p.category === c.slug); return <tr key={c.slug}><td className="font-medium">{c.name}</td><td className="text-right">{ps.length}</td><td className="text-right">{ps.filter((p) => p.status === "published").length}</td><td className="text-right tabular-nums">{eur(Math.min(...ps.map((p) => p.priceCents)))}</td><td className="text-right tabular-nums">{eur(Math.max(...ps.map((p) => p.priceCents)))}</td></tr>; })}</tbody>
        </Table>

        <SectionHeading className="mt-20" eyebrow="Running costs" title="Model prices we use for estimates" intro="Estimated EUR per million tokens. Provider prices change; these are reviewed before launch and editable by admins." />
        <Table className="mt-6">
          <thead><tr><th>Model</th><th className="text-right">Input / 1M</th><th className="text-right">Output / 1M</th></tr></thead>
          <tbody>{MODELS.filter((m) => m.provider !== "sandbox").map((m) => <tr key={m.id}><td>{m.label}</td><td className="text-right tabular-nums">€{m.inputEurPerM}</td><td className="text-right tabular-nums">€{m.outputEurPerM}</td></tr>)}</tbody>
        </Table>

        <div className="mt-16 grid gap-4 md:grid-cols-2">
          <Card className="p-6"><p className="font-semibold">Hosted-agent subscriptions</p><p className="mt-1 text-[14px] text-muted">Monthly subscriptions for always-on hosted agents and business suites are planned. They’ll be listed with included usage and hard spend caps. There is no unlimited lifetime hosting.</p></Card>
          <Card className="p-6"><p className="font-semibold">Installation & configuration services</p><p className="mt-1 text-[14px] text-muted">Need help setting up an agent or workflow? We scope and quote services individually.</p><LinkButton href="/contact" variant="outline" size="sm" className="mt-4">Request a quote</LinkButton></Card>
        </div>
      </Container>
    </>
  );
}
