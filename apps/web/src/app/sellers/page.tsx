import type { Metadata } from "next";
import { sellerApplicationAction } from "@/app/actions/shop";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/forms";
import { env } from "@/lib/env";
import { Card, Container, Input, Label, Notice, PageHeader, Textarea } from "@/components/ui";

export const metadata: Metadata = { title: "Sell on AgentForge", alternates: { canonical: "/sellers" } };

export default function Sellers() {
  return (
    <>
      <PageHeader eyebrow="Seller programme" title="Sell your AI products on AgentForge" intro="We're preparing to open the marketplace to third-party sellers. Apply now to join the first cohort." />
      <Container className="grid grid-cols-1 [&>*]:min-w-0 gap-8 py-12 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4 text-[14.5px] text-muted">
          <p><strong className="text-fg">What we look for:</strong> products that work as described, with documentation, tests and honest cost information.</p>
          <p><strong className="text-fg">Review process:</strong> every submission is reviewed and tested before it can be published. Products can’t be marked Available without a working deliverable.</p>
          <p><strong className="text-fg">Commission and payouts:</strong> to be announced. Payouts will only start once a compliant marketplace payment solution is in place.</p>
          <Notice tone={env.sellersEnabled ? "success" : "info"}>{env.sellersEnabled ? "Seller onboarding is enabled in this environment." : "Seller accounts are not open yet (feature flag off). Applications are recorded for review."}</Notice>
        </div>
        <Card className="p-6">
          <ActionForm action={sellerApplicationAction} className="space-y-4" resetOnSuccess>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="n">Name</Label><Input id="n" name="name" required /></div>
              <div><Label htmlFor="e">Email</Label><Input id="e" name="email" type="email" required /></div>
            </div>
            <div><Label htmlFor="c">Company (optional)</Label><Input id="c" name="company" /></div>
            <div><Label htmlFor="p">What would you sell?</Label><Textarea id="p" name="products" rows={5} required minLength={20} /></div>
            <SubmitButton>Submit application</SubmitButton>
          </ActionForm>
        </Card>
      </Container>
    </>
  );
}
