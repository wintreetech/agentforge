export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readMinutes: number;
  tag: string;
  accent: string;
  art: "network" | "layers" | "terminal" | "workspace" | "orbit";
  body: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "how-we-price-ai-products-transparently",
    title: "How we show AI running costs before you buy",
    excerpt: "Every hosted product on AgentForge shows an estimated per-run provider cost. Here is how the estimate is built, and where its limits are.",
    date: "2026-11-24",
    readMinutes: 5,
    tag: "Pricing",
    accent: "#7C3AED",
    art: "layers",
    body: `AI products have two prices: the one you pay once, and the one you pay every time they run. Most marketplaces only show the first. We show both.

## What the estimate includes

Each hosted product defines a token budget per run in our product registry. We combine that budget with the published per-token prices of the model you select to produce a range: the low end assumes a short input, the high end assumes the input fills the budget.

## What it does not include

- Price changes by model providers after the estimate was set
- Your own API key's discounts or commitments
- Retries after provider errors (rare, and capped at two)

## Credits instead of surprises

Hosted runs draw from credits, where one credit equals one cent of estimated provider cost. Purchases of hosted tools include a credit allowance; when it runs out, you can buy a pack or connect your own API key and pay the provider directly.

## Hard limits

Every run is bounded by a maximum number of steps, a token budget, a cost ceiling and a timeout. If any limit is hit, the run stops and tells you which one. No product can run indefinitely on your account.`,
  },
  {
    slug: "prompt-injection-defences-in-agent-products",
    title: "Treating documents as data: our prompt-injection defences",
    excerpt: "Agents read emails, PDFs and web pages written by strangers. We explain the layered defences every AgentForge product uses.",
    date: "2026-11-21",
    readMinutes: 6,
    tag: "Security",
    accent: "#22D3EE",
    art: "network",
    body: `When an agent reads a document, the document can try to give the agent instructions. That is prompt injection, and there is no single fix. We use layers.

## 1. Untrusted content is fenced

Uploaded files, quoted emails, fetched pages and tool outputs are wrapped in delimited data blocks with a random marker. The system prompt tells the model that anything inside those blocks is information, never instruction.

## 2. Suspicious text is flagged

We scan untrusted content for common injection phrasing. A match does not block the run, but it is surfaced to you as a warning on the result, so you know to look more carefully.

## 3. Permissions don't come from the model

The model cannot grant itself tools. Which tools a product may use is fixed in the product registry. Anything with side effects outside AgentForge, such as fetching a URL or calling an API, needs your approval for that run, and server-side fetches only go to public HTTPS addresses.

## 4. Outputs are sanitised

Model output is rendered as text and Markdown, never as raw HTML, and active content is stripped before display.

None of this makes injection impossible. It makes it visible and limits what a successful injection can do.`,
  },
  {
    slug: "building-your-first-mcp-server",
    title: "Building your first MCP server: a practical walkthrough",
    excerpt: "The Model Context Protocol lets AI clients call tools you define. A walkthrough of the structure we use in the MCP Server Developer Kit.",
    date: "2026-11-18",
    readMinutes: 7,
    tag: "Developers",
    accent: "#10B981",
    art: "terminal",
    body: `The Model Context Protocol (MCP) is an open protocol for connecting AI applications to tools and data. An MCP server exposes tools; an MCP client, such as a desktop assistant, discovers and calls them.

## Start with a typed registry

Each tool in our kit is a plain object with a name, a description, a zod input schema and a handler. The registry validates every call against the schema before the handler runs, so handlers never see malformed input.

## Make side effects explicit

Our example file reader only reads inside an allowlisted directory and refuses paths that escape it. The HTTP fetcher only calls allowlisted hosts. Defaults should be safe; widening access should be a deliberate configuration change.

## Test the handlers, not the transport

Most logic lives in the handlers, which are ordinary functions. The kit's tests call them directly. The stdio transport from the official SDK is wired up in a single small file.

## Connect a client

Point your client's MCP configuration at the compiled server's entry point. The kit's docs include configuration snippets and a checklist for debugging connection problems.`,
  },
  {
    slug: "human-approval-in-agent-workflows",
    title: "Where humans belong in agent workflows",
    excerpt: "Agents are good at drafting and bad at being accountable. Here is how we decide which steps need a person to approve them.",
    date: "2026-11-12",
    readMinutes: 4,
    tag: "Agents",
    accent: "#A855F7",
    art: "orbit",
    body: `An agent that drafts a reply is useful. An agent that sends a refund on its own is a liability. The difference is consequence.

## Our rule of thumb

If a step changes something outside the workspace, such as sending, paying, deleting, publishing or calling an external API, it needs explicit approval. If a step only produces a draft for a person to review, it can run on its own.

## Approval nodes in Agent Studio

The visual workflow editor has a Human approval node. When a run reaches it, the run pauses and shows what is about to happen. You approve or reject from the execution log, and the decision is recorded.

## High-impact domains stay assistive

Recruitment, finance and legal products summarise, extract and compare. They do not rank candidates, make credit decisions or give legal advice. A qualified person makes those decisions, with the agent's output as one input.`,
  },
];
