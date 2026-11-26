"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X, Compass } from "lucide-react";
import { buttonClass } from "./ui";

/**
 * Guided product tour. Walks across real pages, highlighting one element per
 * step (elements carry data-tour="…"). Progress lives in sessionStorage so the
 * tour survives navigation. Start it with startTour() or a link to "?tour=1".
 */

type Step = {
  path: string;
  target?: string;
  title: string;
  body: string;
  /** "auth": needs a signed-in user; "admin": needs an admin. */
  needs?: "auth" | "admin";
};

const STEPS: Step[] = [
  { path: "/", target: "hero", title: "Welcome to AgentForge AI", body: "A marketplace for ready-made AI tools, agents and developer kits. This 2-minute tour follows a customer from finding a product to running it, then shows the admin side." },
  { path: "/", target: "search", title: "Search or describe your problem", body: "Search the catalogue at any time (Ctrl K). You can also describe a problem in plain words and the product assistant recommends matching products." },
  { path: "/marketplace", target: "filters", title: "Filter the marketplace", body: "50 products across 5 categories. Filter by category, price, delivery type, industry and integrations. Every filter is in the URL, so a filtered view can be shared." },
  { path: "/marketplace", target: "grid", title: "Available vs. coming soon", body: "Products marked Available are fully built and tested and can be bought today. Coming-soon products are listed for discovery, but their buy buttons stay disabled until they ship." },
  { path: "/products/ai-knowledge-base-agent", target: "buy", title: "See the price and buy", body: "Each product page shows a single one-time price before VAT, running costs, specifications, changelog, verified reviews and FAQ. Add to cart or buy now." },
  { path: "/dashboard", target: "dash-stats", needs: "auth", title: "Your dashboard after purchase", body: "Checkout runs through a hosted payment page. Access is granted only after the payment provider confirms the payment. Purchased products, credits, runs and spending then appear here." },
  { path: "/dashboard", target: "dash-nav", needs: "auth", title: "Everything you bought, in one place", body: "Run hosted tools, download source code, see invoices, manage knowledge bases and request refunds." },
  { path: "/dashboard/studio", target: "studio", needs: "auth", title: "Agent Studio", body: "Configure purchased agents visually: instructions, model, knowledge base, memory, schedules, webhooks and human approval steps, with pause, retry and full run logs." },
  { path: "/admin", target: "admin-nav", needs: "admin", title: "Admin panel", body: "Admins manage products and prices, orders, refunds, coupons, users and roles, AI provider costs, contact messages, content and the audit log." },
  { path: "/how-it-works", title: "That's the full workflow", body: "This page explains each stage in detail, including what happens behind the scenes during payment and when a product runs. Restart the tour from here at any time." },
];

const KEY = "af-tour-step";
const START_EVENT = "af:tour:start";

export function startTour() {
  window.dispatchEvent(new Event(START_EVENT));
}

function readStep(): number | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
function writeStep(n: number | null) {
  try {
    if (n === null) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, String(n));
  } catch {
    /* storage blocked: tour still works for this page */
  }
}

function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

type Box = { top: number; left: number; width: number; height: number };

