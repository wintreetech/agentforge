import "server-only";
import { randomBytes } from "node:crypto";
import {
  Bm25Index,
  UNTRUSTED_POLICY,
  chunkDocument,
  configuredProviders,
  createProvider,
  estimateCostEur,
  estimateTokens,
  getModel,
  htmlToText,
  runProduct,
  safeFetchText,
  sanitizeModelText,
  topSentences,
  wrapUntrusted,
  type ChatMessage,
} from "@agentforge/ai-engine";
import { getSpec } from "@agentforge/product-registry";
import { audit, id, mutate, now, read, type AgentConfig, type GraphEdge, type GraphNode, type StudioRun } from "./db";
import { providerKeysFor } from "./execute";

/**
 * Agent Studio graph runtime. Runs are advanced one node per call so that
 * pause, cancel, approval and retry are real state transitions persisted
 * between steps. Side-effecting nodes (api_request) always require approval.
 */

export const NODE_TYPES = {
  trigger: { label: "Trigger", desc: "Start of the workflow. Exposes the run input as {{input}}." },
  retrieval: { label: "Document retrieval", desc: "Searches a knowledge base for passages relevant to the query." },
  ai_model: { label: "AI model", desc: "Calls the configured model with a prompt template." },
  extraction: { label: "Data extraction", desc: "Extracts emails, amounts, dates, a regex or JSON from text." },
  api_request: { label: "API request", desc: "HTTPS request to an allowlisted host. Always requires approval." },
  condition: { label: "Conditional logic", desc: "Routes to the true or false branch." },
  human_approval: { label: "Human approval", desc: "Pauses the run until a person approves or rejects." },
  format: { label: "Output formatting", desc: "Builds the final output from a template." },
  handoff: { label: "Agent handoff", desc: "Hands work to another product you own (e.g. Knowledge Base Agent)." },
} as const;
export type NodeType = keyof typeof NODE_TYPES;

export const RUN_LIMITS = { maxSteps: 40, maxTokens: 120_000, maxCostEur: 2, nodeTimeoutMs: 120_000 };

export function defaultGraph(slug: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const n = (idv: string, type: NodeType, x: number, y: number, data: Record<string, unknown>): GraphNode => ({ id: idv, type, position: { x, y }, data: { label: NODE_TYPES[type].label, ...data } });
  if (slug === "multi-agent-research-team") {
    return {
      nodes: [
        n("trigger", "trigger", 0, 120, {}),
        n("research", "handoff", 260, 120, { label: "Research team", product: "multi-agent-research-team", inputTemplate: "{{input}}" }),
        n("review", "human_approval", 520, 120, { message: "Review the report before it is finalised." }),
        n("out", "format", 780, 120, { label: "Final report", template: "{{research}}" }),
      ],
      edges: [
        { id: "e1", source: "trigger", target: "research" },
        { id: "e2", source: "research", target: "review" },
        { id: "e3", source: "review", target: "out" },
      ],
    };
  }
  return {
    nodes: [
      n("trigger", "trigger", 0, 140, {}),
      n("retrieve", "retrieval", 240, 140, { query: "{{input}}", topK: 4 }),
      n("check", "condition", 480, 140, { source: "{{retrieve}}", op: "longer_than", value: "40" }),
      n("answer", "ai_model", 740, 40, { prompt: "Answer the question using only the passages.\n\nQuestion: {{input}}\n\nPassages:\n{{retrieve}}", maxTokens: 700 }),
      n("notfound", "format", 740, 260, { label: "Not found reply", template: "I couldn't find this in the knowledge base." }),
      n("approve", "human_approval", 1000, 40, { message: "Check the answer before it is returned." }),
      n("out", "format", 1240, 40, { label: "Final answer", template: "{{answer}}" }),
    ],
    edges: [
      { id: "e1", source: "trigger", target: "retrieve" },
      { id: "e2", source: "retrieve", target: "check" },
      { id: "e3", source: "check", target: "answer", sourceHandle: "true", label: "true" },
      { id: "e4", source: "check", target: "notfound", sourceHandle: "false", label: "false" },
      { id: "e5", source: "answer", target: "approve" },
      { id: "e6", source: "approve", target: "out" },
    ],
  };
}

export function newConfig(userId: string, slug: string, name: string, model: string): AgentConfig {
  return {
    id: id("agc"),
    userId,
    slug,
    name,
    instructions: "You are a careful assistant. Use only the information provided. Say when something is unknown.",
    model,
    tools: ["retrieve_documents"],
    kbId: null,
    memory: false,
    memoryNotes: [],
    schedule: "off",
    scheduleInput: "",
    lastScheduledAt: null,
    webhookToken: randomBytes(18).toString("base64url"),
    allowedHosts: [],
    graph: defaultGraph(slug),
    updatedAt: now(),
  };
}

