import { getProduct } from "@/lib/catalog";
import { apiError, publicRateLimit } from "@/lib/api-auth";
import { toPublic } from "@/lib/api-public";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const limited = publicRateLimit(req, "product", 60);
  if (limited) return limited;
  const p = await getProduct((await ctx.params).slug);
  if (!p || p.status === "draft" || p.status === "archived") return apiError(404, "not_found", "Product not found.");
  return Response.json({ data: { ...toPublic(p), description: p.description, capabilities: p.capabilities, inputs: p.inputs, outputs: p.outputs, requirements: p.requirements, changelog: p.changelog } });
}
