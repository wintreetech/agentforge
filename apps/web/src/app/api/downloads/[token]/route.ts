import { getUser } from "@/lib/auth";
import { audit, id, mutate, now, read } from "@/lib/db";
import { buildPackage, verifyDownload } from "@/lib/delivery";

export const runtime = "nodejs";

/** Signed, expiring, user-bound download URL. Authorisation is re-checked against the entitlement at download time. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const payload = verifyDownload(decodeURIComponent(token));
  if (!payload) return new Response("This download link is invalid or has expired. Generate a new one from your dashboard.", { status: 410 });
  const user = await getUser();
  if (!user || user.id !== payload.u) return new Response("Sign in with the account that owns this product.", { status: 403 });
  const lic = await read((db) => {
    const ent = db.entitlements.find((e) => e.userId === user.id && e.slug === payload.s && e.status === "active");
    return ent ? db.licenseKeys.find((k) => k.entitlementId === ent.id && k.status === "active") : undefined;
  });
  if (!lic) return new Response("No active licence for this product.", { status: 403 });
  const pkg = await buildPackage(payload.s, { key: lic.key, license: lic.license, email: user.email });
  await mutate((db) => void db.downloads.push({ id: id("dl"), userId: user.id, slug: payload.s, version: payload.v, at: now() }));
  await audit(user.id, "download", payload.s, { version: payload.v });
  return new Response(Buffer.from(pkg.bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${pkg.fileName}"`,
      "Content-Length": String(pkg.bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
