"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductImage } from "@agentforge/catalog";
import { cn } from "@/lib/utils";

const kindLabel = { illustration: "Illustration", diagram: "Diagram", screenshot: "Screenshot" } as const;

export function Gallery({ images, title }: { images: ProductImage[]; title: string }) {
  const [i, setI] = useState(0);
  const cur = images[i];
  return (
    <div>
      <div className="relative aspect-[3/2] overflow-hidden rounded-3xl border border-border bg-surface">
        <Image src={cur.src} alt={cur.alt} fill priority={i === 0} sizes="(max-width: 1024px) 100vw, 58vw" className={cn(cur.kind === "screenshot" ? "object-contain" : "object-cover")} />
        <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-[11.5px] font-medium text-white backdrop-blur">{kindLabel[cur.kind]}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2" role="tablist" aria-label={`${title} images`}>
        {images.map((im, j) => (
          <button key={im.src} type="button" role="tab" aria-selected={j === i} aria-label={`${kindLabel[im.kind]}: ${im.alt}`} onClick={() => setI(j)} className={cn("relative aspect-[3/2] overflow-hidden rounded-xl border transition", j === i ? "border-accent ring-2 ring-accent/30" : "border-border opacity-70 hover:opacity-100")}>
            <Image src={im.src} alt="" fill sizes="160px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
