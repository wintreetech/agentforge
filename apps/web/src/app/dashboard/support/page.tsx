import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { createTicketAction, replyTicketAction } from "@/app/actions/account";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/forms";
import { DashHeader } from "@/components/dash";
import { Badge, Card, Input, Label, Textarea } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Support" };

export default async function Support() {
  const user = await requireUser();
  const tickets = await read((db) => db.tickets.filter((t) => t.userId === user.id).reverse());
  return (
    <>
      <DashHeader title="Support" intro={<>Check the <Link href="/help" className="text-accent-2">Help center</Link> first; otherwise open a ticket and we&apos;ll reply here.</>} />
      <Card className="p-5">
        <p className="font-semibold">New ticket</p>
        <ActionForm action={createTicketAction} className="mt-4 space-y-3" resetOnSuccess>
          <div><Label htmlFor="s">Subject</Label><Input id="s" name="subject" required minLength={4} maxLength={140} /></div>
          <div><Label htmlFor="b">How can we help?</Label><Textarea id="b" name="body" rows={4} required minLength={10} maxLength={5000} /></div>
          <SubmitButton>Submit ticket</SubmitButton>
        </ActionForm>
      </Card>
      <div className="mt-6 space-y-4">
        {tickets.map((t) => (
          <Card key={t.id} className="p-5">
            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{t.subject}</p><Badge tone={t.status === "answered" ? "accent" : t.status === "closed" ? "neutral" : "warning"}>{t.status}</Badge><span className="ml-auto text-[12px] text-subtle">{fmtDateTime(t.createdAt)}</span></div>
            <ul className="mt-3 space-y-2">
              {t.messages.map((m, i) => (
                <li key={i} className={`rounded-xl p-3 text-[13.5px] ${m.from === "staff" ? "bg-accent/8 border border-accent/20" : "bg-surface-2"}`}>
                  <p className="text-[12px] text-subtle">{m.from === "staff" ? "AgentForge support" : "You"} · {fmtDateTime(m.at)}</p>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </li>
              ))}
            </ul>
            {t.status !== "closed" && (
              <form action={replyTicketAction} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={t.id} />
                <label htmlFor={`r-${t.id}`} className="sr-only">Reply</label>
                <Input id={`r-${t.id}`} name="body" placeholder="Reply…" required />
                <SubmitButton variant="outline">Send</SubmitButton>
              </form>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
