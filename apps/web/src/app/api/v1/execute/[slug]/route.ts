import { z } from "zod";
import { authenticateApiKey, apiError } from "@/lib/api-auth";
import { ownsProduct } from "@/lib/commerce";
import { execute } from "@/lib/execute";
import { HttpError } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/v1/execute/:slug  (API key required, product must be owned)
 * Body: {"input": {...product fields}, "model": "claude-haiku-5-5", "stream": false}
 * With stream=true the response is NDJSON events; otherwise a single JSON result.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof Response) return auth;
  const { slug } = await ctx.params;
  if (!(await ownsProduct(auth.userId, slug))) return apiError(403, "not_entitled", "Your account does not own this product.", auth.headers);
  const body = z.object({ input: z.record(z.string(), z.unknown()), model: z.string().default("sandbox-deterministic"), stream: z.boolean().default(false) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_request", body.error.issues[0].message, auth.headers);
  const access = { mode: "api" as const, userId: auth.userId, anonKey: null };

  if (body.data.stream) {
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(c) {
        try {
          await execute({ slug, input: body.data.input, modelId: body.data.model, access, signal: req.signal }, (e) => c.enqueue(enc.encode(JSON.stringify(e) + "\n")));
        } catch (e) {
          c.enqueue(enc.encode(JSON.stringify({ type: "error", message: (e as Error).message }) + "\n"));
        }
        c.close();
      },
    });
    return new Response(stream, { headers: { ...auth.headers, "Content-Type": "application/x-ndjson" } });
  }
  try {
    const r = await execute({ slug, input: body.data.input, modelId: body.data.model, access, signal: req.signal }, () => {});
    if (r.error) return Response.json({ id: r.executionId, status: "failed", error: r.error, usage: r.usage }, { status: 422, headers: auth.headers });
    return Response.json({ id: r.executionId, status: "succeeded", simulated: r.output!.simulated, output: { markdown: r.output!.markdown, data: r.output!.data ?? null, citations: r.output!.citations ?? null, warnings: r.output!.warnings }, usage: r.usage }, { headers: auth.headers });
  } catch (e) {
    const err = e as HttpError;
    return apiError(err.status ?? 500, "execution_error", err.message, auth.headers);
  }
}
