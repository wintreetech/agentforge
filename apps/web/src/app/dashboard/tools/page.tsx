import { requireUser } from "@/lib/auth";
import { ownedProducts } from "@/lib/owned";
import { DashHeader } from "@/components/dash";
import { OwnedGrid } from "../owned-grid";

export const metadata = { title: "My AI tools" };

export default async function Tools() {
  const user = await requireUser();
  const items = (await ownedProducts(user.id)).map((o) => o.product).filter((p) => p.delivery === "hosted-tool");
  return (
    <>
      <DashHeader title="My AI tools" intro="Hosted tools you own. Runs use your credits, or your own provider key if you've added one under Integrations." />
      <OwnedGrid items={items} href={(p) => `/dashboard/tools/${p.slug}`} cta="Open tool" empty={{ title: "No tools yet", body: "Hosted tools you buy appear here.", category: "ai-micro-tools" }} />
    </>
  );
}