/** Validate a graph submitted from the editor. */
export function validateGraph(g: { nodes: GraphNode[]; edges: GraphEdge[] }): string | null {
  if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) return "Malformed graph";
  if (g.nodes.length > 40) return "A workflow can have at most 40 nodes.";
  const ids = new Set(g.nodes.map((n) => n.id));
  if (ids.size !== g.nodes.length) return "Duplicate node ids.";
  for (const n of g.nodes) if (!(n.type in NODE_TYPES) || !/^[a-zA-Z0-9_-]{1,40}$/.test(n.id)) return `Invalid node ${n.id}`;
  if (g.nodes.filter((n) => n.type === "trigger").length !== 1) return "A workflow needs exactly one Trigger node.";
  for (const e of g.edges) if (!ids.has(e.source) || !ids.has(e.target)) return "An edge points to a missing node.";
  if (JSON.stringify(g).length > 200_000) return "Graph is too large.";
  return null;
}

const render = (tpl: string, vars: Record<string, string>) => String(tpl ?? "").replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, k) => vars[k] ?? "");

function log(run: StudioRun, level: "info" | "warn" | "error", message: string, nodeId?: string) {
  run.logs.push({ at: now(), level, message: message.slice(0, 2000), nodeId });
  if (run.logs.length > 500) run.logs.splice(0, run.logs.length - 500);
}

