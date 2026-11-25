import { requireUser } from "@/lib/auth";
import { ownedProducts } from "@/lib/owned";
import { DashHeader } from "@/components/dash";
import { OwnedGrid } from "../owned-grid";

export const metadata = { title: "My workflows" };

export default async function Workflows() {
  const user = await requireUser();
  const items = (await ownedProducts(user.id)).map((o) => o.product).filter((p) => p.delivery === "workflow-template");
  return (
    <>
      <DashHeader title="My workflows" intro="n8n workflow templates you own, ready to import. You can also build your own visual workflows in Agent Studio." />
      <OwnedGrid
        items={items}
        href={() => "/dashboard/downloads"}
        cta="Download"
        empty={{ title: "No workflow templates yet", body: "Workflow templates are in development and not purchasable yet. Meanwhile, Agent Studio lets you build visual workflows around the agents you own.", category: "automation-workflows" }}
      />
    </>
  );
}
