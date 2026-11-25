import { filterProducts, parseQuery } from "@agentforge/catalog";
import { getPopularity, getProducts } from "@/lib/catalog";
import { publicRateLimit } from "@/lib/api-auth";
import { toPublic } from "@/lib/api-public";

/** GET /api/v1/products — public catalogue with the same filters as /marketplace. */
export async function GET(req: Request) {
  const limited = publicRateLimit(req, "products", 60);
  if (limited) return limited;
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const q = parseQuery(sp);
  const r = filterProducts(await getProducts(), { ...q, perPage: Math.min(Number(sp.per_page) || 20, 60) }, await getPopularity());
  return Response.json({ data: r.items.map(toPublic), page: r.page, pages: r.pages, total: r.total });
}