export async function createRun(cfg: AgentConfig, input: string, trigger: StudioRun["trigger"]): Promise<StudioRun> {
  const trig = cfg.graph.nodes.find((n) => n.type === "trigger")!;
  const run: StudioRun = {
    id: id("run"),
    configId: cfg.id,
    userId: cfg.userId,
    trigger,
    status: "running",
    input: input.slice(0, 50_000),
    vars: { input: input.slice(0, 50_000), instructions: cfg.instructions, memory: cfg.memory ? cfg.memoryNotes.join("\n") : "" },
    nodeStates: Object.fromEntries(cfg.graph.nodes.map((n) => [n.id, { status: "pending" as const }])),
    queue: [trig.id],
    logs: [],
    inputTokens: 0,
    outputTokens: 0,
    costEur: 0,
    steps: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  log(run, "info", `Run started (${trigger}).`);
  await mutate((db) => void db.studioRuns.push(run));
  await audit(cfg.userId, "studio.run_started", run.id, { config: cfg.id, trigger });
  return run;
}

async function llm(cfg: AgentConfig, prompt: string, maxTokens: number, signal: AbortSignal): Promise<{ text: string; inT: number; outT: number; cost: number; simulated: boolean }> {
  const keys = await providerKeysFor(cfg.userId);
  const model = getModel(cfg.model) ?? getModel("sandbox-deterministic")!;
  const provider = configuredProviders(keys).includes(model.provider) ? model.provider : "sandbox";
  const messages: ChatMessage[] = [
    { role: "system", content: `${cfg.instructions}\n\n${UNTRUSTED_POLICY}` },
    { role: "user", content: prompt },
  ];
  if (provider === "sandbox") {
    // Deterministic, clearly labelled stand-in: extract the most informative sentences from the prompt data.
    const picks = topSentences(prompt.replace(/<<\/?DATA_[^>]+>>/g, " "), 3).map((s) => `- ${s.sentence}`);
    const text = `[Sandbox output — no AI model was called]\n${picks.join("\n") || "- (no content to summarise)"}`;
    return { text, inT: estimateTokens(prompt), outT: estimateTokens(text), cost: 0, simulated: true };
  }
  const p = createProvider(provider, keys);
  let text = "";
  let inT = 0;
  let outT = 0;
  for await (const c of p.stream({ model: model.id, messages, maxTokens, signal })) {
    if (c.type === "text") text += c.text;
    else ((inT = c.inputTokens), (outT = c.outputTokens));
  }
  if (!inT) inT = estimateTokens(prompt);
  if (!outT) outT = estimateTokens(text);
  return { text: sanitizeModelText(text), inT, outT, cost: estimateCostEur(model.id, inT, outT), simulated: false };
}

/** Execute exactly one queued node. Returns the updated run. */
export async function advance(runId: string, userId: string): Promise<StudioRun | null> {
  const [run, cfg] = await read((db) => {
    const r = db.studioRuns.find((x) => x.id === runId && x.userId === userId);
    return [r ? structuredClone(r) : null, r ? structuredClone(db.agentConfigs.find((c) => c.id === r.configId) ?? null) : null] as const;
  });
  if (!run || !cfg) return null;
  if (run.status !== "running") return run;

  const nodeId = run.queue.shift();
  if (!nodeId) {
    run.status = "completed";
    log(run, "info", "Run completed.");
    if (cfg.memory) {
      const last = Object.entries(run.nodeStates).reverse().find(([, s]) => s.status === "done" && s.output)?.[1].output ?? "";
      await mutate((db) => {
        const c = db.agentConfigs.find((x) => x.id === cfg.id);
        if (c) c.memoryNotes = [...c.memoryNotes, `${new Date().toISOString().slice(0, 10)}: ${last.slice(0, 240)}`].slice(-20);
      });
    }
    return save(run);
  }
  const node = cfg.graph.nodes.find((n) => n.id === nodeId);
  if (!node) return save(run);
  if (run.steps >= RUN_LIMITS.maxSteps) return fail(run, nodeId, `Step limit of ${RUN_LIMITS.maxSteps} reached (possible loop).`);

  const st = run.nodeStates[nodeId] ?? { status: "pending" };
  const d = node.data as Record<string, any>;
  const vars = { ...run.vars, prev: run.vars.prev ?? run.input };
  const t0 = Date.now();
  const signal = AbortSignal.timeout(RUN_LIMITS.nodeTimeoutMs);
  const approved = (st as { approved?: boolean }).approved === true;

  // Approval gates
  if ((node.type === "human_approval" || node.type === "api_request") && !approved) {
    run.queue.unshift(nodeId);
    run.nodeStates[nodeId] = { status: "awaiting_approval", output: node.type === "human_approval" ? render(d.message ?? "Approval required", vars) : `${d.method ?? "GET"} ${render(d.url ?? "", vars)}` };
    run.status = "awaiting_approval";
    log(run, "warn", node.type === "api_request" ? `Approval required before calling ${render(d.url ?? "", vars)}.` : `Waiting for approval: ${render(d.message ?? "", vars)}`, nodeId);
    return save(run);
  }

  run.steps++;
  run.nodeStates[nodeId] = { status: "running" };
  let output = "";
  let branch: "true" | "false" | null = null;
  try {
    switch (node.type as NodeType) {
      case "trigger":
        output = run.input;
        break;
      case "retrieval": {
        const kbId = d.kbId || cfg.kbId;
        if (!kbId) throw new Error("No knowledge base selected for this retrieval node or the agent.");
        const docs = await read((db) => (db.knowledgeBases.some((k) => k.id === kbId && k.userId === userId) ? db.kbDocuments.filter((x) => x.kbId === kbId && x.userId === userId) : []));
        const hits = new Bm25Index(docs.flatMap((x) => chunkDocument({ id: x.id, name: x.name, pages: x.pages }))).search(render(d.query ?? "{{input}}", vars), Math.min(Number(d.topK) || 4, 10));
        output = hits.map((h, i) => `[${i + 1}] (${h.chunk.docName}${h.chunk.page ? `, p.${h.chunk.page}` : ""}) ${h.chunk.text}`).join("\n\n");
        log(run, "info", `Retrieved ${hits.length} passage(s) from ${docs.length} document(s).`, nodeId);
        break;
      }
      case "ai_model": {
        const prompt = render(d.prompt ?? "{{prev}}", Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, k === "instructions" ? v : wrapUntrusted(k, v)])));
        if (run.inputTokens + run.outputTokens + estimateTokens(prompt) > RUN_LIMITS.maxTokens) throw new Error("Token budget for this run would be exceeded.");
        const r = await llm(cfg, prompt, Math.min(Number(d.maxTokens) || 800, 4000), signal);
        run.inputTokens += r.inT;
        run.outputTokens += r.outT;
        run.costEur += r.cost;
        if (run.costEur > RUN_LIMITS.maxCostEur) throw new Error(`Cost cap of €${RUN_LIMITS.maxCostEur} per run exceeded.`);
        output = r.text;
        run.nodeStates[nodeId].tokens = r.inT + r.outT;
        if (r.simulated) log(run, "warn", "Sandbox: no AI provider configured for this model; output is simulated.", nodeId);
        break;
      }
      case "extraction": {
        const src = render(d.source ?? "{{prev}}", vars);
        const mode = d.mode ?? "emails";
        const found =
          mode === "emails" ? src.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g)
          : mode === "amounts" ? src.match(/[€$£]\s?\d[\d.,]*|\d[\d.,]*\s?(?:EUR|USD|GBP)/g)
          : mode === "dates" ? src.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/g)
          : mode === "regex" ? (() => { const re = new RegExp(String(d.pattern ?? "").slice(0, 200), "g"); return src.slice(0, 200_000).match(re); })()
          : (() => { const s = src.indexOf("{"), e = src.lastIndexOf("}"); return s >= 0 && e > s ? [JSON.stringify(JSON.parse(src.slice(s, e + 1)), null, 2)] : null; })();
        output = (found ?? []).slice(0, 200).join("\n");
        log(run, "info", `Extracted ${(found ?? []).length} item(s) (${mode}).`, nodeId);
        break;
      }
      case "api_request": {
        const url = render(d.url ?? "", vars);
        const r = await safeFetchText(url, { allowHosts: cfg.allowedHosts, timeoutMs: 10_000, maxBytes: 300_000 });
        output = `HTTP ${r.status}\n${/html/i.test(r.contentType) ? htmlToText(r.text) : r.text}`.slice(0, 100_000);
        log(run, "info", `Fetched ${r.url} (${r.status}).`, nodeId);
        break;
      }
      case "condition": {
        const src = render(d.source ?? "{{prev}}", vars);
        const val = String(d.value ?? "");
        const op = d.op ?? "contains";
        const ok = op === "contains" ? src.toLowerCase().includes(val.toLowerCase()) : op === "equals" ? src.trim() === val : op === "longer_than" ? src.length > Number(val) : op === "matches" ? new RegExp(val.slice(0, 200), "i").test(src) : false;
        branch = ok ? "true" : "false";
        output = branch;
        log(run, "info", `Condition (${op} ${val}) → ${branch}.`, nodeId);
        break;
      }
      case "human_approval":
        output = `Approved at ${now()}`;
        break;
      case "format":
        output = render(d.template ?? "{{prev}}", vars);
        break;
      case "handoff": {
        const slug = String(d.product ?? "");
        const owns = await read((db) => db.entitlements.some((e) => e.userId === userId && e.slug === slug && e.status === "active"));
        if (!owns) throw new Error(`Handoff target "${slug}" is not a product you own.`);
        const spec = getSpec(slug);
        if (!spec) throw new Error("Handoff target has no runnable implementation.");
        const text = render(d.inputTemplate ?? "{{input}}", vars);
        const kbDocs = cfg.kbId ? await read((db) => db.kbDocuments.filter((x) => x.kbId === cfg.kbId && x.userId === userId).map((x) => ({ id: x.id, name: x.name, pages: x.pages }))) : [];
        const inputFor: Record<string, unknown> =
          slug === "ai-knowledge-base-agent" ? { question: text.slice(0, 500), docs: kbDocs }
          : slug === "multi-agent-research-team" ? { question: text.slice(0, 400), docs: kbDocs, urls: [], approveFetch: false, depth: "standard" }
          : { draft: text, goal: "Improve clarity", points: text, text, keyword: text.slice(0, 120), audience: "General", name: text.slice(0, 160), attributes: text, fullName: "Candidate", targetRole: "Role", history: text, jobDescription: text };
        const keys = await providerKeysFor(userId);
        const model = getModel(cfg.model) ?? getModel("sandbox-deterministic")!;
        const pid = configuredProviders(keys).includes(model.provider) ? model.provider : "sandbox";
        const res = await runProduct({
          steps: (c) => spec.steps(c, {}),
          finalize: spec.finalize,
          input: spec.schema.parse(inputFor),
          provider: createProvider(pid, keys),
          model: pid === "sandbox" ? "sandbox-deterministic" : model.id,
          budget: { ...spec.meta.policy.budget, timeoutMs: spec.meta.policy.timeoutMs },
          signal,
          emit: (e) => e.type === "step" && e.status !== "running" && log(run, e.status === "failed" ? "error" : "info", `↳ ${e.agent ?? slug}: ${e.label} (${e.status})`, nodeId),
        });
        if (res.error) throw new Error(res.error.message);
        run.inputTokens += res.usage.inputTokens;
        run.outputTokens += res.usage.outputTokens;
        run.costEur += res.usage.costEur;
        output = res.output!.markdown;
        if (res.output!.simulated) log(run, "warn", "Handoff ran in sandbox mode; output is simulated.", nodeId);
        break;
      }
    }
  } catch (e) {
    return fail(run, nodeId, (e as Error).message);
  }

  run.nodeStates[nodeId] = { ...run.nodeStates[nodeId], status: "done", output: output.slice(0, 100_000), ms: Date.now() - t0 };
  run.vars[nodeId] = output.slice(0, 100_000);
  run.vars.prev = output.slice(0, 100_000);
  for (const e of cfg.graph.edges.filter((x) => x.source === nodeId)) {
    if (branch && e.sourceHandle && e.sourceHandle !== branch) {
      run.nodeStates[e.target] = { status: "skipped" };
      continue;
    }
    if (!run.queue.includes(e.target)) run.queue.push(e.target);
  }
  log(run, "info", `${node.data.label ?? node.type} done in ${Date.now() - t0} ms.`, nodeId);
  return save(run);
}

