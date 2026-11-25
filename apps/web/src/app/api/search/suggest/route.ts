import { suggest } from "@agentforge/catalog";
import { getProducts } from "@/lib/catalog";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 100) ?? "";
  return Response.json({ items: suggest(await getProducts(), q, 7) }, { headers: { "Cache-Control": "public, max-age=60" } });
}
