import type { Product } from "./types.ts";
import { scoreProduct } from "./search.ts";

/**
 * Deterministic recommendation engine used by the marketplace assistant.
 * It only ever returns products that exist in the catalog, with their real
 * prices and availability. No LLM is needed; if one is configured the UI may
 * use it to phrase the explanation, but the product set comes from here.
 */

const NEEDS: { key: string; label: string; terms: string[] }[] = [
  { key: "content", label: "Content creation", terms: ["content", "blog", "article", "copy", "writing", "newsletter", "seo", "social"] },
  { key: "leads", label: "Lead research & sales", terms: ["lead", "leads", "prospect", "sales", "crm", "outbound", "pipeline", "account"] },
  { key: "reporting", label: "Reporting & analysis", terms: ["report", "reporting", "analytics", "dashboard", "kpi", "analysis", "data", "insight"] },
  { key: "support", label: "Customer support", terms: ["support", "customer service", "tickets", "helpdesk", "faq", "help desk"] },
  { key: "documents", label: "Documents & knowledge", terms: ["pdf", "document", "documents", "knowledge", "contract", "policy", "wiki", "summar"] },
  { key: "finance", label: "Finance & invoices", terms: ["invoice", "invoices", "accounting", "bookkeeping", "expense", "finance", "vat"] },
  { key: "email", label: "Email", terms: ["email", "emails", "inbox", "gmail", "reply", "replies"] },
  { key: "ecommerce", label: "E-commerce", terms: ["shop", "store", "ecommerce", "e-commerce", "product description", "shopify", "orders"] },
  { key: "recruiting", label: "Recruitment", terms: ["hiring", "recruit", "recruitment", "candidates", "resume", "cv", "job"] },
  { key: "research", label: "Research", terms: ["research", "market", "competitor", "competitors", "due diligence", "brief"] },
  { key: "dev", label: "Development", terms: ["developer", "code", "api", "mcp", "sdk", "rag", "build my own", "framework", "boilerplate"] },
  { key: "automation", label: "Workflow automation", terms: ["automate", "automation", "workflow", "n8n", "zapier", "sync"] },
];

export interface Recommendation {
  product: Product;
  reasons: string[];
  need: string | null;
}

export interface AssistantResult {
  budgetEur: number | null;
  needs: string[];
  recommendations: Recommendation[];
  bundle: { items: Product[]; totalEur: number } | null;
  notes: string[];
}

export function parseBudget(text: string): number | null {
  const t = text.toLowerCase().replace(/,/g, "");
  const m =
    t.match(/(?:under|below|less than|max(?:imum)?|up to|budget(?: of| is)?|within)\s*(?:€|eur|euro|euros)?\s*(\d{2,5})/) ||
    t.match(/(?:€|eur)\s*(\d{2,5})\s*(?:budget|max|total)?/) ||
    t.match(/(\d{2,5})\s*(?:€|eur|euros?)/);
  return m ? Number(m[1]) : null;
}

export function detectNeeds(text: string): typeof NEEDS {
  const t = ` ${text.toLowerCase()} `;
  return NEEDS.filter((n) => n.terms.some((term) => t.includes(term)));
}

export function recommend(all: Product[], text: string, opts: { limit?: number; includeComingSoon?: boolean } = {}): AssistantResult {
  const limit = opts.limit ?? 6;
  const budget = parseBudget(text);
  const needs = detectNeeds(text);
  const notes: string[] = [];
  const candidates = all.filter((p) => p.status !== "draft" && p.status !== "archived");

  const scored = candidates
    .map((p) => {
      let s = scoreProduct(p, text);
      const reasons: string[] = [];
      let matchedNeed: string | null = null;
      for (const n of needs) {
        const ns = scoreProduct(p, n.terms.join(" "));
        if (ns > 0) {
          s += ns * 0.6;
          if (!matchedNeed) matchedNeed = n.label;
        }
      }
      if (matchedNeed) reasons.push(`Matches your need: ${matchedNeed.toLowerCase()}`);
      if (budget != null && p.priceCents <= budget * 100) reasons.push(`Within your €${budget} budget`);
      if (p.status === "published") {
        s *= 1.35;
        reasons.push("Available now");
      } else {
        reasons.push("Coming soon — not yet purchasable");
      }
      if (p.costPerRunEur) reasons.push(`Est. €${p.costPerRunEur[0].toFixed(3)}–€${p.costPerRunEur[1].toFixed(2)} provider cost per run`);
      return { product: p, score: s, reasons, need: matchedNeed };
    })
    .filter((x) => x.score > 0)
    .filter((x) => budget == null || x.product.priceCents <= budget * 100)
    .filter((x) => opts.includeComingSoon !== false || x.product.status === "published")
    .sort((a, b) => b.score - a.score);

  const recommendations = scored.slice(0, limit).map(({ product, reasons, need }) => ({ product, reasons, need }));

  // Bundle: best available product per detected need, staying within budget.
  let bundle: AssistantResult["bundle"] = null;
  if (needs.length > 1) {
    const chosen: Product[] = [];
    let total = 0;
    for (const n of needs) {
      const best = scored.find(
        (x) => x.need === n.label && x.product.status === "published" && !chosen.includes(x.product) && (budget == null || total + x.product.priceCents / 100 <= budget),
      );
      if (best) {
        chosen.push(best.product);
        total += best.product.priceCents / 100;
      }
    }
    if (chosen.length > 1) bundle = { items: chosen, totalEur: total };
  }

  if (!needs.length && !recommendations.length) notes.push("I couldn't match that to products in the catalogue. Try describing the task, e.g. 'summarise PDFs' or 'research leads'.");
  if (budget != null && !recommendations.length) notes.push(`Nothing in the catalogue matches within €${budget}. The cheapest listing is €10.`);
  const unavailable = needs.filter((n) => !scored.some((x) => x.need === n.label && x.product.status === "published"));
  for (const n of unavailable) notes.push(`No product for "${n.label.toLowerCase()}" is available to buy yet; matching listings are marked Coming soon.`);

  return { budgetEur: budget, needs: needs.map((n) => n.label), recommendations, bundle, notes };
}
