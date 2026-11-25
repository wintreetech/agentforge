import type { Metadata } from "next";
import { HELP } from "@/content/help";
import { JsonLd } from "@/components/json-ld";
import { Card, Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "FAQ", alternates: { canonical: "/faq" } };

export default function Faq() {
  const all = HELP.flatMap((s) => s.items);
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: all.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })) }} />
      <PageHeader eyebrow="FAQ" title="Frequently asked questions" />
      <Container className="max-w-3xl py-12">
        <Card className="divide-y divide-border">
          {all.map((i) => (
            <div key={i.q} className="p-5">
              <h2 className="font-medium">{i.q}</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{i.a}</p>
            </div>
          ))}
        </Card>
      </Container>
    </>
  );
}
