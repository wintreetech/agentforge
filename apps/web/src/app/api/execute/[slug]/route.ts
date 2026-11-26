import { getUser } from "@/lib/auth";
import { ownsProduct } from "@/lib/commerce";
import { execute, normaliseInput, streamExecution } from "@/lib/execute";
import { HttpError, assertSameOrigin, clientIp, rateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  try {
    assertSameOrigin(req);
    const user = await getUser();
    if (!user) throw new HttpError(401, "Sign in to run products you own.");
    const rl = rateLimit(`exec:${user.id ?? clientIp(req)}`, 20, 60_000);
    if (!rl.ok) throw new HttpError(429, "Too many runs in a short time. Wait a minute and try again.");
    // Free demo runs (the former Playground) are removed: only purchased products can run.
    if (!(await ownsProduct(user.id, slug))) throw new HttpError(403, "Purchase this product to run it.");
    const fd = await req.formData();
    const input = await normaliseInput(slug, fd, user.id);
    const modelId = String(fd.get("model") ?? "sandbox-deterministic");
    return streamExecution((emit) =>
      execute({ slug, input, modelId, access: { mode: "owned", userId: user.id, anonKey: null }, signal: req.signal }, emit),
    );
  } catch (e) {
    const err = e as HttpError;
    return Response.json({ type: "error", message: err.message }, { status: err.status ?? 500 });
  }
}
