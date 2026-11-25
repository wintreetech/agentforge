"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { buttonClass, Input, Select } from "@/components/ui";

const ENDPOINTS = [
  { id: "list", label: "GET /api/v1/products", method: "GET", path: "/api/v1/products?availability=available&per_page=3", body: null },
  { id: "one", label: "GET /api/v1/products/:slug", method: "GET", path: "/api/v1/products/mcp-server-developer-kit", body: null },
  { id: "verify", label: "POST /api/v1/licenses/verify", method: "POST", path: "/api/v1/licenses/verify", body: '{"key":"AF-ABCDE-FGHJK-LMNPQ-RSTU"}' },
  { id: "health", label: "GET /api/health", method: "GET", path: "/api/health", body: null },
];

export function ApiTester() {
  const [ep, setEp] = useState(ENDPOINTS[0]);
  const [path, setPath] = useState(ep.path);
  const [body, setBody] = useState(ep.body ?? "");
  const [out, setOut] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!path.startsWith("/api/v1/") && path !== "/api/health") return;
    setLoading(true);
    try {
      const r = await fetch(path, { method: ep.method, headers: ep.body ? { "Content-Type": "application/json" } : undefined, body: ep.method === "POST" ? body : undefined });
      setStatus(r.status);
      setOut(JSON.stringify(await r.json(), null, 2).slice(0, 6000));
    } catch (e) {
      setOut(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap gap-2">
        <label htmlFor="ep" className="sr-only">Endpoint</label>
        <Select id="ep" value={ep.id} onChange={(e) => { const n = ENDPOINTS.find((x) => x.id === e.target.value)!; setEp(n); setPath(n.path); setBody(n.body ?? ""); setOut(null); }} className="max-w-72">
          {ENDPOINTS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </Select>
        <label htmlFor="ep-path" className="sr-only">Path</label>
        <Input id="ep-path" value={path} onChange={(e) => setPath(e.target.value)} className="min-w-60 flex-1 font-mono text-[12.5px]" />
        <button type="button" onClick={send} disabled={loading} className={buttonClass("primary")}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Send</button>
      </div>
      {ep.method === "POST" && <textarea aria-label="Request body" value={body} onChange={(e) => setBody(e.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-border bg-bg-2 p-2 font-mono text-[12.5px]" />}
      {out && <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-bg-2 p-3 font-mono text-[12px] text-muted"><span className="text-fg">HTTP {status}</span>{"\n"}{out}</pre>}
    </div>
  );
}
