import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { env } from "@/lib/env";
import { Container, EmptyState, Notice } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Dev outbox", robots: { index: false } };

/** Development-only mail viewer. Shows only mail sent to the signed-in user (all mail for admins). Disabled in production. */
export default async function Outbox() {
  if (env.isProd) notFound();
  const user = await getUser();
  const mails = await read((db) => db.outbox.filter((m) => user && (user.role === "admin" || m.to === user.email)).slice(-30).reverse());
  return (
    <Container className="max-w-3xl py-12">
      <h1 className="text-2xl font-semibold">Development mail outbox</h1>
      <Notice tone="sandbox" className="mt-4">No email provider is configured. Emails are stored here instead of being sent. This page is disabled in production.</Notice>
      <div className="mt-6 space-y-3">
        {!user && <EmptyState title="Sign in to see your emails" />}
        {user && mails.length === 0 && <EmptyState title="No emails yet" />}
        {mails.map((m) => (
          <article key={m.id} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-[12px] text-subtle">To {m.to} · {fmtDateTime(m.createdAt)}</p>
            <p className="mt-1 font-medium">{m.subject}</p>
            <div className="mt-2 whitespace-pre-wrap break-words text-[13.5px] text-muted">
              {m.body.split(/(https?:\/\/\S+)/).map((part, i) => (/^https?:\/\//.test(part) && part.startsWith(env.appUrl) ? <a key={i} href={part.replace(env.appUrl, "")} className="text-accent-2 underline">{part}</a> : part))}
            </div>
          </article>
        ))}
      </div>
    </Container>
  );
}
