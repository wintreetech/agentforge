"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Check, CircleDashed, Copy, Download, Loader2, Play, Square, XCircle, FlaskConical } from "lucide-react";
import type { RunnableMeta } from "@agentforge/product-registry/fields";
import { Markdown } from "./markdown";
import { buttonClass, Input, Label, Select, Textarea } from "./ui";
import { cn } from "@/lib/utils";

export interface ModelOption {
  id: string;
  label: string;
  available: boolean;
  reason: string | null;
  inputEurPerM: number;
  outputEurPerM: number;
}

interface StepState { id: string; label: string; agent?: string; status: string; ms?: number; tokens?: number; detail?: string }

export function ProductRunner({
  meta,
  models,
  mode,
  kbs = [],
  compact = false,
  creditsLeft,
  demoLeft,
}: {
  meta: RunnableMeta;
  models: ModelOption[];
  mode: "demo" | "owned";
  kbs?: { id: string; name: string }[];
  compact?: boolean;
  creditsLeft?: number;
  demoLeft?: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [model, setModel] = useState(models.find((m) => m.available && m.id !== "sandbox-deterministic")?.id ?? "sandbox-deterministic");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [streamText, setStreamText] = useState("");
  const [output, setOutput] = useState<{ markdown: string; data?: any; warnings: string[]; simulated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ inputTokens: number; outputTokens: number; costEur: number; ms: number } | null>(null);
  const [meta2, setMeta2] = useState<{ simulated: boolean; model: string; estimate: { tokens: number; costEur: number } } | null>(null);
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [values, setValues] = useState<Record<string, string | boolean>>({});

  const selected = models.find((m) => m.id === model);
  const estCost = selected ? (meta.policy.budget.maxTokens * 0.5 * (selected.inputEurPerM * 0.7 + selected.outputEurPerM * 0.3)) / 1_000_000 : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    fd.set("model", model);
    setRunning(true);
    setSteps([]);
    setStreamText("");
    setOutput(null);
    setError(null);
    setUsage(null);
    abort.current = new AbortController();
    try {
      const res = await fetch(`/api/execute/${meta.slug}`, { method: "POST", body: fd, signal: abort.current.signal });
      if (!res.body) throw new Error("No response");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "meta") setMeta2(ev);
          else if (ev.type === "step")
            setSteps((s) => {
              const i = s.findIndex((x) => x.id === ev.id);
              if (i < 0) return [...s, ev];
              const c = [...s];
              c[i] = ev;
              return c;
            });
          else if (ev.type === "token") setStreamText((t) => t + ev.text);
          else if (ev.type === "output") setOutput(ev.output);
          else if (ev.type === "error") setError(ev.message);
          else if (ev.type === "done") setUsage(ev.usage);
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") setError("Execution was cancelled.");
      else setError((err as Error).message || "The run failed.");
    } finally {
      setRunning(false);
    }
  }

  const exportFile = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shown = output?.markdown ?? streamText;

  return (
    <div className={cn("grid gap-6", !compact && "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
      <form ref={formRef} onSubmit={submit} className="space-y-4" key={formKey} encType="multipart/form-data">
        {meta.examples.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-subtle">Examples:</span>
            {meta.examples.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => {
                  setValues(ex.values);
                  setFormKey((k) => k + 1);
                }}
                className="rounded-full border border-border px-2.5 py-0.5 text-[12.5px] text-muted transition hover:border-border-strong hover:text-fg"
              >
                {ex.label}
              </button>
            ))}
          </div>
        )}
        {meta.fields.map((f) => {
          const idf = `${meta.slug}-${f.name}`;
          const dv = values[f.name] ?? f.defaultValue;
          if (f.type === "kb") {
            if (mode !== "owned" || !kbs.length) return null;
            return (
              <div key={f.name}>
                <Label htmlFor={idf}>{f.label}</Label>
                <Select id={idf} name={f.name} defaultValue="">
                  <option value="">None — use documents below</option>
                  {kbs.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </Select>
                {f.help && <p className="mt-1.5 text-[12.5px] text-subtle">{f.help}</p>}
              </div>
            );
          }
          if (f.type === "checkbox")
            return (
              <label key={f.name} className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-2/40 p-3 text-[13.5px]">
                <input type="checkbox" name={f.name} defaultChecked={dv === true} className="mt-0.5 accent-[var(--accent)]" />
                <span>
                  <span className="font-medium">{f.label}</span>
                  {f.help && <span className="mt-0.5 block text-[12.5px] text-muted">{f.help}</span>}
                </span>
              </label>
            );
          return (
            <div key={f.name}>
              <Label htmlFor={idf}>
                {f.label} {f.required && <span className="text-danger" aria-hidden="true">*</span>}
              </Label>
              {f.type === "textarea" ? (
                <Textarea id={idf} name={f.name} rows={compact ? Math.min(f.rows ?? 4, 4) : f.rows ?? 4} maxLength={f.maxLength} required={f.required} placeholder={f.placeholder} defaultValue={typeof dv === "string" ? dv : ""} />
              ) : f.type === "select" ? (
                <Select id={idf} name={f.name} defaultValue={typeof dv === "string" ? dv : undefined}>
                  {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : f.type === "file" ? (
                <input id={idf} name={f.name} type="file" accept={f.accept} required={f.required} className="block w-full rounded-xl border border-dashed border-border-strong bg-bg-2 p-3 text-[13px] text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-[13px] file:text-fg" />
              ) : (
                <Input id={idf} name={f.name} maxLength={f.maxLength} required={f.required} placeholder={f.placeholder} defaultValue={typeof dv === "string" ? dv : ""} />
              )}
              {f.help && <p className="mt-1.5 text-[12.5px] text-subtle">{f.help}</p>}
            </div>
          );
        })}

        <div className="rounded-xl border border-border bg-surface-2/40 p-3">
          <Label htmlFor={`${meta.slug}-model`}>Model</Label>
          <Select id={`${meta.slug}-model`} value={model} onChange={(e) => setModel(e.target.value)}>
            {models.map((m) => (
              <option key={m.id} value={m.id} disabled={!m.available}>
                {m.label}{m.reason ? ` — ${m.reason}` : ""}
              </option>
            ))}
          </Select>
          <p className="mt-2 text-[12.5px] text-muted">
            {model === "sandbox-deterministic" ? (
              <>Sandbox runs use deterministic code, not an AI model. Output is labelled as simulated. No cost.</>
            ) : (
              <>Estimated provider cost up to ~€{estCost.toFixed(3)} per run (budget {meta.policy.budget.maxTokens.toLocaleString("en")} tokens, cap €{meta.policy.budget.maxCostEur}).</>
            )}
          </p>
          <p className="mt-1 text-[12px] text-subtle">
            Limits: {meta.policy.budget.maxSteps} steps · {Math.round(meta.policy.timeoutMs / 1000)}s timeout
            {mode === "demo" && demoLeft != null && <> · {demoLeft} demo runs left today</>}
            {mode === "owned" && creditsLeft != null && <> · {creditsLeft} credits</>}
          </p>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={running} className={buttonClass("primary", "lg", "flex-1")}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {running ? "Running…" : "Run"}
          </button>
          {running && (
            <button type="button" onClick={() => abort.current?.abort()} className={buttonClass("outline", "lg")}>
              <Square className="size-4" /> Cancel
            </button>
          )}
        </div>
      </form>

      <div className="min-w-0 space-y-4">
        {(meta2?.simulated || output?.simulated) && (
          <div className="flex items-start gap-2.5 rounded-xl border border-accent-3/35 bg-accent-3/8 px-3.5 py-2.5 text-[13px]">
            <FlaskConical className="mt-0.5 size-4 shrink-0 text-accent-3" />
            <p><span className="font-semibold">Simulated output (sandbox).</span> <span className="text-muted">Produced by deterministic code, not an AI model. Configure a provider key to run on a live model.</span></p>
          </div>
        )}

        {steps.length > 0 && (
          <ol className="space-y-1.5 rounded-2xl border border-border bg-surface p-3" aria-label="Execution progress">
            {steps.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 text-[13px]">
                {s.status === "running" ? <Loader2 className="size-4 animate-spin text-accent-2" /> : s.status === "done" ? <Check className="size-4 text-success" /> : s.status === "failed" ? <XCircle className="size-4 text-danger" /> : <CircleDashed className="size-4 text-subtle" />}
                {s.agent && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-muted">{s.agent}</span>}
                <span className={cn(s.status === "running" ? "text-fg" : "text-muted")}>{s.label}</span>
                {s.detail && <span className="truncate text-[12px] text-subtle">— {s.detail}</span>}
                <span className="ml-auto font-mono text-[11.5px] text-subtle tabular-nums">{s.ms != null ? `${s.ms} ms` : ""}{s.tokens ? ` · ${s.tokens} tok` : ""}</span>
              </li>
            ))}
          </ol>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/35 bg-danger/8 px-3.5 py-3 text-[13.5px]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <p>{error}</p>
          </div>
        )}

        {output?.warnings?.length ? (
          <div className="rounded-xl border border-warning/35 bg-warning/8 px-3.5 py-2.5 text-[13px]">
            {output.warnings.map((w) => <p key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />{w}</p>)}
          </div>
        ) : null}

        <div className={cn("relative min-h-64 rounded-2xl border border-border bg-surface p-5", !shown && "grid place-items-center")} aria-live="polite" aria-busy={running}>
          {shown ? (
            <>
              <Markdown source={shown} />
              {running && !output && <span className="inline-block h-4 w-2 animate-pulse bg-accent align-middle" />}
            </>
          ) : running ? (
            <div className="w-full space-y-3" aria-hidden="true">
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-5/6 rounded" />
              <div className="skeleton h-3 w-2/3 rounded" />
            </div>
          ) : (
            <p className="text-center text-[13.5px] text-subtle">Output appears here. Try an example to see the full flow.</p>
          )}
        </div>

        {output && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={buttonClass("outline", "sm")}
              onClick={async () => {
                await navigator.clipboard.writeText(output.markdown);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" className={buttonClass("outline", "sm")} onClick={() => exportFile(`${meta.slug}.md`, output.markdown, "text/markdown")}>
              <Download className="size-3.5" /> Markdown
            </button>
            {output.data !== undefined && (
              <button type="button" className={buttonClass("outline", "sm")} onClick={() => exportFile(`${meta.slug}.json`, JSON.stringify(output.data, null, 2), "application/json")}>
                <Download className="size-3.5" /> JSON
              </button>
            )}
            {output.data?.csv && (
              <button type="button" className={buttonClass("outline", "sm")} onClick={() => exportFile(`${meta.slug}-lines.csv`, output.data.csv, "text/csv")}>
                <Download className="size-3.5" /> CSV
              </button>
            )}
            {usage && (
              <span className="ml-auto font-mono text-[11.5px] text-subtle">
                {usage.inputTokens + usage.outputTokens} tokens · €{usage.costEur.toFixed(4)} · {(usage.ms / 1000).toFixed(1)}s{meta2 ? ` · ${meta2.model}` : ""}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
