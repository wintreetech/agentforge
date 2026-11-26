import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { DashHeader } from "@/components/dash";
import { Badge, Card, EmptyState } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Contact messages" };

export default async function AdminMessages() {
  await requireAdmin();
  const messages = await read((db) => db.contactMessages.slice(-100).reverse());
  return (
    <>
      <DashHeader title="Contact messages" intro="Messages sent through the public contact form." />
      {messages.length === 0 ? (
        <EmptyState title="No messages yet" />
      ) : (
        <div className="space-y-2">
          {messages.map((m) => (
            <Card key={m.id} className="p-4 text-[13.5px]">
              <p className="font-medium">{m.name} · {m.email} <Badge>{m.topic}</Badge></p>
              <p className="mt-1 whitespace-pre-wrap text-muted">{m.message}</p>
              <p className="mt-1 text-[12px] text-subtle">{fmtDateTime(m.createdAt)}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
