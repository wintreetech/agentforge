import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock, Plus } from "lucide-react";
import { getCategory, type Product } from "@agentforge/catalog";
import { addToCartAction } from "@/app/actions/shop";
import { cn, deliveryShort, eur, statusLabel } from "@/lib/utils";
import { Badge, buttonClass } from "./ui";

export function StatusBadge({ status }: { status: Product["status"] }) {
  const tone = status === "published" ? "success" : status === "beta" ? "cyan" : status === "coming_soon" ? "neutral" : "warning";
  return <Badge tone={tone}>{status === "coming_soon" && <Clock className="size-3" />}{statusLabel[status]}</Badge>;
}

export function ProductCard({ p, view = "grid", priority = false }: { p: Product; view?: "grid" | "list"; priority?: boolean }) {
  const cat = getCategory(p.category)!;
  const buyable = p.status === "published" && p.functional;
  const action = buyable ? (
    <form action={addToCartAction}>
      <input type="hidden" name="slug" value={p.slug} />
      <button className={buttonClass("outline", "sm")} aria-label={`Add ${p.title} to cart`}>
        <Plus className="size-3.5" /> Add to cart
      </button>
    </form>
  ) : (
    <span className={cn(buttonClass("outline", "sm"), "cursor-not-allowed opacity-60")} title="Not purchasable yet: this product's deliverable is still in development." aria-disabled="true">
      Coming soon
    </span>
  );

  if (view === "list") {
    return (
      <article className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-surface p-3 transition hover:border-border-strong sm:flex-row">
        <Link href={`/products/${p.slug}`} className="relative aspect-[3/2] w-full shrink-0 overflow-hidden rounded-xl sm:w-60" tabIndex={-1} aria-hidden="true">
          <Image src={p.thumbnail} alt="" fill sizes="(max-width: 640px) 100vw, 240px" className="object-cover transition duration-500 group-hover:scale-[1.03]" priority={priority} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col py-1 pr-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium" style={{ color: cat.accent }}>{cat.name}</span>
            <StatusBadge status={p.status} />
            <Badge>{deliveryShort[p.delivery]}</Badge>
          </div>
          <h3 className="mt-1.5 text-[16px] font-semibold tracking-tight">
            <Link href={`/products/${p.slug}`} className="after:absolute after:inset-0 after:content-['']">{p.title}</Link>
          </h3>
          <p className="mt-1 line-clamp-2 text-[13.5px] text-muted">{p.shortDescription}</p>
          <p className="mt-2 text-[12.5px] text-subtle">{p.integrations.slice(0, 4).join(" · ")}</p>
          <div className="relative z-10 mt-auto flex items-center justify-between gap-3 pt-3">
            <span className="text-lg font-semibold tabular-nums">{eur(p.priceCents)}</span>
            {action}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_20px_50px_-24px_var(--glow)]">
      <div className="relative aspect-[3/2] overflow-hidden">
        <Image src={p.thumbnail} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.04]" priority={priority} />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <StatusBadge status={p.status} />
        </div>
        <ArrowUpRight className="absolute right-3 top-3 size-5 text-white/0 transition group-hover:text-white/80" aria-hidden="true" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-medium" style={{ color: cat.accent }}>{cat.navLabel}</span>
          <span className="text-subtle">·</span>
          <span className="text-subtle">{deliveryShort[p.delivery]}</span>
        </div>
        <h3 className="mt-1.5 text-[15.5px] font-semibold leading-snug tracking-tight">
          <Link href={`/products/${p.slug}`} className="after:absolute after:inset-0 after:content-['']">{p.title}</Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-muted">{p.shortDescription}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.integrations.slice(0, 3).map((i) => (
            <span key={i} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-muted">{i}</span>
          ))}
        </div>
        <div className="relative z-10 mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="text-[17px] font-semibold tabular-nums">{eur(p.priceCents)}</span>
          {action}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface" aria-hidden="true">
      <div className="skeleton aspect-[3/2]" />
      <div className="space-y-2.5 p-4">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="flex justify-between pt-3">
          <div className="skeleton h-5 w-14 rounded" />
          <div className="skeleton h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
