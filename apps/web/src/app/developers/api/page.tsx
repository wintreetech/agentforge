import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { Container, PageHeader } from "@/components/ui";
import { DevNav } from "../dev-nav";

export const metadata: Metadata = { title: "REST API reference", alternates: { canonical: "/developers/api" } };

const REF = `Base URL: your AgentForge domain. All bodies are JSON. Monetary amounts are integer minor units (cents) with a currency code.

## GET /api/v1/products
Public. Query parameters match the marketplace: \`q\`, \`category\`, \`min\`, \`max\` (EUR), \`provider\`, \`integration\`, \`industry\`, \`difficulty\`, \`license\`, \`availability\` (\`available\`, \`coming_soon\`), \`hosting\`, \`sort\` (\`popular\`, \`newest\`, \`price-asc\`, \`price-desc\`, \`relevance\`), \`page\`, \`per_page\` (≤ 60). Lists use comma separation.

\`\`\`json
{ "data": [{ "id": "prd_054", "slug": "mcp-server-developer-kit", "title": "MCP Server Developer Kit",
  "price": { "amount": 9900, "currency": "EUR" }, "status": "published", "purchasable": true, … }],
  "page": 1, "pages": 1, "total": 1 }
\`\`\`

## GET /api/v1/products/{slug}
Public. Returns the product with description, capabilities, inputs, outputs, requirements and changelog. 404 for unknown, draft or archived products.

## POST /api/v1/licenses/verify
Public, rate-limited. Body: \`{"key": "AF-…", "product": "optional-slug"}\`.

\`\`\`json
{ "valid": true, "status": "active", "product": "mcp-server-developer-kit", "license": "developer", "issued_at": "2026-11-25T…" }
\`\`\`
Invalid keys return \`{"valid": false, "reason": "malformed" | "not_found" | "product_mismatch"}\`. No customer data is ever returned.

## POST /api/v1/execute/{slug}
API key required; your account must own the product. Body:

| Field | Type | Notes |
|---|---|---|
| input | object | Product-specific fields, validated server-side. See each product's documentation. |
| model | string | e.g. \`claude-haiku-5-5\`, \`gpt-5-mini\`, \`gemini-2.5-flash\` or \`sandbox-deterministic\`. Must be configured. |
| stream | boolean | NDJSON event stream when true. |

Response (non-streaming):
\`\`\`json
{ "id": "exe_…", "status": "succeeded", "simulated": false,
  "output": { "markdown": "…", "data": { … }, "citations": [ … ], "warnings": [] },
  "usage": { "inputTokens": 812, "outputTokens": 404, "costEur": 0.0027, "steps": 3, "ms": 4210 } }
\`\`\`
Live-model runs deduct credits unless you have added your own provider key. 402 means insufficient credits.

## GET /api/v1/usage
API key required. Last 30 days: runs, succeeded, input/output tokens, estimated cost and credit balance.

## GET /api/health
Public. Live service checks; 503 when a configured service is down.`;

export default function ApiReference() {
  return (
    <>
      <PageHeader eyebrow="Developers" title="REST API reference" />
      <Container className="grid grid-cols-1 [&>*]:min-w-0 gap-10 py-12 lg:grid-cols-[220px_1fr]">
        <DevNav current="/developers/api" />
        <div className="min-w-0 max-w-3xl"><Markdown source={REF} /></div>
      </Container>
    </>
  );
}
