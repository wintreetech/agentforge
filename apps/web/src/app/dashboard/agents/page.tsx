import { requireUser } from "@/lib/auth";
import { ownedProducts } from "@/lib/owned";
import { DashHeader } from "@/components/dash";
import { OwnedGrid } from "../owned-grid";

export const metadata = { title: "My agents" };

export default async function Agents() {
  const user = await requireUser();
  const items = (await ownedProducts(user.id)).map((o) => o.product).filter((p) => p.delivery === "cloud-agent" || p.delivery === "self-hosted-agent");
  return (
    <>
      <DashHeader title="My agents" intro="Agents you own. Run them directly, or configure instructions, knowledge, tools, schedules and approvals in Agent Studio." />
      <OwnedGrid items={items} href={(p) => `/dashboard/tools/${p.slug}`} cta="Run agent" empty={{ title: "No agents yet", body: "Agents you buy appear here and in Agent Studio.", category: "ai-agents" }} />
    </>
  );
}
