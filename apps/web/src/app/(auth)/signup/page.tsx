import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { AuthShell } from "../auth-shell";
import { SignUpForm } from "../auth-forms";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function SignUp() {
  if (await getUser()) redirect("/dashboard");
  return (
    <AuthShell title="Create your workspace" intro="Free to create. Try products in the Playground; pay only for what you buy.">
      <SignUpForm googleEnabled={!!env.googleClientId} />
    </AuthShell>
  );
}
