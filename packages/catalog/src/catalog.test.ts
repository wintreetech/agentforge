import { describe, expect, it } from "vitest";
import { seedProducts, categories, filterProducts, parseQuery, recommend, parseBudget, suggest, FUNCTIONAL_SLUGS } from "./index.ts";

describe("catalog", () => {
  it("has 60 products across 6 categories with at least 10 each", () => {
    expect(seedProducts).toHaveLength(60);
    for (const c of categories) {
      expect(seedProducts.filter((p) => p.category === c.slug).length).toBeGreaterThanOrEqual(10);
    }
  });

  it("prices are within €10–€800 and stored as integer cents", () => {
    for (const p of seedProducts) {
      expect(Number.isInteger(p.priceCents)).toBe(true);
      expect(p.priceCents).toBeGreaterThanOrEqual(1000);
      expect(p.priceCents).toBeLessThanOrEqual(80000);
    }
  });

  it("has unique ids, slugs and thumbnails", () => {
    const uniq = (xs: string[]) => new Set(xs).size === xs.length;
    expect(uniq(seedProducts.map((p) => p.id))).toBe(true);
    expect(uniq(seedProducts.map((p) => p.slug))).toBe(true);
    expect(uniq(seedProducts.map((p) => p.thumbnail))).toBe(true);
  });

  it("matches the specified prices for spot-checked products", () => {
    const price = (slug: string) => seedProducts.find((p) => p.slug === slug)!.priceCents / 100;
    expect(price("ai-resume-cover-letter-builder")).toBe(10);
    expect(price("complete-ai-business-automation-suite")).toBe(799);
    expect(price("mcp-server-developer-kit")).toBe(99);
    expect(price("multi-agent-research-team")).toBe(249);
  });

  it("only the 10 functional products are published", () => {
    const published = seedProducts.filter((p) => p.status === "published").map((p) => p.slug).sort();
    expect(published).toEqual([...FUNCTIONAL_SLUGS].sort());
    for (const p of seedProducts.filter((x) => !x.functional)) expect(p.status).toBe("coming_soon");
  });
});

describe("filters and search", () => {
  it("filters by category and price range", () => {
    const r = filterProducts(seedProducts, { category: ["ai-agents"], minPrice: 100, maxPrice: 200, perPage: 60 });
    expect(r.items.length).toBeGreaterThan(0);
    for (const p of r.items) {
      expect(p.category).toBe("ai-agents");
      expect(p.priceCents).toBeGreaterThanOrEqual(10000);
      expect(p.priceCents).toBeLessThanOrEqual(20000);
    }
  });

  it("sorts by price ascending and descending", () => {
    const asc = filterProducts(seedProducts, { sort: "price-asc", perPage: 60 }).items;
    expect(asc[0].priceCents).toBe(1000);
    const desc = filterProducts(seedProducts, { sort: "price-desc", perPage: 60 }).items;
    expect(desc[0].priceCents).toBe(79900);
  });

  it("full-text search finds invoice products", () => {
    const r = filterProducts(seedProducts, { q: "extract invoices", perPage: 60 });
    expect(r.items[0].slug).toBe("ai-invoice-data-extractor");
  });

  it("availability filter returns only purchasable products", () => {
    const r = filterProducts(seedProducts, { availability: ["available"], perPage: 60 });
    expect(r.total).toBe(10);
  });

  it("paginates", () => {
    const r = filterProducts(seedProducts, { perPage: 12, page: 2 });
    expect(r.page).toBe(2);
    expect(r.pages).toBe(5);
    expect(r.items).toHaveLength(12);
  });

  it("parses query strings, including comma lists", () => {
    const q = parseQuery({ category: "ai-agents,developer-kits", min: "20", max: "300", sort: "newest", q: "rag" });
    expect(q.category).toEqual(["ai-agents", "developer-kits"]);
    expect(q.minPrice).toBe(20);
    expect(q.sort).toBe("newest");
  });

  it("suggests titles", () => {
    expect(suggest(seedProducts, "pdf")[0].label).toBe("AI PDF Summarizer");
  });
});

describe("recommendation assistant", () => {
  it("parses budgets", () => {
    expect(parseBudget("under €300")).toBe(300);
    expect(parseBudget("budget of 500 euros")).toBe(500);
    expect(parseBudget("no budget mentioned")).toBeNull();
  });

  it("only recommends real products within budget", () => {
    const r = recommend(seedProducts, "I run a marketing agency and need to automate content creation, lead research and client reporting. Budget €400");
    expect(r.budgetEur).toBe(400);
    expect(r.recommendations.length).toBeGreaterThan(0);
    const slugs = new Set(seedProducts.map((p) => p.slug));
    for (const rec of r.recommendations) {
      expect(slugs.has(rec.product.slug)).toBe(true);
      expect(rec.product.priceCents).toBeLessThanOrEqual(40000);
    }
    expect(r.needs).toContain("Content creation");
  });
});
