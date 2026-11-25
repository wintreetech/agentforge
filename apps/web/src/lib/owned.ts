import "server-only";
import type { Product } from "@agentforge/catalog";
import { getProducts } from "./catalog";
import { read, type Entitlement } from "./db";

export async function ownedProducts(userId: string): Promise<{ product: Product; entitlement: Entitlement }[]> {
  const [ents, products] = await Promise.all([read((db) => db.entitlements.filter((e) => e.userId === userId && e.status === "active")), getProducts()]);
  return ents.map((e) => ({ entitlement: e, product: products.find((p) => p.slug === e.slug)! })).filter((x) => x.product);
}
