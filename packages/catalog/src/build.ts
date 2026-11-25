import { rawProducts, type RawProduct } from "./raw-products.ts";
import type { AIProvider, ChangelogEntry, DeliveryType, FAQ, Product, ProductImage } from "./types.ts";

/**
 * Slugs of products whose deliverable is implemented and covered by tests.
 * Only these are marked "published" (purchasable). Everything else is "coming_soon".
 */
export const FUNCTIONAL_SLUGS = [
  "ai-resume-cover-letter-builder",
  "ai-prompt-optimizer",
  "ai-pdf-summarizer",
  "ai-product-description-generator",
  "ai-email-writing-assistant",
  "ai-invoice-data-extractor",
  "ai-seo-content-generator",
  "ai-knowledge-base-agent",
  "multi-agent-research-team",
  "mcp-server-developer-kit",
] as const;

/**
 * Real screenshots captured from the running app by apps/web/e2e/screenshots.spec.ts
 * (Playground runs in sandbox mode — the screenshots show the "Simulated output" label).
 */
export const PRODUCT_SCREENSHOTS: Record<string, string[]> = Object.fromEntries(
  [
    "ai-resume-cover-letter-builder",
    "ai-prompt-optimizer",
    "ai-product-description-generator",
    "ai-email-writing-assistant",
    "ai-invoice-data-extractor",
    "ai-seo-content-generator",
    "ai-knowledge-base-agent",
    "multi-agent-research-team",
  ].map((s) => [s, [`/screenshots/products/${s}.png`]]),
);

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ALL_PROVIDERS: AIProvider[] = ["OpenAI", "Anthropic", "Google Gemini"];

const deliveryLabel: Record<DeliveryType, string> = {
  "hosted-tool": "Hosted tool — runs in your AgentForge dashboard",
  "cloud-agent": "Cloud-hosted agent — configured and run in Agent Studio",
  "self-hosted-agent": "Self-hosted agent — Docker package you run on your infrastructure",
  "workflow-template": "Automation workflow template — import into n8n",
  "source-code": "Source-code package — downloadable ZIP with documentation",
  subscription: "Subscription — hosted suite billed monthly, self-host option available",
};
export { deliveryLabel };

function installation(r: RawProduct): string[] {
  switch (r.delivery) {
    case "hosted-tool":
      return [
        "Purchase the tool; access is granted after the payment provider confirms the payment.",
        "Open Dashboard → My AI tools and launch the tool.",
        "Optional: add your own provider API key under Dashboard → Integrations to run on your account instead of included credits.",
      ];
    case "cloud-agent":
      return [
        "Purchase the agent; it appears under Dashboard → My agents.",
        "Open it in Agent Studio, review the default instructions, model and tools.",
        "Add knowledge or sources, then run it manually or from a webhook.",
      ];
    case "self-hosted-agent":
      return [
        "Download the package from Dashboard → Downloads.",
        "Copy .env.example to .env and add your provider keys.",
        "Run `docker compose up` and open the local console.",
      ];
    case "workflow-template":
      return [
        "Download the workflow JSON from Dashboard → Downloads.",
        "In n8n choose Import from file and select the JSON.",
        "Connect the listed credentials in n8n and run the included test execution.",
      ];
    case "source-code":
      return [
        "Download the versioned ZIP from Dashboard → Downloads.",
        "Follow README.md: install dependencies, copy .env.example to .env, run the tests.",
        "Build on top of it under the terms of your licence.",
      ];
    case "subscription":
      return [
        "Start the subscription; your workspace is provisioned after payment confirmation.",
        "Connect your business systems from the onboarding checklist.",
        "Invite your team and configure approval policies.",
      ];
  }
}

function requirements(r: RawProduct): string[] {
  const base: Record<DeliveryType, string[]> = {
    "hosted-tool": ["A modern browser", "An AgentForge account"],
    "cloud-agent": ["An AgentForge account", "Optional: your own OpenAI, Anthropic or Gemini API key"],
    "self-hosted-agent": ["Docker 24+", "2 vCPU / 4 GB RAM", "An OpenAI, Anthropic or Gemini API key"],
    "workflow-template": ["n8n 1.x (self-hosted or cloud)", "Credentials for the listed integrations", "An AI provider API key"],
    "source-code": ["Node.js 20+ or Python 3.11+ as documented", "Git", "Provider API keys for AI features"],
    subscription: ["An AgentForge organisation workspace", "Admin access to the systems you connect"],
  };
  return base[r.delivery];
}

function costNote(r: RawProduct): string {
  if (!r.cost) return "No per-run AI cost from the kit itself; your own usage of AI providers is billed by them.";
  const [lo, hi] = r.cost;
  return `Estimated provider cost of €${lo.toFixed(3)}–€${hi.toFixed(2)} per run, depending on model and input size. Hosted runs use included credits; with your own API key the provider bills you directly. Estimates, not guarantees.`;
}

