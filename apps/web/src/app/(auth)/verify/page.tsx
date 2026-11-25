import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { resendVerificationAction, verifyEmail } from "@/app/actions/auth";
import { env } from "@/lib/env";
import { SubmitButton } from "@/components/forms";
import { LinkButton, Notice } from "@/components/ui";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };

async function confirm(fd: FormData) {
  "use server";
  const ok = await verifyEmail(String(fd.get("token") ?? ""));
  redirect(ok ? "/dashboard?verified=1" : "/verify?invalid=1");
}

export default async function Verify({ searchParams }: { searchParams: Promise<{ token?: string; sent?: string; invalid?: string }> }) {
  const sp = await searchParams;
  const user = await getUser();
  if (sp.token) {
    // Confirmation requires a click (POST) so link scanners can't verify on the user's behalf.
    return (
      <AuthShell title="Confirm your email">
        <form action={confirm}>
          <input type="hidden" name="token" value={sp.token} />
          <SubmitButton size="lg" className="w-full">Confirm email address</SubmitButton>
        </form>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Verify your email" intro={user?.emailVerifiedAt ? "Your email is verified." : `We sent a confirmation link to ${user?.email ?? "your inbox"}.`}>
      {sp.invalid && <Notice tone="danger" className="mb-4">That link is invalid or has expired. Request a new one.</Notice>}
      {!env.isProd && (
        <Notice tone="sandbox" className="mb-4" title="Development mail outbox">
          No email provider is configured, so messages are stored locally. Open the <Link href="/dev/outbox" className="underline">dev outbox</Link> to click the link.
        </Notice>
      )}
      {user && !user.emailVerifiedAt && (
        <form action={resendVerificationAction}><SubmitButton variant="outline" className="w-full">Resend verification email</SubmitButton></form>
      )}
      {user?.emailVerifiedAt && <LinkButton href="/dashboard" className="w-full">Go to dashboard</LinkButton>}
      {!user && <LinkButton href="/signin" className="w-full">Sign in</LinkButton>}
    </AuthShell>
  );
}
