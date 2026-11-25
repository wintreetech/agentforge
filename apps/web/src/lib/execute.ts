import "server-only";
import {
  MODELS,
  configuredProviders,
  createProvider,
  creditsForCost,
  estimateCostEur,
  estimateTokens,
  getModel,
  htmlToText,
  runProduct,
  safeFetchText,
  type ProviderId,
  type ProviderKeys,
  type RunEvent,
  type SourceDoc,
} from "@agentforge/ai-engine";
import { getSpec, type ProductSpec } from "@agentforge/product-registry";
import { ZodError } from "zod";
import { env } from "./env";
import { id, mutate, now, read, type ExecutionRecord } from "./db";
import { decrypt, HttpError } from "./security";
import { fileToPages } from "./documents";

// ───────────────────────── Providers & models ─────────────────────────

export async function providerKeysFor(userId: string | null): Promise<ProviderKeys> {
  const keys: ProviderKeys = { ...env.providerKeys };
  if (userId) {
    const own = await read((db) => db.providerSecrets.filter((s) => s.userId === userId));
    for (const s of own) {
      try {
        keys[s.provider] = decrypt(s.ciphertext);
      } catch {
        /* undecryptable (key rotated) — ignore */
      }
    }
  }
  const disabled = await read((db) => db.settings.disabledProviders);
  for (const d of disabled) delete keys[d as keyof ProviderKeys];
  return keys;
}

export async function availableModels(userId: string | null, demo: boolean) {
  const keys = await providerKeysFor(userId);
  const configured = new Set<ProviderId>(configuredProviders(keys));
  return MODELS.map((m) => ({
    ...m,
    available: configured.has(m.provider) && (!demo || m.provider === "sandbox" || env.demoAllowProviders),
    reason: !configured.has(m.provider) ? "Provider not configured" : demo && m.provider !== "sandbox" && !env.demoAllowProviders ? "Demo runs use the sandbox" : null,
  }));
}

// ───────────────────────── Input normalisation ─────────────────────────

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

async function uploadedDoc(fd: FormData): Promise<SourceDoc | null> {
  const f = fd.get("document");
  if (!(f instanceof File) || f.size === 0) return null;
  const { name, pages } = await fileToPages(f);
  return { id: `upload`, name, pages };
}

/** Converts a submitted form into the exact input shape the product spec validates. */
export async function normaliseInput(slug: string, fd: FormData, userId: string | null): Promise<Record<string, unknown>> {
  const plain = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  switch (slug) {
    case "ai-pdf-summarizer": {
      const doc = await uploadedDoc(fd);
      if (!doc) throw new HttpError(400, "Upload a PDF or text file.");
      return { fileName: doc.name, pages: doc.pages, length: plain.length || "standard" };
    }
    case "ai-invoice-data-extractor": {
      const doc = await uploadedDoc(fd);
      const text = [doc?.pages.join("\n\n") ?? "", plain.text ?? ""].join("\n").trim();
      return { text, fileName: doc?.name };
    }
    case "ai-knowledge-base-agent": {
      const docs: SourceDoc[] = [];
      const kbId = plain.kb;
      if (kbId && userId) {
        const kbDocs = await read((db) => (db.knowledgeBases.some((k) => k.id === kbId && k.userId === userId) ? db.kbDocuments.filter((d) => d.kbId === kbId && d.userId === userId) : []));
        docs.push(...kbDocs.map((d) => ({ id: d.id, name: d.name, pages: d.pages })));
      }
      const up = await uploadedDoc(fd);
      if (up) docs.push(up);
      if (plain.text?.trim()) docs.push({ id: "pasted", name: "Pasted text", pages: [plain.text] });
      return { question: plain.question ?? "", docs };
    }
    case "multi-agent-research-team": {
      const docs: SourceDoc[] = (plain.sources ?? "")
        .split(/\n\s*---\s*\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20)
        .map((s, i) => {
          const [first, ...rest] = s.split("\n");
          const titled = /^source:\s*/i.test(first) && rest.join("").trim().length > 20;
          return { id: `pasted${i}`, name: (titled ? first.replace(/^source:\s*/i, "") : first).slice(0, 80) || `Pasted source ${i + 1}`, pages: [titled ? rest.join("\n") : s] };
        });
      const up = await uploadedDoc(fd);
      if (up) docs.push(up);
      const urls = (plain.urls ?? "").split(/\s+/).map((u) => u.trim()).filter(Boolean);
      return { question: plain.question ?? "", docs, urls, approveFetch: plain.approveFetch === "on" || plain.approveFetch === "true", depth: plain.depth || "standard" };
    }
    default:
      return plain;
  }
}

// ───────────────────────── Access policy ─────────────────────────

export interface Access {
  mode: "demo" | "owned" | "api";
  userId: string | null;
  anonKey: string | null;
}

export async function demoRunsToday(userId: string | null, anonKey: string | null) {
  const since = new Date(Date.now() - 864e5).toISOString();
  return read((db) => db.executions.filter((e) => e.mode === "demo" && e.createdAt >= since && ((userId && e.userId === userId) || (anonKey && e.anonKey === anonKey))).length);
}

// ───────────────────────── Execution ─────────────────────────

