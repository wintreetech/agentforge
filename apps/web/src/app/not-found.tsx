import { Container, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-mono text-[13px] text-subtle">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
      <p className="mt-2 max-w-md text-muted">The link may be outdated, or the product may have been archived.</p>
      <div className="mt-6 flex gap-3"><LinkButton href="/marketplace">Browse the marketplace</LinkButton><LinkButton href="/" variant="outline">Home</LinkButton></div>
    </Container>
  );
}
