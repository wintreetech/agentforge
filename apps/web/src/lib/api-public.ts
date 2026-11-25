import type { Product } from "@agentforge/catalog";

export const toPublic = (p: Product) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  short_description: p.shortDescription,
  category: p.category,
  price: { amount: p.priceCents, currency: p.currency },
  status: p.status,
  purchasable: p.status === "published" && p.functional,
  delivery: p.delivery,
  hosting: p.hosting,
  license: p.license,
  version: p.version,
  integrations: p.integrations,
  cost_per_run_eur: p.costPerRunEur,
  url: `/products/${p.slug}`,
});
