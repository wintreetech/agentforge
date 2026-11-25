import { ImageResponse } from "next/og";
import { getCategory, seedProducts } from "@agentforge/catalog";

export const alt = "AgentForge AI product";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = seedProducts.find((x) => x.slug === slug);
  const c = p ? getCategory(p.category) : undefined;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: `linear-gradient(135deg, #08090D 0%, #11131A 55%, ${c?.accent ?? "#7C3AED"}55 100%)`, color: "#F4F5F8" }}>
        <div style={{ fontSize: 28, color: c?.accent2 ?? "#A78BFA" }}>{c?.name ?? "AgentForge AI"}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.05 }}>{p?.title ?? "AgentForge AI"}</div>
          <div style={{ fontSize: 28, marginTop: 20, color: "#A3A9BC", maxWidth: 1000 }}>{p?.shortDescription ?? ""}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30 }}>
          <span>AgentForge AI</span>
          <span style={{ fontWeight: 700 }}>{p ? `€${p.priceCents / 100}` : ""}{p && p.status !== "published" ? " · Coming soon" : ""}</span>
        </div>
      </div>
    ),
    size,
  );
}