export function GuidedTour({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [ready, setReady] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Restore after navigation / start from ?tour=1 / start from button event.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1") {
      writeStep(0);
      params.delete("tour");
      const q = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
    }
    const restore = requestAnimationFrame(() => setStep(readStep()));
    const onStart = () => {
      writeStep(0);
      setStep(0);
    };
    window.addEventListener(START_EVENT, onStart);
    return () => {
      cancelAnimationFrame(restore);
      window.removeEventListener(START_EVENT, onStart);
    };
  }, []);

  const current = step !== null ? STEPS[step] : null;
  const blocked = current?.needs === "admin" ? !isAdmin : current?.needs === "auth" ? !signedIn : false;
  const onPage = current ? pathname === current.path : false;

  const go = useCallback(
    (n: number | null) => {
      writeStep(n);
      setStep(n);
      setBox(null);
      setReady(false);
      if (n === null) return;
      const s = STEPS[n];
      const needsBlocked = s.needs === "admin" ? !isAdmin : s.needs === "auth" ? !signedIn : false;
      if (!needsBlocked && window.location.pathname !== s.path) router.push(s.path);
    },
    [router, isAdmin, signedIn],
  );

  // Navigate to the step's page if we're elsewhere (e.g. tour restored on another page).
  useEffect(() => {
    if (!current || blocked || onPage) return;
    router.push(current.path);
  }, [current, blocked, onPage, router]);

  // Locate and track the highlighted element.
  useLayoutEffect(() => {
    if (!current || blocked || !onPage) return;
    let cancelled = false;
    let tries = 0;
    let el: HTMLElement | null = null;
    const measure = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pad = 8;
      // Cap very tall targets to the visible area so the popover stays on screen.
      const top = Math.max(r.top - pad, 72);
      const bottom = Math.min(r.bottom + pad, window.innerHeight - 8);
      setBox({ top, left: r.left - pad, width: r.width + pad * 2, height: Math.max(bottom - top, 40) });
    };
    const locate = () => {
      if (cancelled) return;
      el = current.target ? findTarget(current.target) : null;
      if (!el && current.target && tries++ < 30) {
        setTimeout(locate, 100);
        return;
      }
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.top < 80 || r.bottom > window.innerHeight * 0.6) {
          window.scrollTo({ top: Math.max(window.scrollY + r.top - 96, 0), behavior: "instant" as ScrollBehavior });
        }
        measure();
      } else setBox(null);
      setReady(true);
    };
    const first = requestAnimationFrame(locate);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(first);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [current, blocked, onPage]);

  useEffect(() => {
    if (ready || blocked) nextRef.current?.focus({ preventScroll: true });
  }, [ready, blocked, step]);

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") go(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, go]);

  if (step === null || !current) return null;
  if (!blocked && (!onPage || !ready)) return null;

  const last = step === STEPS.length - 1;
  const n = STEPS.length;

  // Popover placement: below the target if room, otherwise above; centred card without a target.
  let style: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  if (box && !blocked) {
    const w = Math.min(380, window.innerWidth - 32);
    const left = Math.min(Math.max(box.left, 16), window.innerWidth - w - 16);
    const below = box.top + box.height + 12;
    if (window.innerWidth < 640) style = { left: 16, right: 16, bottom: 16 };
    else if (below + 220 < window.innerHeight) style = { left, top: below, width: w };
    else if (box.top - 232 > 64) style = { left, top: box.top - 12, width: w, transform: "translateY(-100%)" };
    else style = { left, bottom: 16, width: w };
  }

  return (
    <div className="fixed inset-0 z-[90]" aria-live="polite">
      {box && !blocked ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-2xl ring-2 ring-accent transition-all duration-200"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: "0 0 0 9999px rgba(3,4,10,.62)" }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-[rgba(3,4,10,.62)]" />
      )}
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        className="fixed w-[min(380px,calc(100vw-32px))] rounded-2xl border border-border-strong bg-surface p-5 text-fg shadow-2xl"
        style={style}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-1.5 font-mono text-[11.5px] uppercase tracking-wider text-accent-2">
            <Compass className="size-3.5" aria-hidden="true" /> Tour · {step + 1} / {n}
          </p>
          <button type="button" onClick={() => go(null)} className="-m-1 grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label="End tour">
            <X className="size-4" />
          </button>
        </div>
        <h2 id="tour-title" className="mt-2 text-[17px] font-semibold">{current.title}</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{current.body}</p>
        {blocked && (
          <p className="mt-3 rounded-xl border border-border bg-bg-2 p-3 text-[13px] text-muted">
            {current.needs === "admin" ? "This part is only visible to admin accounts. Skip it, or sign in as an admin to see it." : "Sign in to see this part of the tour. You'll come back to this step afterwards."}
          </p>
        )}
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((step + 1) / n) * 100}%` }} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className={buttonClass("ghost", "sm")}>
            <ArrowLeft className="size-4" /> Back
          </button>
          <div className="flex gap-2">
            {blocked && current.needs === "auth" && (
              <a href={`/signin?next=${encodeURIComponent(current.path)}`} className={buttonClass("outline", "sm")}>Sign in</a>
            )}
            <button ref={nextRef} type="button" onClick={() => go(last ? null : step + 1)} className={buttonClass("primary", "sm")}>
              {last ? "Finish" : blocked ? "Skip" : "Next"} {!last && <ArrowRight className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StartTourButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={startTour} className={className ?? buttonClass("outline", "lg")}>
      <Compass className="size-4" aria-hidden="true" /> {children ?? "Take the guided tour"}
    </button>
  );
}
