"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addEdge, Background, Controls, Handle, MarkerType, Position, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { Check, CircleDashed, Download, Loader2, Pause, Play, RotateCcw, Save, ShieldAlert, Square, ThumbsDown, ThumbsUp, Trash2, XCircle } from "lucide-react";
import type { StudioRun } from "@/lib/db";
import { saveConfigAction } from "@/app/actions/studio";
import { Markdown } from "@/components/markdown";
import { Badge, Card, Input, Label, Notice, Select, Textarea, buttonClass } from "@/components/ui";
import { cn, fmtDateTime } from "@/lib/utils";

interface Cfg {
  id: string; name: string; instructions: string; model: string; tools: string[]; kbId: string | null; memory: boolean; memoryNotes: string[];
  schedule: "off" | "hourly" | "daily" | "weekly"; scheduleInput: string; allowedHosts: string[];
  graph: { nodes: { id: string; type: string; position: { x: number; y: number }; data: Record<string, any> }[]; edges: { id: string; source: string; target: string; sourceHandle?: string | null; label?: string }[] };
}

const COLORS: Record<string, string> = {
  trigger: "#22D3EE", retrieval: "#10B981", ai_model: "#8B5CF6", extraction: "#F59E0B", api_request: "#EF4444",
  condition: "#6366F1", human_approval: "#EAB308", format: "#64748B", handoff: "#EC4899",
};
const STATUS_RING: Record<string, string> = { running: "ring-2 ring-accent-2 animate-pulse", done: "ring-2 ring-success", failed: "ring-2 ring-danger", awaiting_approval: "ring-2 ring-warning", skipped: "opacity-40" };

function FlowNode({ data, type, selected }: NodeProps) {
  const d = data as { label: string; status?: string };
  return (
    <div className={cn("min-w-40 rounded-xl border bg-[var(--surface)] px-3 py-2 text-[12.5px] shadow-sm", selected ? "border-accent" : "border-[var(--border-strong)]", d.status && STATUS_RING[d.status])}>
      {type !== "trigger" && <Handle type="target" position={Position.Left} />}
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ background: COLORS[type as string] }} />
        <span className="text-[10.5px] uppercase tracking-wider text-[var(--fg-subtle)]">{String(type).replace("_", " ")}</span>
      </div>
      <p className="mt-0.5 font-medium text-[var(--fg)]">{d.label}</p>
      {type === "condition" ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ top: "35%", background: "#10B981" }} />
          <Handle type="source" position={Position.Right} id="false" style={{ top: "75%", background: "#EF4444" }} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}

const FIELDS: Record<string, { key: string; label: string; kind: "text" | "textarea" | "select" | "number"; options?: string[] }[]> = {
  trigger: [],
  retrieval: [{ key: "query", label: "Query template", kind: "text" }, { key: "topK", label: "Passages", kind: "number" }, { key: "kbId", label: "Knowledge base (blank = agent default)", kind: "select" }],
  ai_model: [{ key: "prompt", label: "Prompt template", kind: "textarea" }, { key: "maxTokens", label: "Max output tokens", kind: "number" }],
  extraction: [{ key: "source", label: "Source", kind: "text" }, { key: "mode", label: "Extract", kind: "select", options: ["emails", "amounts", "dates", "regex", "json"] }, { key: "pattern", label: "Regex (mode = regex)", kind: "text" }],
  api_request: [{ key: "method", label: "Method", kind: "select", options: ["GET"] }, { key: "url", label: "URL (host must be allowlisted)", kind: "text" }],
  condition: [{ key: "source", label: "Source", kind: "text" }, { key: "op", label: "Operator", kind: "select", options: ["contains", "equals", "longer_than", "matches"] }, { key: "value", label: "Value", kind: "text" }],
  human_approval: [{ key: "message", label: "Message to approver", kind: "text" }],
  format: [{ key: "template", label: "Output template", kind: "textarea" }],
  handoff: [{ key: "product", label: "Hand off to product", kind: "select" }, { key: "inputTemplate", label: "Input template", kind: "text" }],
};

