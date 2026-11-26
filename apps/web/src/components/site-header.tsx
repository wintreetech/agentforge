import { categories } from "@agentforge/catalog";
import { getAnonKey, getUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { NavBar } from "./nav-bar";
import { GuidedTour } from "./guided-tour";

export async function SiteHeader() {
  const user = await getUser();
  const key = user?.id ?? (await getAnonKey());
  const [cartCount, wishCount] = await Promise.all([
    key ? read((db) => db.cart.filter((c) => c.ownerKey === key).reduce((s, c) => s + c.quantity, 0)) : 0,
    user ? read((db) => db.wishlist.filter((w) => w.userId === user.id).length) : 0,
  ]);
  const cats = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    navLabel: c.navLabel,
    accent: c.accent,
  }));
  return (
    <>
      <NavBar user={user ? { name: user.name, email: user.email, role: user.role } : null} cartCount={cartCount} wishCount={wishCount} categories={cats} />
      <GuidedTour signedIn={Boolean(user)} isAdmin={user?.role === "admin"} />
    </>
  );
}
