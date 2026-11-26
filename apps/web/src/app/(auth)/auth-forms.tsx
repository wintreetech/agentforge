"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms";
import { Field, Input, Notice, buttonClass } from "@/components/ui";

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
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

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, undefined);
  return (
    <form action={action} className="space-y-4">
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
