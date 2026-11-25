import { getUser } from "@/lib/auth";
import { audit, read } from "@/lib/db";

/** GDPR-style data export of everything stored for the signed-in user. Secrets are excluded. */
export async function GET() {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const data = await read((db) => ({
    exportedAt: new Date().toISOString(),
    profile: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt, emailVerifiedAt: user.emailVerifiedAt, marketingConsent: user.marketingConsent },
    organisation: db.orgs.find((o) => o.id === user.orgId),
    orders: db.orders.filter((o) => o.userId === user.id),
    entitlements: db.entitlements.filter((e) => e.userId === user.id),
    licenseKeys: db.licenseKeys.filter((k) => k.userId === user.id),
    downloads: db.downloads.filter((d) => d.userId === user.id),
    credits: db.credits.filter((c) => c.userId === user.id),
    executions: db.executions.filter((e) => e.userId === user.id),
    knowledgeBases: db.knowledgeBases.filter((k) => k.userId === user.id).map((k) => ({ ...k, documents: db.kbDocuments.filter((d) => d.kbId === k.id).map((d) => ({ name: d.name, pages: d.pages, createdAt: d.createdAt })) })),
    agentConfigs: db.agentConfigs.filter((a) => a.userId === user.id).map(({ webhookToken: _w, ...a }) => a),
    apiKeys: db.apiKeys.filter((k) => k.userId === user.id).map(({ hash: _h, ...k }) => k),
    providerKeys: db.providerSecrets.filter((p) => p.userId === user.id).map((p) => ({ provider: p.provider, last4: p.last4, createdAt: p.createdAt })),
    tickets: db.tickets.filter((t) => t.userId === user.id),
    reviews: db.reviews.filter((r) => r.userId === user.id),
    wishlist: db.wishlist.filter((w) => w.userId === user.id),
  }));
  await audit(user.id, "account.export", user.id);
  return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="agentforge-export-${user.id}.json"`, "Cache-Control": "no-store" } });
}
