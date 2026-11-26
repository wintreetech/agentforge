import type { Metadata } from "next";
import { CatalogBrowser } from "@/components/catalog-browser";
import { RecentlyViewed } from "@/components/recently-viewed";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Browse 50 AI tools, agents, automation workflows, business suites and developer kits, priced from €10 to €800.",
  alternates: { canonical: "/marketplace" },
};

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader eyebrow="Marketplace" title="Every AI product, one honest catalogue" intro="Filter by price, provider, integration, industry and hosting. Products marked Available are built and tested; the rest are clearly marked Coming soon." />
      <Container className="py-10">
        <CatalogBrowser searchParams={sp} basePath="/marketplace" />
        <RecentlyViewed />
      </Container>
    </>
  );
}
