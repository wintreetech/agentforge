import type { Metadata } from "next";
import { Notice } from "@/components/ui";
import { AuthShell } from "../auth-shell";
import { ResetForm } from "../auth-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Choose a new password" intro="You'll be signed out of other sessions.">
      {token ? <ResetForm token={token} /> : <Notice tone="danger">Missing reset token. Use the link from your email.</Notice>}
    </AuthShell>
  );
}
