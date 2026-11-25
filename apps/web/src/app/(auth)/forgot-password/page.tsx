import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { ForgotForm } from "../auth-forms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function Forgot() {
  return (
    <AuthShell title="Reset your password" intro="Enter your email and we'll send a reset link valid for one hour.">
      <ForgotForm />
    </AuthShell>
  );
}
