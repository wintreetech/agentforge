import { z } from "zod";
import { getUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { advance, control } from "@/lib/studio";
import { assertSameOrigin, HttpError } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  const run = await read((db) => db.studioRuns.find((r) => r.id === id && r.userId === user.id));
  return run ? Response.json(run) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await getUser();
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    const { id } = await ctx.params;
    const { action } = z.object({ action: z.enum(["advance", "approve", "reject", "pause", "resume", "cancel", "retry"]) }).parse(await req.json());
    const run = action === "advance" ? await advance(id, user.id) : await control(id, user.id, action);
    return run ? Response.json(run) : Response.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: (e as HttpError).status ?? 400 });
  }
}
