import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getProducts } from "@/lib/catalog";
import { updateProductAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/forms";
import { DashHeader } from "@/components/dash";
import { StatusBadge } from "@/components/product-card";
import { Input, Notice, Select } from "@/components/ui";
import { statusLabel } from "@/lib/utils";

export const metadata = { title: "Products" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const products = (await getProducts()).filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <DashHeader title="Products" intro="Edit status, price and short description. Products without a registered, tested deliverable cannot be set to Published or Beta — the server rejects it." />
      <form className="mb-4 max-w-sm"><label htmlFor="pq" className="sr-only">Filter</label><Input id="pq" name="q" defaultValue={q} placeholder="Filter by title…" /></form>
      <Notice className="mb-4">Images, galleries and version files are generated from the repository (scripts/generate-assets.mjs, products/). Uploading replacement images requires configured object storage (Supabase Storage).</Notice>
      <div className="space-y-3">
        {products.map((p) => (
          <details key={p.slug} className="rounded-2xl border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
              <Image src={p.thumbnail} alt="" width={72} height={48} className="rounded-md" />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.title}</span><span className="text-[12px] text-subtle">{p.id} · {p.category} · v{p.version}{p.functional ? " · deliverable ✓" : ""}</span></span>
              <StatusBadge status={p.status} />
              <span className="w-16 text-right font-semibold tabular-nums">€{p.priceCents / 100}</span>
            </summary>
            <div className="border-t border-border p-4">
              <ActionForm action={updateProductAction} className="grid gap-3 sm:grid-cols-[160px_120px_1fr_auto] sm:items-end">
                <input type="hidden" name="slug" value={p.slug} />
                <div><label htmlFor={`s-${p.slug}`} className="mb-1 block text-[12.5px] font-medium">Status</label><Select id={`s-${p.slug}`} name="status" defaultValue={p.status}>{Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v} disabled={(v === "published" || v === "beta") && !p.functional}>{l}</option>)}</Select></div>
                <div><label htmlFor={`p-${p.slug}`} className="mb-1 block text-[12.5px] font-medium">Price (€)</label><Input id={`p-${p.slug}`} name="price" type="number" min={10} max={800} step="1" defaultValue={p.priceCents / 100} /></div>
                <div><label htmlFor={`d-${p.slug}`} className="mb-1 block text-[12.5px] font-medium">Short description</label><Input id={`d-${p.slug}`} name="shortDescription" defaultValue={p.shortDescription} maxLength={240} /></div>
                <SubmitButton size="md">Save</SubmitButton>
              </ActionForm>
              <Link href={`/products/${p.slug}`} className="mt-3 inline-block text-[13px] text-accent-2">View product page →</Link>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
