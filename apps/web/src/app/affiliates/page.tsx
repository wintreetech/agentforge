import type { Metadata } from "next";
import { Card, Container, LinkButton, Notice, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Affiliate program", alternates: { canonical: "/affiliates" } };

export default function Affiliates() {
  return (
    <>
      <PageHeader eyebrow="Affiliates" title="Recommend products you trust" intro="Earn a commission when people you refer buy available products. We only pay on completed, non-refunded orders." />
      <Container className="max-w-4xl py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {[["1. Apply", "Tell us where you publish and who your audience is."], ["2. Share", "Get a referral link that attributes purchases for 30 days."], ["3. Get paid", "Commissions are paid monthly after the refund window."]].map(([t, d]) => <Card key={t} className="p-5"><p className="font-semibold">{t}</p><p className="mt-1 text-[14px] text-muted">{d}</p></Card>)}
        </div>
        <Notice className="mt-8" title="Not open yet">The referral data model and tracking are in place, but commission payouts require a payout provider and tax setup. Contact us to join the waitlist; rates will be published before launch.</Notice>
        <LinkButton href="/contact" className="mt-6">Join the waitlist</LinkButton>
      </Container>
    </>
  );
}
