import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { env } from "@/lib/env";
import { blogPosts } from "@/content/blog-data";
import { decideSellerAction } from "@/app/actions/admin";
import { DashHeader } from "@/components/dash";
import { Badge, Card, Notice, Table, buttonClass } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Content & sellers" };

export default async function AdminContent() {
  await requireAdmin();
  const [subs, sellers] = await read((db) => [db.newsletter.slice().reverse(), db.sellerApplications.slice().reverse()]);
  return (
    <>
      <DashHeader title="Content & sellers" intro="Blog posts are version-controlled in apps/web/src/content and published through deploys. The homepage banner is edited in Settings." />
      <h2 className="mb-3 font-semibold">Blog posts</h2>
      <Table><thead><tr><th>Title</th><th>Tag</th><th>Date</th><th /></tr></thead><tbody>{blogPosts.map((b) => <tr key={b.slug}><td className="font-medium">{b.title}</td><td><Badge>{b.tag}</Badge></td><td className="text-muted">{fmtDate(b.date)}</td><td className="text-right"><Link href={`/blog/${b.slug}`} className="text-[13px] text-accent-2">View</Link></td></tr>)}</tbody></Table>

      <h2 className="mb-3 mt-10 font-semibold">Newsletter subscribers ({subs.length})</h2>
      {subs.length === 0 ? <p className="text-[13.5px] text-muted">No subscribers yet.</p> : (
        <Table><thead><tr><th>Email</th><th>Source</th><th>Consent</th></tr></thead><tbody>{subs.slice(0, 200).map((s) => <tr key={s.email}><td>{s.email}</td><td>{s.source}</td><td className="text-muted">{fmtDateTime(s.consentAt)}</td></tr>)}</tbody></Table>
      )}

      <h2 className="mb-3 mt-10 flex items-center gap-2 font-semibold">Seller applications <Badge tone={env.sellersEnabled ? "success" : "neutral"}>feature flag: {env.sellersEnabled ? "on" : "off"}</Badge></h2>
      <Notice className="mb-3">Third-party payouts are disabled until a compliant marketplace payment solution (e.g. Stripe Connect) is configured. Approving an application records the decision only.</Notice>
      {sellers.length === 0 ? <p className="text-[13.5px] text-muted">No applications.</p> : (
        <div className="space-y-3">
          {sellers.map((s) => (
            <Card key={s.id} className="p-4 text-[13.5px]">
              <p className="font-medium">{s.name} · {s.company || "—"} · {s.email} <Badge tone={s.status === "approved" ? "success" : s.status === "rejected" ? "danger" : "warning"}>{s.status}</Badge></p>
              <p className="mt-1 whitespace-pre-wrap text-muted">{s.products}</p>
              {s.status === "submitted" && (
                <div className="mt-2 flex gap-2">
                  <form action={decideSellerAction}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="decision" value="approve" /><button className={buttonClass("outline", "sm")}>Approve</button></form>
                  <form action={decideSellerAction}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="decision" value="reject" /><button className={buttonClass("ghost", "sm")}>Reject</button></form>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
