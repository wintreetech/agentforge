import { categories } from "@agentforge/catalog";
import { getAnonKey, getUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { getProducts } from "@/lib/catalog";
import { NavBar } from "./nav-bar";

export async function SiteHeader() {
  const user = await getUser();
  const key = user?.id ?? (await getAnonKey());
  const [cartCount, wishCount, products] = await Promise.all([
    key ? read((db) => db.cart.filter((c) => c.ownerKey === key).reduce((s, c) => s + c.quantity, 0)) : 0,
    user ? read((db) => db.wishlist.filter((w) => w.userId === user.id).length) : 0,
    getProducts(),
  ]);
  const featured = products.filter((p) => p.status === "published").slice(0, 3).map((p) => ({ slug: p.slug, title: p.title, priceCents: p.priceCents, thumbnail: p.thumbnail, short: p.shortDescription }));
  const cats = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    navLabel: c.navLabel,
    tagline: c.tagline,
    accent: c.accent,
    count: products.filter((p) => p.category === c.slug).length,
    available: products.filter((p) => p.category === c.slug && p.status === "published").length,
  }));
  return <NavBar user={user ? { name: user.name, email: user.email, role: user.role } : null} cartCount={cartCount} wishCount={wishCount} categories={cats} featured={featured} />;
}
