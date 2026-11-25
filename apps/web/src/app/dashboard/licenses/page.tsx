import { KeyRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { getProducts } from "@/lib/catalog";
import { DashHeader } from "@/components/dash";
import { Badge, EmptyState, Table } from "@/components/ui";
import { fmtDate, licenseLabel } from "@/lib/utils";

export const metadata = { title: "Licence keys" };

export default async function Licenses() {
  const user = await requireUser();
  const [keys, products] = await Promise.all([read((db) => db.licenseKeys.filter((k) => k.userId === user.id).reverse()), getProducts()]);
  return (
    <>
      <DashHeader title="Licence keys" intro={<>One key per purchased product. Verify keys programmatically with <code className="rounded bg-surface-2 px-1 font-mono text-[12.5px]">POST /api/v1/licenses/verify</code>.</>} />
      {keys.length === 0 ? <EmptyState icon={<KeyRound className="size-5" />} title="No licence keys yet" /> : (
        <Table>
          <thead><tr><th>Product</th><th>Licence</th><th>Key</th><th>Status</th><th>Issued</th></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.key}>
                <td className="font-medium">{products.find((p) => p.slug === k.slug)?.title ?? k.slug}</td>
                <td>{licenseLabel[k.license]}</td>
                <td><code className="select-all font-mono text-[12.5px]">{k.key}</code></td>
                <td><Badge tone={k.status === "active" ? "success" : "danger"}>{k.status}</Badge></td>
                <td className="text-muted">{fmtDate(k.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
