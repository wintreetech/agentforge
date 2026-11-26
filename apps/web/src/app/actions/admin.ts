"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { seedProducts, type ProductStatus } from "@agentforge/catalog";
import { requireAdmin } from "@/lib/auth";
import { audit, id, mutate, now, read } from "@/lib/db";
import { env } from "@/lib/env";
import { paymentProvider, sandboxProvider } from "@/lib/commerce";

type S = { error?: string; ok?: string } | undefined;

const STATUSES: ProductStatus[] = ["draft", "coming_soon", "beta", "published", "unavailable", "archived"];

export async function updateProductAction(_: S, fd: FormData): Promise<S> {
  const admin = await requireAdmin();
  const slug = String(fd.get("slug"));
  const seed = seedProducts.find((p) => p.slug === slug);
  if (!seed) return { error: "Unknown product." };
  const status = String(fd.get("status")) as ProductStatus;
  if (!STATUSES.includes(status)) return { error: "Invalid status." };
  // Guardrail: a product can only be sold when a tested deliverable is registered.
  if ((status === "published" || status === "beta") && !seed.functional) return { error: `${seed.title} has no implemented, tested deliverable and cannot be made purchasable.` };
  const priceEur = Number(fd.get("price"));
  if (!Number.isFinite(priceEur) || priceEur < 10 || priceEur > 800) return { error: "Price must be between €10 and €800." };
  const short = String(fd.get("shortDescription") ?? "").trim();
  if (short.length < 20 || short.length > 240) return { error: "Short description must be 20–240 characters." };
  await mutate((db) => {
    db.productOverrides = db.productOverrides.filter((o) => o.slug !== slug);
    db.productOverrides.push({ slug, status, priceCents: Math.round(priceEur * 100), shortDescription: short, updatedAt: now(), updatedBy: admin.id });
    if (status === "published" && seed.status !== "published") {
      for (const w of db.wishlist.filter((x) => x.slug === slug)) db.notifications.push({ id: id("ntf"), userId: w.userId, title: `${seed.title} is available`, body: "A product on your wishlist has been released.", href: `/products/${slug}`, readAt: null, createdAt: now() });
    }
  });
  await audit(admin.id, "product.updated", slug, { status, priceEur });
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export async function decideRefundAction(fd: FormData) {
  const admin = await requireAdmin();
  const rid = String(fd.get("id"));
  const decision = String(fd.get("decision"));
  const refund = await read((db) => db.refunds.find((r) => r.id === rid));
  if (!refund || refund.status !== "requested") return;
  if (decision === "reject") {
    await mutate((db) => {
      const r = db.refunds.find((x) => x.id === rid)!;
      Object.assign(r, { status: "rejected", decidedAt: now(), decidedBy: admin.id });
      db.notifications.push({ id: id("ntf"), userId: r.userId, title: "Refund request reviewed", body: "Your refund request was not approved. Reply in Support if you have questions.", href: "/dashboard/purchases", readAt: null, createdAt: now() });
    });
    await audit(admin.id, "refund.rejected", rid);
  } else {
    const order = await read((db) => db.orders.find((o) => o.id === refund.orderId));
    if (!order?.paymentRef) return;
    const res = await paymentProvider().refund(order.paymentRef, refund.amountCents);
    await mutate((db) => Object.assign(db.refunds.find((x) => x.id === rid)!, { status: "approved", providerRef: res.refundRef, decidedAt: now(), decidedBy: admin.id }));
    await audit(admin.id, "refund.approved", rid, { amount: refund.amountCents });
    // Access is revoked only when the provider confirms the refund via webhook.
    if (env.paymentProvider === "sandbox") {
      const raw = JSON.stringify({ id: `sbx_evt_${randomBytes(8).toString("hex")}`, type: "refund.succeeded", orderId: order.id, paymentRef: order.paymentRef, amountCents: refund.amountCents, currency: "EUR" });
      await fetch(`${env.appUrl}/api/webhooks/payments`, { method: "POST", headers: { "Content-Type": "application/json", "x-agentforge-signature": sandboxProvider().sign(raw) }, body: raw });
    }
  }
  revalidatePath("/admin/refunds");
}

export async function createCouponAction(_: S, fd: FormData): Promise<S> {
  const admin = await requireAdmin();
  const s = z
    .object({
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, "Codes: 3–40 letters, digits, - or _"),
      kind: z.enum(["percent", "fixed"]),
      value: z.coerce.number().positive(),
      maxRedemptions: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
      expiresAt: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!s.success) return { error: s.error.issues[0].message };
  if (s.data.kind === "percent" && s.data.value > 100) return { error: "Percent must be ≤ 100." };
  return mutate((db): S => {
    if (db.coupons.some((c) => c.code === s.data.code)) return { error: "Code already exists." };
    db.coupons.push({ id: id("cpn"), code: s.data.code, kind: s.data.kind, value: s.data.kind === "fixed" ? Math.round(s.data.value * 100) : s.data.value, active: true, redemptions: 0, maxRedemptions: s.data.maxRedemptions ?? null, expiresAt: s.data.expiresAt || null, createdAt: now() });
    return { ok: `Coupon ${s.data.code} created.` };
  }).finally(() => audit(admin.id, "coupon.created", s.data.code).then(() => revalidatePath("/admin/coupons")));
}

export async function toggleCouponAction(fd: FormData) {
  const admin = await requireAdmin();
  const cid = String(fd.get("id"));
  await mutate((db) => {
    const c = db.coupons.find((x) => x.id === cid);
    if (c) c.active = !c.active;
  });
  await audit(admin.id, "coupon.toggled", cid);
  revalidatePath("/admin/coupons");
}

export async function setRoleAction(fd: FormData) {
  const admin = await requireAdmin();
  const uid = String(fd.get("id"));
  const role = fd.get("role") === "admin" ? "admin" : "customer";
  if (uid === admin.id) return; // cannot change own role
  await mutate((db) => {
    const u = db.users.find((x) => x.id === uid);
    if (u) u.role = role;
    if (role === "customer") db.sessions = db.sessions.filter((s) => s.userId !== uid); // force re-auth
  });
  await audit(admin.id, "user.role_changed", uid, { role });
  revalidatePath("/admin/users");
}

export async function toggleProviderAction(fd: FormData) {
  const admin = await requireAdmin();
  const p = String(fd.get("provider"));
  if (!["openai", "anthropic", "gemini"].includes(p)) return;
  await mutate((db) => {
    const s = new Set(db.settings.disabledProviders);
    if (s.has(p)) s.delete(p);
    else s.add(p);
    db.settings.disabledProviders = [...s];
  });
  await audit(admin.id, "provider.toggled", p);
  revalidatePath("/admin/providers");
}

export async function saveSettingsAction(_: S, fd: FormData): Promise<S> {
  const admin = await requireAdmin();
  const s = z.object({ creditsPerHostedPurchase: z.coerce.number().int().min(0).max(100_000), maintenanceBanner: z.string().max(300) }).safeParse(Object.fromEntries(fd));
  if (!s.success) return { error: s.error.issues[0].message };
  await mutate((db) => Object.assign(db.settings, s.data));
  await audit(admin.id, "settings.updated", "platform", s.data);
  revalidatePath("/", "layout");
  return { ok: "Settings saved." };
}

export async function decideSellerAction(fd: FormData) {
  const admin = await requireAdmin();
  const sid = String(fd.get("id"));
  const decision = fd.get("decision") === "approve" ? "approved" : "rejected";
  await mutate((db) => {
    const s = db.sellerApplications.find((x) => x.id === sid);
    if (s) s.status = decision;
  });
  await audit(admin.id, `seller.${decision}`, sid);
  revalidatePath("/admin/content");
}