function fail(run: StudioRun, nodeId: string, message: string) {
  run.queue.unshift(nodeId);
  run.nodeStates[nodeId] = { status: "failed", error: message };
  run.status = "failed";
  log(run, "error", message, nodeId);
  return save(run);
}

async function save(run: StudioRun): Promise<StudioRun> {
  run.updatedAt = now();
  await mutate((db) => {
    const i = db.studioRuns.findIndex((r) => r.id === run.id);
    if (i >= 0) {
      // Respect a cancel/pause that landed while this step was executing.
      const cur = db.studioRuns[i];
      if ((cur.status === "cancelled" || cur.status === "paused") && run.status === "running") run.status = cur.status;
      db.studioRuns[i] = run;
    }
  });
  return run;
}

export async function control(runId: string, userId: string, action: "approve" | "reject" | "pause" | "resume" | "cancel" | "retry"): Promise<StudioRun | null> {
  const res = await mutate((db) => {
    const run = db.studioRuns.find((r) => r.id === runId && r.userId === userId);
    if (!run) return null;
    const head = run.queue[0];
    switch (action) {
      case "approve":
        if (run.status !== "awaiting_approval" || !head) break;
        run.nodeStates[head] = { ...run.nodeStates[head], status: "pending", ...({ approved: true } as object) };
        run.status = "running";
        log(run, "info", "Approved by user.", head);
        break;
      case "reject":
        if (run.status !== "awaiting_approval" || !head) break;
        run.nodeStates[head] = { status: "failed", error: "Rejected by user" };
        run.status = "cancelled";
        log(run, "warn", "Rejected by user; run stopped.", head);
        break;
      case "pause":
        if (run.status === "running") (run.status = "paused"), log(run, "info", "Paused by user.");
        break;
      case "resume":
        if (run.status === "paused") (run.status = "running"), log(run, "info", "Resumed by user.");
        break;
      case "cancel":
        if (!["completed", "cancelled"].includes(run.status)) (run.status = "cancelled"), log(run, "warn", "Cancelled by user.");
        break;
      case "retry":
        if (run.status === "failed" && head) {
          run.nodeStates[head] = { status: "pending" };
          run.status = "running";
          log(run, "info", "Retrying failed step.", head);
        }
        break;
    }
    run.updatedAt = now();
    return structuredClone(run);
  });
  if (res) await audit(userId, `studio.run_${action}`, runId);
  return res;
}

