import "server-only";
import { cache } from "react";
import { seedProducts, type Product } from "@agentforge/catalog";
import { read } from "./db";

/** Catalog = seed data + admin overrides. Popularity = real paid order counts. */
export const getProducts = cache(async (): Promise<Product[]> => {
  const overrides = await read((db) => db.productOverrides);
  if (!overrides.length) return seedProducts;
  const map = new Map(overrides.map((o) => [o.slug, o]));
  return seedProducts.map((p) => {
    const o = map.get(p.slug);
    if (!o) return p;
    return { ...p, status: o.status ?? p.status, priceCents: o.priceCents ?? p.priceCents, shortDescription: o.shortDescription ?? p.shortDescription, updatedAt: o.updatedAt.slice(0, 10) };
  });
});

export const getProduct = cache(async (slug: string) => (await getProducts()).find((p) => p.slug === slug) ?? null);

export const getPopularity = cache(async (): Promise<Record<string, number>> =>
  read((db) => {
    const counts: Record<string, number> = {};
    for (const o of db.orders) if (o.status === "paid" || o.status === "partially_refunded") for (const i of o.items) counts[i.slug] = (counts[i.slug] ?? 0) + i.quantity;
    return counts;
  }),
);

export const isPurchasable = (p: Product) => (p.status === "published" || p.status === "beta") && p.functional;

export async function getVerifiedReviews(slug: string) {
  return read((db) => db.reviews.filter((r) => r.slug === slug).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}
