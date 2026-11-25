"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { sha256 } from "@agentforge/commerce";
import { destroySession, hashPassword, passwordProblems, requireUser, verifyPassword } from "@/lib/auth";
import { audit, id, mutate, now, read } from "@/lib/db";
import { encrypt, HttpError } from "@/lib/security";
import { fileToPages } from "@/lib/documents";

type S = { error?: string; ok?: string; secret?: string } | undefined;

export async function updateProfileAction(_: S, fd: FormData): Promise<S> {
  const u = await requireUser();
  const s = z.object({ name: z.string().trim().min(2).max(120), org: z.string().trim().min(2).max(120), marketing: z.string().optional() }).safeParse(Object.fromEntries(fd));
  if (!s.success) return { error: s.error.issues[0].message };
  await mutate((db) => {
    const user = db.users.find((x) => x.id === u.id)!;
    user.name = s.data.name;
    user.marketingConsent = s.data.marketing === "on";
    const org = db.orgs.find((o) => o.id === user.orgId && o.ownerId === u.id);
    if (org) org.name = s.data.org;
  });
  revalidatePath("/dashboard", "layout");
  return { ok: "Profile saved." };
}

export async function changePasswordAction(_: S, fd: FormData): Promise<S> {
  const u = await requireUser();
  const cur = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (!(await verifyPassword(cur, u.passwordHash))) return { error: "Current password is incorrect." };
  const p = passwordProblems(next);
  if (p) return { error: p };
  const h = await hashPassword(next);
  await mutate((db) => void (db.users.find((x) => x.id === u.id)!.passwordHash = h));
  await audit(u.id, "auth.password_changed", u.id);
  return { ok: "Password changed." };
}

export async function revokeOtherSessionsAction() {
  const u = await requireUser();
  const { cookies } = await import("next/headers");
  const tok = (await cookies()).get("af_session")?.value ?? "";
  await mutate((db) => void (db.sessions = db.sessions.filter((s) => s.userId !== u.id || s.tokenHash === sha256(tok))));
  await audit(u.id, "auth.sessions_revoked", u.id);
  revalidatePath("/dashboard/settings");
}

export async function deleteAccountAction(_: S, fd: FormData): Promise<S> {
  const u = await requireUser();
  if (String(fd.get("confirm")) !== "DELETE") return { error: 'Type DELETE to confirm.' };
  if (!(await verifyPassword(String(fd.get("password") ?? ""), u.passwordHash))) return { error: "Password is incorrect." };
  await mutate((db) => {
    const user = db.users.find((x) => x.id === u.id)!;
    // Personal data is erased; order records are retained (anonymised) for statutory bookkeeping.
    user.deletedAt = now();
    user.email = `deleted+${user.id}@invalid`;
    user.name = "Deleted user";
    user.passwordHash = null;
    db.sessions = db.sessions.filter((s) => s.userId !== u.id);
    db.cart = db.cart.filter((c) => c.ownerKey !== u.id);
    db.wishlist = db.wishlist.filter((w) => w.userId !== u.id);
    db.kbDocuments = db.kbDocuments.filter((d) => d.userId !== u.id);
    db.knowledgeBases = db.knowledgeBases.filter((k) => k.userId !== u.id);
    db.providerSecrets = db.providerSecrets.filter((k) => k.userId !== u.id);
    for (const k of db.apiKeys.filter((k) => k.userId === u.id)) k.revokedAt = now();
    for (const e of db.executions.filter((e) => e.userId === u.id)) {
      e.output = null;
      e.inputPreview = "[deleted]";
    }
    for (const o of db.orders.filter((o) => o.userId === u.id)) o.email = user.email;
  });
  await audit(u.id, "account.deleted", u.id);
  await destroySession();
  redirect("/?deleted=1");
}

