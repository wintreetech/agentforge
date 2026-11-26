import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getProducts } from "@/lib/catalog";
import { StatusBadge } from "@/components/product-card";
import { Container, PageHeader } from "@/components/ui";
import { deliveryShort, eur, licenseLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Compare products", robots: { index: false } };

export default async function Compare({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const products = await getProducts();
  const chosen = (ids ?? "").split(",").map((s) => products.find((p) => p.slug === s.trim())).filter((p) => !!p).slice(0, 4);
  const others = products.filter((p) => !chosen.includes(p) && (!chosen.length || p.category === chosen[0].category)).slice(0, 12);
  const rows: [string, (p: (typeof products)[number]) => React.ReactNode][] = [
    ["Price", (p) => <span className="font-semibold">{eur(p.priceCents)}</span>],
    ["Status", (p) => <StatusBadge status={p.status} />],
    ["Delivery", (p) => deliveryShort[p.delivery]],
    ["Hosting", (p) => (p.hosting === "both" ? "Hosted or self-hosted" : p.hosting)],
    ["Difficulty", (p) => p.difficulty],
    ["Cost per run", (p) => (p.costPerRunEur ? `€${p.costPerRunEur[0].toFixed(3)}–€${p.costPerRunEur[1].toFixed(2)}` : "—")],
    ["Capabilities", (p) => <ul className="list-disc space-y-1 pl-4">{p.capabilities.map((c) => <li key={c}>{c}</li>)}</ul>],
    ["Integrations", (p) => p.integrations.join(", ")],
    ["Inputs", (p) => p.inputs.join(", ")],
    ["Outputs", (p) => p.outputs.join(", ")],
  ];
  const href = (add: string) => `/compare?ids=${[...chosen.map((c) => c.slug), add].join(",")}`;
  return (
    <>
      <PageHeader eyebrow="Compare" title="Compare products side by side" intro="Add up to four products. Comparisons use the same data as the product pages." />
      <Container className="py-10">
        {chosen.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[760px] text-left text-[13.5px]">
              <thead>
                <tr>
                  <th className="w-40 bg-surface-2/50 p-4" />
                  {chosen.map((p) => (
                    <th key={p.slug} className="bg-surface-2/50 p-4 align-top font-normal">
                      <Image src={p.thumbnail} alt="" width={240} height={160} className="aspect-[3/2] w-full rounded-lg object-cover" />
                      <Link href={`/products/${p.slug}`} className="mt-2 block font-semibold hover:underline">{p.title}</Link>
                      <Link href={`/compare?ids=${chosen.filter((c) => c !== p).map((c) => c.slug).join(",")}`} className="text-[12px] text-subtle hover:text-danger">Remove</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, fn]) => (
                  <tr key={label} className="border-t border-border align-top">
                    <th scope="row" className="p-4 text-[12.5px] font-medium text-muted">{label}</th>
                    {chosen.map((p) => <td key={p.slug} className="p-4">{fn(p)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {chosen.length < 4 && (
          <div className="mt-8">
            <p className="font-medium">{chosen.length ? "Add another product" : "Choose products to compare"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {others.map((o) => <Link key={o.slug} href={href(o.slug)} className="rounded-full border border-border px-3 py-1 text-[13px] text-muted hover:border-border-strong hover:text-fg">+ {o.title}</Link>)}
            </div>
          </div>
        )}
      </Container>
    </>
  );
}
