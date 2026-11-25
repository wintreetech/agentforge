import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock, Cloud, Code2, Download, FlaskConical, Heart, Play, Server, ShieldCheck, Star, Workflow, Repeat, Scale } from "lucide-react";
import { deliveryLabel, getCategory, seedProducts } from "@agentforge/catalog";
import { getRunnable } from "@agentforge/product-registry/fields";
import { getProduct, getProducts, getVerifiedReviews, isPurchasable } from "@/lib/catalog";
import { getUser } from "@/lib/auth";
import { licenseOptions, ownsProduct } from "@/lib/commerce";
import { read } from "@/lib/db";
import { addToCartAction, reviewAction, toggleWishlistAction } from "@/app/actions/shop";
import { Gallery } from "@/components/gallery";
import { ProductCard, StatusBadge } from "@/components/product-card";
import { TrackView, RecentlyViewed } from "@/components/recently-viewed";
import { JsonLd } from "@/components/json-ld";
import { Badge, Card, Container, Input, LinkButton, Notice, Textarea, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { deliveryShort, eur, fmtDate, licenseLabel } from "@/lib/utils";
import { env } from "@/lib/env";

export function generateStaticParams() {
  return seedProducts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return {};
  return {
    title: { absolute: p.seo.title },
    description: p.seo.description,
    keywords: p.seo.keywords,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title: p.title, description: p.shortDescription, images: [`/products/${p.slug}/opengraph-image`], type: "website" },
  };
}