// ───────────── API keys ─────────────
export async function createApiKeyAction(_: S, fd: FormData): Promise<S> {
  const u = await requireUser();
  const name = z.string().trim().min(2).max(60).safeParse(fd.get("name"));
  if (!name.success) return { error: "Give the key a name (2–60 characters)." };
  const count = await read((db) => db.apiKeys.filter((k) => k.userId === u.id && !k.revokedAt).length);
  if (count >= 10) return { error: "You can have at most 10 active keys." };
  const secret = `afk_live_${randomBytes(24).toString("base64url")}`;
  await mutate((db) => void db.apiKeys.push({ id: id("key"), userId: u.id, name: name.data, prefix: secret.slice(0, 14), hash: sha256(secret), createdAt: now(), lastUsedAt: null, revokedAt: null }));
  await audit(u.id, "apikey.created", name.data);
  revalidatePath("/dashboard/api-keys");
  return { ok: "Key created. Copy it now — it won't be shown again.", secret };
}

export async function revokeApiKeyAction(fd: FormData) {
  const u = await requireUser();
  const kid = String(fd.get("id"));
  await mutate((db) => {
    const k = db.apiKeys.find((x) => x.id === kid && x.userId === u.id);
    if (k && !k.revokedAt) k.revokedAt = now();
  });
  await audit(u.id, "apikey.revoked", kid);
  revalidatePath("/dashboard/api-keys");
}

// ───────────── Provider keys (BYO) ─────────────
export async function saveProviderKeyAction(_: S, fd: FormData): Promise<S> {
  const u = await requireUser();
  const s = z.object({ provider: z.enum(["openai", "anthropic", "gemini"]), key: z.string().trim().min(20, "That doesn't look like an API key.").max(300) }).safeParse(Object.fromEntries(fd));
  if (!s.success) return { error: s.error.issues[0].message };
  await mutate((db) => {
    db.providerSecrets = db.providerSecrets.filter((p) => !(p.userId === u.id && p.provider === s.data.provider));
    db.providerSecrets.push({ userId: u.id, provider: s.data.provider, ciphertext: encrypt(s.data.key), last4: s.data.key.slice(-4), createdAt: now() });
  });
  await audit(u.id, "integration.provider_key_saved", s.data.provider);
  revalidatePath("/dashboard/integrations");
  return { ok: "Key saved (encrypted at rest). Runs of products you own will use it." };
}

export async function removeProviderKeyAction(fd: FormData) {
  const u = await requireUser();
  const provider = String(fd.get("provider"));
  await mutate((db) => void (db.providerSecrets = db.providerSecrets.filter((p) => !(p.userId === u.id && p.provider === provider))));
  await audit(u.id, "integration.provider_key_removed", provider);
  revalidatePath("/dashboard/integrations");
}

// ───────────── Knowledge bases ─────────────
export async function createKbAction(_: S, fd: FormData): Promise<S> {
  const u = await requireUser();
  const name = z.string().trim().min(2).max(80).safeParse(fd.get("name"));
  if (!name.success) return { error: "Name must be 2–80 characters." };
  const kid = id("kb");
  await mutate((db) => void db.knowledgeBases.push({ id: kid, userId: u.id, name: name.data, createdAt: now() }));
  redirect(`/dashboard/knowledge/${kid}`);
}

export async function uploadKbDocAction(_: S, fd: FormData): Promise<S> {
  const u = await requireUser();
  const kbId = String(fd.get("kbId"));
  const owns = await read((db) => db.knowledgeBases.some((k) => k.id === kbId && k.userId === u.id));
  if (!owns) return { error: "Knowledge base not found." };
  const file = fd.get("file");
  const text = String(fd.get("text") ?? "").trim();
  try {
    let doc: { name: string; pages: string[]; bytes: number };
    if (file instanceof File && file.size) doc = await fileToPages(file);
    else if (text.length >= 20) doc = { name: String(fd.get("title") || "Pasted text").slice(0, 120), pages: [text.slice(0, 400_000)], bytes: text.length };
    else return { error: "Choose a file or paste at least 20 characters." };
    const total = await read((db) => db.kbDocuments.filter((d) => d.userId === u.id).reduce((s, d) => s + d.bytes, 0));
    if (total + doc.bytes > 50 * 1024 * 1024) return { error: "Storage limit (50 MB) reached." };
    await mutate((db) => void db.kbDocuments.push({ id: id("doc"), kbId, userId: u.id, name: doc.name, pages: doc.pages, bytes: doc.bytes, createdAt: now() }));
    revalidatePath(`/dashboard/knowledge/${kbId}`);
    return { ok: `Added “${doc.name}” (${doc.pages.length} page${doc.pages.length === 1 ? "" : "s"}).` };
  } catch (e) {
    return { error: e instanceof HttpError ? e.message : "Could not process the file." };
  }
}

