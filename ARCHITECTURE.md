# Architecture decisions

## 1. Monorepo with npm workspaces
`apps/web` plus four TypeScript packages consumed as source (`transpilePackages`). pnpm/turbo weren't installed; npm workspaces keep the toolchain minimal. Packages use explicit `.ts` import extensions so Node ≥ 22.6 can also run them directly (asset and seed scripts import the catalogue without a build step).

The prompt's suggested packages map as follows: `database` and `auth` live in `apps/web/src/lib` (`db.ts`, `auth.ts`) behind small interfaces; `payments` is part of `packages/commerce`; `types` and `config` are folded into the packages that own them.

## 2. One execution engine for every product
`packages/ai-engine/runtime.ts` runs a product as a list of steps (`llm` or `compute`). Each product in `packages/product-registry` declares its input schema (zod), steps, deterministic sandbox implementation, finalisation and policy (model, allowed tools, timeout, step/token/cost budgets, permissions, demo rules). The engine enforces budgets, streams tokens, retries retryable provider errors (2× with backoff), supports cancellation via `AbortSignal`, sanitises output and emits audit events. The web app persists every run with steps, tokens, estimated cost and credits.

Adding a product means writing a spec, not a backend.

## 3. Providers and sandbox
OpenAI, Anthropic and Gemini are called over REST with streaming (no SDK dependencies). Keys stay on the server; customer-supplied keys are AES-256-GCM encrypted. When no provider is configured, the **sandbox provider** streams the step's deterministic output (heuristics, extractive summarisation, BM25 retrieval, templates). The UI, API and stored runs always label it `simulated`. No paid API calls were made during development.

## 4. Agent Studio runtime
Workflow graphs (xyflow editor) are executed by `lib/studio.ts` **one node per request**, with state persisted between nodes. That makes pause, resume, cancel, human approval and retry-from-failed-step real state transitions rather than UI tricks. `api_request` nodes always require approval, can only reach allowlisted hosts and go through the SSRF guard. Handoff nodes run other owned products through the shared engine. Schedules run via `instrumentation.ts` (in-process interval, disable with `SCHEDULER=off` when running several instances). Webhook triggers use secret, rotatable URLs.

## 5. Python service

## 6. Payments
`PaymentProvider` interface with `SandboxPaymentProvider` and `StripePaymentProvider` (Checkout Sessions, automatic tax, idempotency keys, refunds). Fulfilment happens **only** in `/api/webhooks/payments` after signature verification on the raw body with a 5-minute tolerance, and is idempotent per provider event id. The amount and currency must match the order. The sandbox "hosted checkout" posts a signed webhook to the same endpoint, so development exercises the production path. Sandbox payments are refused in production unless explicitly allowed.

Prices are EUR minor units, excluding VAT. The sandbox computes EU VAT by buyer country (reverse charge only for validated VAT IDs, never in the sandbox); production should use Stripe Tax or a merchant of record.

## 7. Licensing and delivery
Licence keys are `AF-XXXXX-XXXXX-XXXXX-CCCC` with an HMAC checksum, so malformed or forged keys are rejected without a database lookup. Downloads use signed, account-bound tokens that expire after 5 minutes, and the entitlement is re-checked at download time. ZIPs are built from the real deliverable directory with the buyer's licence file added (dependency-free ZIP writer).

## 8. Data layer
Runtime: an atomic JSON document store (`lib/db.ts`) with serialised writes, the same entities as the SQL schema, so it's swappable. Production schema: `supabase/migrations/0001_init.sql` with RLS policies, a constraint that prevents publishing products without a deliverable, order arithmetic checks, pgvector embeddings and an append-only audit log trigger. It is verified by `tests/unit/sql.test.ts` against embedded Postgres (PGlite) with a stubbed `auth` schema.

**Why not Supabase at runtime yet:** no credentials or local Postgres/Docker were available. Wiring a Supabase repository plus Supabase Auth is the main remaining production task.

## 9. Auth
Development provider: scrypt password hashes, random session tokens stored hashed, HttpOnly/SameSite cookies, rate-limited sign-in and sign-up, email verification and reset through a dev outbox, and no user enumeration. Authorisation is enforced server-side in every page, action and route (`requireUser`/`requireAdmin`, ownership filters on every query). Google sign-in and MFA are shown as unavailable until Supabase Auth is wired.

## 10. Security headers and CSP
CSP allows `'unsafe-inline'` scripts because of the pre-hydration theme script and Next's inline bootstrap without nonces. Upgrade path: nonce-based CSP via `proxy.ts`, which makes all pages dynamic (they already are because the header reads the session).

## 11. Images
There was no image-generation capability or licensed photography in this environment, so all artwork is **original, deterministic SVG** (`scripts/generate-assets.mjs`): unique cover, workflow diagram and input/output sheet per product, plus category, blog and page art. A manifest records source and licence. Product galleries also include **real screenshots** captured by Playwright from actual sandbox runs (labelled "Screenshot"; the output inside them is labelled simulated). Illustrations are labelled "Illustration" or "Diagram", never presented as screenshots.

## 12. Rendering
Most routes are dynamic because the shared header reads the session (cart count, user menu). Follow-up: move the header's user-specific parts to a small client island so catalogue and content pages can be statically rendered.
