import Link from "next/link";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { allIndustries, allIntegrations, categories, filterProducts, parseQuery, type ProductQuery } from "@agentforge/catalog";
import { getPopularity, getProducts } from "@/lib/catalog";
import { MarketplaceFilters, SortAndView } from "./marketplace-filters";
import { ProductCard } from "./product-card";
import { EmptyState, buttonClass } from "./ui";
import { cn } from "@/lib/utils";

/** Server-rendered, URL-driven catalogue browser shared by /marketplace and /category/[slug]. */
export async function CatalogBrowser({ searchParams, fixed, basePath }: { searchParams: Record<string, string | string[] | undefined>; fixed?: Partial<ProductQuery>; basePath: string }) {
  const [products, popularity] = await Promise.all([getProducts(), getPopularity()]);
  const query = { ...parseQuery(searchParams), ...fixed, perPage: 12 };
  const result = filterProducts(products, query, popularity);
  const scope = fixed?.category ? products.filter((p) => fixed.category!.includes(p.category)) : products;
  const view = searchParams.view === "list" ? "list" : "grid";
  const facets = {
    categories: categories.map((c) => ({ value: c.slug, label: c.name, count: products.filter((p) => p.category === c.slug).length })),
    providers: ["OpenAI", "Anthropic", "Google Gemini"],
    integrations: allIntegrations(scope).filter((i) => !/clipboard/i.test(i)),
    industries: allIndustries(scope),
    difficulties: ["beginner", "intermediate", "advanced"],
    licenses: [...new Set(scope.map((p) => p.license))],
    hideCategory: !!fixed?.category,
  };
  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string") p.set(k, v);
    p.set("page", String(n));
    return `${basePath}?${p.toString()}`;
  };

  return (
    <div className="grid grid-cols-1 [&>*]:min-w-0 gap-8 lg:grid-cols-[260px_1fr]">
      <Suspense fallback={<div className="skeleton h-96 rounded-2xl" />}>
        <MarketplaceFilters facets={facets} total={result.total} />
      </Suspense>
      <div className="min-w-0">
        <Suspense>
          <SortAndView total={result.total} />
        </Suspense>
        {result.items.length === 0 ? (
          <div className="mt-6">
            <EmptyState icon={<SearchX className="size-5" />} title="No products match these filters" action={<Link href={basePath} className={buttonClass("outline", "sm")}>Clear filters</Link>}>
              Try a wider price range, fewer filters, or describe your problem to the <Link href="/assistant" className="text-accent-2 underline">product assistant</Link>.
            </EmptyState>
          </div>
        ) : (
          <div className={cn("mt-5 grid gap-5", view === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
            {result.items.map((p, i) => <ProductCard key={p.slug} p={p} view={view} priority={i < 3} />)}
          </div>
        )}
        {result.pages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Pagination">
            {result.page > 1 && <Link href={pageHref(result.page - 1)} className={buttonClass("outline", "sm")} rel="prev">Previous</Link>}
            {Array.from({ length: result.pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={pageHref(n)} aria-current={n === result.page ? "page" : undefined} className={cn(buttonClass(n === result.page ? "secondary" : "ghost", "sm"), "min-w-8")}>{n}</Link>
            ))}
            {result.page < result.pages && <Link href={pageHref(result.page + 1)} className={buttonClass("outline", "sm")} rel="next">Next</Link>}
          </nav>
        )}
      </div>
    </div>
  );
}
