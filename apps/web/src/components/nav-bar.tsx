"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Heart, LayoutDashboard, LogOut, Menu, Search, Shield, ShoppingBag, X, ArrowRight } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { buttonClass } from "./ui";
import { cn, eur } from "@/lib/utils";
import { signOutAction } from "@/app/actions/auth";

interface Cat { slug: string; name: string; navLabel: string; tagline: string; accent: string; count: number; available: number }
interface Feat { slug: string; title: string; priceCents: number; thumbnail: string; short: string }

const RESOURCES = [
  { href: "/how-it-works", label: "How it works", desc: "The full workflow and a guided tour" },
  { href: "/blog", label: "Blog", desc: "Guides and product notes" },
  { href: "/docs", label: "Documentation", desc: "Set up and use products" },
  { href: "/integrations", label: "Integrations", desc: "Supported tools and providers" },
  { href: "/help", label: "Help center", desc: "Answers to common questions" },
  { href: "/changelog", label: "Changelog", desc: "What shipped recently" },
  { href: "/status", label: "System status", desc: "Live service checks" },
  { href: "/enterprise", label: "Enterprise", desc: "Security, SSO and custom work" },
];

export function NavBar({ user, cartCount, wishCount, categories, featured }: { user: { name: string; email: string; role: string } | null; cartCount: number; wishCount: number; categories: Cat[]; featured: Feat[] }) {
  const [open, setOpen] = useState<null | "market" | "resources" | "user">(null);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  // Close menus on navigation (state adjustment during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(null);
    setMobile(false);
    setSearch(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setSearch(false);
        setMobile(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const navLink = (href: string, label: string) => (
    <Link href={href} className={cn("whitespace-nowrap rounded-lg px-2 py-1.5 text-[13.5px] text-muted transition hover:text-fg", pathname.startsWith(href) && "text-fg")}>
      {label}
    </Link>
  );

  return (
    <header ref={ref} className="glass sticky top-0 z-50 border-b border-border">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="Main" className="ml-2 hidden items-center xl:flex">
          <button
            type="button"
            aria-expanded={open === "market"}
            aria-controls="mega-market"
            onClick={() => setOpen(open === "market" ? null : "market")}
            onMouseEnter={() => setOpen("market")}
            className="flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-[13.5px] text-muted transition hover:text-fg"
          >
            Marketplace <ChevronDown className={cn("size-3.5 transition", open === "market" && "rotate-180")} />
          </button>
          {categories.filter((c) => c.slug !== "multi-agent-systems").map((c) => (
            <span key={c.slug}>{navLink(`/category/${c.slug}`, c.navLabel)}</span>
          ))}
          {navLink("/pricing", "Pricing")}
          <button
            type="button"
            aria-expanded={open === "resources"}
            onClick={() => setOpen(open === "resources" ? null : "resources")}
            className="flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-[13.5px] text-muted transition hover:text-fg"
          >
            Resources <ChevronDown className={cn("size-3.5 transition", open === "resources" && "rotate-180")} />
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button type="button" data-tour="search" onClick={() => setSearch(true)} className="hidden h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-surface/60 pl-2.5 pr-2 text-[13px] text-subtle transition hover:text-fg 2xl:flex" aria-label="Search products">
            <Search className="size-4" /> Search <kbd className="ml-3 rounded border border-border px-1.5 font-mono text-[10.5px]">Ctrl K</kbd>
          </button>
          <button type="button" data-tour="search" onClick={() => setSearch(true)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 2xl:hidden" aria-label="Search products">
            <Search className="size-[18px]" />
          </button>
          <Link href="/wishlist" className="relative grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg" aria-label={`Wishlist, ${wishCount} items`}>
            <Heart className="size-[18px]" />
            {wishCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">{wishCount}</span>}
          </Link>
          <Link href="/cart" className="relative grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg" aria-label={`Cart, ${cartCount} items`}>
            <ShoppingBag className="size-[18px]" />
            {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">{cartCount}</span>}
          </Link>
          <ThemeToggle />
          {user ? (
            <div className="relative ml-1">
              <button type="button" aria-expanded={open === "user"} onClick={() => setOpen(open === "user" ? null : "user")} className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-accent-2 to-accent text-[13px] font-semibold text-white" aria-label="Account menu">
                {user.name.slice(0, 1).toUpperCase()}
              </button>
              {open === "user" && (
                <div className="absolute right-0 top-11 w-60 rounded-xl border border-border bg-surface p-1.5 shadow-2xl">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"><LayoutDashboard className="size-4" /> Dashboard</Link>
                  {user.role === "admin" && <Link href="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"><Shield className="size-4" /> Admin</Link>}
                  <form action={signOutAction}>
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"><LogOut className="size-4" /> Sign out</button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="ml-1 hidden items-center gap-1 sm:flex">
              <Link href="/signin" className={buttonClass("ghost", "sm")}>Sign in</Link>
              <Link href="/signup" className={buttonClass("primary", "sm")}>Get started</Link>
            </div>
          )}
          <button type="button" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 xl:hidden" aria-label="Open menu" aria-expanded={mobile} onClick={() => setMobile(true)}>
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      {open === "market" && (
        <div id="mega-market" onMouseLeave={() => setOpen(null)} className="absolute inset-x-0 top-16 hidden border-b border-border bg-bg/95 backdrop-blur-xl xl:block">
          <div className="mx-auto grid max-w-7xl grid-cols-12 gap-8 px-8 py-8">
            <div className="col-span-7 grid grid-cols-2 gap-2">
              {categories.map((c) => (
                <Link key={c.slug} href={`/category/${c.slug}`} className="group flex gap-3 rounded-xl p-3 transition hover:bg-surface-2">
                  <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: c.accent, boxShadow: `0 0 12px ${c.accent}` }} />
                  <span>
                    <span className="flex items-center gap-2 text-[14px] font-medium">{c.name}<span className="text-[11.5px] font-normal text-subtle">{c.count} listings</span></span>
                    <span className="mt-0.5 block text-[13px] text-muted">{c.tagline}</span>
                  </span>
                </Link>
              ))}
              <Link href="/marketplace" className="col-span-2 mt-2 flex items-center gap-1.5 px-3 text-[13px] font-medium text-accent-2">Browse all products <ArrowRight className="size-3.5" /></Link>
            </div>
            <div className="col-span-5">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">Available now</p>
              <div className="space-y-2">
                {featured.map((f) => (
                  <Link key={f.slug} href={`/products/${f.slug}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5 transition hover:border-border-strong">
                    <Image src={f.thumbnail} alt="" width={96} height={64} className="h-14 w-20 rounded-lg object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium">{f.title}</span>
                      <span className="block truncate text-[12.5px] text-muted">{f.short}</span>
                    </span>
                    <span className="ml-auto text-[13px] font-semibold tabular-nums">{eur(f.priceCents)}</span>
                  </Link>
                ))}
              </div>
              <Link href="/marketplace?availability=available" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-2">All available products <ArrowRight className="size-3.5" /></Link>
            </div>
          </div>
        </div>
      )}

      {open === "resources" && (
        <div className="absolute right-[max(1rem,calc(50%-36rem))] top-16 hidden w-[520px] rounded-b-2xl border border-t-0 border-border bg-bg/95 p-3 backdrop-blur-xl xl:grid xl:grid-cols-2 xl:gap-1">
          {RESOURCES.map((r) => (
            <Link key={r.href} href={r.href} className="rounded-lg p-3 transition hover:bg-surface-2">
              <span className="block text-[13.5px] font-medium">{r.label}</span>
              <span className="block text-[12.5px] text-muted">{r.desc}</span>
            </Link>
          ))}
        </div>
      )}

      {mobile && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobile(false)} />
          <div className="absolute right-0 top-0 h-full w-[min(360px,100%)] overflow-y-auto border-l border-border bg-bg p-5">
            <div className="flex items-center justify-between">
              <Logo />
              <button type="button" onClick={() => setMobile(false)} className="grid size-9 place-items-center rounded-lg hover:bg-surface-2" aria-label="Close menu"><X className="size-5" /></button>
            </div>
            <nav className="mt-6 space-y-1" aria-label="Mobile">
              <Link href="/marketplace" className="block rounded-lg px-3 py-2.5 font-medium hover:bg-surface-2">Marketplace</Link>
              {categories.map((c) => (
                <Link key={c.slug} href={`/category/${c.slug}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] text-muted hover:bg-surface-2"><span className="size-2 rounded-full" style={{ background: c.accent }} />{c.name}</Link>
              ))}
              <div className="my-3 border-t border-border" />
              {[["/assistant", "Product assistant"], ["/pricing", "Pricing"], ...RESOURCES.map((r) => [r.href, r.label])].map(([h, l]) => (
                <Link key={h} href={h} className="block rounded-lg px-3 py-2 text-[14px] text-muted hover:bg-surface-2">{l}</Link>
              ))}
            </nav>
            {!user && (
              <div className="mt-6 grid grid-cols-2 gap-2">
                <Link href="/signin" className={buttonClass("outline")}>Sign in</Link>
                <Link href="/signup" className={buttonClass("primary")}>Get started</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {search && <SearchDialog onClose={() => setSearch(false)} />}
    </header>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ q: string; items: { label: string; slug: string }[] }>({ q: "", items: [] });
  const items = q.trim().length >= 2 && results.q === q ? results.items : [];
  const [active, setActive] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: ac.signal })
        .then((r) => r.json())
        .then((j) => {
          setResults({ q, items: j.items ?? [] });
          setActive(0);
        })
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q]);
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/55 px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(items[active] ? `/products/${items[active].slug}` : `/marketplace?q=${encodeURIComponent(q)}`);
          }}
          className="flex items-center gap-3 border-b border-border px-4"
        >
          <Search className="size-4 text-subtle" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, items.length - 1)));
              if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
            }}
            placeholder="Search tools, agents, workflows…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
            aria-label="Search query"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls="search-results"
          />
          <kbd className="rounded border border-border px-1.5 font-mono text-[10.5px] text-subtle">Esc</kbd>
        </form>
        <ul id="search-results" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {items.map((it, i) => (
            <li key={it.slug} role="option" aria-selected={i === active}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(`/products/${it.slug}`)} className={cn("w-full rounded-lg px-3 py-2.5 text-left text-[14px]", i === active && "bg-surface-2")}>
                {it.label}
              </button>
            </li>
          ))}
          {q.trim().length >= 2 && (
            <li>
              <button type="button" onClick={() => go(`/marketplace?q=${encodeURIComponent(q)}`)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13.5px] text-muted hover:bg-surface-2">
                <Search className="size-3.5" /> Search all products for “{q}”
              </button>
            </li>
          )}
          {q.trim().length < 2 && <li className="px-3 py-6 text-center text-[13px] text-subtle">Type at least two characters. Try “invoice”, “research” or “MCP”.</li>}
        </ul>
      </div>
    </div>
  );
}
