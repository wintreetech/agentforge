import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FUNCTIONAL_SLUGS } from "@agentforge/catalog";
import { getRunnable } from "@agentforge/product-registry/fields";
import { getProduct } from "@/lib/catalog";
import { listDeliverableFiles } from "@/lib/delivery";
import { Markdown } from "@/components/markdown";
import { Container, LinkButton, PageHeader } from "@/components/ui";

export function generateStaticParams() {
  return FUNCTIONAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  return p ? { title: `${p.title} documentation`, alternates: { canonical: `/docs/products/${p.slug}` } } : {};
}

const TROUBLE: Record<string, string[]> = {
  "ai-pdf-summarizer": ["**“No extractable text”**: the PDF is a scanned image. OCR is not enabled; export a text PDF instead.", "**Encrypted PDF**: remove the password before uploading."],
  "ai-invoice-data-extractor": ["**Missing line items**: lines must read “description quantity unit-price amount”. Paste text if your PDF uses complex tables.", "**Validation ❌**: the document's numbers don't add up, or a field was misread. Check the source."],
  "ai-knowledge-base-agent": ["**“Couldn't find this”**: no passage matched. Rephrase with words used in your documents, or add the right document.", "**Injection warning**: a document contains text addressed to an AI; it was ignored as an instruction."],
};

export default async function ProductDocs({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p || !p.functional) notFound();
  const meta = getRunnable(slug);
  const files = meta?.policy.kind === "download" ? await listDeliverableFiles(slug) : [];
  const md = [
    "## Quick start",
    ...p.installation.map((s, i) => `${i + 1}. ${s}`),
    "",
    meta && meta.policy.kind !== "download"
      ? ["## Inputs and validation", "| Field | Type | Required | Notes |", "|---|---|---|---|", ...meta.fields.map((f) => `| ${f.label} | ${f.type}${f.options ? ` (${f.options.map((o) => o.value).join(", ")})` : ""} | ${f.required ? "yes" : "no"} | ${(f.help ?? "") + (f.maxLength ? ` Max ${f.maxLength.toLocaleString("en")} chars.` : "")} |`)].join("\n")
      : "",
    "",
    "## Outputs and export formats",
    ...p.outputs.map((o) => `- ${o}`),
    meta && meta.policy.kind !== "download" ? "- Copy to clipboard, Markdown export, and JSON/CSV export where structured data is produced." : "",
    "",
    meta && meta.policy.kind !== "download"
      ? `## Limits, credits and costs\n- Maximum ${meta.policy.budget.maxSteps} steps, ${meta.policy.budget.maxTokens.toLocaleString("en")} tokens, €${meta.policy.budget.maxCostEur} provider cost and ${Math.round(meta.policy.timeoutMs / 1000)} seconds per run.\n- ${p.costNote}\n- Sandbox runs (no provider configured) are free and labelled as simulated.\n- API: \`POST /api/v1/execute/${slug}\` with \`{"input": {…}}\` using the field names above (file inputs are sent as text/pages; see the developer portal).`
      : `## Package contents (v${p.version})\n${files.map((f) => `- \`${f.path}\``).join("\n")}`,
    "",
    "## Troubleshooting",
    ...(TROUBLE[slug] ?? ["**Run stopped with a limit error**: shorten the input or pick a model with a larger context.", "**Provider not configured**: choose the sandbox model or add your own key under Integrations."]).map((t) => `- ${t}`),
  ].join("\n");
  return (
    <>
      <PageHeader eyebrow="Documentation" title={p.title} intro={`Version ${p.version}. ${p.shortDescription}`} />
      <Container className="max-w-3xl py-12">
        <Markdown source={md} />
        {slug === "mcp-server-developer-kit" && <p className="mt-6 text-[14px] text-muted">The full README, tool-authoring guide and client setup guide are included in the download.</p>}
        <div className="mt-8 flex gap-3"><LinkButton href={`/products/${slug}`}>Product page</LinkButton></div>
      </Container>
    </>
  );
}
