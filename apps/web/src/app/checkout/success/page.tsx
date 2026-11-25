import type { Metadata } from "next";
import { CheckCircle2, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { Card, Container, LinkButton, Notice } from "@/components/ui";
import { eur2 } from "@/lib/utils";
import { AutoRefresh } from "./auto-refresh";

export const metadata: Metadata = { title: "Order status", robots: { index: false } };

/** The redirect lands here, but access is granted only by the webhook. We just show the current state. */
export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const user = await requireUser();
  const { order: orderId } = await searchParams;
  const order = await read((db) => db.orders.find((o) => o.id === orderId && o.userId === user.id));
  if (!order) return <Container className="py-20"><Notice tone="danger">Order not found.</Notice></Container>;
  const paid = order.status === "paid";
  return (
    <Container className="max-w-xl py-16">
      <Card className="p-8 text-center">
        {paid ? <CheckCircle2 className="mx-auto size-12 text-success" /> : <Clock className="mx-auto size-12 text-warning" />}
        <h1 className="mt-4 text-2xl font-semibold">{paid ? "Payment confirmed" : order.status === "pending" ? "Waiting for payment confirmation" : `Order ${order.status}`}</h1>
        <p className="mt-2 text-muted">
          {paid ? `Order ${order.number} · ${eur2(order.totalCents)}. Your products are ready.` : order.status === "pending" ? "We grant access as soon as the payment provider confirms the payment. This page refreshes automatically." : "No access was granted for this order."}
        </p>
        {!paid && order.status === "pending" && <AutoRefresh />}
        {paid && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <LinkButton href="/dashboard/purchases">Go to my purchases</LinkButton>
            <LinkButton href={`/dashboard/invoices/${order.id}`} variant="outline">View invoice</LinkButton>
          </div>
        )}
      </Card>
    </Container>
  );
}
