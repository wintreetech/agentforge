import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { staffReplyAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/forms";
import { DashHeader } from "@/components/dash";
import { Badge, Card, EmptyState, Textarea, buttonClass } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Support tickets" };

export default async function AdminTickets() {
  await requireAdmin();
  const [tickets, users, messages] = await read((db) => [db.tickets.slice().reverse(), db.users, db.contactMessages.slice(-30).reverse()]);
  return (
    <>
      <DashHeader title="Support tickets" />
      {tickets.length === 0 && <EmptyState title="No tickets" />}
      <div className="space-y-4">
        {tickets.map((t) => (
          <Card key={t.id} className="p-5">
            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{t.subject}</p><Badge tone={t.status === "open" ? "warning" : t.status === "answered" ? "accent" : "neutral"}>{t.status}</Badge><span className="text-[12.5px] text-subtle">{users.find((u) => u.id === t.userId)?.email} · {fmtDateTime(t.createdAt)}</span></div>
            <ul className="mt-3 space-y-2">{t.messages.map((m, i) => <li key={i} className={`rounded-xl p-3 text-[13.5px] ${m.from === "staff" ? "border border-accent/20 bg-accent/8" : "bg-surface-2"}`}><p className="text-[12px] text-subtle">{m.from} · {fmtDateTime(m.at)}</p><p className="mt-1 whitespace-pre-wrap">{m.body}</p></li>)}</ul>
            {t.status !== "closed" && (
              <form action={staffReplyAction} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={t.id} />
                <label htmlFor={`sr-${t.id}`} className="sr-only">Reply</label>
                <Textarea id={`sr-${t.id}`} name="body" rows={2} placeholder="Reply to customer…" />
                <div className="flex gap-2"><SubmitButton size="sm">Send reply</SubmitButton><button name="close" value="1" className={buttonClass("ghost", "sm")}>Close ticket</button></div>
              </form>
            )}
          </Card>
        ))}
      </div>
      <h2 className="mb-3 mt-10 font-semibold">Contact form messages</h2>
      {messages.length === 0 ? <p className="text-[13.5px] text-muted">None yet.</p> : (
        <div className="space-y-2">{messages.map((m) => <Card key={m.id} className="p-4 text-[13.5px]"><p className="font-medium">{m.name} · {m.email} <Badge>{m.topic}</Badge></p><p className="mt-1 whitespace-pre-wrap text-muted">{m.message}</p><p className="mt-1 text-[12px] text-subtle">{fmtDateTime(m.createdAt)}</p></Card>)}</div>
      )}
    </>
  );
}
