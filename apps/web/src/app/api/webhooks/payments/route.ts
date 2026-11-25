import { WebhookSignatureError } from "@agentforge/commerce";
import { handlePaymentEvent, paymentProvider } from "@/lib/commerce";
import { audit } from "@/lib/db";

export const runtime = "nodejs";

/** Payment provider webhook. Signature verified on the raw body; fulfilment is idempotent per event id. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 512_000) return new Response("Payload too large", { status: 413 });
  let evt;
  try {
    evt = await paymentProvider().parseWebhook(raw, req.headers);
  } catch (e) {
    if (e instanceof WebhookSignatureError || e instanceof SyntaxError) {
      await audit(null, "payment.webhook_rejected", "webhook", { reason: (e as Error).message });
      return new Response("Invalid signature", { status: 400 });
    }
    console.error("[webhook]", e);
    return new Response("Webhook error", { status: 500 });
  }
  if (!evt) return Response.json({ received: true, ignored: true });
  const result = await handlePaymentEvent(evt);
  return Response.json({ received: true, result });
}
