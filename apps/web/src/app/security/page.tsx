import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { Container, Notice, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Security", alternates: { canonical: "/security" } };

const BODY = `## Application security
- **Authentication**: passwords hashed with scrypt; sessions are random 256-bit tokens in HttpOnly, SameSite cookies, stored server-side only as hashes.
- **Authorisation**: every dashboard, admin page, API route and server action checks permissions on the server. Customers can only read their own workspace data.
- **CSRF**: server actions use Next.js origin checks; cookie-authenticated API routes reject cross-origin requests.
- **Headers**: Content-Security-Policy, X-Frame-Options DENY, nosniff, strict referrer policy, HSTS in production.
- **Input validation**: all inputs validated with zod schemas on the server; uploads are type-sniffed by content, size-limited and passed through a malware-scanning hook.
- **Secrets**: provider keys and credentials come from environment variables; customer-supplied AI provider keys are encrypted with AES-256-GCM.
- **Payments**: hosted checkout only; webhook signatures verified on raw bodies with timestamp tolerance; fulfilment is idempotent per event and never triggered by browser redirects.
- **Downloads**: signed, short-lived, account-bound URLs; entitlement re-checked at download time.

## AI-specific controls
- Product executions run with maximum steps, token budgets, cost caps and timeouts.
- Tool access is defined per product in a registry allowlist, never by model output.
- Untrusted content (documents, emails, web pages, tool output) is fenced as data and scanned for injection patterns.
- Server-side fetches are restricted to public HTTPS addresses (SSRF protection with DNS resolution checks) and, in Agent Studio, to hosts you allowlist, with human approval.
- Recruitment, financial and legal products are assistive only.

## Reporting a vulnerability
Use the contact form with topic "Security report". Please give us reasonable time to fix issues before disclosure. Do not access other customers' data, degrade service, or use social engineering. [Safe-harbour wording to be confirmed by legal.]`;

export default function Security() {
  return (
    <>
      <PageHeader eyebrow="Security" title="How we protect your data and your runs" />
      <Container className="max-w-3xl py-12">
        <Notice className="mb-6">This page describes controls implemented in the application. It is not a certification. AgentForge AI is not currently SOC 2 or ISO 27001 certified.</Notice>
        <Markdown source={BODY} />
      </Container>
    </>
  );
}