const deliveryIcon = { "hosted-tool": Cloud, "cloud-agent": Cloud, "self-hosted-agent": Server, "workflow-template": Workflow, "source-code": Code2, subscription: Repeat } as const;

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const { error } = await searchParams;
  const p = await getProduct(slug);
  if (!p || p.status === "draft" || p.status === "archived") notFound();
  const [user, all, reviews] = await Promise.all([getUser(), getProducts(), getVerifiedReviews(slug)]);
  const cat = getCategory(p.category)!;
  const owned = user ? await ownsProduct(user.id, slug) : false;
  const wished = user ? await read((db) => db.wishlist.some((w) => w.userId === user.id && w.slug === slug)) : false;
  const runnable = getRunnable(slug);
  const buyable = isPurchasable(p);
  const opts = licenseOptions(p);
  const related = p.related.map((s) => all.find((x) => x.slug === s)).filter((x) => !!x);
  const DIcon = deliveryIcon[p.delivery];
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.shortDescription,
    image: `${env.appUrl}${p.thumbnail}`,
    sku: p.id,
    category: cat.name,
    brand: { "@type": "Brand", name: "AgentForge AI" },
    offers: { "@type": "Offer", price: (p.priceCents / 100).toFixed(2), priceCurrency: "EUR", availability: buyable ? "https://schema.org/InStock" : "https://schema.org/PreOrder", url: `${env.appUrl}/products/${p.slug}` },
    // Ratings only from verified purchaser reviews — never fabricated.
    ...(avg != null ? { aggregateRating: { "@type": "AggregateRating", ratingValue: avg.toFixed(1), reviewCount: reviews.length } } : {}),
  };

  return (
    <>
      <JsonLd data={ld} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Marketplace", item: `${env.appUrl}/marketplace` }, { "@type": "ListItem", position: 2, name: cat.name, item: `${env.appUrl}/category/${cat.slug}` }, { "@type": "ListItem", position: 3, name: p.title }] }} />
      <TrackView slug={p.slug} title={p.title} thumbnail={p.thumbnail} />
      <Container className="py-8">
        <nav aria-label="Breadcrumb" className="text-[13px] text-subtle">
          <Link href="/marketplace" className="hover:text-fg">Marketplace</Link> / <Link href={`/category/${cat.slug}`} className="hover:text-fg">{cat.name}</Link> / <span className="text-muted">{p.title}</span>
        </nav>
        <div className="mt-6 grid grid-cols-1 [&>*]:min-w-0 gap-10 lg:grid-cols-[1.35fr_1fr]">
          <Gallery images={p.images} title={p.title} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={p.status} />
              <Badge>{deliveryShort[p.delivery]}</Badge>
              <span className="text-[12.5px] font-medium" style={{ color: cat.accent }}>{cat.name} · {p.subcategory}</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{p.title}</h1>
            <p className="mt-3 text-[15.5px] leading-relaxed text-muted">{p.shortDescription}</p>
            {avg != null && (
              <a href="#reviews" className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-muted"><Star className="size-4 fill-warning text-warning" /> {avg.toFixed(1)} · {reviews.length} verified review{reviews.length === 1 ? "" : "s"}</a>
            )}

            {error && <Notice tone="danger" className="mt-4">{error}</Notice>}

            <Card className="mt-6 p-5">
              {buyable ? (
                <form action={addToCartAction} className="space-y-4">
                  <input type="hidden" name="slug" value={p.slug} />
                  <fieldset>
                    <legend className="mb-2 text-[13px] font-medium">Licence</legend>
                    <div className="space-y-2">
                      {opts.map((o, i) => (
                        <label key={o.license} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
                          <input type="radio" name="license" value={o.license} defaultChecked={i === 0} className="accent-[var(--accent)]" />
                          <span className="flex-1">
                            <span className="block text-[14px] font-medium">{licenseLabel[o.license]} licence</span>
                            <span className="block text-[12.5px] text-muted">{o.note}</span>
                          </span>
                          <span className="text-lg font-semibold tabular-nums">{eur(o.priceCents)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <p className="text-[12px] text-subtle">Prices exclude VAT, which is calculated at checkout by country.</p>
                  {owned ? (
                    <div className="space-y-2">
                      <Notice tone="success">You own this product.</Notice>
                      <LinkButton href={runnable && runnable.policy.kind !== "download" ? `/dashboard/tools/${p.slug}` : "/dashboard/downloads"} className="w-full">{runnable?.policy.kind === "download" ? "Go to downloads" : "Open in dashboard"}</LinkButton>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <SubmitButton size="lg">Add to cart</SubmitButton>
                      <button name="buyNow" value="1" className={buttonClass("secondary", "lg")}>Buy now</button>
                    </div>
                  )}
                </form>
              ) : (
                <div>
                  <p className="flex items-baseline gap-2"><span className="text-3xl font-semibold tabular-nums">{eur(p.priceCents)}</span><span className="text-[13px] text-subtle">planned price</span></p>
                  <Notice tone="info" className="mt-4" title="Not available to buy yet">
                    This product is in development. Its deliverable has not been completed and tested, so we don&apos;t sell it yet. Add it to your wishlist to be notified at release.
                  </Notice>
                  <button disabled className={buttonClass("outline", "lg", "mt-4 w-full")} title="Disabled: product not yet released"><Clock className="size-4" /> Coming soon</button>
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <form action={toggleWishlistAction}>
                  <input type="hidden" name="slug" value={p.slug} />
                  <input type="hidden" name="back" value={`/products/${p.slug}`} />
                  <button className={buttonClass("outline", "md", "w-full")} aria-pressed={wished}>
                    <Heart className={`size-4 ${wished ? "fill-accent text-accent" : ""}`} /> {wished ? "Wishlisted" : "Wishlist"}
                  </button>
                </form>
                {p.demoAvailable && runnable ? (
                  <LinkButton href={`/playground?product=${p.slug}`} variant="outline"><Play className="size-4" /> Try live demo</LinkButton>
                ) : (
                  <span className={buttonClass("outline", "md", "cursor-not-allowed opacity-50")} title={p.delivery === "source-code" && p.functional ? "Source-code kits have no live demo; see the documentation and file list." : "No demo available yet"} aria-disabled="true"><Play className="size-4" /> No live demo</span>
                )}
              </div>
              <Link href={`/compare?ids=${p.slug}`} className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-muted hover:text-fg"><Scale className="size-3.5" /> Compare with other products</Link>
            </Card>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border p-4">
              <DIcon className="mt-0.5 size-5 shrink-0 text-accent-2" />
              <div className="text-[13.5px]">
                <p className="font-medium">{deliveryLabel[p.delivery]}</p>
                <p className="mt-1 text-muted">Version {p.version === "0.0.0" ? "— (unreleased)" : p.version} · {licenseLabel[p.license]} licence · {p.hosting === "both" ? "Hosted or self-hosted" : p.hosting === "hosted" ? "Hosted" : "Self-hosted"} · {p.difficulty[0].toUpperCase() + p.difficulty.slice(1)}</p>
                {p.publishedAt && <p className="mt-1 text-subtle">Published {fmtDate(p.publishedAt)} · Updated {fmtDate(p.updatedAt)}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* ───────── Details ───────── */}
        <div className="mt-16 grid grid-cols-1 [&>*]:min-w-0 gap-12 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-14">
            <section aria-labelledby="overview">
              <h2 id="overview" className="text-2xl font-semibold tracking-tight">Overview</h2>
              <p className="mt-3 text-[15.5px] leading-relaxed text-muted">{p.description}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {p.benefits.map((b) => (
                  <div key={b} className="flex gap-2.5 rounded-xl border border-border bg-surface p-3.5 text-[14px]"><Check className="mt-0.5 size-4 shrink-0 text-success" />{b}</div>
                ))}
              </div>
            </section>

            <section aria-labelledby="caps" className="grid gap-8 sm:grid-cols-2">
              <div>
                <h2 id="caps" className="text-xl font-semibold">Capabilities</h2>
                <ul className="mt-3 space-y-2 text-[14px] text-muted">{p.capabilities.map((c) => <li key={c} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />{c}</li>)}</ul>
              </div>
              <div>
                <h2 className="text-xl font-semibold">Use cases</h2>
                <ul className="mt-3 space-y-2 text-[14px] text-muted">{p.useCases.map((c) => <li key={c} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-3" />{c}</li>)}</ul>
                <p className="mt-4 text-[13px] text-subtle">For: {p.audience.join(", ")}</p>
              </div>
            </section>

            <section aria-labelledby="how">
              <h2 id="how" className="text-xl font-semibold">How it works</h2>
              <p className="mt-2 text-[14px] text-muted">The diagram in the gallery shows each step. Inputs and outputs:</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Card className="p-4"><p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Inputs</p><ul className="mt-2 space-y-1.5 text-[14px]">{p.inputs.map((x) => <li key={x}>{x}</li>)}</ul></Card>
                <Card className="p-4"><p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Outputs</p><ul className="mt-2 space-y-1.5 text-[14px]">{p.outputs.map((x) => <li key={x}>{x}</li>)}</ul></Card>
              </div>
              {runnable && runnable.policy.kind !== "download" && (
                <p className="mt-4 text-[13px] text-muted">
                  Execution policy: up to {runnable.policy.budget.maxSteps} steps, {runnable.policy.budget.maxTokens.toLocaleString("en")} tokens, €{runnable.policy.budget.maxCostEur} provider cost and {Math.round(runnable.policy.timeoutMs / 1000)}s per run.
                  {runnable.agents && <> Agents: {runnable.agents.join(", ")}.</>}
                  {runnable.policy.permissions.length > 0 && <> Permissions: {runnable.policy.permissions.join(", ")}.</>}
                </p>
              )}
            </section>

            <section aria-labelledby="tech">
              <h2 id="tech" className="text-xl font-semibold">Technical specifications</h2>
              <dl className="mt-4 divide-y divide-border rounded-2xl border border-border text-[14px]">
                {[
                  ["Delivery", deliveryLabel[p.delivery]],
                  ["Supported integrations", p.integrations.join(", ")],
                  ["AI providers", p.providers.join(", ")],
                  ["Estimated operating cost", p.costNote],
                  ["Requirements", p.requirements.join(" · ")],
                  ["Industries", p.industries.join(", ")],
                  ["Licence", `${licenseLabel[p.license]} — see the Licence Agreement`],
                ].map(([k, v]) => (
                  <div key={k} className="grid gap-1 p-4 sm:grid-cols-[200px_1fr]"><dt className="text-subtle">{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="install">
              <h2 id="install" className="text-xl font-semibold">Installation & access</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] text-muted">{p.installation.map((s) => <li key={s}>{s}</li>)}</ol>
              <p className="mt-4 text-[13.5px]">Documentation: {p.functional ? <Link href={`/docs/products/${p.slug}`} className="text-accent-2 underline underline-offset-2">{p.documentation.join(" · ")}</Link> : <span className="text-muted">{p.documentation[0]}</span>}</p>
            </section>

            <section aria-labelledby="changelog">
              <h2 id="changelog" className="text-xl font-semibold">Changelog</h2>
              {p.changelog.length ? (
                <ul className="mt-3 space-y-3">{p.changelog.map((c) => <li key={c.version} className="rounded-xl border border-border p-4 text-[14px]"><p className="font-medium">v{c.version} <span className="font-normal text-subtle">· {fmtDate(c.date)}</span></p><ul className="mt-1.5 list-disc pl-5 text-muted">{c.notes.map((n) => <li key={n}>{n}</li>)}</ul></li>)}</ul>
              ) : <p className="mt-2 text-[14px] text-muted">No releases yet.</p>}
            </section>

            <section aria-labelledby="reviews" id="reviews">
              <h2 className="text-xl font-semibold">Verified customer reviews</h2>
              {reviews.length === 0 ? <p className="mt-2 text-[14px] text-muted">No reviews yet. Only customers who bought this product can review it.</p> : (
                <ul className="mt-4 space-y-3">
                  {reviews.map((r) => (
                    <li key={r.id} className="rounded-xl border border-border p-4">
                      <p className="flex items-center gap-2 text-[14px] font-medium">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`size-3.5 ${i < r.rating ? "fill-warning text-warning" : "text-border-strong"}`} />)} {r.title}</p>
                      <p className="mt-1.5 text-[14px] text-muted">{r.body}</p>
                      <p className="mt-2 text-[12px] text-subtle">{r.authorName} · Verified purchase · {fmtDate(r.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
              {owned && (
                <form action={reviewAction} className="mt-5 space-y-3 rounded-2xl border border-border p-4">
                  <input type="hidden" name="slug" value={p.slug} />
                  <p className="text-[14px] font-medium">Write a review</p>
                  <div className="flex gap-3 text-[13.5px]">{[5, 4, 3, 2, 1].map((n) => <label key={n} className="flex items-center gap-1"><input type="radio" name="rating" value={n} defaultChecked={n === 5} className="accent-[var(--accent)]" />{n}★</label>)}</div>
                  <Input name="title" placeholder="Title" required minLength={3} maxLength={120} aria-label="Review title" />
                  <Textarea name="body" placeholder="What did it help you do?" required minLength={20} maxLength={3000} rows={3} aria-label="Review text" />
                  <SubmitButton size="sm">Publish review</SubmitButton>
                </form>
              )}
            </section>

            <section aria-labelledby="faq">
              <h2 id="faq" className="text-xl font-semibold">Frequently asked questions</h2>
              <div className="mt-4 divide-y divide-border rounded-2xl border border-border">
                {p.faqs.map((f) => (
                  <details key={f.q} className="group p-4">
                    <summary className="flex cursor-pointer list-none justify-between gap-4 text-[14.5px] font-medium">{f.q}<span className="text-subtle group-open:rotate-45" aria-hidden="true">+</span></summary>
                    <p className="mt-2 text-[14px] leading-relaxed text-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card className="p-5">
              <p className="text-[13px] font-semibold">Cost transparency</p>
              {p.costPerRunEur ? (
                <>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">€{p.costPerRunEur[0].toFixed(3)}–€{p.costPerRunEur[1].toFixed(2)}</p>
                  <p className="text-[12.5px] text-muted">estimated provider cost per run</p>
                </>
              ) : (
                <p className="mt-2 text-[13.5px] text-muted">No per-run cost from AgentForge.</p>
              )}
              <p className="mt-3 text-[12.5px] leading-relaxed text-subtle">{p.costNote}</p>
            </Card>
            <Card className="p-5 text-[13px]">
              <p className="font-semibold">Buying with confidence</p>
              <ul className="mt-3 space-y-2 text-muted">
                <li className="flex gap-2"><ShieldCheck className="size-4 shrink-0 text-accent-2" />Hosted checkout; access only after confirmed payment</li>
                <li className="flex gap-2"><Download className="size-4 shrink-0 text-accent-2" />Versioned downloads and licence keys in your dashboard</li>
                <li className="flex gap-2"><FlaskConical className="size-4 shrink-0 text-accent-2" />Sandbox output is always labelled</li>
              </ul>
            </Card>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-20" aria-labelledby="related">
            <h2 id="related" className="text-2xl font-semibold tracking-tight">Related products</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{related.map((r) => <ProductCard key={r.slug} p={r} />)}</div>
          </section>
        )}
        <RecentlyViewed exclude={p.slug} />
      </Container>
    </>
  );
}
