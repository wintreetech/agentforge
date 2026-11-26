import { Download, FileCode } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { DELIVERABLES, listDeliverableFiles, signDownload } from "@/lib/delivery";
import { ownedProducts } from "@/lib/owned";
import { DashHeader } from "@/components/dash";
import { Card, EmptyState, LinkButton, Table, buttonClass } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Downloads" };

export default async function Downloads() {
  const user = await requireUser();
  const owned = (await ownedProducts(user.id)).filter((o) => DELIVERABLES[o.product.slug]);
  const history = await read((db) => db.downloads.filter((d) => d.userId === user.id).slice(-30).reverse());
  const files = await Promise.all(owned.map((o) => listDeliverableFiles(o.product.slug)));
  return (
    <>
      <DashHeader title="Downloads" intro="Versioned packages for products you own. Download links are signed, tied to your account and expire after 5 minutes; refresh this page for a new one." />
      {owned.length === 0 ? (
        <EmptyState icon={<Download className="size-5" />} title="No downloadable products" action={<LinkButton href="/category/developer-kits">Browse developer kits</LinkButton>}>Source-code kits and workflow templates you buy appear here.</EmptyState>
      ) : (
        <div className="space-y-4">
          {owned.map((o, i) => (
            <Card key={o.product.slug} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{o.product.title}</p>
                  <p className="text-[13px] text-muted">Version {DELIVERABLES[o.product.slug].version} · {files[i].length} files · {(files[i].reduce((s, f) => s + f.bytes, 0) / 1024).toFixed(0)} KB</p>
                </div>
                <a href={`/api/downloads/${encodeURIComponent(signDownload(user.id, o.product.slug))}`} className={buttonClass("primary")} download><Download className="size-4" /> Download ZIP</a>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-[13px] text-muted">Package contents</summary>
                <ul className="mt-2 grid gap-1 font-mono text-[12px] text-muted sm:grid-cols-2">
                  {files[i].map((f) => <li key={f.path} className="flex items-center gap-1.5"><FileCode className="size-3.5 shrink-0" />{f.path}</li>)}
                </ul>
              </details>
            </Card>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-semibold">Download history</h2>
          <Table><thead><tr><th>Product</th><th>Version</th><th>When</th></tr></thead><tbody>{history.map((h) => <tr key={h.id}><td>{h.slug}</td><td>{h.version}</td><td className="text-muted">{fmtDateTime(h.at)}</td></tr>)}</tbody></Table>
        </div>
      )}
    </>
  );
}