export async function deleteKbDocAction(fd: FormData) {
  const u = await requireUser();
  const docId = String(fd.get("id"));
  const kbId = String(fd.get("kbId"));
  await mutate((db) => void (db.kbDocuments = db.kbDocuments.filter((d) => !(d.id === docId && d.userId === u.id))));
  revalidatePath(`/dashboard/knowledge/${kbId}`);
}

export async function deleteKbAction(fd: FormData) {
  const u = await requireUser();
  const kbId = String(fd.get("id"));
  await mutate((db) => {
    if (!db.knowledgeBases.some((k) => k.id === kbId && k.userId === u.id)) return;
    db.knowledgeBases = db.knowledgeBases.filter((k) => k.id !== kbId);
    db.kbDocuments = db.kbDocuments.filter((d) => d.kbId !== kbId);
  });
  redirect("/dashboard/knowledge");
}

// ───────────── Support & refunds ─────────────
export async function createTicketAction(_: S, fd: FormData): Promise<S> {
  const u = await requireUser();
  const s = z.object({ subject: z.string().trim().min(4).max(140), body: z.string().trim().min(10).max(5000) }).safeParse(Object.fromEntries(fd));
  if (!s.success) return { error: s.error.issues[0].message };
  await mutate((db) => void db.tickets.push({ id: id("tkt"), userId: u.id, subject: s.data.subject, status: "open", messages: [{ from: "customer", authorId: u.id, body: s.data.body, at: now() }], createdAt: now() }));
  revalidatePath("/dashboard/support");
  return { ok: "Ticket created. We'll reply here and by email." };
}

export async function replyTicketAction(fd: FormData) {
  const u = await requireUser();
  const tid = String(fd.get("id"));
  const body = String(fd.get("body") ?? "").trim().slice(0, 5000);
  if (body.length < 2) return;
  await mutate((db) => {
    const t = db.tickets.find((x) => x.id === tid && x.userId === u.id);
    if (t && t.status !== "closed") {
      t.messages.push({ from: "customer", authorId: u.id, body, at: now() });
      t.status = "open";
    }
  });
  revalidatePath("/dashboard/support");
}

export async function requestRefundAction(_: S, fd: FormData): Promise<S> {
  const u = await requireUser();
  const orderId = String(fd.get("orderId"));
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 10) return { error: "Tell us briefly why (at least 10 characters)." };
  return mutate((db): S => {
    const o = db.orders.find((x) => x.id === orderId && x.userId === u.id);
    if (!o || o.status !== "paid") return { error: "Only paid orders can be refunded." };
    if (db.refunds.some((r) => r.orderId === orderId && r.status !== "rejected")) return { error: "A refund request already exists for this order." };
    db.refunds.push({ id: id("ref"), orderId, userId: u.id, reason: reason.slice(0, 2000), amountCents: o.totalCents - o.refundedCents, status: "requested", providerRef: null, createdAt: now(), decidedAt: null, decidedBy: null });
    return { ok: "Refund requested. You'll be notified when it is reviewed." };
  });
}

export async function markNotificationsReadAction() {
  const u = await requireUser();
  await mutate((db) => db.notifications.filter((n) => n.userId === u.id && !n.readAt).forEach((n) => (n.readAt = now())));
  revalidatePath("/dashboard");
}
