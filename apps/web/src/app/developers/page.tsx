import type { Metadata } from "next";
import Image from "next/image";
import { Markdown } from "@/components/markdown";
import { Container, PageHeader } from "@/components/ui";
import { env } from "@/lib/env";
import { DevNav } from "./dev-nav";
import { ApiTester } from "./api-tester";

export const metadata: Metadata = { title: "Developer portal", description: "AgentForge AI REST API, webhooks, SDK examples and MCP integration.", alternates: { canonical: "/developers" } };

const body = (base: string) => `## 1. Create an API key
Go to **Dashboard → API keys**, create a key and copy it. Keys look like \`afk_live_…\` and are shown only once. They're stored as SHA-256 hashes.

## 2. Authenticate
Send the key as a bearer token:

\`\`\`bash
curl ${base}/api/v1/usage -H "Authorization: Bearer $AGENTFORGE_API_KEY"
\`\`\`

## 3. Run a product you own

**JavaScript (Node 18+ / browsers on your server)**
\`\`\`js
const res = await fetch("${base}/api/v1/execute/ai-invoice-data-extractor", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.AGENTFORGE_API_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ input: { text: invoiceText }, model: "claude-haiku-5-5" }),
});
const run = await res.json();
console.log(run.status, run.output.data.invoice.total);
\`\`\`

**Python (requests)**
\`\`\`python
import os, requests
r = requests.post(
    "${base}/api/v1/execute/ai-knowledge-base-agent",
    headers={"Authorization": f"Bearer {os.environ['AGENTFORGE_API_KEY']}"},
    json={"input": {"question": "What is the leave policy?", "docs": [{"id": "h", "name": "Handbook", "pages": [handbook_text]}]}},
    timeout=120,
)
r.raise_for_status()
print(r.json()["output"]["markdown"])
\`\`\`

## Streaming
Add \`"stream": true\` to receive newline-delimited JSON events: \`meta\`, \`step\`, \`token\`, \`output\`, \`error\`, \`done\`.

## Rate limits
| Endpoint | Limit |
|---|---|
| Authenticated (\`/api/v1/execute\`, \`/api/v1/usage\`) | 60 requests / minute / key |
| Public catalogue | 60 requests / minute / IP |
| Licence verification | 20 requests / minute / IP |

Responses include \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\` and \`X-RateLimit-Reset\`; a 429 includes \`Retry-After\`.

## SDKs
There's no published SDK package yet. The REST API is small enough to call directly; the examples above are complete. The **Multi-LLM Integration Toolkit** and **AI API Integration Starter Kit** (coming soon) will ship typed clients.

## Errors
Errors use \`{"error": {"code": "...", "message": "..."}}\` with standard HTTP status codes: 400 invalid_request, 401 unauthorized, 402 insufficient credits, 403 not_entitled, 404 not_found, 422 validation/execution error, 429 rate_limited.`;

export default function Developers() {
  return (
    <>
      <PageHeader eyebrow="Developer portal" title="Build on AgentForge" intro="A small, predictable REST API: browse the catalogue, verify licences, run products you own and read usage." />
      <Container className="grid grid-cols-1 [&>*]:min-w-0 gap-10 py-12 lg:grid-cols-[220px_1fr]">
        <DevNav current="/developers" />
        <div className="min-w-0 max-w-3xl">
          <div className="relative mb-8 aspect-[3/1] overflow-hidden rounded-2xl border border-border"><Image src="/assets/pages/developers.svg" alt="" fill sizes="768px" className="object-cover" priority /></div>
          <Markdown source={body(env.appUrl)} />
          <h2 className="mt-10 text-xl font-semibold">Try it</h2>
          <p className="mt-1 text-[14px] text-muted">Interactive testing is limited to public, read-only endpoints so nothing here can change data or spend credits.</p>
          <ApiTester />
        </div>
      </Container>
    </>
  );
}
