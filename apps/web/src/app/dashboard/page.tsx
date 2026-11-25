import Link from "next/link";
import { Bell, Bot, Network, PlayCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { markNotificationsReadAction } from "@/app/actions/account";
import { DashHeader } from "@/components/dash";
import { Badge, Card, EmptyState, LinkButton, Notice, Stat, buttonClass } from "@/components/ui";
import { eur2, fmtDateTime, daysAgoIso } from "@/lib/utils";

export default async function Overview({ searchParams }: { searchParams: Promise<{ verified?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const d = await read((db) => {
    const ex = db.executions.filter((e) => e.userId === user.id);
    const since = daysAgoIso(30);
    return {
      ents: db.entitlements.filter((e) => e.userId === user.id && e.status === "active").length,
      credits: db.credits.filter((c) => c.userId === user.id).reduce((s, c) => s + c.delta, 0),
      runs30: ex.filter((e) => e.createdAt >= since).length,
      spent: db.orders.filter((o) => o.userId === user.id && (o.status === "paid" || o.status === "partially_refunded")).reduce((s, o) => s + o.totalCents - o.refundedCents, 0),
      recent: ex.slice(-6).reverse(),
      notes: db.notifications.filter((n) => n.userId === user.id).slice(-5).reverse(),
      awaiting: db.studioRuns.filter((r) => r.userId === user.id && r.status === "awaiting_approval").length,
    };
  });
  return (
    <>
      <DashHeader title={`Welcome, ${user.name.split(" ")[0]}`} intro="Your products, runs and account at a glance. All figures come from your workspace." />
      {sp.verified && <Notice tone="success" className="mb-6">Email verified. You can now make purchases.</Notice>}
      {sp.error === "forbidden" && <Notice tone="danger" className="mb-6">You don&apos;t have access to that area.</Notice>}
      {d.awaiting > 0 && <Notice tone="warning" className="mb-6" title="Approval needed">{d.awaiting} Agent Studio run(s) are waiting for your approval. <Link href="/dashboard/studio" className="underline">Review</Link></Notice>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Products owned" value={d.ents} />
        <Stat label="Credits available" value={d.credits.toLocaleString("en")} hint="1 credit ≈ €0.01 provider cost" />
        <Stat label="Runs (30 days)" value={d.runs30} />
        <Stat label="Total spent" value={eur2(d.spent)} hint="Net of refunds" />
      </div>
      <div className="mt-6 grid grid-cols-1 [&>*]:min-w-0 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between"><p className="font-semibold">Recent runs</p><Link href="/dashboard/executions" className="text-[13px] text-accent-2">All runs</Link></div>
          {d.recent.length === 0 ? (
            <div className="mt-4"><EmptyState icon={<PlayCircle className="size-5" />} title="No runs yet" action={<LinkButton href="/playground" size="sm">Open the Playground</LinkButton>}>Try any available product in the Playground.</EmptyState></div>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {d.recent.map((e) => (
                <li key={e.id}>
                  <Link href={`/dashboard/executions/${e.id}`} className="flex items-center gap-3 py-2.5 text-[13.5px] hover:text-fg">
                    <Badge tone={e.status === "succeeded" ? "success" : "danger"}>{e.status}</Badge>
                    <span className="flex-1 truncate">{e.slug}</span>
                    {e.simulated && <Badge tone="cyan">sandbox</Badge>}
                    <span className="text-[12px] text-subtle">{fmtDateTime(e.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-semibold"><Bell className="size-4" /> Notifications</p>
            {d.notes.some((n) => !n.readAt) && <form action={markNotificationsReadAction}><button className={buttonClass("ghost", "sm")}>Mark all read</button></form>}
          </div>
          {d.notes.length === 0 ? <p className="mt-4 text-[13.5px] text-muted">Nothing new.</p> : (
            <ul className="mt-3 space-y-3">
              {d.notes.map((n) => (
                <li key={n.id} className="text-[13.5px]">
                  <p className="flex items-center gap-2 font-medium">{!n.readAt && <span className="size-1.5 rounded-full bg-accent" />}{n.title}</p>
                  <p className="text-muted">{n.body}</p>
                  {n.href && <Link href={n.href} className="text-[12.5px] text-accent-2">Open</Link>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          { href: "/dashboard/tools", icon: PlayCircle, t: "Run a tool", d: "Open a hosted tool you own." },
          { href: "/dashboard/studio", icon: Network, t: "Agent Studio", d: "Configure agents and visual workflows." },
          { href: "/marketplace?availability=available", icon: Bot, t: "Find more products", d: "Browse what's available now." },
        ].map((q) => (
          <Link key={q.href} href={q.href} className="rounded-2xl border border-border bg-surface p-5 transition hover:border-border-strong">
            <q.icon className="size-5 text-accent-2" />
            <p className="mt-3 font-medium">{q.t}</p>
            <p className="text-[13px] text-muted">{q.d}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
