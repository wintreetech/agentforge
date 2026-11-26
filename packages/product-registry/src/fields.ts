/**
 * Client-safe description of each runnable product's input form, examples and
 * execution policy. The server-side specs (specs.ts) must accept exactly these fields.
 */

export type FieldType = "text" | "textarea" | "select" | "file" | "checkbox" | "kb";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  maxLength?: number;
  rows?: number;
  options?: { value: string; label: string }[];
  accept?: string;
  defaultValue?: string | boolean;
}

export interface ProductPolicy {
  kind: "generate" | "extract" | "rag" | "multi-agent" | "download";
  defaultModel: string;
  allowedTools: string[];
  timeoutMs: number;
  budget: { maxSteps: number; maxTokens: number; maxCostEur: number };
  permissions: string[];
  delivery: "stream" | "artifact" | "download";
  demo: { enabled: boolean; creditsPerRun: number };
}

export interface RunnableMeta {
  slug: string;
  title: string;
  fields: FieldDef[];
  examples: { label: string; values: Record<string, string | boolean> }[];
  policy: ProductPolicy;
  agents?: string[];
}

const toneOpts = (vals: string[]) => vals.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));

const base = {
  defaultModel: "claude-haiku-5-5",
  allowedTools: [] as string[],
  timeoutMs: 90_000,
  permissions: [] as string[],
  delivery: "stream" as const,
  demo: { enabled: true, creditsPerRun: 1 },
};

