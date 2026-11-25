import { z } from "zod";
import { getUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { createRun } from "@/lib/studio";
import { assertSameOrigin, HttpError, rateLimit } from "@/lib/security";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await getUser();
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    if (!rateLimit(`studio:${user.id}`, 30, 60_000).ok) return Response.json({ error: "Too many runs. Wait a minute." }, { status: 429 });
    const body = z.object({ configId: z.string(), input: z.string().max(50_000) }).parse(await req.json());
    const cfg = await read((db) => db.agentConfigs.find((c) => c.id === body.configId && c.userId === user.id));
    if (!cfg) return Response.json({ error: "Not found" }, { status: 404 });
    const owns = await read((db) => db.entitlements.some((e) => e.userId === user.id && e.slug === cfg.slug && e.status === "active"));
    if (!owns) return Response.json({ error: "Your licence for this agent is not active." }, { status: 403 });
    const run = await createRun(cfg, body.input, "manual");
    return Response.json(run);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: (e as HttpError).status ?? 400 });
  }
}