export interface ExecuteRequest {
  slug: string;
  input: Record<string, unknown>;
  modelId: string;
  access: Access;
  signal?: AbortSignal;
}

export function getRunnableSpec(slug: string): ProductSpec {
  const spec = getSpec(slug);
  if (!spec) throw new HttpError(404, "This product has no runnable implementation.");
  return spec;
}

/** Validates, checks quota/credits, runs, meters and records. Emits NDJSON-ready events. */
export async function execute(req: ExecuteRequest, emit: (e: RunEvent | { type: "meta"; executionId: string; simulated: boolean; model: string; estimate: { tokens: number; costEur: number } }) => void) {
  const spec = getRunnableSpec(req.slug);
  let input: unknown;
  try {
    input = spec.schema.parse(req.input);
  } catch (e) {
    if (e instanceof ZodError) throw new HttpError(422, e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
    throw e;
  }

  const model = getModel(req.modelId) ?? getModel("sandbox-deterministic")!;
  const keys = await providerKeysFor(req.access.userId);
  if (!configuredProviders(keys).includes(model.provider)) throw new HttpError(400, `${model.label} is not configured. Choose the sandbox or add an API key in Integrations.`);

  if (req.access.mode === "demo") {
    if (!spec.meta.policy.demo.enabled) throw new HttpError(403, "This product has no live demo.");
    if (model.provider !== "sandbox" && !env.demoAllowProviders) throw new HttpError(403, "Demo runs use the sandbox. Purchase the product to run it on a live model.");
    const limit = await read((db) => db.settings.demoRunsPerDay);
    if ((await demoRunsToday(req.access.userId, req.access.anonKey)) >= limit) throw new HttpError(429, `Demo limit reached (${limit} runs per 24 hours). Purchase the product for full access.`);
  }

  const estTokens = estimateTokens(JSON.stringify(input)) + spec.meta.policy.budget.maxTokens / 6;
  const estCost = estimateCostEur(model.id, estTokens * 0.7, estTokens * 0.3);
  if (req.access.mode !== "demo" && req.access.userId && model.provider !== "sandbox") {
    const bal = await read((db) => db.credits.filter((c) => c.userId === req.access.userId).reduce((s, c) => s + c.delta, 0));
    if (bal < creditsForCost(estCost, false)) throw new HttpError(402, "Not enough credits for this run. Buy a credit pack or use your own API key.");
  }

  const executionId = id("exe");
  emit({ type: "meta", executionId, simulated: model.provider === "sandbox", model: model.label, estimate: { tokens: Math.round(estTokens), costEur: estCost } });

  const steps: ExecutionRecord["steps"] = [];
  const provider = createProvider(model.provider, keys);
  const result = await runProduct({
    steps: (ctx) =>
      spec.steps(ctx, {
        fetchUrl: async (u) => {
          const r = await safeFetchText(u, { timeoutMs: 10_000, maxBytes: 1_500_000 });
          return { url: r.url, text: /html/i.test(r.contentType) ? htmlToText(r.text) : r.text };
        },
      }),
    finalize: spec.finalize,
    input,
    provider,
    model: model.id,
    budget: { ...spec.meta.policy.budget, timeoutMs: spec.meta.policy.timeoutMs },
    signal: req.signal,
    emit: (e) => {
      if (e.type === "step") {
        const i = steps.findIndex((s) => s.id === e.id);
        const rec = { id: e.id, label: e.label, agent: e.agent, status: e.status, ms: e.ms, tokens: e.tokens, detail: e.detail };
        if (i >= 0) steps[i] = rec;
        else steps.push(rec);
      }
      emit(e);
    },
  });

  const simulated = model.provider === "sandbox";
  const credits = req.access.mode === "demo" || simulated ? 0 : creditsForCost(result.usage.costEur, false);
  const preview = JSON.stringify(input, (k, v) => (k === "pages" ? `[${(v as string[]).length} pages]` : typeof v === "string" && v.length > 160 ? v.slice(0, 160) + "…" : v)).slice(0, 600);
  await mutate((db) => {
    db.executions.push({
      id: executionId,
      userId: req.access.userId,
      anonKey: req.access.userId ? null : req.access.anonKey,
      slug: req.slug,
      provider: model.provider,
      model: model.id,
      status: result.error ? (result.error.code === "cancelled" ? "cancelled" : "failed") : "succeeded",
      mode: req.access.mode,
      inputPreview: preview,
      output: result.output?.markdown.slice(0, 200_000) ?? null,
      error: result.error?.message ?? null,
      steps,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costEur: result.usage.costEur,
      credits,
      simulated,
      ms: result.usage.ms,
      createdAt: now(),
    });
    if (db.executions.length > 50_000) db.executions.splice(0, db.executions.length - 50_000);
    if (credits && req.access.userId) db.credits.push({ id: id("crd"), userId: req.access.userId, delta: -credits, reason: `Run: ${req.slug}`, at: now(), executionId });
  });
  return { executionId, ...result };
}

/** NDJSON streaming response for a run. */
export function streamExecution(run: (emit: (e: unknown) => void) => Promise<unknown>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: unknown) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await run(emit);
      } catch (e) {
        const err = e as HttpError;
        emit({ type: "error", message: err.message ?? "Execution failed", code: err.status ? `http_${err.status}` : "execution_failed" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
