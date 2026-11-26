import type { MetadataRoute } from "next";
import { categories, seedProducts } from "@agentforge/catalog";
import { blogPosts } from "@/content/blog-data";
import { LEGAL } from "@/content/legal";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const u = (p: string) => `${env.appUrl}${p}`;
  const pages = ["", "/how-it-works", "/marketplace", "/assistant", "/pricing", "/enterprise", "/docs", "/integrations", "/blog", "/about", "/contact", "/help", "/faq", "/security", "/changelog", "/status", "/affiliates", "/sellers", "/careers"];
  return [
    ...pages.map((p) => ({ url: u(p), changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...categories.map((c) => ({ url: u(`/category/${c.slug}`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...seedProducts.filter((p) => p.status !== "draft" && p.status !== "archived").map((p) => ({ url: u(`/products/${p.slug}`), lastModified: p.updatedAt, priority: p.status === "published" ? 0.9 : 0.5 })),
    ...seedProducts.filter((p) => p.functional).map((p) => ({ url: u(`/docs/products/${p.slug}`), priority: 0.5 })),
    ...blogPosts.map((b) => ({ url: u(`/blog/${b.slug}`), lastModified: b.date, priority: 0.6 })),
    ...Object.keys(LEGAL).map((k) => ({ url: u(`/legal/${k}`), priority: 0.2 })),
  ];
}
