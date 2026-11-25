import Image from "next/image";
import type { ReactNode } from "react";
import { Container } from "@/components/ui";

export function AuthShell({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <Container className="grid min-h-[calc(100vh-4rem)] items-center gap-12 py-12 lg:grid-cols-2">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="mt-2 text-muted">{intro}</p>}
        <div className="mt-8">{children}</div>
      </div>
      <div className="relative hidden aspect-square overflow-hidden rounded-3xl border border-border lg:block">
        <Image src="/assets/pages/studio.svg" alt="" fill sizes="50vw" className="object-cover" priority />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-8 text-white">
          <p className="text-xl font-semibold">Intelligence. Automated.</p>
          <p className="mt-1 text-sm opacity-80">Tools, agents and workflows with budgets, approvals and a full audit trail.</p>
        </div>
      </div>
    </Container>
  );
}
