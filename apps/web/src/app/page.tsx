import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bot, Building2, FileSearch, Gauge, Layers, ShieldCheck, Workflow, Wrench } from "lucide-react";
import { categories, allIntegrations } from "@agentforge/catalog";
import { getProducts } from "@/lib/catalog";
import { getUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { HeroVisual } from "@/components/hero-visual";
import { ProblemSearch } from "@/components/problem-search";
import { ProductCard } from "@/components/product-card";
import { StartTourButton } from "@/components/guided-tour";
import { NewsletterForm } from "@/components/forms";
import { Badge, Card, Container, LinkButton, SectionHeading, buttonClass } from "@/components/ui";
import { eur } from "@/lib/utils";

export default async function Home() {
  const [products, user, banner] = await Promise.all([getProducts(), getUser(), read((db) => db.settings.maintenanceBanner)]);
  const available = products.filter((p) => p.status === "published");
  const featured = ["ai-knowledge-base-agent", "ai-seo-content-generator", "ai-invoice-data-extractor", "mcp-server-developer-kit", "ai-pdf-summarizer"].map((s) => products.find((p) => p.slug === s)!);
  const newest = [...available].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 4);
  const workflows = products.filter((p) => p.category === "automation-workflows").slice(0, 6);
  const integrations = allIntegrations(products).filter((i) => !/export|clipboard|upload|^Markdown|^JSON|^CSV|^PDF|Any MCP|REST API|Agent Studio|Approved URL|Document upload|TXT/i.test(i)).slice(0, 36);
  const range = (cat: string) => {
    const ps = products.filter((p) => p.category === cat).map((p) => p.priceCents);
    return `${eur(Math.min(...ps))}–${eur(Math.max(...ps))}`;
  };

  return (
    <>
      {banner && <div role="status" className="border-b border-border bg-accent/10 px-4 py-2 text-center text-[13.5px]">{banner}</div>}
      {/* ───────────── Hero ───────────── */}
      <section data-tour="hero" className="relative overflow-hidden border-b border-border">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="glow pointer-events-none absolute inset-0" />
        <Container className="relative grid grid-cols-1 [&>*]:min-w-0 items-center gap-10 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <Badge tone="accent" className="mb-5">
              <span className="size-1.5 rounded-full bg-accent" /> 10 products available now · 60 in the catalogue
            </Badge>
            <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.03em] text-balance sm:text-6xl">
              <span className="text-gradient">Your AI Workforce</span>
              <br />
              Starts Here.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted text-pretty">
              Discover powerful AI tools, intelligent agents and ready-to-use automation systems designed to transform the way you work.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <LinkButton href="/marketplace" size="lg">Explore Marketplace <ArrowRight className="size-4" /></LinkButton>
              <StartTourButton className={buttonClass("ghost", "lg")}>Take the tour</StartTourButton>
            </div>
            <div className="mt-9">
              <ProblemSearch large />
            </div>
          </div>
          <HeroVisual />
        </Container>
      </section>

      {/* ───────────── Featured (bento) ───────────── */}
      <Container className="py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Featured" title="Built, tested and ready to run" intro="Every product marked Available has a working deliverable, ready to use right after purchase." />
          <LinkButton href="/marketplace?availability=available" variant="ghost">All available products <ArrowRight className="size-4" /></LinkButton>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-6 md:grid-rows-2">
          <Link href={`/products/${featured[0].slug}`} className="group relative overflow-hidden rounded-3xl border border-border bg-surface md:col-span-4 md:row-span-2">
            <div className="relative aspect-[16/10] md:aspect-auto md:h-[62%]">
              <Image src={featured[0].thumbnail} alt="" fill sizes="(max-width: 768px) 100vw, 66vw" className="object-cover transition duration-700 group-hover:scale-[1.02]" priority />
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2"><Badge tone="success">Available</Badge><Badge>AI agent</Badge></div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">{featured[0].title}</h3>
              <p className="mt-2 max-w-xl text-[14.5px] text-muted">{featured[0].shortDescription}</p>
              <p className="mt-4 flex items-center gap-4 text-sm"><span className="text-lg font-semibold">{eur(featured[0].priceCents)}</span><span className="text-accent-2">View product →</span></p>
            </div>
          </Link>
          {featured.slice(1, 3).map((p) => (
            <Link key={p.slug} href={`/products/${p.slug}`} className="group relative overflow-hidden rounded-3xl border border-border bg-surface md:col-span-2">
              <div className="relative aspect-[16/9]">
                <Image src={p.thumbnail} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-1 line-clamp-2 text-[13px] text-muted">{p.shortDescription}</p>
                <p className="mt-2 text-sm font-semibold">{eur(p.priceCents)}</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>

      {/* ───────────── Categories ───────────── */}
      <section className="border-y border-border bg-bg-2/40 py-20">
        <Container>
          <SectionHeading eyebrow="Explore by category" title="From a €10 tool to a complete AI operation" intro="Five categories, each with at least ten products. Prices scale with scope, not hype." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c, i) => (
              <Link key={c.slug} href={`/category/${c.slug}`} className={`group relative overflow-hidden rounded-2xl border border-border bg-surface ${i === 0 ? "lg:row-span-2" : ""}`}>
                <div className={`relative ${i === 0 ? "aspect-[4/3] lg:aspect-[4/5]" : "aspect-[16/9]"}`}>
                  <Image src={`/assets/categories/${c.slug}.svg`} alt="" fill sizes="(max-width: 1024px) 50vw, 33vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <p className="text-[12px] font-medium opacity-80">{range(c.slug)} · {products.filter((p) => p.category === c.slug).length} products</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight">{c.name}</h3>
                    <p className="mt-1 text-[13.5px] opacity-80">{c.tagline}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* ───────────── Newly released ───────────── */}
      <Container className="py-20">
        <SectionHeading eyebrow="Newly released" title="Fresh off the build pipeline" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {newest.map((p) => <ProductCard key={p.slug} p={p} />)}
        </div>
      </Container>

      {/* ───────────── Build your AI workforce ───────────── */}
      <Container className="py-20">
        <SectionHeading eyebrow="Build your AI workforce" title="Start small. Compose as you grow." intro="Each layer builds on the one before, on the same runtime, with the same budgets, approvals and audit trail." />
        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3">
          {[
            { icon: Wrench, t: "Tools", d: "One job, done well: extract, summarise, draft.", r: range("ai-micro-tools"), href: "/category/ai-micro-tools" },
            { icon: Bot, t: "Agents", d: "Tools, memory and knowledge working toward a goal.", r: range("ai-agents"), href: "/category/ai-agents" },
            { icon: Building2, t: "Operations", d: "Department-wide systems with approvals and budgets.", r: range("business-solutions"), href: "/category/business-solutions" },
          ].map((s, i) => (
            <Link key={s.t} href={s.href} className="group relative bg-surface p-6 transition hover:bg-surface-2">
              <span className="font-mono text-[12px] text-subtle">0{i + 1}</span>
              <s.icon className="mt-6 size-6 text-accent-2" />
              <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
              <p className="mt-1.5 text-[13.5px] text-muted">{s.d}</p>
              <p className="mt-5 text-[13px] font-medium tabular-nums">{s.r}</p>
            </Link>
          ))}
        </div>
      </Container>

      {/* ───────────── Popular automation ───────────── */}
      <section className="border-y border-border bg-bg-2/40 py-20">
        <Container className="grid grid-cols-1 [&>*]:min-w-0 gap-10 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <SectionHeading eyebrow="Automation workflows" title="n8n workflows for the tools you already use" intro="Import a JSON file, connect credentials, run the test execution. Every workflow puts a human in front of anything that sends, pays or publishes." />
            <p className="mt-4 text-[13px] text-subtle">Workflow templates are in development and not yet purchasable. Add one to your wishlist to be notified.</p>
            <LinkButton href="/category/automation-workflows" variant="outline" className="mt-6">See all workflows</LinkButton>
          </div>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {workflows.map((w) => (
              <li key={w.slug}>
                <Link href={`/products/${w.slug}`} className="flex items-center gap-4 p-4 transition hover:bg-surface-2">
                  <Workflow className="size-5 shrink-0 text-accent-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium">{w.title}</span>
                    <span className="block truncate text-[12.5px] text-muted">{w.integrations.filter((x) => x !== "n8n").slice(0, 4).join(" → ")}</span>
                  </span>
                  <Badge>Coming soon</Badge>
                  <span className="w-12 text-right text-[13.5px] font-semibold tabular-nums">{eur(w.priceCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ───────────── Industries ───────────── */}
      <Container className="py-20">
        <SectionHeading eyebrow="Industry solutions" title="Find what fits your business" />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[["E-commerce", "🛒"], ["Marketing", "📣"], ["Accounting", "🧾"], ["Legal", "⚖️"], ["Real estate", "🏠"], ["Education", "🎓"], ["SaaS", "☁️"], ["Consulting", "📊"], ["HR", "🤝"], ["Software", "💻"], ["Finance", "💶"], ["Research", "🔬"]].map(([ind, emoji]) => (
            <Link key={ind} href={`/marketplace?industry=${encodeURIComponent(ind)}`} className="rounded-xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-border-strong">
              <span className="text-xl" aria-hidden="true">{emoji}</span>
              <p className="mt-2 text-[14px] font-medium">{ind}</p>
              <p className="text-[12px] text-subtle">{products.filter((p) => p.industries.includes(ind)).length} products</p>
            </Link>
          ))}
        </div>
      </Container>

      {/* ───────────── How it works ───────────── */}
      <section className="border-y border-border py-20">
        <Container>
          <SectionHeading align="center" eyebrow="How it works" title="From problem to running agent in four steps" intro={<><Link href="/how-it-works" className="text-accent-2 underline">See the full workflow</Link> or take the guided tour.</>} />
          <ol className="mt-12 grid gap-6 md:grid-cols-4">
            {[
              { icon: FileSearch, t: "Describe or browse", d: "Search the catalogue or describe your problem to the assistant." },
              { icon: Gauge, t: "Compare and choose", d: "Clear product pages with features, running costs, specs and reviews." },
              { icon: ShieldCheck, t: "Buy securely", d: "Hosted checkout. Access is granted only after the payment provider confirms." },
              { icon: Layers, t: "Configure and run", d: "Use tools in your dashboard, configure agents in Agent Studio, or download source." },
            ].map((s, i) => (
              <li key={s.t} className="relative">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl border border-border bg-surface"><s.icon className="size-5 text-accent-2" /></span>
                  <span className="font-mono text-[12px] text-subtle">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{s.t}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ───────────── Integrations ───────────── */}
      <Container className="py-20">
        <div className="grid grid-cols-1 [&>*]:min-w-0 gap-10 lg:grid-cols-[1fr_2fr]">
          <SectionHeading eyebrow="Supported integrations" title="Works with your stack" intro="Integrations listed by products in the catalogue. Names are used to describe compatibility only." />
          <div className="flex flex-wrap gap-2">
            {integrations.map((i) => (
              <span key={i} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] text-muted">{i}</span>
            ))}
            <Link href="/integrations" className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-accent-2">Full directory →</Link>
          </div>
        </div>
      </Container>

      {/* ───────────── Bundles + developers + enterprise (bento) ───────────── */}
      <Container className="pb-20">
        <div className="grid gap-4">
          <Card className="flex flex-col p-6">
            <Badge className="self-start">Bundles</Badge>
            <h3 className="mt-4 text-xl font-semibold tracking-tight">Product bundles</h3>
            <p className="mt-2 text-[13.5px] text-muted">Bundles combine related products at a lower total price. The assistant can also suggest a combination within your budget.</p>
            <ul className="mt-4 space-y-2 text-[13.5px]">
              {["complete-ai-developer-mega-bundle", "complete-marketing-workflow-pack", "complete-ai-business-automation-suite"].map((s) => {
                const p = products.find((x) => x.slug === s)!;
                return (
                  <li key={s}><Link href={`/products/${s}`} className="flex justify-between gap-3 rounded-lg border border-border px-3 py-2 hover:bg-surface-2"><span>{p.title}</span><span className="font-medium tabular-nums">{eur(p.priceCents)}</span></Link></li>
                );
              })}
            </ul>
            <LinkButton href="/assistant" variant="outline" className="mt-auto self-start" size="sm">Build a bundle with the assistant</LinkButton>
          </Card>
        </div>
        <Card className="mt-4 overflow-hidden">
          <div className="grid grid-cols-1 [&>*]:min-w-0 md:grid-cols-[1.2fr_1fr]">
            <div className="relative min-h-60">
              <Image src="/assets/pages/enterprise.svg" alt="" fill sizes="(max-width:768px) 100vw, 55vw" className="object-cover" />
            </div>
            <div className="p-8">
              <Badge tone="accent">Enterprise</Badge>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight">AI operations with controls your security team will accept</h3>
              <ul className="mt-5 space-y-2 text-[14px] text-muted">
                {["Organisation workspaces with roles", "Per-action approval policies and audit logs", "Bring your own model keys; spend caps per run", "Self-hosted options for data residency"].map((t) => (
                  <li key={t} className="flex gap-2.5"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-2" />{t}</li>
                ))}
              </ul>
              <LinkButton href="/enterprise" className="mt-6">Talk to us</LinkButton>
            </div>
          </div>
        </Card>
      </Container>

      {/* ───────────── FAQ ───────────── */}
      <section className="border-t border-border py-20">
        <Container className="grid grid-cols-1 [&>*]:min-w-0 gap-10 lg:grid-cols-[1fr_2fr]">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {[
              ["What does “Coming soon” mean?", "The listing is in the catalogue but its deliverable isn't finished and tested yet, so it can't be bought. We only sell products that work."],
              ["Do I need my own AI API keys?", "No. Hosted products include monthly credits. You can also add your own OpenAI, Anthropic or Gemini key so the provider bills you directly."],
              ["What is sandbox mode?", "When no AI provider is configured, products run deterministic code instead of a model. That output is always labelled as simulated."],
              ["How are prices and VAT handled?", "Prices are in EUR, excluding VAT. VAT is calculated at checkout based on your country, as required for digital services in the EU."],
              ["Can I get a refund?", "See the Refund Policy. You can request a refund from your dashboard; requests are reviewed and processed through the payment provider."],
            ].map(([q, a]) => (
              <details key={q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">{q}<span className="text-subtle transition group-open:rotate-45" aria-hidden="true">+</span></summary>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* ───────────── Newsletter + CTA ───────────── */}
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 sm:p-12">
          <div className="glow pointer-events-none absolute inset-0" />
          <div className="relative grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Build your AI workforce.</h2>
              <p className="mt-3 max-w-md text-muted">Start with one tool. Add agents when you’re ready. Every run is logged, budgeted and yours.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton href="/signup" size="lg">Get started</LinkButton>
                <LinkButton href="/marketplace" size="lg" variant="outline">Browse marketplace</LinkButton>
              </div>
            </div>
            <div>
              <p className="font-medium">Get release notes and guides</p>
              <p className="mb-4 mt-1 text-[13.5px] text-muted">New products, changelogs and practical guides. No spam.</p>
              <NewsletterForm source="home" />
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}
