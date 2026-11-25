import type { Metadata } from "next";
import { contactAction } from "@/app/actions/shop";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/forms";
import { Card, Container, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default function Contact() {
  return (
    <>
      <PageHeader eyebrow="Contact" title="Talk to us" intro="Sales, partnerships, security reports or anything else. Existing customers get faster answers through Dashboard → Support." />
      <Container className="grid grid-cols-1 [&>*]:min-w-0 gap-8 py-12 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <ActionForm action={contactAction} className="space-y-4" resetOnSuccess>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="n">Name</Label><Input id="n" name="name" required autoComplete="name" /></div>
              <div><Label htmlFor="e">Email</Label><Input id="e" name="email" type="email" required autoComplete="email" /></div>
            </div>
            <div><Label htmlFor="t">Topic</Label><Select id="t" name="topic"><option value="sales">Sales & enterprise</option><option value="support">Support</option><option value="partnership">Partnership</option><option value="security">Security report</option><option value="other">Other</option></Select></div>
            <div><Label htmlFor="m">Message</Label><Textarea id="m" name="message" rows={6} required minLength={10} maxLength={5000} /></div>
            <p className="text-[12.5px] text-subtle">We use your details only to reply. See the Privacy Policy.</p>
            <SubmitButton>Send message</SubmitButton>
          </ActionForm>
        </Card>
        <div className="space-y-4 text-[14px]">
          <Card className="p-5"><p className="font-semibold">Security</p><p className="mt-1 text-muted">Report vulnerabilities via this form with topic “Security report”. See our <a href="/security" className="underline">security page</a> for scope.</p></Card>
          <Card className="p-5"><p className="font-semibold">Company details</p><p className="mt-1 text-muted">Legal entity, address and registration details will be published here before launch.</p></Card>
        </div>
      </Container>
    </>
  );
}
