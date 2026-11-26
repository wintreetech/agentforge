import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Bot, CreditCard, Download, FileSearch, KeyRound, LayoutDashboard, Lock, Network,
  Receipt, Search, Settings2, ShieldCheck, ShoppingCart, Sparkles, UserCheck, Webhook, Wrench,
} from "lucide-react";
import { Badge, Card, Container, LinkButton, PageHeader, SectionHeading } from "@/components/ui";
import { StartTourButton } from "@/components/guided-tour";

export const metadata: Metadata = {
  title: "How it works",
  description: "The full AgentForge AI workflow: discover, test, buy, get access, run and manage AI tools and agents, plus what happens behind the scenes.",
  alternates: { canonical: "/how-it-works" },
};

const journey = [
  {
    n: 1, icon: Search, title: "Discover", shot: "home", href: "/marketplace",
    body: "Browse 50 products in 5 categories, search with Ctrl K, or describe a problem to the product assistant and get matching recommendations.",
    points: ["Filters for category, price, delivery type, industry and integration", "Shareable filtered URLs", "Compare up to 4 products side by side"],
  },
  {
    n: 2, icon: FileSearch, title: "Evaluate", shot: "product", href: "/products/ai-knowledge-base-agent",
    body: "Each product page explains what it does, how it works and what it costs to run.",
    points: ["One clear one-time price", "Running-cost estimate per run", "Specs, changelog, verified reviews and FAQ"],
  },
  {
    n: 3, icon: CreditCard, title: "Buy securely", shot: "checkout", href: "/cart",
    body: "Cart, coupon codes and EU VAT by country, then a hosted checkout page. Card details never touch AgentForge servers.",
    points: ["Hosted checkout (Stripe in production)", "Access granted only after the payment is confirmed", "Invoice issued automatically"],
  },
  {
    n: 4, icon: LayoutDashboard, title: "Get access instantly", shot: "dashboard", href: "/dashboard",
    body: "The purchase appears in the customer dashboard with everything needed to use it.",
    points: ["Products appear in My purchases", "Included run credits for hosted tools", "Signed, expiring download links for source code"],
  },
  {
    n: 5, icon: Wrench, title: "Run and configure", shot: "tool", href: "/dashboard/tools",
    body: "Hosted tools run right in the dashboard. Agents are configured in Agent Studio with approvals and schedules.",
    points: ["Results ready to copy or export", "Knowledge bases for your own documents", "Visual workflows with human approval steps"],
  },
];

const fulfilment = [
  { icon: ShoppingCart, t: "Checkout", d: "Order created with prices, VAT and coupon locked in." },
  { icon: Lock, t: "Payment provider", d: "Customer pays on the provider's hosted page." },
  { icon: Webhook, t: "Signed webhook", d: "Provider confirms payment; the signature is verified and duplicates are ignored." },
  { icon: Receipt, t: "Order paid", d: "Invoice, notification and receipt are created." },
  { icon: KeyRound, t: "Access granted", d: "The product and its run credits are added to the account." },
  { icon: Download, t: "Use", d: "Run, download or call the API from the dashboard." },
];

const run = [
  { icon: UserCheck, t: "Check access", d: "Ownership, credits and rate limits are checked." },
  { icon: ShieldCheck, t: "Validate input", d: "Input is validated and screened for prompt injection." },
  { icon: Sparkles, t: "Run the engine", d: "The product calls the chosen AI model within a cost budget, with retries." },
  { icon: BadgeCheck, t: "Check output", d: "Results are checked (sources cited, figures grounded, totals add up)." },
  { icon: Receipt, t: "Record usage", d: "Credits are deducted and the run is saved to history." },
];

const roles = [
  { icon: Bot, t: "Visitors", d: "Browse, compare and ask the assistant for recommendations without an account." },
  { icon: LayoutDashboard, t: "Customers", d: "Buy, run tools, download source code, and manage invoices and refunds." },
  { icon: Settings2, t: "Admins", d: "Manage products and prices, orders, refunds, coupons, users, AI provider costs, contact messages, content and the audit log." },
];

