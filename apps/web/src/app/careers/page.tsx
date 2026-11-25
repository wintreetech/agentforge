import type { Metadata } from "next";
import { Container, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Careers", alternates: { canonical: "/careers" } };

export default function Careers() {
  return (
    <>
      <PageHeader eyebrow="Careers" title="Build AI products people can rely on" intro="We're a small team that values working software over slide decks, honest numbers over growth theatre, and safety as a feature." />
      <Container className="max-w-3xl py-12">
        <EmptyState title="No open positions right now" action={<LinkButton href="/contact" variant="outline">Introduce yourself</LinkButton>}>
          We publish roles here when we’re hiring. You’re welcome to send a short note about what you’d like to work on.
        </EmptyState>
      </Container>
    </>
  );
}
