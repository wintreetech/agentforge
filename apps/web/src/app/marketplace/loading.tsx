import { ProductCardSkeleton } from "@/components/product-card";
import { Container } from "@/components/ui";

export default function Loading() {
  return (
    <Container className="py-10" aria-busy="true" aria-label="Loading products">
      <div className="skeleton mb-10 h-40 rounded-3xl" />
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-8 lg:grid-cols-[260px_1fr]">
        <div className="skeleton hidden h-96 rounded-2xl lg:block" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
      </div>
    </Container>
  );
}
