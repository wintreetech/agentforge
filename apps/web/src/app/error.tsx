"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Container, buttonClass } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted">The error has been logged{error.digest ? ` (reference ${error.digest})` : ""}. Try again, or contact support if it keeps happening.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className={buttonClass("primary")}>Try again</button>
        <Link href="/" className={buttonClass("outline")}>Home</Link>
      </div>
    </Container>
  );
}
