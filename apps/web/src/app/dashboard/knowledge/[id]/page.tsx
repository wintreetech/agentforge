import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { deleteKbAction, deleteKbDocAction, uploadKbDocAction } from "@/app/actions/account";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/forms";
import { DashHeader } from "@/components/dash";
import { Card, EmptyState, Input, Label, Textarea, buttonClass } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export default async function KbDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const kb = await read((db) => db.knowledgeBases.find((k) => k.id === id && k.userId === user.id));
  if (!kb) notFound();
  const docs = await read((db) => db.kbDocuments.filter((d) => d.kbId === id && d.userId === user.id).map((d) => ({ id: d.id, name: d.name, pages: d.pages.length, bytes: d.bytes, createdAt: d.createdAt, preview: d.pages.join(" ").slice(0, 160) })));
  return (
    <>
      <DashHeader
        title={kb.name}
        intro={<>Use it from the <Link href="/dashboard/tools/ai-knowledge-base-agent" className="text-accent-2">Knowledge Base Agent</Link> or a retrieval node in Agent Studio.</>}
        actions={<form action={deleteKbAction}><input type="hidden" name="id" value={kb.id} /><button className={buttonClass("danger", "sm")}>Delete knowledge base</button></form>}
      />
      <Card className="p-5">
        <p className="font-semibold">Add a document</p>
        <ActionForm action={uploadKbDocAction} className="mt-4 space-y-3" resetOnSuccess>
          <input type="hidden" name="kbId" value={kb.id} />
          <div><Label htmlFor="f">File (PDF, TXT, MD — up to 5 MB)</Label><input id="f" name="file" type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" className="block w-full rounded-xl border border-dashed border-border-strong p-3 text-[13px] text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-fg" /></div>
          <p className="text-[12.5px] text-subtle">or paste text</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <div><Label htmlFor="t">Title</Label><Input id="t" name="title" maxLength={120} placeholder="e.g. Leave policy" /></div>
            <div><Label htmlFor="x">Text</Label><Textarea id="x" name="text" rows={3} maxLength={400000} /></div>
          </div>
          <SubmitButton>Add to knowledge base</SubmitButton>
        </ActionForm>
      </Card>
      <div className="mt-6">
        {docs.length === 0 ? <EmptyState icon={<FileText className="size-5" />} title="No documents yet" /> : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {docs.map((d) => (
              <li key={d.id} className="flex items-start gap-3 p-4">
                <FileText className="mt-0.5 size-4 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.name}</p>
                  <p className="text-[12.5px] text-subtle">{d.pages} page{d.pages === 1 ? "" : "s"} · {(d.bytes / 1024).toFixed(1)} KB · {fmtDate(d.createdAt)}</p>
                  <p className="mt-1 truncate text-[13px] text-muted">{d.preview}</p>
                </div>
                <form action={deleteKbDocAction}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="kbId" value={kb.id} /><button className={buttonClass("ghost", "sm", "text-danger")}>Remove</button></form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
