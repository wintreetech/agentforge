"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms";
import { Field, Input, Notice, buttonClass } from "@/components/ui";

function GoogleButton({ enabled }: { enabled: boolean }) {
  return (
    <button type="button" disabled={!enabled} title={enabled ? undefined : "Google sign-in is not configured in this environment (set GOOGLE_CLIENT_ID)."} className={buttonClass("outline", "lg", "w-full")}>
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14zM12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" /></svg>
      Continue with Google {!enabled && <span className="text-[11px] text-subtle">(not configured)</span>}
    </button>
  );
}

export function SignInForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const [state, action] = useActionState(signInAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <GoogleButton enabled={googleEnabled} />
      <div className="flex items-center gap-3 text-[12px] text-subtle"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <SubmitButton size="lg" className="w-full">Sign in</SubmitButton>
      <div className="flex justify-between text-[13px]">
        <Link href="/forgot-password" className="text-muted hover:text-fg">Forgot password?</Link>
        <Link href={`/signup${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent-2">Create an account</Link>
      </div>
    </form>
  );
}

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, action] = useActionState(signUpAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <GoogleButton enabled={googleEnabled} />
      <div className="flex items-center gap-3 text-[12px] text-subtle"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
      <Field label="Full name" htmlFor="name"><Input id="name" name="name" autoComplete="name" required maxLength={120} /></Field>
      <Field label="Work email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" htmlFor="password" help="At least 10 characters, with letters and numbers or symbols."><Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} /></Field>
      <label className="flex items-start gap-2 text-[13px] text-muted"><input type="checkbox" name="terms" required className="mt-0.5 accent-[var(--accent)]" />I agree to the <Link href="/legal/terms" className="underline">Terms</Link> and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.</label>
      <label className="flex items-start gap-2 text-[13px] text-muted"><input type="checkbox" name="marketing" className="mt-0.5 accent-[var(--accent)]" />Email me product updates (optional).</label>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <SubmitButton size="lg" className="w-full">Create account</SubmitButton>
      <p className="text-center text-[13px] text-muted">Already have an account? <Link href="/signin" className="font-medium text-accent-2">Sign in</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required /></Field>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      {state?.ok && <Notice tone="success">{state.ok}</Notice>}
      <SubmitButton size="lg" className="w-full">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, undefined);
  if (state?.ok) return <div className="space-y-4"><Notice tone="success">{state.ok}</Notice><Link href="/signin" className={buttonClass("primary", "lg", "w-full")}>Sign in</Link></div>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password" help="At least 10 characters."><Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} /></Field>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <SubmitButton size="lg" className="w-full">Set new password</SubmitButton>
    </form>
  );
}
