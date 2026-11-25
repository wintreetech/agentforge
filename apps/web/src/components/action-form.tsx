"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Notice } from "./ui";

type State = { error?: string; ok?: string } | undefined;

/** Generic progressive-enhancement form wrapper that shows a server action's result. */
export function ActionForm({ action, children, className, resetOnSuccess = false }: { action: (s: State, fd: FormData) => Promise<State>; children: ReactNode; className?: string; resetOnSuccess?: boolean }) {
  const [state, formAction] = useActionState(action, undefined);
  const [submits, setSubmits] = useState(0);
  return (
    <form action={formAction} onSubmit={() => setSubmits((n) => n + 1)} className={className} key={resetOnSuccess && state?.ok ? `ok-${submits}` : "form"}>
      {children}
      {state?.error && <Notice tone="danger" className="mt-3">{state.error}</Notice>}
      {state?.ok && <Notice tone="success" className="mt-3">{state.ok}</Notice>}
    </form>
  );
}
