import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AuthShell } from "../auth-shell";
import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safe = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (await getUser()) redirect(safe);
  return (
    <AuthShell title="Welcome back" intro="Sign in to your AgentForge workspace.">
      <SignInForm next={safe} />
    </AuthShell>
  );
}
