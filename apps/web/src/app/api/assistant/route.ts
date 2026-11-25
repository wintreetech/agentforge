import { z } from "zod";
import { recommend } from "@agentforge/catalog";
import { getProducts } from "@/lib/catalog";
import { clientIp, rateLimit } from "@/lib/security";

export async function POST(req: Request) {
  if (!rateLimit(`assist:${clientIp(req)}`, 30, 60_000).ok) return Response.json({ error: "Too many requests" }, { status: 429 });
  const body = z.object({ query: z.string().trim().min(3).max(600) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Describe what you need in a few words." }, { status: 400 });
  const r = recommend(await getProducts(), body.data.query, { limit: 8 });
  const slim = (p: (typeof r.recommendations)[number]["product"]) => ({ slug: p.slug, title: p.title, priceCents: p.priceCents, status: p.status, shortDescription: p.shortDescription, category: p.category, costPerRunEur: p.costPerRunEur, thumbnail: p.thumbnail });
  return Response.json({
    budgetEur: r.budgetEur,
    needs: r.needs,
    notes: r.notes,
    recommendations: r.recommendations.map((x) => ({ product: slim(x.product), reasons: x.reasons, need: x.need })),
    bundle: r.bundle ? { totalEur: r.bundle.totalEur, items: r.bundle.items.map(slim) } : null,
  });
}
