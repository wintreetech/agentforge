"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getModel } from "@agentforge/ai-engine";
import { requireUser } from "@/lib/auth";
import { audit, mutate, now, read } from "@/lib/db";
import { newConfig, validateGraph } from "@/lib/studio";
import { getProduct } from "@/lib/catalog";

const STUDIO_SLUGS = ["ai-knowledge-base-agent", "multi-agent-research-team"];

export async function createConfigAction(fd: FormData) {
  const user = await requireUser();
  const slug = String(fd.get("slug"));
  const owns = await read((db) => db.entitlements.some((e) => e.userId === user.id && e.slug === slug && e.status === "active"));
  if (!owns || !STUDIO_SLUGS.includes(slug)) redirect("/dashboard/studio?error=not-owned");
  const p = await getProduct(slug);
  const cfg = newConfig(user.id, slug, `${p?.title ?? slug} workflow`, slug === "multi-agent-research-team" ? "claude-sonnet-5-5" : "claude-haiku-5-5");
  await mutate((db) => void db.agentConfigs.push(cfg));
  await audit(user.id, "studio.config_created", cfg.id);
  redirect(`/dashboard/studio/${cfg.id}`);
}

const saveSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(2).max(80),
  instructions: z.string().max(8000),
  model: z.string().refine((m) => !!getModel(m), "Unknown model"),
  tools: z.array(z.enum(["retrieve_documents", "fetch_url", "extract_data"])).max(10),
  kbId: z.string().nullable(),
  memory: z.boolean(),
  schedule: z.enum(["off", "hourly", "daily", "weekly"]),
  scheduleInput: z.string().max(4000),
  allowedHosts: z.array(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Hosts must be plain domain names like api.example.com")).max(20),
  graph: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
});

export async function saveConfigAction(payload: unknown): Promise<{ ok?: true; error?: string }> {
  const user = await requireUser();
  const s = saveSchema.safeParse(payload);
  if (!s.success) return { error: s.error.issues[0].message };
  const gErr = validateGraph(s.data.graph);
  if (gErr) return { error: gErr };
  if (s.data.kbId && !(await read((db) => db.knowledgeBases.some((k) => k.id === s.data.kbId && k.userId === user.id)))) return { error: "Knowledge base not found." };
  const ok = await mutate((db) => {
    const c = db.agentConfigs.find((x) => x.id === s.data.id && x.userId === user.id);
    if (!c) return false;
    Object.assign(c, { ...s.data, allowedHosts: s.data.allowedHosts.map((h) => h.toLowerCase()), graph: { nodes: s.data.graph.nodes.map((n: any) => ({ id: n.id, type: n.type, position: n.position, data: n.data })), edges: s.data.graph.edges.map((e: any) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, label: e.label })) }, updatedAt: now() });
    return true;
  });
  if (!ok) return { error: "Configuration not found." };
  await audit(user.id, "studio.config_saved", s.data.id);
  revalidatePath(`/dashboard/studio/${s.data.id}`);
  return { ok: true };
}

export async function rotateWebhookAction(fd: FormData) {
  const user = await requireUser();
  const cid = String(fd.get("id"));
  await mutate((db) => {
    const c = db.agentConfigs.find((x) => x.id === cid && x.userId === user.id);
    if (c) c.webhookToken = randomBytes(18).toString("base64url");
  });
  revalidatePath(`/dashboard/studio/${cid}`);
}

export async function deleteConfigAction(fd: FormData) {
  const user = await requireUser();
  const cid = String(fd.get("id"));
  await mutate((db) => void (db.agentConfigs = db.agentConfigs.filter((c) => !(c.id === cid && c.userId === user.id))));
  redirect("/dashboard/studio");
}
