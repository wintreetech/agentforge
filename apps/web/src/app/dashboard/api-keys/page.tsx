import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { revokeApiKeyAction } from "@/app/actions/account";
import { DashHeader } from "@/components/dash";
import { Badge, Table, buttonClass } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { CreateKeyForm } from "./create-key-form";

export const metadata = { title: "API keys" };

export default async function ApiKeys() {
  const user = await requireUser();
  const keys = await read((db) => db.apiKeys.filter((k) => k.userId === user.id).reverse());
  return (
    <>
      <DashHeader title="API keys" intro={<>Use keys to call the <Link href="/developers/api" className="text-accent-2">AgentForge REST API</Link>. Keys are hashed at rest (SHA-256) and shown only once.</>} />
      <CreateKeyForm />
      {keys.length > 0 && (
        <Table className="mt-6">
          <thead><tr><th>Name</th><th>Prefix</th><th>Created</th><th>Last used</th><th>Status</th><th /></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="font-medium">{k.name}</td>
                <td><code className="font-mono text-[12.5px]">{k.prefix}…</code></td>
                <td className="text-muted">{fmtDateTime(k.createdAt)}</td>
                <td className="text-muted">{fmtDateTime(k.lastUsedAt)}</td>
                <td><Badge tone={k.revokedAt ? "danger" : "success"}>{k.revokedAt ? "revoked" : "active"}</Badge></td>
                <td className="text-right">
                  {!k.revokedAt && (
                    <form action={revokeApiKeyAction}><input type="hidden" name="id" value={k.id} /><button className={buttonClass("danger", "sm")}>Revoke</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
