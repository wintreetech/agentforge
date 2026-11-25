"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  consumeEmailToken,
  createSession,
  destroySession,
  getAnonKey,
  getUser,
  hashPassword,
  passwordProblems,
  registerUser,
  sendEmailToken,
  signInWithPassword,
} from "@/lib/auth";
import { mergeCarts } from "@/lib/commerce";
import { audit, mutate, now, read } from "@/lib/db";
import { rateLimit } from "@/lib/security";
import { headers } from "next/headers";

type State = { error?: string; ok?: string } | undefined;

const safeNext = (n: FormDataEntryValue | null) => {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
};

async function limited(bucket: string) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  return !rateLimit(`${bucket}:${ip}`, 10, 10 * 60_000).ok;
}

export async function signUpAction(_: State, fd: FormData): Promise<State> {
  if (await limited("signup")) return { error: "Too many attempts. Try again in a few minutes." };
  const s = z
    .object({ name: z.string().trim().min(2, "Enter your name.").max(120), email: z.string().trim().email("Enter a valid email.").max(200), password: z.string() })
    .safeParse(Object.fromEntries(fd));
  if (!s.success) return { error: s.error.issues[0].message };
  const pw = passwordProblems(s.data.password);
  if (pw) return { error: pw };
  if (fd.get("terms") !== "on") return { error: "Please accept the Terms of Service and Privacy Policy." };
  const r = await registerUser({ ...s.data, marketingConsent: fd.get("marketing") === "on" });
  if (!r.ok) return { error: r.error };
  const autoVerified = process.env.AUTO_VERIFY_EMAIL === "true";
  if (!autoVerified) await sendEmailToken(r.userId, "verify");
  await createSession(r.userId);
  await mergeCarts(await getAnonKey(), r.userId);
  await audit(r.userId, "auth.signup", r.userId);
  redirect(autoVerified ? "/dashboard" : "/verify?sent=1");
}

export async function signInAction(_: State, fd: FormData): Promise<State> {
  if (await limited("signin")) return { error: "Too many attempts. Try again in a few minutes." };
  const email = String(fd.get("email") ?? "");
  const password = String(fd.get("password") ?? "");
  const u = await signInWithPassword(email, password);
  if (!u) return { error: "Email or password is incorrect." };
  await mergeCarts(await getAnonKey(), u.id);
  redirect(safeNext(fd.get("next")));
}

export async function signOutAction() {
  await destroySession();
  redirect("/");
}

export async function resendVerificationAction() {
  const u = await getUser();
  if (!u) redirect("/signin");
  if (!(await limited("verify"))) await sendEmailToken(u.id, "verify");
  redirect("/verify?sent=1");
}

export async function forgotPasswordAction(_: State, fd: FormData): Promise<State> {
  if (await limited("forgot")) return { error: "Too many attempts. Try again later." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const u = await read((db) => db.users.find((x) => x.email === email && !x.deletedAt));
  if (u) await sendEmailToken(u.id, "reset");
  // Same response whether or not the account exists (no enumeration).
  return { ok: "If an account exists for that email, we've sent a reset link." };
}

export async function resetPasswordAction(_: State, fd: FormData): Promise<State> {
  const pw = String(fd.get("password") ?? "");
  const problem = passwordProblems(pw);
  if (problem) return { error: problem };
  const userId = await consumeEmailToken(String(fd.get("token") ?? ""), "reset");
  if (!userId) return { error: "This reset link is invalid or has expired." };
  const hash = await hashPassword(pw);
  await mutate((db) => {
    const u = db.users.find((x) => x.id === userId);
    if (u) u.passwordHash = hash;
    db.sessions = db.sessions.filter((s) => s.userId !== userId); // sign out everywhere
  });
  await audit(userId, "auth.password_reset", userId);
  return { ok: "Password updated. You can sign in now." };
}

export async function verifyEmail(token: string): Promise<boolean> {
  const userId = await consumeEmailToken(token, "verify");
  if (!userId) return false;
  await mutate((db) => {
    const u = db.users.find((x) => x.id === userId);
    if (u && !u.emailVerifiedAt) u.emailVerifiedAt = now();
  });
  await audit(userId, "auth.email_verified", userId);
  return true;
}
