import { getAnonKey, getUser } from "@/lib/auth";
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
    const anonKey = user ? null : await getAnonKey(true);
    const rl = rateLimit(`exec:${user?.id ?? anonKey ?? clientIp(req)}`, 20, 60_000);
    if (!rl.ok) throw new HttpError(429, "Too many runs in a short time. Wait a minute and try again.");
    const fd = await req.formData();
    const owned = user ? await ownsProduct(user.id, slug) : false;
    const input = await normaliseInput(slug, fd, owned ? user!.id : null);
    const modelId = String(fd.get("model") ?? "sandbox-deterministic");
    return streamExecution((emit) =>
      execute({ slug, input, modelId, access: { mode: owned ? "owned" : "demo", userId: user?.id ?? null, anonKey }, signal: req.signal }, emit),
    );
  } catch (e) {
    const err = e as HttpError;
    return Response.json({ type: "error", message: err.message }, { status: err.status ?? 500 });
  }
}
