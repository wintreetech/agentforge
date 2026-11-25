import type { Product } from "./types.ts";

export type SortKey = "relevance" | "price-asc" | "price-desc" | "newest" | "popular";

export interface ProductQuery {
  q?: string;
  category?: string[];
  minPrice?: number; // EUR
  maxPrice?: number; // EUR
  provider?: string[];
  integration?: string[];
  industry?: string[];
  difficulty?: string[];
  license?: string[];
  availability?: string[]; // "available" | "coming_soon"
  hosting?: string[]; // "hosted" | "self-hosted"
  sort?: SortKey;
  page?: number;
  perPage?: number;
}

export interface QueryResult {
  items: Product[];
  total: number;
  page: number;
  pages: number;
  perPage: number;
}

const STOP = new Set(["a", "an", "the", "and", "or", "for", "to", "of", "in", "on", "with", "my", "our", "i", "we", "need", "want", "that", "is", "are", "it", "ai", "tool", "tools"]);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9€\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Very light stemming so "invoices" matches "invoice", "summarizing" matches "summarize". */
export function stem(t: string): string {
  return t
    .replace(/(ies)$/, "y")
    .replace(/(ization|isation)$/, "ize")
    .replace(/(izing|ising|izer|iser|ized|ised)$/, "ize")
    .replace(/(ing|ers|er|es|s)$/, "")
    .slice(0, 12);
}

function fieldText(p: Product) {
  return {
    title: p.title,
    tag: p.shortDescription,
    body: [p.description, p.subcategory, ...p.capabilities, ...p.useCases, ...p.audience, ...p.industries, ...p.integrations].join(" "),
  };
}

/** Lexical relevance score (BM25-lite with field weights). 0 = no match. */
export function scoreProduct(p: Product, query: string): number {
  const qs = tokenize(query).map(stem);
  if (!qs.length) return 0;
  const f = fieldText(p);
  const fields: [string[], number][] = [
    [tokenize(f.title).map(stem), 6],
    [tokenize(f.tag).map(stem), 3],
    [tokenize(f.body).map(stem), 1],
  ];
  let score = 0;
  let matched = 0;
  for (const q of qs) {
    let hit = false;
    for (const [tokens, w] of fields) {
      const tf = tokens.filter((t) => t === q || (q.length >= 4 && t.startsWith(q))).length;
      if (tf) {
        hit = true;
        score += (w * (tf * 2.2)) / (tf + 1.2);
      }
    }
    if (hit) matched++;
  }
  if (!matched) return 0;
  // Reward covering more of the query.
  return score * (matched / qs.length);
}

const has = (list: string[] | undefined) => Array.isArray(list) && list.length > 0;

export function filterProducts(all: Product[], query: ProductQuery, popularity: Record<string, number> = {}): QueryResult {
  let items = all.filter((p) => p.status !== "draft" && p.status !== "archived");
  const q = query.q?.trim();
  const scores = new Map<string, number>();

  if (q) {
    for (const p of items) scores.set(p.slug, scoreProduct(p, q));
    items = items.filter((p) => (scores.get(p.slug) ?? 0) > 0);
  }
  if (has(query.category)) items = items.filter((p) => query.category!.includes(p.category));
  if (query.minPrice != null) items = items.filter((p) => p.priceCents >= query.minPrice! * 100);
  if (query.maxPrice != null) items = items.filter((p) => p.priceCents <= query.maxPrice! * 100);
  if (has(query.provider)) items = items.filter((p) => p.providers.some((x) => query.provider!.includes(x)));
  if (has(query.integration)) items = items.filter((p) => p.integrations.some((x) => query.integration!.includes(x)));
  if (has(query.industry)) items = items.filter((p) => p.industries.some((x) => query.industry!.includes(x)));
  if (has(query.difficulty)) items = items.filter((p) => query.difficulty!.includes(p.difficulty));
  if (has(query.license)) items = items.filter((p) => query.license!.includes(p.license));
  if (has(query.availability)) {
    items = items.filter((p) =>
      query.availability!.some((a) => (a === "available" ? p.status === "published" || p.status === "beta" : p.status === a)),
    );
  }
  if (has(query.hosting)) {
    items = items.filter((p) => query.hosting!.some((h) => p.hosting === h || p.hosting === "both"));
  }

  const sort = query.sort ?? (q ? "relevance" : "popular");
  const byDate = (p: Product) => (p.publishedAt ? Date.parse(p.publishedAt) : 0);
  items = [...items].sort((a, b) => {
    switch (sort) {
      case "price-asc":
        return a.priceCents - b.priceCents;
      case "price-desc":
        return b.priceCents - a.priceCents;
      case "newest":
        return byDate(b) - byDate(a) || a.priceCents - b.priceCents;
      case "popular":
        // Genuine popularity = completed order count. Ties: available first, then newest.
        return (
          (popularity[b.slug] ?? 0) - (popularity[a.slug] ?? 0) ||
          Number(b.status === "published") - Number(a.status === "published") ||
          byDate(b) - byDate(a) ||
          a.priceCents - b.priceCents
        );
      case "relevance":
      default:
        return (scores.get(b.slug) ?? 0) - (scores.get(a.slug) ?? 0) || a.priceCents - b.priceCents;
    }
  });

  const perPage = Math.min(Math.max(query.perPage ?? 12, 1), 60);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(query.page ?? 1, 1), pages);
  return { items: items.slice((page - 1) * perPage, page * perPage), total, page, pages, perPage };
}

export function suggest(all: Product[], prefix: string, limit = 6): { label: string; slug: string }[] {
  const q = prefix.trim().toLowerCase();
  if (q.length < 2) return [];
  const starts = all.filter((p) => p.title.toLowerCase().includes(q));
  const scored = all
    .filter((p) => !starts.includes(p))
    .map((p) => ({ p, s: scoreProduct(p, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
  return [...starts, ...scored].slice(0, limit).map((p) => ({ label: p.title, slug: p.slug }));
}

/** Parse URLSearchParams-like record into a ProductQuery. */
export function parseQuery(sp: Record<string, string | string[] | undefined>): ProductQuery {
  const list = (k: string) => {
    const v = sp[k];
    if (v == null) return undefined;
    const arr = (Array.isArray(v) ? v : [v]).flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean);
    return arr.length ? arr : undefined;
  };
  const num = (k: string) => {
    const v = sp[k];
    const n = Number(Array.isArray(v) ? v[0] : v);
    return Number.isFinite(n) && v != null && v !== "" ? n : undefined;
  };
  const sortRaw = (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort) as SortKey | undefined;
  const sorts: SortKey[] = ["relevance", "price-asc", "price-desc", "newest", "popular"];
  return {
    q: (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.slice(0, 200),
    category: list("category"),
    minPrice: num("min"),
    maxPrice: num("max"),
    provider: list("provider"),
    integration: list("integration"),
    industry: list("industry"),
    difficulty: list("difficulty"),
    license: list("license"),
    availability: list("availability"),
    hosting: list("hosting"),
    sort: sortRaw && sorts.includes(sortRaw) ? sortRaw : undefined,
    page: num("page"),
  };
}
