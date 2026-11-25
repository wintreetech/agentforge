"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { cn, eur } from "@/lib/utils";

interface Rec {
  product: { slug: string; title: string; priceCents: number; status: string; shortDescription: string };
  reasons: string[];
}
interface Result {
  budgetEur: number | null;
  needs: string[];
  recommendations: Rec[];
  bundle: { items: { slug: string; title: string; priceCents: number }[]; totalEur: number } | null;
  notes: string[];
}

const EXAMPLES = [
  "I run a marketing agency and need to automate content creation, lead research and client reporting.",
  "Extract data from supplier invoices into a spreadsheet, budget under €100",
  "Answer staff questions from our HR handbook",
];

export function ProblemSearch({ large = false }: { large?: boolean }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(text: string) {
    if (text.trim().length < 4) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: text }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Something went wrong");
      setRes(await r.json());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("w-full", large && "max-w-2xl")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="group relative rounded-2xl border border-border-strong bg-surface/80 p-2 shadow-[0_20px_60px_-30px_var(--glow)] backdrop-blur focus-within:border-accent"
      >
        <label htmlFor="problem" className="sr-only">Describe your business problem</label>
        <textarea
          id="problem"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              run(q);
            }
          }}
          rows={2}
          maxLength={600}
          placeholder="Describe a business problem, e.g. “summarise long PDFs for my team”"
          className="w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed outline-none placeholder:text-subtle"
        />
        <div className="flex items-center justify-end gap-2 px-2 pb-1 sm:justify-between">
          <span className="hidden items-center gap-1.5 text-[12px] text-subtle sm:flex"><Sparkles className="size-3.5" /> Matches against the real catalogue</span>
          <button type="submit" disabled={loading || q.trim().length < 4} className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-accent px-4 text-[13.5px] font-medium text-white transition hover:brightness-110 disabled:opacity-50">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Find products
          </button>
        </div>
      </form>
      {!res && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => (setQ(e), run(e))} className="rounded-full border border-border bg-surface/60 px-3 py-1 text-left text-[12.5px] text-muted transition hover:border-border-strong hover:text-fg">
              {e.length > 64 ? e.slice(0, 62) + "…" : e}
            </button>
          ))}
        </div>
      )}
      {err && <p className="mt-3 text-sm text-danger" role="alert">{err}</p>}
      {res && (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-left" aria-live="polite">
          {res.needs.length > 0 && (
            <p className="text-[13px] text-muted">
              Needs detected: <span className="text-fg">{res.needs.join(", ")}</span>
              {res.budgetEur != null && <> · Budget: <span className="text-fg">€{res.budgetEur}</span></>}
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {res.recommendations.slice(0, 4).map((r) => (
              <li key={r.product.slug}>
                <Link href={`/products/${r.product.slug}`} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 transition hover:border-border-strong">
                  <span>
                    <span className="block text-[14px] font-medium">{r.product.title}</span>
                    <span className="mt-0.5 block text-[12.5px] text-muted">{r.reasons.slice(0, 2).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums">{eur(r.product.priceCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {res.bundle && (
            <p className="mt-3 text-[13px] text-muted">
              Suggested combination: {res.bundle.items.map((b) => b.title).join(" + ")} = <span className="font-semibold text-fg">€{res.bundle.totalEur}</span>
            </p>
          )}
          {res.notes.map((n) => <p key={n} className="mt-2 text-[12.5px] text-subtle">{n}</p>)}
          <div className="mt-3 flex gap-3 text-[13px]">
            <Link href={`/assistant?q=${encodeURIComponent(q)}`} className="font-medium text-accent-2">Open in assistant →</Link>
            <button type="button" onClick={() => setRes(null)} className="text-subtle hover:text-fg">Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}
