import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { getProducts } from "@/lib/catalog";
import { toggleWishlistAction } from "@/app/actions/shop";
import { ProductCard } from "@/components/product-card";
import { Container, EmptyState, LinkButton, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default async function Wishlist() {
  const user = await requireUser("/wishlist");
  const [slugs, products] = await Promise.all([read((db) => db.wishlist.filter((w) => w.userId === user.id).map((w) => w.slug)), getProducts()]);
  const items = slugs.map((s) => products.find((p) => p.slug === s)).filter((p) => !!p);
  return (
    <Container className="py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Wishlist</h1>
        {items.length > 1 && <LinkButton href={`/compare?ids=${items.slice(0, 4).map((p) => p.slug).join(",")}`} variant="outline" size="sm">Compare</LinkButton>}
      </div>
      {items.length === 0 ? (
        <div className="mt-8"><EmptyState icon={<Heart className="size-5" />} title="Nothing saved yet" action={<LinkButton href="/marketplace">Browse products</LinkButton>}>Save Coming soon products to be notified at release.</EmptyState></div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.slug} className="space-y-2">
              <ProductCard p={p} />
              <form action={toggleWishlistAction}>
                <input type="hidden" name="slug" value={p.slug} />
                <input type="hidden" name="back" value="/wishlist" />
                <button className={buttonClass("ghost", "sm")}>Remove from wishlist</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
