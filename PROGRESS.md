# AgentForge AI: completion report

_Updated 2026-11-25._

## Verification results (actual runs)

| Check | Result |
|---|---|
| TypeScript strict (`tsc --noEmit`) | ✅ 0 errors |
| ESLint (eslint-config-next) | ✅ 0 errors, 0 warnings |
| Unit tests (Vitest) | ✅ 69/69: catalogue, filters, recommender, VAT, coupons, licence keys, signed tokens, webhook signatures (sandbox + Stripe), ZIP/CRC, providers (OpenAI/Anthropic/Gemini stream parsing), budgets, cancellation, retries, SSRF, injection, retrieval, all 9 runnable products |
| SQL migration + seed + RLS (PGlite / Postgres 17) | ✅ 7/7: 60 products seeded, deliverable constraint, price/order checks, append-only audit, tenant isolation, draft visibility, verified-purchase reviews |
| Python service (pytest) | ✅ 7/7: LangGraph planner→researcher→critic→writer, service-token auth, validation, budget, injection flagging |
| MCP Server Developer Kit | ✅ 10/10 incl. an end-to-end stdio session with the official MCP client; `tsc` build OK |
| E2E (Playwright, MS Edge) | ✅ 33/33: homepage (no console errors, no broken images), search/assistant, filters/sort/pagination/URLs, coming-soon not purchasable, product JSON-LD (no fake ratings), Playground sandbox label, public API, forged webhook rejected, **full purchase → webhook fulfilment → ZIP download → licence verify → owned run**, **tenant isolation** (404/403 for another user), admin gate, auth redirects, **Agent Studio fail → fix → retry → approval → complete**, no horizontal overflow on 11 pages at 412px |
| `next build` | ✅ Compiles (162 pages). 8 non-fatal Turbopack "whole project traced" warnings from dynamic fs paths (see blockers) |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| Lighthouse | ⚠️ **Not measured.** Lighthouse isn't installed; no scores are claimed |

Screenshots: `docs/screenshots/*-desktop.png` and `*-mobile.png` (8 pages); real product screenshots: `apps/web/public/screenshots/products/` (8 products).

## What's done

**Catalogue:** 60 products, 6 categories, hand-written differentiated copy, all required fields. Only the **10 functional products are purchasable**; the other 50 are "Coming soon" with disabled buy buttons and explanations, enforced in the UI, the server action, the admin action and a database constraint.

**Ten functional products:**
- 9 hosted products run on the shared engine, with validation, error handling, usage tracking, docs, tests and real screenshots: Resume & Cover Letter Builder, Prompt Optimizer, PDF Summarizer (PDF parsing, scanned-PDF detection), Product Description Generator (figure-grounding check), Email Writing Assistant (injection-safe), Invoice Data Extractor (rule-based extraction + arithmetic validation + CSV), SEO Content Generator, Knowledge Base Agent (BM25 RAG, cited answers, not-found handling), Multi-Agent Research Team (4 agents, approved URL fetch, critic gaps).
- The MCP Server Developer Kit is a real downloadable source package.

**Storefront:** homepage (all 16 requested sections), mega menu, search (Ctrl K), marketplace with every filter plus sort, grid/list view, pagination and shareable URLs, category pages, product pages (gallery, licence options, buy now, wishlist, demo, specs, costs, changelog, verified reviews, FAQ, related), compare, wishlist, recently viewed, the recommendation assistant, dark/light themes, reduced-motion support and a cookie-consent banner.

**Commerce:** persistent cart (anonymous carts merged on sign-in), quantities for seat-based products, coupons, EU VAT, hosted checkout (sandbox and Stripe), webhook-only fulfilment, idempotency, licence keys with a verification API, signed downloads with history, invoices, refund requests, admin refunds through the provider with revocation on the refund webhook, and credits.

**Customer platform:** all 18 dashboard sections, settings (profile, workspace, password, sessions, data export, account deletion), Playground with demo quotas, Agent Studio (visual editor with 9 node types, configuration, knowledge, memory, schedules, webhook, logs, approvals, pause/cancel/retry, export).

**Admin:** overview with charts, products (status, price, copy), orders, refunds, coupons, licences (revocation with reason), users and roles, execution and cost monitoring, AI provider toggles and the price table, support tickets with contact messages, content (blog, newsletter, seller applications), audit log, settings (demo quota, credits, homepage banner). All admin access is gated on the server.

**Developer portal and REST API:** catalogue, product, licence verification, execute (JSON or NDJSON stream), usage, and health endpoints. Docs cover JS and Python examples, rate limits, webhooks and MCP, plus an interactive tester for public endpoints.

**Content:** about, contact, pricing, enterprise, integrations directory, help, FAQ (FAQ schema), 4 blog posts, legal drafts (terms, privacy, cookies, refunds, licence, all clearly marked "pending legal review"), security, changelog, status (real checks), affiliates, sellers (feature-flagged application form), careers, sitemap, robots and OG images.

**Data:** a PostgreSQL schema with every requested table, indexes, foreign keys, constraints and RLS; the seed is generated from the catalogue.

## Demo deployment (added 2026-11-25)

- `render.yaml` Blueprint + `DEPLOY-RENDER.md`: demo mode on the Render Free plan (sandbox checkout allowed, auto-verified sign-ups, no persistent disk; `DEMO_LOGIN_EMAIL`/`DEMO_LOGIN_PASSWORD` recreate a login on every start), server binds to Render's `$PORT`.
- Email: added Resend delivery (`RESEND_API_KEY`, `MAIL_FROM`). Without it, production users could never verify their email and therefore never buy. `AUTO_VERIFY_EMAIL=true` is the demo-only fallback.
- The `DEVTEST10` seed coupon is now inactive in production.
- Verified with a production build on port 10000: public pages, sign-up → dashboard, sandbox purchase → fulfilment, owned tool run, admin panel. No page errors.

