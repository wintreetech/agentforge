import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { Container, PageHeader } from "@/components/ui";
import { DevNav } from "../dev-nav";

export const metadata: Metadata = { title: "Webhooks", alternates: { canonical: "/developers/webhooks" } };

const DOC = `## Inbound: trigger an Agent Studio workflow
Every Agent Studio workflow has a secret webhook URL (Dashboard → Agent Studio → your workflow). POST to it to start a run:

\`\`\`bash
curl -X POST "$WEBHOOK_URL" -H "Content-Type: application/json" -d '{"input": "Summarise yesterday's support tickets"}'
\`\`\`

The response includes \`runId\`, \`status\` and, when the run completed without needing approval, \`output\`. Runs stop at **Human approval** and **API request** nodes and wait for approval in the dashboard; approvals can't be given through the webhook. Rotate the URL at any time; the old one stops working immediately. Limit: 30 requests per minute per IP, 50 KB body.

## Inbound: payment provider events
\`POST /api/webhooks/payments\` receives events from the payment provider. It verifies the signature on the raw body (Stripe: \`Stripe-Signature\`; development sandbox: \`X-AgentForge-Signature\`, format \`t=<unix>,v1=<hex HMAC-SHA256 of "t.body">\`), rejects timestamps older than 5 minutes, and processes each event id exactly once.

### Verifying a signature yourself (Node)
\`\`\`js
import { createHmac, timingSafeEqual } from "node:crypto";
function verify(secret, rawBody, header) {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(\`\${parts.t}.\${rawBody}\`).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}
\`\`\`

## Outbound webhooks
Outbound notifications to your systems (order completed, run finished) are planned. Today, poll \`/api/v1/usage\` or call workflows that use an **API request** node to call your endpoint, which requires an approval per call and an allowlisted host.`;

export default function Webhooks() {
  return (
    <>
      <PageHeader eyebrow="Developers" title="Webhooks" />
      <Container className="grid grid-cols-1 [&>*]:min-w-0 gap-10 py-12 lg:grid-cols-[220px_1fr]">
        <DevNav current="/developers/webhooks" />
        <div className="min-w-0 max-w-3xl"><Markdown source={DOC} /></div>
      </Container>
    </>
  );
}
