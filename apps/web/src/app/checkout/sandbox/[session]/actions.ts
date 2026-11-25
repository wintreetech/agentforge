"use server";

import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { sandboxProvider } from "@/lib/commerce";
import { read } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * The sandbox "provider" posts a signed event to the public webhook endpoint,
 * so the exact production fulfilment path (signature check → idempotent
 * fulfilment) is exercised. It does not call handlePaymentEvent directly.
 */
export async function completeSandboxPayment(fd: FormData) {
  if (env.paymentProvider !== "sandbox") throw new Error("Sandbox disabled");
  const user = await requireUser();
  const orderId = String(fd.get("orderId"));
  const outcome = fd.get("outcome") === "expired" ? "checkout.expired" : "checkout.completed";
  const order = await read((db) => db.orders.find((o) => o.id === orderId && o.userId === user.id));
  if (!order || order.status !== "pending") redirect(`/checkout/success?order=${orderId}`);
  const evt = { id: `sbx_evt_${randomBytes(8).toString("hex")}`, type: outcome, orderId, paymentRef: `sbx_pay_${randomBytes(6).toString("hex")}`, amountCents: order.totalCents, currency: "EUR" };
  const raw = JSON.stringify(evt);
  const res = await fetch(`${env.appUrl}/api/webhooks/payments`, { method: "POST", headers: { "Content-Type": "application/json", "x-agentforge-signature": sandboxProvider().sign(raw) }, body: raw });
  if (!res.ok) throw new Error(`Webhook delivery failed: ${res.status}`);
  redirect(outcome === "checkout.expired" ? "/cart?cancelled=1" : `/checkout/success?order=${orderId}`);
}