/** Run until it completes, fails, pauses or needs approval (used by webhooks and schedules). */
export async function runToBoundary(runId: string, userId: string, maxSteps = RUN_LIMITS.maxSteps) {
  let run: StudioRun | null = null;
  for (let i = 0; i < maxSteps + 1; i++) {
    run = await advance(runId, userId);
    if (!run || run.status !== "running") break;
  }
  return run;
}

// ───────────── Schedules (driven by instrumentation.ts in the Node.js server) ─────────────
const INTERVAL: Record<string, number> = { hourly: 3600e3, daily: 864e5, weekly: 7 * 864e5 };

export async function runDueSchedules() {
  const due = await read((db) => db.agentConfigs.filter((c) => c.schedule !== "off" && (!c.lastScheduledAt || Date.now() - Date.parse(c.lastScheduledAt) >= INTERVAL[c.schedule])).map((c) => structuredClone(c)));
  for (const cfg of due) {
    const owns = await read((db) => db.entitlements.some((e) => e.userId === cfg.userId && e.slug === cfg.slug && e.status === "active"));
    if (!owns) continue;
    await mutate((db) => {
      const c = db.agentConfigs.find((x) => x.id === cfg.id);
      if (c) c.lastScheduledAt = now();
    });
    const run = await createRun(cfg, cfg.scheduleInput || "Scheduled run", "schedule");
    await runToBoundary(run.id, cfg.userId);
  }
}
