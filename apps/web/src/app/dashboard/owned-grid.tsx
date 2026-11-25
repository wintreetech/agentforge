import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Product } from "@agentforge/catalog";
import { EmptyState, LinkButton } from "@/components/ui";
import { deliveryShort } from "@/lib/utils";

export function OwnedGrid({ items, empty, href, cta }: { items: Product[]; empty: { title: string; body: ReactNode; category?: string }; href: (p: Product) => string; cta: string }) {
  if (!items.length)
    return <EmptyState title={empty.title} action={<LinkButton href={empty.category ? `/category/${empty.category}` : "/marketplace?availability=available"}>Browse products</LinkButton>}>{empty.body}</EmptyState>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((p) => (
        <div key={p.slug} className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="relative aspect-[16/9]"><Image src={p.thumbnail} alt="" fill sizes="33vw" className="object-cover" /></div>
          <div className="p-4">
            <p className="text-[12px] text-subtle">{deliveryShort[p.delivery]} · v{p.version}</p>
            <p className="mt-1 font-semibold">{p.title}</p>
            <div className="mt-3 flex gap-2">
              <LinkButton href={href(p)} size="sm">{cta}</LinkButton>
              <Link href={`/docs/products/${p.slug}`} className="inline-flex h-8 items-center px-2 text-[13px] text-muted hover:text-fg">Docs</Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
