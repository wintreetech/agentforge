"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { newsletterAction } from "@/app/actions/shop";
import { buttonClass, Input } from "./ui";
import { cn } from "@/lib/utils";

export function SubmitButton({ children, variant = "primary", size = "md", className, pendingText }: { children: ReactNode; variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, size, className)} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function NewsletterForm({ source = "footer", compact = false }: { source?: string; compact?: boolean }) {
  const [state, action] = useActionState(newsletterAction, undefined);
  if (state?.ok) return <p className="text-sm text-success" role="status">Thanks, you’re subscribed. You can unsubscribe at any time.</p>;
  return (
    <form action={action} className={cn("space-y-2.5", compact && "max-w-md")}>
      <input type="hidden" name="source" value={source} />
      <div className="flex gap-2">
        <label htmlFor={`nl-${source}`} className="sr-only">Email address</label>
        <Input id={`nl-${source}`} name="email" type="email" required placeholder="you@company.com" autoComplete="email" />
        <SubmitButton>Subscribe</SubmitButton>
      </div>
      <label className="flex items-start gap-2 text-[12.5px] text-muted">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-[var(--accent)]" />
        <span>Send me product releases and guides, about twice a month. See the <Link href="/legal/privacy" className="underline underline-offset-2">Privacy Policy</Link>.</span>
      </label>
      {state?.error && <p className="text-[12.5px] text-danger" role="alert">{state.error}</p>}
    </form>
  );
}
