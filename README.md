# AgentForge AI

**Intelligence. Automated.** A marketplace where customers discover, test, buy, download, configure and run AI tools, agents, automation workflows and agentic business systems (€10–€800).

> Status: development build. Runs fully on a laptop with **no credentials**, using clearly labelled sandboxes for payments and AI. See [PROGRESS.md](PROGRESS.md) for exactly what works, what is verified and what is blocked.

## Quick start

Requirements: Node.js ≥ 22.6 (tested on 26), npm 10+, Python 3.12 (optional service), Microsoft Edge or Chromium (e2e tests).

```bash
npm install
cp .env.example .env          # optional; everything has development defaults
npm run dev                   # http://localhost:3100
```

1. Open http://localhost:3100 and **Sign up**.
2. Verify your email via **http://localhost:3100/dev/outbox** (development mail outbox).
3. Buy an available product: checkout uses the **payment sandbox**, and fulfilment happens through a signed webhook.
4. Use it in **Dashboard → My AI tools / Agent Studio / Downloads**.

Make yourself an admin: add your email to `ADMIN_EMAILS` before signing up, or run `npm run make-admin -- you@example.com` and restart the dev server.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on :3100 |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Vitest: catalogue, commerce, AI engine, 9 product executions, SQL schema + RLS (PGlite) |
| `npm run e2e` | Playwright (uses system Edge; `PW_CHANNEL=chromium` for bundled Chromium) |
| `npm run typecheck` / `npm run lint` | TypeScript strict / ESLint |
| `npm run assets` | Regenerate the 195 SVG illustrations + `public/assets/manifest.json` |
| `npm run seed:sql` | Regenerate `supabase/seed.sql` from the TypeScript catalogue |
| `npm run audit:deps` | `npm audit` of production dependencies |
| `cd products/developer-kits/mcp-server-kit && npm i && npm test` | MCP kit tests (incl. end-to-end MCP stdio session) |

## Repository layout

```
apps/web                 Next.js 16 App Router storefront, dashboards, admin, REST API
packages/catalog         60-product catalogue, search/filter, recommendation engine
packages/commerce        VAT/coupons, payments (sandbox + Stripe), licence keys, signed URLs, ZIP
packages/ai-engine       Provider abstraction (OpenAI/Anthropic/Gemini/sandbox), runtime, RAG, SSRF guard
packages/product-registry  Runnable product specs (inputs, steps, budgets, policies)
products/                Downloadable deliverables (MCP Server Developer Kit)
supabase/                PostgreSQL migration (RLS) + generated seed
scripts/                 Asset generator, seed generator, admin CLI
docs/screenshots         Desktop & mobile screenshots captured by Playwright
docker/, docker-compose.yml  Container definitions (unverified here: no Docker available)
```

## Environment variables

See [.env.example](.env.example). Nothing is required for development. In production, all `*_SECRET`/`*_KEY` secrets are required and the app refuses to sign tokens or run sandbox payments without them.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): technical decisions
- [PROGRESS.md](PROGRESS.md): completion report, blockers and production checklist
- In-app: `/developers`, `/docs`, `/security`
