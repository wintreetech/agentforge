import type { Category } from "./types.ts";

export const categories: Category[] = [
  {
    slug: "ai-micro-tools",
    name: "AI Micro Tools",
    navLabel: "AI Tools",
    tagline: "Single-purpose tools that do one job well.",
    description:
      "Focused utilities for writing, documents and data extraction. Run them in the browser, pay once, and use the included monthly credits or your own API key.",
    accent: "#7C3AED",
    accent2: "#A78BFA",
    motif: "spark",
  },
  {
    slug: "automation-workflows",
    name: "Automation Workflows",
    navLabel: "Workflows",
    tagline: "Ready-to-import workflows for the tools you already use.",
    description:
      "n8n workflow templates that connect email, spreadsheets, CRMs and stores, with AI steps where judgement is needed and approval steps where mistakes are costly.",
    accent: "#22D3EE",
    accent2: "#67E8F9",
    motif: "flow",
  },
  {
    slug: "ai-agents",
    name: "AI Agents",
    navLabel: "AI Agents",
    tagline: "Configurable agents that work from your data.",
    description:
      "Agents with tools, memory and guardrails. Run them hosted on AgentForge or self-host them, configure them in Agent Studio, and keep a full log of every step.",
    accent: "#6366F1",
    accent2: "#818CF8",
    motif: "orbit",
  },
  {
    slug: "business-solutions",
    name: "Complete Business Solutions",
    navLabel: "AI Solutions",
    tagline: "End-to-end systems for a whole business function.",
    description:
      "Packaged suites that combine agents, workflows and dashboards for a department or industry, with agency and white-label licensing options.",
    accent: "#F59E0B",
    accent2: "#FCD34D",
    motif: "blocks",
  },
  {
    slug: "developer-kits",
    name: "Developer Kits & Bundles",
    navLabel: "Developer Kits",
    tagline: "Source code, starter kits and frameworks.",
    description:
      "Typed, tested source code for building your own AI products: MCP servers, RAG apps, multi-provider clients and orchestration frameworks.",
    accent: "#10B981",
    accent2: "#6EE7B7",
    motif: "brackets",
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
