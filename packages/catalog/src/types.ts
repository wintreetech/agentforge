export type CategorySlug =
  | "ai-micro-tools"
  | "automation-workflows"
  | "ai-agents"
  | "multi-agent-systems"
  | "business-solutions"
  | "developer-kits";

export type DeliveryType =
  | "hosted-tool"
  | "cloud-agent"
  | "self-hosted-agent"
  | "workflow-template"
  | "source-code"
  | "subscription";

export type ProductStatus = "draft" | "coming_soon" | "beta" | "published" | "unavailable" | "archived";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Hosting = "hosted" | "self-hosted" | "both";
export type LicenseType = "personal" | "commercial" | "developer" | "agency" | "white-label";
export type AIProvider = "OpenAI" | "Anthropic" | "Google Gemini";

export interface Category {
  slug: CategorySlug;
  name: string;
  navLabel: string;
  tagline: string;
  description: string;
  accent: string;
  accent2: string;
  motif: "spark" | "flow" | "orbit" | "constellation" | "blocks" | "brackets";
}

export interface ProductImage {
  src: string;
  alt: string;
  kind: "illustration" | "diagram" | "screenshot";
}

export interface FAQ {
  q: string;
  a: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string[];
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  category: CategorySlug;
  subcategory: string;
  priceCents: number;
  currency: "EUR";
  version: string;
  publishedAt: string | null;
  updatedAt: string;
  status: ProductStatus;
  benefits: string[];
  capabilities: string[];
  useCases: string[];
  audience: string[];
  industries: string[];
  inputs: string[];
  outputs: string[];
  integrations: string[];
  providers: AIProvider[];
  /** Estimated provider/API cost per run in EUR [low, high]; null when not applicable. */
  costPerRunEur: [number, number] | null;
  costNote: string;
  requirements: string[];
  installation: string[];
  documentation: string[];
  changelog: ChangelogEntry[];
  license: LicenseType;
  delivery: DeliveryType;
  hosting: Hosting;
  difficulty: Difficulty;
  demoAvailable: boolean;
  faqs: FAQ[];
  related: string[];
  images: ProductImage[];
  thumbnail: string;
  seo: { title: string; description: string; keywords: string[] };
  /** Whether a real, tested deliverable exists. Only these can be purchased. */
  functional: boolean;
}