function Flow({ steps }: { steps: { icon: typeof Bot; t: string; d: string }[] }) {
  return (
    <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none">
      {steps.map((s, i) => (
        <li key={s.t} className="relative">
          <Card className="h-full p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent-2"><s.icon className="size-[18px]" aria-hidden="true" /></span>
              <span className="font-mono text-[11.5px] text-subtle">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <p className="mt-3 text-[14.5px] font-semibold">{s.t}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.d}</p>
          </Card>
          {i < steps.length - 1 && (
            <ArrowRight aria-hidden="true" className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-subtle lg:block" />
          )}
        </li>
      ))}
    </ol>
  );
}

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="From problem to running AI agent"
        intro="This page walks through the whole AgentForge AI workflow: how customers find, test, buy and use products, what happens behind the scenes, and what admins manage."
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <StartTourButton />
          <LinkButton href="/marketplace" size="lg">Explore the marketplace <ArrowRight className="size-4" /></LinkButton>
        </div>
      </PageHeader>

      {/* Journey overview strip */}
      <Container className="py-12">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {journey.map((s) => (
            <li key={s.n}>
              <a href={`#step-${s.n}`} className="flex h-full items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-[13.5px] transition hover:border-border-strong">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-[12px] font-semibold text-white">{s.n}</span>
                <span className="font-medium">{s.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </Container>

      {/* Customer journey */}
      <Container className="space-y-20 pb-20">
        {journey.map((s, i) => (
          <section key={s.n} id={`step-${s.n}`} className="grid scroll-mt-24 grid-cols-1 items-center gap-8 lg:grid-cols-2 [&>*]:min-w-0">
            <div className={i % 2 ? "lg:order-2" : undefined}>
              <p className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-wider text-accent-2">
                <s.icon className="size-4" aria-hidden="true" /> Step {s.n}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{s.title}</h2>
              <p className="mt-3 text-[15.5px] leading-relaxed text-muted">{s.body}</p>
              <ul className="mt-5 space-y-2">
                {s.points.map((pt) => (
                  <li key={pt} className="flex gap-2.5 text-[14px]"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-accent-2" aria-hidden="true" />{pt}</li>
                ))}
              </ul>
              <Link href={s.href} className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent-2">Open this page <ArrowRight className="size-4" /></Link>
            </div>
            <div className={i % 2 ? "lg:order-1" : undefined}>
              <div className="overflow-hidden rounded-2xl border border-border bg-bg-2 shadow-2xl shadow-black/30">
                <div className="flex items-center gap-1.5 border-b border-border px-3 py-2" aria-hidden="true">
                  <span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" />
                </div>
                <Image
                  src={`/screenshots/tour/${s.shot}.webp`}
                  alt={`Screenshot: ${s.title}`}
                  width={1440}
                  height={900}
                  sizes="(min-width: 1024px) 600px, 100vw"
                  className="h-auto w-full"
                />
              </div>
            </div>
          </section>
        ))}
      </Container>

      {/* Behind the scenes: purchase */}
      <section className="border-y border-border bg-bg-2/40 py-20">
        <Container>
          <SectionHeading eyebrow="Behind the scenes" title="What happens when someone buys" intro="Access is never granted from the browser. Only a signed confirmation from the payment provider unlocks a purchase, so a refreshed or forged page can't create free access." />
          <Flow steps={fulfilment} />
          <p className="mt-6 text-[13px] text-subtle">Refunds follow the same path: a refund confirmed by the provider removes access to the product automatically.</p>
        </Container>
      </section>

      {/* Behind the scenes: a run */}
      <section className="py-20">
        <Container>
          <SectionHeading eyebrow="Behind the scenes" title="What happens when a product runs" intro="Every run goes through the same engine and the same checks." />
          <Flow steps={run} />
        </Container>
      </section>

      {/* Agent Studio */}
      <section className="border-y border-border bg-bg-2/40 py-20">
        <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <SectionHeading eyebrow="Agent Studio" title="Workflows with a human in the loop" intro="Customers who own an agent can shape it into a workflow: connect AI, retrieval, extraction, API, condition and formatting steps, and add approval gates where a person must sign off before the agent continues." />
            <ul className="mt-6 grid gap-2 text-[14px] sm:grid-cols-2">
              {["Instructions, model and knowledge base", "Memory and schedules", "Incoming webhooks", "Pause, cancel and retry", "Approval steps", "Full run logs and export"].map((t) => (
                <li key={t} className="flex gap-2"><Network className="mt-0.5 size-4 shrink-0 text-accent-2" aria-hidden="true" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border">
            <Image src="/screenshots/tour/studio.webp" alt="Screenshot: Agent Studio" width={1440} height={900} sizes="(min-width: 1024px) 600px, 100vw" className="h-auto w-full" />
          </div>
        </Container>
      </section>

      {/* Roles */}
      <section className="py-20">
        <Container>
          <SectionHeading align="center" eyebrow="Who does what" title="Three roles, one platform" />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {roles.map((r) => (
              <Card key={r.t} className="p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent-2"><r.icon className="size-5" aria-hidden="true" /></span>
                <p className="mt-4 font-semibold">{r.t}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{r.d}</p>
              </Card>
            ))}
          </div>
          <div className="mt-8 overflow-hidden rounded-2xl border border-border">
            <Image src="/screenshots/tour/admin.webp" alt="Screenshot: admin overview" width={1440} height={900} sizes="(min-width: 1280px) 1200px, 100vw" className="h-auto w-full" />
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-16">
        <Container className="flex flex-col items-center text-center">
          <Badge tone="accent">2-minute walkthrough</Badge>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">See it on the real pages</h2>
          <p className="mt-2 max-w-xl text-[15px] text-muted">The guided tour moves through the live site and highlights each part of the workflow.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <StartTourButton />
            <LinkButton href="/marketplace" size="lg" variant="secondary">Browse products</LinkButton>
          </div>
        </Container>
      </section>
    </>
  );
}
