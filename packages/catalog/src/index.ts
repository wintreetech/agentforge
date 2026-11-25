import { buildProducts } from "./build.ts";
import type { Product } from "./types.ts";

export * from "./types.ts";
export * from "./categories.ts";
export * from "./search.ts";
export * from "./recommend.ts";
export { FUNCTIONAL_SLUGS, PRODUCT_SCREENSHOTS, slugify, deliveryLabel } from "./build.ts";

/** Seed catalog. Runtime overrides (admin edits) are layered on top in the web app's data store. */
export const seedProducts: Product[] = buildProducts();

export function formatEur(cents: number, opts: { decimals?: boolean } = {}): string {
  const showDecimals = opts.decimals ?? cents % 100 !== 0;
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(cents / 100);
}

export const allIntegrations = (ps: Product[]) => [...new Set(ps.flatMap((p) => p.integrations))].sort();
export const allIndustries = (ps: Product[]) => [...new Set(ps.flatMap((p) => p.industries))].sort();
