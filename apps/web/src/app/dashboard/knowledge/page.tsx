import Link from "next/link";
import { Library } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { createKbAction } from "@/app/actions/account";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/forms";
import { DashHeader } from "@/components/dash";
import { Card, EmptyState, Input, Label } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Knowledge bases" };

export default async function Knowledge() {
  const user = await requireUser();
  const [kbs, docs] = await read((db) => [db.knowledgeBases.filter((k) => k.userId === user.id), db.kbDocuments.filter((d) => d.userId === user.id)]);
  return (
    <>
      <DashHeader title="Knowledge bases" intro="Private document collections used by the Knowledge Base Agent and by retrieval nodes in Agent Studio. Only you can access them." />
      <Card className="p-5">
        <ActionForm action={createKbAction}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1"><Label htmlFor="kbn">New knowledge base</Label><Input id="kbn" name="name" placeholder="e.g. Company handbook" required maxLength={80} /></div>
            <SubmitButton>Create</SubmitButton>
          </div>
        </ActionForm>
      </Card>
      <div className="mt-6">
        {kbs.length === 0 ? <EmptyState icon={<Library className="size-5" />} title="No knowledge bases yet">Create one, then upload PDFs, text or Markdown.</EmptyState> : (
          <div className="grid gap-4 sm:grid-cols-2">
            {kbs.map((k) => {
              const ds = docs.filter((d) => d.kbId === k.id);
              return (
                <Link key={k.id} href={`/dashboard/knowledge/${k.id}`} className="rounded-2xl border border-border bg-surface p-5 transition hover:border-border-strong">
                  <p className="font-semibold">{k.name}</p>
                  <p className="mt-1 text-[13px] text-muted">{ds.length} document{ds.length === 1 ? "" : "s"} · {(ds.reduce((s, d) => s + d.bytes, 0) / 1024).toFixed(0)} KB · created {fmtDate(k.createdAt)}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