function faqs(r: RawProduct, functional: boolean): FAQ[] {
  const list: FAQ[] = [];
  if (!functional) {
    list.push({
      q: "Can I buy this now?",
      a: "Not yet. This listing is marked Coming soon because its deliverable is still being built and tested. Add it to your wishlist and you will be notified when it is released.",
    });
  }
  list.push({
    q: "What exactly do I receive?",
    a: `${deliveryLabel[r.delivery]}. ${r.outputs.length ? `Outputs: ${r.outputs.join(", ")}.` : ""}`,
  });
  list.push({
    q: "Which AI providers does it support?",
    a: r.cost
      ? "OpenAI, Anthropic and Google Gemini through AgentForge's provider abstraction. You can choose the model per run where the product allows it."
      : "The code supports OpenAI, Anthropic and Google Gemini via environment-configured keys; no provider is required to build or run the tests.",
  });
  list.push({ q: "What will it cost to run?", a: costNote(r) });
  list.push({
    q: "How is my data handled?",
    a: "Inputs are processed only to run the product and are stored in your workspace for your history. Uploaded documents are treated as untrusted data and are never used to train models by AgentForge. See the Privacy Policy for retention settings.",
  });
  if (["HR", "Finance", "Legal", "Accounting", "Recruitment"].some((s) => r.sub.includes(s) || r.industries.includes(s))) {
    list.push({
      q: "Does it make decisions on its own?",
      a: "No. In recruitment, finance and legal contexts this product provides assistive analysis only. A qualified person reviews outputs and makes every decision.",
    });
  }
  list.push({
    q: "What is the refund policy?",
    a: "See the Refund Policy. For digital content delivered immediately, EU withdrawal rights may be waived at checkout with your explicit consent; we still review refund requests for products that do not work as described.",
  });
  return list;
}

function changelog(functional: boolean, publishedAt: string | null): ChangelogEntry[] {
  if (!functional || !publishedAt) return [];
  return [
    {
      version: "1.0.0",
      date: publishedAt,
      notes: ["Initial release", "Input validation and error handling", "Sandbox mode for development without provider keys"],
    },
  ];
}

function images(slug: string, title: string): ProductImage[] {
  const base = `/assets/products/${slug}`;
  const shots = (PRODUCT_SCREENSHOTS[slug] ?? []).map<ProductImage>((src) => ({
    src,
    alt: `Screenshot of ${title} running in AgentForge`,
    kind: "screenshot",
  }));
  return [
    { src: `${base}/cover.svg`, alt: `${title} illustration`, kind: "illustration" },
    ...shots,
    { src: `${base}/workflow.svg`, alt: `How ${title} works, step by step`, kind: "diagram" },
    { src: `${base}/spec.svg`, alt: `${title} inputs and outputs`, kind: "diagram" },
  ];
}

const PUBLISH_DATES: Record<string, string> = {
  "ai-resume-cover-letter-builder": "2026-11-18",
  "ai-prompt-optimizer": "2026-11-18",
  "ai-pdf-summarizer": "2026-11-19",
  "ai-product-description-generator": "2026-11-19",
  "ai-email-writing-assistant": "2026-11-20",
  "ai-invoice-data-extractor": "2026-11-21",
  "ai-seo-content-generator": "2026-11-21",
  "ai-knowledge-base-agent": "2026-11-23",
  "multi-agent-research-team": "2026-11-24",
  "mcp-server-developer-kit": "2026-11-25",
};

export function buildProducts(): Product[] {
  const functionalSet = new Set<string>(FUNCTIONAL_SLUGS);
  const products: Product[] = rawProducts.map((r, i) => {
    const slug = slugify(r.title);
    const functional = functionalSet.has(slug);
    const publishedAt = functional ? PUBLISH_DATES[slug] ?? "2026-11-25" : null;
    const imgs = images(slug, r.title);
    const benefits = [
      r.caps[0],
      r.uses[0] ? `Built for: ${r.uses[0].charAt(0).toLowerCase()}${r.uses[0].slice(1)}` : "",
      r.cost ? "Transparent per-run cost estimates before you run" : "One-time purchase, no runtime fees from AgentForge",
      r.hosting === "hosted" ? "Nothing to install" : r.hosting === "self-hosted" ? "Runs on your infrastructure, your data stays with you" : "Run hosted or self-host",
    ].filter(Boolean);
    return {
      id: `prd_${String(i + 1).padStart(3, "0")}`,
      slug,
      title: r.title,
      shortDescription: r.tag,
      description: r.desc,
      category: r.category,
      subcategory: r.sub,
      priceCents: r.price * 100,
      currency: "EUR",
      version: functional ? "1.0.0" : "0.0.0",
      publishedAt,
      updatedAt: publishedAt ?? "2026-11-25",
      status: functional ? "published" : "coming_soon",
      benefits,
      capabilities: r.caps,
      useCases: r.uses,
      audience: r.audience,
      industries: r.industries,
      inputs: r.inputs,
      outputs: r.outputs,
      integrations: r.integrations,
      providers: ALL_PROVIDERS,
      costPerRunEur: r.cost,
      costNote: costNote(r),
      requirements: requirements(r),
      installation: installation(r),
      documentation: functional
        ? ["Quick start", "Inputs and validation rules", "Outputs and export formats", "Limits, credits and costs", "Troubleshooting"]
        : ["Documentation will be published with the release."],
      changelog: changelog(functional, publishedAt),
      license: r.license,
      delivery: r.delivery,
      hosting: r.hosting,
      difficulty: r.difficulty,
      demoAvailable: functional && r.delivery !== "source-code",
      faqs: faqs(r, functional),
      related: [],
      images: imgs,
      thumbnail: imgs[0].src,
      seo: {
        title: `${r.title} — €${r.price} | AgentForge AI`,
        description: r.tag.length > 155 ? r.tag.slice(0, 152) + "…" : r.tag,
        keywords: [r.title, r.sub, ...r.caps.slice(0, 2)].map((k) => k.toLowerCase()),
      },
      functional,
    } satisfies Product;
  });

  // Related products: nearest by price within the category, plus one functional product elsewhere.
  for (const p of products) {
    const same = products
      .filter((o) => o.category === p.category && o.slug !== p.slug)
      .sort((a, b) => Math.abs(a.priceCents - p.priceCents) - Math.abs(b.priceCents - p.priceCents))
      .slice(0, 3)
      .map((o) => o.slug);
    const cross = products.find((o) => o.functional && o.category !== p.category && !same.includes(o.slug));
    p.related = cross ? [...same, cross.slug] : same;
  }
  return products;
}
