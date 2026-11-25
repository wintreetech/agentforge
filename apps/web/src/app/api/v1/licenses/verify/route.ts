import { z } from "zod";
import { licenseKeyWellFormed } from "@agentforge/commerce";
import { read } from "@/lib/db";
import { env } from "@/lib/env";
import { apiError, publicRateLimit } from "@/lib/api-auth";

/**
 * POST /api/v1/licenses/verify {"key": "AF-…", "product": "optional-slug"}
 * Public, rate-limited. Reveals only validity, product, licence type and status — no customer data.
 */
export async function POST(req: Request) {
  const limited = publicRateLimit(req, "license", 20);
  if (limited) return limited;
  const body = z.object({ key: z.string().trim().max(64), product: z.string().max(120).optional() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_request", "Body must be JSON: {\"key\": \"AF-…\"}");
  const key = body.data.key.toUpperCase();
  if (!licenseKeyWellFormed(env.licenseSecret, key)) return Response.json({ valid: false, reason: "malformed" });
  const k = await read((db) => db.licenseKeys.find((x) => x.key === key));
  if (!k) return Response.json({ valid: false, reason: "not_found" });
  if (body.data.product && body.data.product !== k.slug) return Response.json({ valid: false, reason: "product_mismatch" });
  return Response.json({ valid: k.status === "active", status: k.status, product: k.slug, license: k.license, issued_at: k.createdAt });
}
