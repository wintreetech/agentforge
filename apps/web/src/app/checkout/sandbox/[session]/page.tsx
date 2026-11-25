import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { env } from "@/lib/env";
import { Card, Container, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { eur2 } from "@/lib/utils";
import { completeSandboxPayment } from "./actions";

export const metadata: Metadata = { title: "Sandbox payment", robots: { index: false } };

/**
 * Stand-in for a provider-hosted checkout page in development. It never collects
 * card details. Completing it makes the server send itself a signed webhook.
 */
export default async function SandboxCheckout({ params }: { params: Promise<{ session: string }> }) {
  if (env.paymentProvider !== "sandbox") notFound();
  const user = await requireUser();
  const { session } = await params;
  const order = await read((db) => db.orders.find((o) => o.sessionId === decodeURIComponent(session) && o.userId === user.id));
  if (!order) notFound();
  return (
    <Container className="max-w-lg py-16">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-accent-3/30 bg-accent-3/10 px-5 py-3 text-[13px] font-medium">
          <FlaskConical className="size-4 text-accent-3" /> Development payment sandbox — no real payment is taken
        </div>
        <div className="p-6">
          <p className="text-[13px] text-muted">Order {order.id}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{eur2(order.totalCents)}</p>
          <ul className="mt-4 space-y-1 text-[13.5px] text-muted">{order.items.map((i) => <li key={i.slug}>{i.title} ({i.license})</li>)}</ul>
          {order.status === "pending" ? (
            <div className="mt-6 grid gap-2">
              <form action={completeSandboxPayment}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="outcome" value="paid" />
                <SubmitButton size="lg" className="w-full" pendingText="Sending signed webhook…">Simulate successful payment</SubmitButton>
              </form>
              <form action={completeSandboxPayment}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="outcome" value="expired" />
                <SubmitButton variant="outline" size="lg" className="w-full">Simulate abandoned checkout</SubmitButton>
              </form>
            </div>
          ) : (
            <div className="mt-6">
              <p className="text-[14px]">This order is <strong>{order.status}</strong>.</p>
              <LinkButton href={`/checkout/success?order=${order.id}`} className="mt-4">View order</LinkButton>
            </div>
          )}
          <p className="mt-5 text-[12px] leading-relaxed text-subtle">With PAYMENT_PROVIDER=stripe, this step is Stripe&apos;s hosted Checkout in test mode and fulfilment is driven by Stripe&apos;s signed webhook.</p>
        </div>
      </Card>
    </Container>
  );
}
