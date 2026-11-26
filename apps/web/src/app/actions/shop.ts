"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { LicenseType } from "@agentforge/catalog";
import { getAnonKey, getUser } from "@/lib/auth";
import { addToCart, createOrderAndCheckout, updateCartItem } from "@/lib/commerce";
import { audit, id, mutate, now, read } from "@/lib/db";
import { getProduct } from "@/lib/catalog";

async function ownerKey(create = true) {
  const u = await getUser();
  return u?.id ?? (await getAnonKey(create));
}

export async function addToCartAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const license = (formData.get("license") as LicenseType | null) ?? undefined;
  const buyNow = formData.get("buyNow") === "1";
  const key = await ownerKey();
  const res = await addToCart(key!, slug, license);
  revalidatePath("/", "layout");
  if (!res.ok) redirect(`/products/${encodeURIComponent(slug)}?error=${encodeURIComponent(res.error)}`);
  redirect(buyNow ? "/checkout" : `/cart?added=${encodeURIComponent(slug)}`);
}

export async function updateCartAction(formData: FormData) {
  const key = await ownerKey(false);
  if (!key) return;
  const slug = String(formData.get("slug") ?? "");
  const qty = Number(formData.get("quantity") ?? 1);
  await updateCartItem(key, slug, Number.isFinite(qty) ? qty : 1);
  revalidatePath("/cart");
  revalidatePath("/", "layout");
}

export async function removeFromCartAction(formData: FormData) {
  const key = await ownerKey(false);
  if (!key) return;
  await updateCartItem(key, String(formData.get("slug") ?? ""), 0);
  revalidatePath("/cart");
  revalidatePath("/", "layout");
}

export async function toggleWishlistAction(formData: FormData) {
  const u = await getUser();
  const slug = String(formData.get("slug") ?? "");
  const back = String(formData.get("back") ?? `/products/${slug}`);
  if (!u) redirect(`/signin?next=${encodeURIComponent(back)}`);
  if (!(await getProduct(slug))) return;
  await mutate((db) => {
    const i = db.wishlist.findIndex((w) => w.userId === u.id && w.slug === slug);
    if (i >= 0) db.wishlist.splice(i, 1);
    else db.wishlist.push({ userId: u.id, slug, addedAt: now() });
  });
  revalidatePath(back.startsWith("/") ? back : "/");
  revalidatePath("/wishlist");
}

const checkoutSchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/, "Choose your country."),
  coupon: z.string().trim().max(40).optional(),
  consent: z.literal("on", { message: "Please confirm the digital-content consent to continue." }),
  terms: z.literal("on", { message: "Please accept the Terms and Licence Agreement." }),
});

export async function checkoutAction(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const u = await getUser();
  if (!u) redirect("/signin?next=/checkout");
  if (!u.emailVerifiedAt) return { error: "Please verify your email address before purchasing. Check your inbox (in development: /dev/outbox)." };
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let url: string;
  try {
    const r = await createOrderAndCheckout({
      userId: u.id,
      email: u.email,
      couponCode: parsed.data.coupon || null,
      country: parsed.data.country,
      vatId: null,
      digitalConsent: true,
    });
    if (!r.ok) return { error: r.error };
    url = r.url;
  } catch (e) {
    console.error("[checkout]", e);
    return { error: "Checkout could not be started. The payment provider may not be configured." };
  }
  redirect(url);
}

export async function newsletterAction(_prev: { ok?: boolean; error?: string } | undefined, formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const email = z.string().trim().toLowerCase().email().max(200).safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  if (formData.get("consent") !== "on") return { error: "Please tick the consent box." };
  await mutate((db) => {
    if (!db.newsletter.some((n) => n.email === email.data)) db.newsletter.push({ email: email.data, consentAt: now(), source: String(formData.get("source") ?? "site").slice(0, 40) });
  });
  return { ok: true };
}

export async function contactAction(_prev: { ok?: string; error?: string } | undefined, formData: FormData): Promise<{ ok?: string; error?: string }> {
  const s = z
    .object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200), topic: z.enum(["sales", "support", "partnership", "security", "other"]), message: z.string().trim().min(10).max(5000) })
    .safeParse(Object.fromEntries(formData));
  if (!s.success) return { error: s.error.issues[0].message };
  await mutate((db) => void db.contactMessages.push({ id: id("msg"), ...s.data, createdAt: now() }));
  return { ok: "Thanks — your message has been sent. We usually reply within two business days." };
}

export async function sellerApplicationAction(_prev: { ok?: string; error?: string } | undefined, formData: FormData): Promise<{ ok?: string; error?: string }> {
  const s = z
    .object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200), company: z.string().trim().max(200).optional().default(""), products: z.string().trim().min(20, "Tell us a little more about what you would sell.").max(4000) })
    .safeParse(Object.fromEntries(formData));
  if (!s.success) return { error: s.error.issues[0].message };
  const u = await getUser();
  await mutate((db) => void db.sellerApplications.push({ id: id("sel"), userId: u?.id ?? null, ...s.data, status: "submitted", createdAt: now() }));
  await audit(u?.id ?? null, "seller.application", s.data.email);
  return { ok: "Application received. We'll be in touch when seller onboarding opens." };
}

export async function reviewAction(formData: FormData) {
  const u = await getUser();
  const slug = String(formData.get("slug") ?? "");
  if (!u) redirect(`/signin?next=/products/${slug}`);
  const s = z.object({ rating: z.coerce.number().int().min(1).max(5), title: z.string().trim().min(3).max(120), body: z.string().trim().min(20).max(3000) }).safeParse(Object.fromEntries(formData));
  // Verified purchase required: only customers with an active entitlement can review.
  const owns = await read((db) => db.entitlements.some((e) => e.userId === u.id && e.slug === slug && e.status === "active"));
  if (!owns || !s.success) redirect(`/products/${slug}?error=${encodeURIComponent(!owns ? "Only verified purchasers can review." : s.error!.issues[0].message)}#reviews`);
  await mutate((db) => {
    db.reviews = db.reviews.filter((r) => !(r.userId === u.id && r.slug === slug));
    db.reviews.push({ id: id("rev"), userId: u.id, slug, ...s.data, createdAt: now(), authorName: u.name.split(" ")[0] });
  });
  revalidatePath(`/products/${slug}`);
  redirect(`/products/${slug}#reviews`);
}
