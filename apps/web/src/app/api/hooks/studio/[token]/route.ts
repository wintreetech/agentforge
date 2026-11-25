import { timingSafeEqual } from "node:crypto";
import { read } from "@/lib/db";
import { createRun, runToBoundary } from "@/lib/studio";
import { clientIp, rateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Webhook trigger for an Agent Studio workflow. The secret token in the URL
 * identifies the workflow. Runs stop at any approval node; approvals happen in
 * the dashboard, never via the webhook.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!rateLimit(`hook:${clientIp(req)}`, 30, 60_000).ok) return Response.json({ error: "Rate limited" }, { status: 429 });
  const cfg = await read((db) => db.agentConfigs.find((c) => c.webhookToken.length === token.length && timingSafeEqual(Buffer.from(c.webhookToken), Buffer.from(token))));
  if (!cfg) return Response.json({ error: "Unknown webhook" }, { status: 404 });
  const owns = await read((db) => db.entitlements.some((e) => e.userId === cfg.userId && e.slug === cfg.slug && e.status === "active"));
  if (!owns) return Response.json({ error: "Licence inactive" }, { status: 403 });
  const raw = await req.text();
  if (raw.length > 50_000) return Response.json({ error: "Payload too large" }, { status: 413 });
  let input = raw;
  try {
    const j = JSON.parse(raw);
    input = typeof j.input === "string" ? j.input : JSON.stringify(j);
  } catch {}
  const run = await createRun(cfg, input, "webhook");
  const final = await runToBoundary(run.id, cfg.userId);
  const lastOut = final ? Object.values(final.nodeStates).filter((s) => s.status === "done").at(-1)?.output : null;
  return Response.json({ runId: run.id, status: final?.status, output: final?.status === "completed" ? lastOut : null });
}