export function StudioEditor({ config, kbs, models, nodeTypes: palette, ownedProducts, initialRun, recentRuns }: {
  config: Cfg; kbs: { id: string; name: string }[]; models: { id: string; label: string; available: boolean }[]; nodeTypes: { type: string; label: string; desc: string }[]; ownedProducts: string[]; initialRun: StudioRun | null; recentRuns: { id: string; status: string; createdAt: string; trigger: string }[];
}) {
  const [cfg, setCfg] = useState(config);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(config.graph.nodes.map((n) => ({ ...n, data: { ...n.data } })));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(config.graph.edges.map((e) => ({ ...e, sourceHandle: e.sourceHandle ?? undefined, markerEnd: { type: MarkerType.ArrowClosed } })));
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [run, setRun] = useState<StudioRun | null>(initialRun);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const driving = useRef(false);
  const nodeTypes = useMemo(() => Object.fromEntries(palette.map((p) => [p.type, FlowNode])), [palette]);

  // Reflect run state on nodes.
  useEffect(() => {
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, status: run?.nodeStates[n.id]?.status } })));
  }, [run, setNodes]);

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, id: `e-${c.source}-${c.sourceHandle ?? "out"}-${c.target}`, label: c.sourceHandle ?? undefined, markerEnd: { type: MarkerType.ArrowClosed } }, es)), [setEdges]);

  const addNode = (type: string) => {
    let n = nodes.length + 1;
    while (nodes.some((x) => x.id === `${type.slice(0, 4)}${n}`)) n++;
    const idv = `${type.slice(0, 4)}${n}`;
    const p = palette.find((x) => x.type === type)!;
    const defaults: Record<string, Record<string, unknown>> = { ai_model: { prompt: "{{prev}}", maxTokens: 600 }, retrieval: { query: "{{input}}", topK: 4 }, format: { template: "{{prev}}" }, condition: { source: "{{prev}}", op: "contains", value: "" }, extraction: { source: "{{prev}}", mode: "emails" }, api_request: { method: "GET", url: "https://" }, human_approval: { message: "Please review." }, handoff: { product: ownedProducts[0] ?? "", inputTemplate: "{{prev}}" } };
    setNodes((ns) => [...ns, { id: idv, type, position: { x: 120 + ns.length * 30, y: 320 + (ns.length % 3) * 40 }, data: { label: p.label, ...(defaults[type] ?? {}) } }]);
    setSelected(idv);
  };

  const selNode = nodes.find((n) => n.id === selected);
  const updateSel = (k: string, v: unknown) => setNodes((ns) => ns.map((n) => (n.id === selected ? { ...n, data: { ...n.data, [k]: v } } : n)));

  async function save() {
    setSaving(true);
    setMsg(null);
    const r = await saveConfigAction({
      ...cfg,
      graph: { nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: Object.fromEntries(Object.entries(n.data).filter(([k]) => k !== "status")) })), edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, label: typeof e.label === "string" ? e.label : undefined })) },
    });
    setSaving(false);
    setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "success", text: "Saved." });
    return !r.error;
  }

  async function post(url: string, body: unknown): Promise<StudioRun | null> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json();
    if (!res.ok) {
      setMsg({ tone: "danger", text: j.error ?? "Request failed" });
      return null;
    }
    return j as StudioRun;
  }

  async function drive(r: StudioRun | null) {
    if (driving.current) return;
    driving.current = true;
    let cur = r;
    try {
      while (cur && cur.status === "running") {
        cur = await post(`/api/studio/runs/${cur.id}`, { action: "advance" });
        if (cur) setRun(cur);
      }
    } finally {
      driving.current = false;
    }
  }

  async function start() {
    setBusy(true);
    if (await save()) {
      const r = await post("/api/studio/runs", { configId: cfg.id, input });
      if (r) {
        setRun(r);
        await drive(r);
      }
    }
    setBusy(false);
  }

  async function act(action: string) {
    if (!run) return;
    const r = await post(`/api/studio/runs/${run.id}`, { action });
    if (r) {
      setRun(r);
      if (r.status === "running") await drive(r);
    }
  }

  const headNode = run?.queue[0];
  const finalOut = run && run.status === "completed" ? Object.entries(run.nodeStates).filter(([, s]) => s.status === "done").map(([, s]) => s.output).at(-1) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border p-2.5">
            <span className="px-1 text-[12px] text-subtle">Add node:</span>
            {palette.filter((p) => p.type !== "trigger").map((p) => (
              <button key={p.type} type="button" onClick={() => addNode(p.type)} title={p.desc} className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[12px] text-muted hover:border-border-strong hover:text-fg">
                <span className="size-2 rounded-full" style={{ background: COLORS[p.type] }} />{p.label}
              </button>
            ))}
          </div>
          <div className="h-[460px]" aria-label="Workflow graph editor">
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} onNodeClick={(_, n) => setSelected(n.id)} onPaneClick={() => setSelected(null)} fitView deleteKeyCode={["Backspace", "Delete"]} proOptions={{ hideAttribution: true }}>
              <Background gap={20} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          <p className="border-t border-border px-3 py-2 text-[12px] text-subtle">Drag from a node&apos;s right handle to another node to connect. Select a node or edge and press Delete to remove it. Use {"{{input}}"}, {"{{prev}}"}, {"{{memory}}"} or {"{{nodeId}}"} in templates.</p>
        </Card>

        <Card className="p-4">
          {selNode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><p className="font-semibold">Node: {selNode.id}</p>{selNode.type !== "trigger" && <button type="button" onClick={() => { setNodes((ns) => ns.filter((n) => n.id !== selNode.id)); setEdges((es) => es.filter((e) => e.source !== selNode.id && e.target !== selNode.id)); setSelected(null); }} className={buttonClass("ghost", "sm", "text-danger")}><Trash2 className="size-3.5" /></button>}</div>
              <p className="text-[12.5px] text-muted">{palette.find((p) => p.type === selNode.type)?.desc}</p>
              <div><Label htmlFor="nl">Label</Label><Input id="nl" value={String(selNode.data.label ?? "")} onChange={(e) => updateSel("label", e.target.value)} /></div>
              {(FIELDS[selNode.type!] ?? []).map((f) => (
                <div key={f.key}>
                  <Label htmlFor={`nf-${f.key}`}>{f.label}</Label>
                  {f.kind === "textarea" ? (
                    <Textarea id={`nf-${f.key}`} rows={5} value={String(selNode.data[f.key] ?? "")} onChange={(e) => updateSel(f.key, e.target.value)} />
                  ) : f.kind === "select" ? (
                    <Select id={`nf-${f.key}`} value={String(selNode.data[f.key] ?? "")} onChange={(e) => updateSel(f.key, e.target.value)}>
                      {f.key === "kbId" ? [<option key="" value="">Agent default</option>, ...kbs.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)]
                        : f.key === "product" ? ownedProducts.map((p) => <option key={p} value={p}>{p}</option>)
                        : f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                    </Select>
                  ) : (
                    <Input id={`nf-${f.key}`} type={f.kind === "number" ? "number" : "text"} value={String(selNode.data[f.key] ?? "")} onChange={(e) => updateSel(f.key, f.kind === "number" ? Number(e.target.value) : e.target.value)} />
                  )}
                </div>
              ))}
              {selNode.type === "api_request" && <Notice tone="warning">Every API request pauses for your approval and may only call hosts in the allowlist.</Notice>}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-semibold">Agent configuration</p>
              <div><Label htmlFor="cn">Name</Label><Input id="cn" value={cfg.name} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} /></div>
              <div><Label htmlFor="ci">System instructions</Label><Textarea id="ci" rows={5} value={cfg.instructions} onChange={(e) => setCfg({ ...cfg, instructions: e.target.value })} /></div>
              <div><Label htmlFor="cm">Model</Label><Select id="cm" value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })}>{models.map((m) => <option key={m.id} value={m.id}>{m.label}{m.available ? "" : " — not configured (runs in sandbox)"}</option>)}</Select></div>
              <div><Label htmlFor="ck">Knowledge base</Label><Select id="ck" value={cfg.kbId ?? ""} onChange={(e) => setCfg({ ...cfg, kbId: e.target.value || null })}><option value="">None</option>{kbs.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</Select></div>
              <fieldset><legend className="mb-1.5 text-[13px] font-medium">Tools</legend>{["retrieve_documents", "extract_data", "fetch_url"].map((t) => (
                <label key={t} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={cfg.tools.includes(t)} onChange={(e) => setCfg({ ...cfg, tools: e.target.checked ? [...cfg.tools, t] : cfg.tools.filter((x) => x !== t) })} className="accent-[var(--accent)]" />{t}{t === "fetch_url" && <span className="text-[11px] text-subtle">(approval required)</span>}</label>
              ))}</fieldset>
              <div><Label htmlFor="ch">Allowed API hosts (comma separated)</Label><Input id="ch" value={cfg.allowedHosts.join(", ")} onChange={(e) => setCfg({ ...cfg, allowedHosts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="api.example.com" /></div>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={cfg.memory} onChange={(e) => setCfg({ ...cfg, memory: e.target.checked })} className="accent-[var(--accent)]" /> Memory: keep short notes from completed runs (available as {"{{memory}}"})</label>
              {cfg.memory && cfg.memoryNotes.length > 0 && <p className="text-[12px] text-subtle">{cfg.memoryNotes.length} memory note(s) stored.</p>}
              <div className="grid grid-cols-2 gap-2">
                <div><Label htmlFor="cs">Schedule</Label><Select id="cs" value={cfg.schedule} onChange={(e) => setCfg({ ...cfg, schedule: e.target.value as Cfg["schedule"] })}>{["off", "hourly", "daily", "weekly"].map((s) => <option key={s}>{s}</option>)}</Select></div>
                <div><Label htmlFor="csi">Scheduled input</Label><Input id="csi" value={cfg.scheduleInput} onChange={(e) => setCfg({ ...cfg, scheduleInput: e.target.value })} /></div>
              </div>
              <p className="text-[12px] text-subtle">Click a node to edit it.</p>
            </div>
          )}
          <button type="button" onClick={save} disabled={saving} className={buttonClass("primary", "md", "mt-4 w-full")}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save workflow</button>
          {msg && <Notice tone={msg.tone} className="mt-3">{msg.text}</Notice>}
        </Card>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 [&>*]:min-w-0 gap-6 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <p className="font-semibold">Run</p>
            <Label htmlFor="rin" className="mt-3">Input</Label>
            <Textarea id="rin" rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. How many days of annual leave do I get?" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={start} disabled={busy || run?.status === "running"} className={buttonClass("primary", "sm")}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Save & run</button>
              {run?.status === "running" && <button type="button" onClick={() => act("pause")} className={buttonClass("outline", "sm")}><Pause className="size-3.5" /> Pause</button>}
              {run?.status === "paused" && <button type="button" onClick={() => act("resume")} className={buttonClass("outline", "sm")}><Play className="size-3.5" /> Resume</button>}
              {run && ["running", "paused", "awaiting_approval"].includes(run.status) && <button type="button" onClick={() => act("cancel")} className={buttonClass("outline", "sm")}><Square className="size-3.5" /> Cancel</button>}
              {run?.status === "failed" && <button type="button" onClick={() => act("retry")} className={buttonClass("outline", "sm")}><RotateCcw className="size-3.5" /> Retry failed step</button>}
            </div>
            {run?.status === "awaiting_approval" && headNode && (
              <div className="mt-4 rounded-xl border border-warning/40 bg-warning/8 p-4">
                <p className="flex items-center gap-2 font-medium"><ShieldAlert className="size-4 text-warning" /> Approval required</p>
                <p className="mt-1 text-[13.5px] text-muted">{run.nodeStates[headNode]?.output}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => act("approve")} className={buttonClass("primary", "sm")}><ThumbsUp className="size-3.5" /> Approve</button>
                  <button type="button" onClick={() => act("reject")} className={buttonClass("danger", "sm")}><ThumbsDown className="size-3.5" /> Reject</button>
                </div>
              </div>
            )}
            {recentRuns.length > 0 && (
              <div className="mt-5">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Task history</p>
                <ul className="mt-2 space-y-1 text-[12.5px]">{recentRuns.map((r) => <li key={r.id}><a href={`?run=${r.id}`} className="text-muted hover:text-fg">{r.status} · {r.trigger} · {fmtDateTime(r.createdAt)}</a></li>)}</ul>
              </div>
            )}
          </div>
          <div className="min-w-0">
            {run ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={run.status === "completed" ? "success" : run.status === "failed" ? "danger" : run.status === "running" ? "accent" : "warning"}>{run.status.replace("_", " ")}</Badge>
                  <span className="font-mono text-[11.5px] text-subtle">{run.steps} steps · {(run.inputTokens + run.outputTokens).toLocaleString("en")} tokens · €{run.costEur.toFixed(4)}</span>
                  {finalOut && (
                    <button type="button" className={buttonClass("ghost", "sm", "ml-auto")} onClick={() => { const u = URL.createObjectURL(new Blob([finalOut], { type: "text/markdown" })); const a = document.createElement("a"); a.href = u; a.download = `${run.id}.md`; a.click(); URL.revokeObjectURL(u); }}><Download className="size-3.5" /> Export result</button>
                  )}
                </div>
                {finalOut && <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-border p-4"><Markdown source={finalOut} /></div>}
                <ol className="mt-3 max-h-72 space-y-1 overflow-auto rounded-xl border border-border bg-bg-2 p-3 font-mono text-[11.5px]" aria-label="Execution log">
                  {run.logs.map((l, i) => (
                    <li key={i} className={cn("flex gap-2", l.level === "error" ? "text-danger" : l.level === "warn" ? "text-warning" : "text-muted")}>
                      {l.level === "error" ? <XCircle className="mt-0.5 size-3 shrink-0" /> : l.level === "warn" ? <CircleDashed className="mt-0.5 size-3 shrink-0" /> : <Check className="mt-0.5 size-3 shrink-0" />}
                      <span className="shrink-0 text-subtle">{l.at.slice(11, 19)}</span>{l.nodeId && <span className="shrink-0 text-accent-2">[{l.nodeId}]</span>}<span className="break-words">{l.message}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-[13.5px] text-muted">No runs yet. Enter an input and press Save & run.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
