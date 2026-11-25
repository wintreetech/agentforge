/**
 * DRAFT legal content. Every document here must be reviewed by a qualified
 * lawyer before production launch. Placeholders in [brackets] must be filled.
 */
export const LEGAL: Record<string, { title: string; updated: string; body: string }> = {
  terms: {
    title: "Terms of Service",
    updated: "2026-11-25",
    body: `## 1. Who we are
AgentForge AI ("we") operates this marketplace. Company name, registered address, registration number and VAT number: [to be completed before launch].

## 2. Accounts
You must provide accurate information and keep your credentials secure. You are responsible for activity in your workspace. You must be at least 18, or the age of majority where you live.

## 3. Products and availability
Products marked **Available** can be purchased. Products marked **Coming soon** cannot be purchased; their descriptions describe planned functionality and may change.

## 4. Prices and payment
Prices are in euros and exclude VAT unless stated. VAT is calculated at checkout according to your location. Payments are processed by our payment provider; we do not store card details.

## 5. Delivery of digital content
Access is granted after the payment provider confirms payment. Hosted products are available in your dashboard; downloadable products are delivered as versioned packages.

## 6. Right of withdrawal (EU/EEA consumers)
You have a 14-day right of withdrawal for distance contracts. For digital content supplied immediately, this right ends when delivery begins **if** you gave your prior express consent and acknowledged the loss of the right at checkout. See the Refund Policy.

## 7. Hosted execution and fair use
Hosted runs are subject to per-run limits (steps, tokens, time and cost) and to your credit balance. We may suspend runs that abuse the service, attempt to bypass limits or violate law.

## 8. Acceptable use
You must not use products to break the law, infringe rights, generate malware, conduct unauthorised access, or make automated decisions with legal or similarly significant effects about people without appropriate human review.

## 9. AI output
AI output can be inaccurate. You are responsible for reviewing output before relying on it. Recruitment, financial and legal products provide assistive analysis only and are not professional advice.

## 10. Liability
[Limitation of liability clause — to be drafted for applicable jurisdictions; mandatory consumer protections cannot be excluded.]

## 11. Governing law
[To be determined.]`,
  },
  privacy: {
    title: "Privacy Policy",
    updated: "2026-11-25",
    body: `## Controller
[Company name and contact details — to be completed.] Data protection contact: [email].

## What we collect
- **Account data**: name, email, password hash, workspace name.
- **Order data**: items, amounts, country, VAT ID (if provided), payment reference. Card data is handled only by the payment provider.
- **Usage data**: product runs (inputs, outputs, token counts, estimated cost) to provide history, metering and support.
- **Uploaded documents**: stored in your private knowledge bases until you delete them.
- **Technical data**: IP address for rate limiting and security logs.

## Why (legal bases)
Contract performance (accounts, purchases, product delivery); legal obligations (tax records); legitimate interests (security, fraud prevention); consent (newsletter, optional analytics).

## AI providers
When you run a product on a live model, the relevant input is sent to the selected AI provider (OpenAI, Anthropic or Google) to generate the output. We configure providers so that inputs are not used to train their models where the provider offers this option. [List sub-processors and transfer mechanisms.]

## Retention
Account data: while your account exists. Run history: [configurable, default 12 months]. Order and invoice records: as required by tax law (e.g. up to 10 years). Security logs: [90 days].

## Your rights
Access, rectification, erasure, restriction, portability and objection. You can export your data and delete your account from Dashboard → Settings. You may complain to your supervisory authority.`,
  },
  cookies: {
    title: "Cookie Policy",
    updated: "2026-11-25",
    body: `## Strictly necessary
| Name | Purpose | Duration |
|---|---|---|
| af_session | Keeps you signed in | 30 days |
| af_anon | Keeps your cart and demo quota before sign-in | 60 days |

## Stored in your browser (not sent to our servers)
| Key | Purpose |
|---|---|
| af-theme | Your light/dark preference |
| af-consent | Your cookie choice |
| af-recent | Recently viewed products |

## Optional analytics
No analytics scripts are loaded today. If analytics is enabled in future, it will only load after you choose **Allow analytics**. You can change your choice by clearing site data, which shows the banner again.`,
  },
  refunds: {
    title: "Refund Policy",
    updated: "2026-11-25",
    body: `## Requesting a refund
Open **Dashboard → My purchases** and choose **Request a refund** on the order. Tell us what went wrong. We aim to respond within [5] business days.

## When we refund
- The product does not work as described and we cannot fix it within a reasonable time.
- You were charged twice or incorrectly.
- EU/EEA consumers who did not consent to immediate delivery may withdraw within 14 days.

## How refunds work
Approved refunds are paid back to the original payment method through our payment provider. When a full refund completes, access to the product and its licence key is revoked.

## Hosted credits
Credits consumed by completed runs are not refundable, except where a run failed due to our error.`,
  },
  license: {
    title: "Licence Agreement",
    updated: "2026-11-25",
    body: `## Licence types
| Licence | You may | You may not |
|---|---|---|
| Personal | Use the product for yourself | Use it to provide services to others |
| Commercial | Use it in your business | Resell or redistribute it |
| Developer | Build software for yourself or clients with source kits | Redistribute the kit as a template or library |
| Agency | Use it to deliver work to multiple clients | Give clients standalone copies of the product |
| White-label | Rebrand and offer it to your customers | Resell the source code itself |

## Seats
Each licence covers one person unless the product is sold per seat. Licence keys are tied to the purchasing account.

## Updates
You receive updates for the major version you bought.

## Revocation
Licences may be revoked after a completed refund, chargeback, or material breach of this agreement.

## Third-party components
Open-source dependencies are licensed under their own terms, listed in each package.`,
  },
};
