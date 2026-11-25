import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, Trash2 } from "lucide-react";
import { getAnonKey, getUser } from "@/lib/auth";
import { allowsQuantity, cartTotals, getCart } from "@/lib/commerce";
import { removeFromCartAction, updateCartAction } from "@/app/actions/shop";
import { Card, Container, EmptyState, LinkButton, Notice, buttonClass } from "@/components/ui";
import { eur2, licenseLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

export default async function CartPage({ searchParams }: { searchParams: Promise<{ added?: string; cancelled?: string }> }) {
  const sp = await searchParams;
  const user = await getUser();
  const key = user?.id ?? (await getAnonKey());
  const lines = await getCart(key);
  const { totals } = await cartTotals(lines, null, "US");

  return (
    <Container className="py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Cart</h1>
      {sp.cancelled && <Notice tone="warning" className="mt-4">Checkout was cancelled. Nothing was charged; your cart is unchanged.</Notice>}
      {sp.added && <Notice tone="success" className="mt-4">Added to your cart.</Notice>}
      {lines.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<ShoppingBag className="size-5" />} title="Your cart is empty" action={<LinkButton href="/marketplace">Browse the marketplace</LinkButton>}>
            Products marked Available can be added to your cart.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 [&>*]:min-w-0 gap-8 lg:grid-cols-[1fr_360px]">
          <ul className="space-y-3">
            {lines.map((l) => (
              <li key={l.slug} className="flex gap-4 rounded-2xl border border-border bg-surface p-3">
                <Link href={`/products/${l.slug}`} className="relative aspect-[3/2] w-32 shrink-0 overflow-hidden rounded-xl">
                  <Image src={l.product.thumbnail} alt="" fill sizes="128px" className="object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/products/${l.slug}`} className="font-medium hover:underline">{l.product.title}</Link>
                  <p className="text-[13px] text-muted">{licenseLabel[l.license]} licence</p>
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                    {allowsQuantity(l.product) ? (
                      <form action={updateCartAction} className="flex items-center gap-2">
                        <input type="hidden" name="slug" value={l.slug} />
                        <label htmlFor={`q-${l.slug}`} className="text-[12.5px] text-muted">Seats</label>
                        <input id={`q-${l.slug}`} name="quantity" type="number" min={1} max={50} defaultValue={l.quantity} className="h-8 w-16 rounded-lg border border-border bg-bg-2 px-2 text-sm" />
                        <button className={buttonClass("ghost", "sm")}>Update</button>
                      </form>
                    ) : (
                      <span className="text-[12.5px] text-subtle" title="Single-licence product">Qty 1</span>
                    )}
                    <form action={removeFromCartAction}>
                      <input type="hidden" name="slug" value={l.slug} />
                      <button className={buttonClass("ghost", "sm", "text-danger")} aria-label={`Remove ${l.product.title}`}><Trash2 className="size-3.5" /> Remove</button>
                    </form>
                  </div>
                </div>
                <p className="font-semibold tabular-nums">{eur2(l.unitCents * l.quantity)}</p>
              </li>
            ))}
          </ul>
          <Card className="h-fit p-5 lg:sticky lg:top-24">
            <p className="font-semibold">Order summary</p>
            <dl className="mt-4 space-y-2 text-[14px]">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{eur2(totals.subtotalCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">VAT</dt><dd className="text-muted">Calculated at checkout</dd></div>
            </dl>
            <p className="mt-3 text-[12.5px] text-subtle">Discount codes and VAT are applied on the next step.</p>
            <LinkButton href="/checkout" size="lg" className="mt-5 w-full">Continue to checkout</LinkButton>
            {!user && <p className="mt-3 text-center text-[12.5px] text-muted">You’ll be asked to sign in. Your cart is kept.</p>}
          </Card>
        </div>
      )}
    </Container>
  );
}
