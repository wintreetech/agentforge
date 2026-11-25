"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useLocalStorage, writeLocal } from "@/lib/client-store";

const KEY = "af-recent";
type Item = { slug: string; title: string; thumbnail: string };

function parse(raw: string | null | undefined): Item[] {
  try {
    return raw ? (JSON.parse(raw) as Item[]) : [];
  } catch {
    return [];
  }
}

export function TrackView({ slug, title, thumbnail }: Item) {
  useEffect(() => {
    let cur: Item[] = [];
    try {
      cur = parse(localStorage.getItem(KEY));
    } catch {}
    writeLocal(KEY, JSON.stringify([{ slug, title, thumbnail }, ...cur.filter((c) => c.slug !== slug)].slice(0, 8)));
  }, [slug, title, thumbnail]);
  return null;
}

export function RecentlyViewed({ exclude }: { exclude?: string }) {
  const items = parse(useLocalStorage(KEY)).filter((i) => i.slug !== exclude).slice(0, 6);
  if (!items.length) return null;
  return (
    <section className="mt-16" aria-labelledby="recent-h">
      <h2 id="recent-h" className="text-lg font-semibold">Recently viewed</h2>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {items.map((i) => (
          <Link key={i.slug} href={`/products/${i.slug}`} className="w-48 shrink-0 overflow-hidden rounded-xl border border-border bg-surface transition hover:border-border-strong">
            {/* eslint-disable-next-line @next/next/no-img-element -- local SVG thumbnails; avoids image optimizer for a client-only list */}
            <img src={i.thumbnail} alt="" loading="lazy" className="aspect-[3/2] w-full object-cover" />
            <p className="truncate px-3 py-2 text-[13px]">{i.title}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
