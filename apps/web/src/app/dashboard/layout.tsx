import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { SideNav } from "@/components/side-nav";
import { Container, Notice } from "@/components/ui";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Dashboard | AgentForge AI" }, robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [openTickets, unread] = await read((db) => [db.tickets.filter((t) => t.userId === user.id && t.status === "answered").length, db.notifications.filter((n) => n.userId === user.id && !n.readAt).length]);
  return (
    <Container className="grid grid-cols-1 gap-8 py-8 lg:grid-cols-[230px_1fr]">
      <aside className="min-w-0">
        <div className="mb-4 hidden px-3 lg:block">
          <p className="truncate text-[13.5px] font-medium">{user.name}</p>
          <p className="truncate text-[12px] text-subtle">{user.email}</p>
        </div>
        <SideNav
          title="Dashboard"
          groups={[
            { items: [{ href: "/dashboard", label: "Overview", icon: "LayoutDashboard", badge: unread }] },
            { title: "Products", items: [
              { href: "/dashboard/purchases", label: "My purchases", icon: "ShoppingBag" },
              { href: "/dashboard/tools", label: "My AI tools", icon: "Wrench" },
              { href: "/dashboard/agents", label: "My agents", icon: "Bot" },
              { href: "/dashboard/workflows", label: "My workflows", icon: "Workflow" },
              { href: "/dashboard/studio", label: "Agent Studio", icon: "Network" },
              { href: "/dashboard/executions", label: "Execution history", icon: "History" },
              { href: "/dashboard/downloads", label: "Downloads", icon: "Download" },
              { href: "/dashboard/licenses", label: "Licence keys", icon: "KeyRound" },
            ] },
            { title: "Build", items: [
              { href: "/dashboard/knowledge", label: "Knowledge bases", icon: "Library" },
              { href: "/dashboard/api-keys", label: "API keys", icon: "Code2" },
              { href: "/dashboard/integrations", label: "Integrations", icon: "Plug" },
              { href: "/dashboard/usage", label: "Usage analytics", icon: "BarChart3" },
            ] },
            { title: "Account", items: [
              { href: "/dashboard/billing", label: "Billing & credits", icon: "CreditCard" },
              { href: "/dashboard/invoices", label: "Invoices", icon: "Receipt" },
              { href: "/wishlist", label: "Wishlist", icon: "Heart" },
              { href: "/dashboard/support", label: "Support", icon: "LifeBuoy", badge: openTickets },
              { href: "/dashboard/settings", label: "Settings", icon: "Settings" },
            ] },
          ]}
        />
      </aside>
      <div className="min-w-0">
        {!user.emailVerifiedAt && <Notice tone="warning" className="mb-6">Your email isn&apos;t verified yet. <a href="/verify" className="underline">Verify it</a> to make purchases.</Notice>}
        {children}
      </div>
    </Container>
  );
}