## Images + workflow tour (added 2026-11-25)

- **Fixed blank images:** 24 of 195 generated SVGs (all micro-tool and developer-kit covers, 2 category images, the developers page image and one blog image) had a duplicated `stroke` attribute, so browsers refused to render them. Fixed in `scripts/generate-assets.mjs` (`panel()` helper) and in the files; `tests/unit/assets.test.ts` now fails on any duplicated SVG attribute. A browser crawl of 118 pages finds 0 broken images.
- **New `/how-it-works` page:** 6-step customer journey with real screenshots (`public/screenshots/tour/`), the purchase-fulfilment flow, the run pipeline, Agent Studio and roles. Linked from Resources, the footer, the homepage and the sitemap.
- **Guided tour** (`components/guided-tour.tsx`): 11 steps across home, marketplace, product, Playground, dashboard, Agent Studio and admin, highlighting real elements (`data-tour` attributes). Started from "Take the tour" or any URL with `?tour=1`; visitors get a sign-in prompt for dashboard/admin steps. Tested as visitor, admin and on a Pixel 7.

## Scope reduction (added 2026-11-25)

Removed from the website at the client's request:
- **Playground** (free demo runs): page, links, homepage demo section and tour step. `/api/execute` now requires sign-in and ownership.
- **Customer dashboard:** licence keys, execution history, API keys and support tickets pages. Admin "Licences" removed; admin "Support tickets" became "Contact messages" (contact-form inbox).
- **Licence options:** products have one one-time price; no licence picker, labels, compare row, filter or upgrade tiers. Downloads include `PURCHASE.txt` instead of `LICENSE-KEY.txt`. (Licence records are still created internally to gate downloads.)
- **Developer API & portal:** `/developers/*`, `/api/v1/*`, related nav/footer/homepage content.
- **Multi-Agent Systems category:** all 10 products (incl. the Multi-Agent Research Team) and the Python LangGraph service (`apps/api`). Catalogue is now **50 products, 5 categories, 9 purchasable**.

## Not done / blockers (honest list)

1. **Supabase isn't wired at runtime.** The app uses the development JSON store and development auth. The SQL schema and RLS are ready and tested; a Supabase repository plus Supabase Auth (Google sign-in, MFA) needs credentials. The JSON store is single-instance only.
2. **No live AI calls were made.** Provider integrations are unit-tested against recorded stream formats only. Model IDs and EUR price estimates in `packages/ai-engine/src/models.ts` must be checked against current provider pricing.
3. **Stripe isn't exercised live.** It's implemented and unit-tested (signatures, idempotency keys, event mapping); run in test mode with real keys plus `stripe listen` before launch. Credit-pack top-ups and subscriptions are disabled in the UI with an explanation.
4. **Docker:** the compose file and Dockerfiles were written but not run (no Docker on this machine).
5. **Python service integration:** tested standalone; the web app doesn't yet route Research Team runs to it.
6. **Redis:** the in-process rate limiter is used; a Redis adapter is pending.
7. **Photography:** none. All imagery is original SVG plus real screenshots. Optional future step: licensed photos or generated images recorded in the manifest.
8. **Workflow, n8n and other coming-soon products:** 50 listings have no deliverable yet (by design they can't be sold). Outbound customer webhooks, seller payouts and affiliate payouts aren't implemented.
9. **Build warnings:** 8 Turbopack whole-project-tracing warnings from runtime file paths (`db.ts`, `delivery.ts`). They inflate the deployment bundle but don't break anything.
10. **Lighthouse and accessibility:** I followed accessible patterns (labels, roles, focus rings, skip link, contrast tokens), but haven't run an automated a11y audit (axe) or Lighthouse.
11. **Performance:** nearly all routes are dynamic because the header reads the session. Converting the header to a client island would make catalogue pages static.

## Production readiness checklist

- [ ] Set every secret in `.env.example` (unique, ≥ 32 random bytes); `PAYMENT_PROVIDER=stripe`; leave `ALLOW_SANDBOX_PAYMENTS` unset
- [ ] Apply `supabase/migrations` and `supabase/seed.sql`; implement and enable the Supabase repository and Auth; migrate off the JSON store
- [ ] Stripe: enable Stripe Tax (VAT ID collection is disabled by request); register the webhook for `checkout.session.completed`, `checkout.session.expired` and `charge.refunded`; complete an end-to-end test-mode purchase and refund
- [ ] Verify model IDs and price table; set provider keys; run each functional product live and review outputs
- [ ] Legal review of all `/legal/*` pages, company details on invoices and contact pages, DPA and sub-processor list
- [ ] Email provider for verification, reset and receipts; turn off `/dev/outbox` (it's already disabled in production)
- [ ] Redis rate limiter; set `SCHEDULER=off` on web replicas and run one scheduler worker
- [ ] Object storage for product files and knowledge-base uploads; connect the malware-scanning hook (`MALWARE_SCAN_URL`)
- [ ] Nonce-based CSP; HSTS preload decision; error monitoring and log retention
- [ ] Run Lighthouse and axe on key pages; fix findings; record actual scores
- [ ] Load test the hosted execution path and set per-plan concurrency limits

## Navigation and checkout update (2026-11-26)

- Removed desktop marketplace mega-menu trigger and panel; mobile marketplace link and category navigation remain.
- Removed checkout VAT ID input and explanatory text, and disabled tax ID collection in Stripe checkout. Country-based tax calculation and required purchase consent remain.
- Source syntax and archive checked; dependency installation unavailable from the offline cache, so full build and browser tests were not run.
