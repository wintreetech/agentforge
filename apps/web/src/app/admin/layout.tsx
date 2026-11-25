import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { SideNav } from "@/components/side-nav";
import { Badge, Container } from "@/components/ui";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin | AgentForge AI" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [refunds, tickets] = await read((db) => [db.refunds.filter((r) => r.status === "requested").length, db.tickets.filter((t) => t.status === "open").length]);
  return (
    <Container className="grid grid-cols-1 gap-8 py-8 lg:grid-cols-[220px_1fr]">
      <aside className="min-w-0">
        <p className="mb-4 hidden items-center gap-2 px-3 text-[13px] font-semibold lg:flex">Administration <Badge tone="accent">admin</Badge></p>
        <SideNav
          title="Admin"
          groups={[
            { items: [{ href: "/admin", label: "Overview", icon: "LayoutDashboard" }] },
            { title: "Commerce", items: [
              { href: "/admin/products", label: "Products", icon: "Package" },
              { href: "/admin/orders", label: "Orders", icon: "ShoppingBag" },
              { href: "/admin/refunds", label: "Refunds", icon: "RotateCcw", badge: refunds },
              { href: "/admin/coupons", label: "Coupons", icon: "Tag" },
              { href: "/admin/licenses", label: "Licences", icon: "KeyRound" },
            ] },
            { title: "Platform", items: [
              { href: "/admin/users", label: "Users & roles", icon: "Users" },
              { href: "/admin/executions", label: "Executions & cost", icon: "Activity" },
              { href: "/admin/providers", label: "AI providers", icon: "Cpu" },
              { href: "/admin/tickets", label: "Support tickets", icon: "Ticket", badge: tickets },
              { href: "/admin/content", label: "Content & sellers", icon: "Megaphone" },
              { href: "/admin/audit", label: "Audit log", icon: "ScrollText" },
              { href: "/admin/settings", label: "Settings", icon: "Settings" },
            ] },
          ]}
        />
      </aside>
      <div className="min-w-0">{children}</div>
    </Container>
  );
}
