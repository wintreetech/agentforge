"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { LayoutGrid, List, Loader2, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FacetOptions {
  categories: { value: string; label: string; count: number }[];
  providers: string[];
  integrations: string[];
  industries: string[];
  difficulties: string[];
  licenses: string[];
  hideCategory?: boolean;
}

const LIST_KEYS = ["category", "provider", "integration", "industry", "difficulty", "license", "availability", "hosting"] as const;

export function MarketplaceFilters({ facets, total }: { facets: FacetOptions; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [min, setMin] = useState(Number(sp.get("min") ?? 10));
  const [max, setMax] = useState(Number(sp.get("max") ?? 800));

  // Re-sync local inputs when the URL changes (back/forward, clear filters).
  const spKey = sp.toString();
  const [lastKey, setLastKey] = useState(spKey);
  if (lastKey !== spKey) {
    setLastKey(spKey);
    setQ(sp.get("q") ?? "");
    setMin(Number(sp.get("min") ?? 10));
    setMax(Number(sp.get("max") ?? 800));
  }

  const push = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mut(p);
    p.delete("page");
    start(() => router.push(`${pathname}?${p.toString()}`, { scroll: false }));
  };
  const list = (k: string) => (sp.get(k) ?? "").split(",").filter(Boolean);
  const toggle = (k: string, v: string) =>
    push((p) => {
      const cur = new Set(list(k));
      if (cur.has(v)) cur.delete(v);
      else cur.add(v);
      if (cur.size) p.set(k, [...cur].join(","));
      else p.delete(k);
    });
  const active = LIST_KEYS.reduce((n, k) => n + list(k).length, 0) + (sp.get("min") || sp.get("max") ? 1 : 0);

  const group = (title: string, key: string, opts: { value: string; label: string; count?: number }[]) => (
    <fieldset className="border-t border-border py-4">
      <legend className="mb-2.5 text-[12.5px] font-semibold uppercase tracking-wider text-subtle">{title}</legend>
      <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
        {opts.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-muted hover:text-fg">
            <input type="checkbox" checked={list(key).includes(o.value)} onChange={() => toggle(key, o.value)} className="size-4 rounded accent-[var(--accent)]" />
            <span className="flex-1">{o.label}</span>
            {o.count != null && <span className="text-[12px] text-subtle tabular-nums">{o.count}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );

  const panel = (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          push((p) => (q.trim() ? p.set("q", q.trim()) : p.delete("q")));
        }}
        role="search"
      >
        <label htmlFor="mq" className="sr-only">Search products</label>
        <input id="mq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="h-10 w-full rounded-xl border border-border bg-bg-2 px-3.5 text-[14px] outline-none focus:border-accent" />
      </form>
      <fieldset className="mt-4 border-t border-border py-4">
        <legend className="mb-2.5 text-[12.5px] font-semibold uppercase tracking-wider text-subtle">Price (EUR)</legend>
        <div className="flex items-center justify-between text-[13px] tabular-nums"><span>€{min}</span><span>€{max}</span></div>
        <div className="relative mt-2 h-6">
          <label className="sr-only" htmlFor="pmin">Minimum price</label>
          <input id="pmin" type="range" min={10} max={800} step={5} value={min} onChange={(e) => setMin(Math.min(Number(e.target.value), max - 5))} onPointerUp={() => push((p) => (min > 10 ? p.set("min", String(min)) : p.delete("min")))} onKeyUp={() => push((p) => (min > 10 ? p.set("min", String(min)) : p.delete("min")))} className="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent accent-[var(--accent)] [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto" />
          <label className="sr-only" htmlFor="pmax">Maximum price</label>
          <input id="pmax" type="range" min={10} max={800} step={5} value={max} onChange={(e) => setMax(Math.max(Number(e.target.value), min + 5))} onPointerUp={() => push((p) => (max < 800 ? p.set("max", String(max)) : p.delete("max")))} onKeyUp={() => push((p) => (max < 800 ? p.set("max", String(max)) : p.delete("max")))} className="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent accent-[var(--accent)] [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto" />
        </div>
      </fieldset>
      {group("Availability", "availability", [{ value: "available", label: "Available now" }, { value: "coming_soon", label: "Coming soon" }])}
      {!facets.hideCategory && group("Category", "category", facets.categories)}
      {group("Hosting", "hosting", [{ value: "hosted", label: "Hosted by AgentForge" }, { value: "self-hosted", label: "Self-hosted" }])}
      {group("Difficulty", "difficulty", facets.difficulties.map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) })))}
      {group("AI provider", "provider", facets.providers.map((d) => ({ value: d, label: d })))}
      {group("Industry", "industry", facets.industries.map((d) => ({ value: d, label: d })))}
      {group("Integration", "integration", facets.integrations.map((d) => ({ value: d, label: d })))}
      {active > 0 && (
        <button type="button" onClick={() => push((p) => [...LIST_KEYS, "min", "max", "q"].forEach((k) => p.delete(k)))} className="mt-2 text-[13px] font-medium text-accent-2">
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <>
      <aside data-tour="filters" className="hidden lg:block" aria-label="Filters">{panel}</aside>
      <div className="lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3.5 text-[13.5px]">
          <SlidersHorizontal className="size-4" /> Filters {active > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] text-white">{active}</span>}
        </button>
        {open && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Filters">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-[min(340px,100%)] overflow-y-auto bg-bg p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-semibold">Filters</p>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close filters" className="grid size-9 place-items-center rounded-lg hover:bg-surface-2"><X className="size-5" /></button>
              </div>
              {panel}
              <button type="button" onClick={() => setOpen(false)} className="mt-4 h-11 w-full rounded-xl bg-accent font-medium text-white">Show {total} results</button>
            </div>
          </div>
        )}
      </div>
      {pending && <Loader2 className="fixed bottom-6 right-6 z-50 size-6 animate-spin text-accent" aria-label="Updating results" />}
    </>
  );
}

export function SortAndView({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const view = sp.get("view") === "list" ? "list" : "grid";
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set(k, v);
    if (k !== "view") p.delete("page");
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[13.5px] text-muted" aria-live="polite"><span className="font-medium text-fg">{total}</span> {total === 1 ? "product" : "products"}</p>
      <div className="flex items-center gap-2">
        <label htmlFor="sort" className="sr-only">Sort by</label>
        <select id="sort" value={sp.get("sort") ?? (sp.get("q") ? "relevance" : "popular")} onChange={(e) => set("sort", e.target.value)} className="h-9 rounded-lg border border-border bg-bg-2 px-2.5 text-[13px]">
          {sp.get("q") && <option value="relevance">Most relevant</option>}
          <option value="popular">Most popular</option>
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
        <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="View">
          {(["grid", "list"] as const).map((v) => (
            <button key={v} type="button" onClick={() => set("view", v)} aria-pressed={view === v} aria-label={`${v} view`} className={cn("grid size-8 place-items-center rounded-md text-muted", view === v && "bg-surface-2 text-fg")}>
              {v === "grid" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