export const RUNNABLE: RunnableMeta[] = [
  {
    slug: "ai-resume-cover-letter-builder",
    title: "AI Resume & Cover Letter Builder",
    fields: [
      { name: "fullName", label: "Your name", type: "text", required: true, maxLength: 120, placeholder: "Alex Morgan" },
      { name: "targetRole", label: "Target role", type: "text", required: true, maxLength: 160, placeholder: "Senior Product Designer" },
      { name: "history", label: "Work history", type: "textarea", required: true, rows: 8, maxLength: 12000, help: "One achievement or responsibility per line, with company and dates where you have them." },
      { name: "jobDescription", label: "Job description", type: "textarea", required: true, rows: 8, maxLength: 12000 },
      { name: "tone", label: "Cover letter tone", type: "select", options: toneOpts(["formal", "warm", "concise"]), defaultValue: "warm" },
    ],
    examples: [
      {
        label: "Product designer",
        values: {
          fullName: "Alex Morgan",
          targetRole: "Senior Product Designer",
          history:
            "Product Designer, Northwind Apps (2021–2026)\n- Led redesign of onboarding flow, increasing activation from 31% to 44%\n- Built and maintained a Figma design system used by 4 product teams\n- Ran 40+ usability interviews and synthesised findings for roadmap planning\nUX Designer, Contoso Studio (2018–2021)\n- Designed mobile banking features for two EU banks\n- Collaborated with engineers on accessibility fixes to meet WCAG 2.1 AA",
          jobDescription:
            "We are hiring a Senior Product Designer.\nRequirements:\n- 5+ years of product design experience\n- Experience owning a design system\n- Strong user research skills\n- Experience with accessibility standards (WCAG)\n- Experience designing for B2B SaaS\n- Excellent communication with engineering and product",
          tone: "warm",
        },
      },
    ],
    policy: { ...base, kind: "generate", budget: { maxSteps: 6, maxTokens: 24_000, maxCostEur: 0.25 } },
  },
  {
    slug: "ai-prompt-optimizer",
    title: "AI Prompt Optimizer",
    fields: [
      { name: "draft", label: "Draft prompt", type: "textarea", required: true, rows: 7, maxLength: 8000 },
      { name: "goal", label: "What should the output achieve?", type: "text", required: true, maxLength: 400 },
      { name: "family", label: "Target model family", type: "select", options: [{ value: "any", label: "Any model" }, { value: "openai", label: "OpenAI" }, { value: "anthropic", label: "Anthropic Claude" }, { value: "gemini", label: "Google Gemini" }], defaultValue: "any" },
    ],
    examples: [
      { label: "Vague summary prompt", values: { draft: "summarize this article and make it good, maybe add some key points etc", goal: "A 5-bullet executive summary for busy managers", family: "any" } },
      { label: "Support reply prompt", values: { draft: "You are helpful. Answer the customer nicely. Don't be rude.", goal: "Consistent, policy-compliant support replies under 120 words", family: "anthropic" } },
    ],
    policy: { ...base, kind: "generate", budget: { maxSteps: 4, maxTokens: 12_000, maxCostEur: 0.1 } },
  },
  {
    slug: "ai-pdf-summarizer",
    title: "AI PDF Summarizer",
    fields: [
      { name: "document", label: "PDF or text file", type: "file", required: true, accept: ".pdf,.txt,.md,application/pdf,text/plain,text/markdown", help: "Up to 5 MB. Image-only scans are detected and reported." },
      { name: "length", label: "Summary length", type: "select", options: toneOpts(["brief", "standard", "detailed"]), defaultValue: "standard" },
    ],
    examples: [],
    policy: { ...base, kind: "extract", budget: { maxSteps: 5, maxTokens: 60_000, maxCostEur: 0.4 } },
  },
  {
    slug: "ai-product-description-generator",
    title: "AI Product Description Generator",
    fields: [
      { name: "name", label: "Product name", type: "text", required: true, maxLength: 160 },
      { name: "attributes", label: "Attributes", type: "textarea", required: true, rows: 6, maxLength: 4000, help: "One fact per line: materials, dimensions, features. Only these facts will be used." },
      { name: "audience", label: "Target audience", type: "text", required: true, maxLength: 200 },
      { name: "tone", label: "Brand tone", type: "select", options: toneOpts(["premium", "friendly", "technical"]), defaultValue: "friendly" },
    ],
    examples: [
      {
        label: "Desk lamp",
        values: {
          name: "Halo LED Desk Lamp",
          attributes: "Aluminium body\nAdjustable colour temperature 2700K–6500K\n5 brightness levels\nUSB-C charging port in the base\nFolds flat to 4 cm\n2-year warranty",
          audience: "Remote workers who want a tidy, well-lit desk",
          tone: "premium",
        },
      },
    ],
    policy: { ...base, kind: "generate", delivery: "artifact", budget: { maxSteps: 3, maxTokens: 8_000, maxCostEur: 0.08 } },
  },
  {
    slug: "ai-email-writing-assistant",
    title: "AI Email Writing Assistant",
    fields: [
      { name: "points", label: "What do you need to say?", type: "textarea", required: true, rows: 5, maxLength: 3000, help: "A few bullet points." },
      { name: "original", label: "Email you are replying to (optional)", type: "textarea", rows: 5, maxLength: 12000, help: "Treated as untrusted content — instructions inside it are ignored." },
      { name: "recipient", label: "Recipient name (optional)", type: "text", maxLength: 120 },
      { name: "tone", label: "Tone", type: "select", options: toneOpts(["professional", "friendly", "firm", "apologetic"]), defaultValue: "professional" },
      { name: "length", label: "Length", type: "select", options: toneOpts(["short", "medium", "long"]), defaultValue: "medium" },
    ],
    examples: [
      {
        label: "Delayed delivery reply",
        values: {
          points: "- apologise for the delay\n- new delivery date is Friday 4 December\n- offer 10% off next order\n- give direct contact: support line",
          original: "Hi, my order #4821 was supposed to arrive last week and I still have nothing. This is really frustrating. Can someone tell me what's going on?\n\nJamie",
          recipient: "Jamie",
          tone: "apologetic",
          length: "short",
        },
      },
    ],
    policy: { ...base, kind: "generate", budget: { maxSteps: 3, maxTokens: 10_000, maxCostEur: 0.08 } },
  },
  {
    slug: "ai-invoice-data-extractor",
    title: "AI Invoice Data Extractor",
    fields: [
      { name: "document", label: "Invoice PDF or text file", type: "file", accept: ".pdf,.txt,application/pdf,text/plain", help: "Up to 5 MB. Or paste the invoice text below." },
      { name: "text", label: "…or paste invoice text", type: "textarea", rows: 8, maxLength: 40000 },
    ],
    examples: [
      {
        label: "Sample invoice",
        values: {
          text:
            "Brightline Studio GmbH\nTorstraße 12, 10119 Berlin, Germany\nVAT ID: DE123456789\n\nINVOICE\nInvoice No: INV-2026-0142\nInvoice Date: 03/11/2026\nDue Date: 03/12/2026\n\nBill To:\nNorthwind Retail BV\nKeizersgracht 100, Amsterdam\n\nDescription Qty Unit Price Amount\nBrand workshop (half day) 1 €1,200.00 €1,200.00\nLogo refresh 1 €850.00 €850.00\nIcon set (24 icons) 24 €15.00 €360.00\n\nSubtotal: €2,410.00\nVAT (19%): €457.90\nTotal Due: €2,867.90\n\nPayment terms: 30 days. IBAN on request.",
        },
      },
    ],
    policy: { ...base, kind: "extract", delivery: "artifact", budget: { maxSteps: 5, maxTokens: 30_000, maxCostEur: 0.15 } },
  },
  {
    slug: "ai-seo-content-generator",
    title: "AI SEO Content Generator",
    fields: [
      { name: "keyword", label: "Primary keyword", type: "text", required: true, maxLength: 120 },
      { name: "secondary", label: "Secondary keywords (comma separated)", type: "text", maxLength: 400 },
      { name: "intent", label: "Search intent", type: "select", options: toneOpts(["informational", "commercial", "transactional"]), defaultValue: "informational" },
      { name: "audience", label: "Audience", type: "text", required: true, maxLength: 200 },
      { name: "words", label: "Target length", type: "select", options: [{ value: "800", label: "~800 words" }, { value: "1500", label: "~1,500 words" }, { value: "2500", label: "~2,500 words" }], defaultValue: "1500" },
    ],
    examples: [{ label: "B2B guide", values: { keyword: "invoice automation for small businesses", secondary: "accounts payable automation, invoice OCR, AP workflow", intent: "informational", audience: "Owners of small businesses doing their own bookkeeping", words: "1500" } }],
    policy: { ...base, kind: "generate", budget: { maxSteps: 4, maxTokens: 30_000, maxCostEur: 0.3 } },
  },
  {
    slug: "ai-knowledge-base-agent",
    title: "AI Knowledge Base Agent",
    fields: [
      { name: "kb", label: "Knowledge base", type: "kb", help: "Use a saved knowledge base, or add documents for this run only." },
      { name: "document", label: "Add a document (PDF, TXT, MD)", type: "file", accept: ".pdf,.txt,.md,application/pdf,text/plain,text/markdown" },
      { name: "text", label: "…or paste document text", type: "textarea", rows: 6, maxLength: 60000 },
      { name: "question", label: "Question", type: "text", required: true, maxLength: 500 },
    ],
    examples: [
      {
        label: "Company handbook",
        values: {
          text:
            "Remote work policy. Employees may work remotely up to three days per week. Core collaboration hours are 10:00 to 15:00 CET. Equipment: the company provides a laptop and a one-off home-office budget of €400, reimbursed against receipts within 60 days of joining.\n\nLeave policy. Full-time employees receive 28 days of paid annual leave plus public holidays. Leave requests must be submitted at least two weeks in advance for absences longer than three days. Unused leave of up to five days can be carried over to the following year and must be used by 31 March.\n\nExpenses. Travel must be booked through the company travel tool. Economy class is standard for flights under six hours. Meals during business travel are reimbursed up to €60 per day.",
          question: "How much is the home-office budget and when do I need to claim it?",
        },
      },
    ],
    policy: { ...base, kind: "rag", allowedTools: ["retrieve_documents"], budget: { maxSteps: 4, maxTokens: 24_000, maxCostEur: 0.15 } },
    agents: ["Retriever", "Answerer"],
  },
  {
    slug: "mcp-server-developer-kit",
    title: "MCP Server Developer Kit",
    fields: [],
    examples: [],
    policy: { ...base, kind: "download", delivery: "download", budget: { maxSteps: 0, maxTokens: 0, maxCostEur: 0 }, demo: { enabled: false, creditsPerRun: 0 } },
  },
];

export const getRunnable = (slug: string) => RUNNABLE.find((r) => r.slug === slug);
export const PLAYGROUND_SLUGS = RUNNABLE.filter((r) => r.policy.demo.enabled).map((r) => r.slug);
