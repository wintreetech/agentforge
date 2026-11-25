import { requireUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { env } from "@/lib/env";
import { removeProviderKeyAction, saveProviderKeyAction } from "@/app/actions/account";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/forms";
import { DashHeader } from "@/components/dash";
import { Badge, Card, Input, Label, Notice, Select, buttonClass } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Integrations" };

const PROVIDERS = [
  { id: "anthropic", name: "Anthropic", hint: "sk-ant-…" },
  { id: "openai", name: "OpenAI", hint: "sk-…" },
  { id: "gemini", name: "Google Gemini", hint: "AIza…" },
] as const;

export default async function Integrations() {
  const user = await requireUser();
  const mine = await read((db) => db.providerSecrets.filter((s) => s.userId === user.id));
  return (
    <>
      <DashHeader title="Integrations" intro="Bring your own AI provider keys. Runs of products you own then use your key, and the provider bills you directly (no AgentForge credits are used for those runs)." />
      <div className="grid gap-4 md:grid-cols-3">
        {PROVIDERS.map((p) => {
          const k = mine.find((m) => m.provider === p.id);
          const platform = !!env.providerKeys[p.id];
          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-center justify-between"><p className="font-semibold">{p.name}</p><Badge tone={k ? "success" : "neutral"}>{k ? "Your key" : "Not connected"}</Badge></div>
              <p className="mt-2 text-[13px] text-muted">{k ? `Key ending …${k.last4}, added ${fmtDate(k.createdAt)}.` : platform ? "Platform key available for included credits." : "No platform key configured in this environment."}</p>
              {k && (
                <form action={removeProviderKeyAction} className="mt-3"><input type="hidden" name="provider" value={p.id} /><button className={buttonClass("danger", "sm")}>Remove key</button></form>
              )}
            </Card>
          );
        })}
      </div>
      <Card className="mt-6 p-5">
        <p className="font-semibold">Add or replace a key</p>
        <ActionForm action={saveProviderKeyAction} className="mt-4" resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">
            <div><Label htmlFor="prov">Provider</Label><Select id="prov" name="provider">{PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
            <div><Label htmlFor="pkey">API key</Label><Input id="pkey" name="key" type="password" autoComplete="off" required placeholder="Paste key" /></div>
            <SubmitButton>Save key</SubmitButton>
          </div>
        </ActionForm>
        <p className="mt-3 text-[12.5px] text-subtle">Keys are encrypted at rest with AES-256-GCM, never sent to your browser after saving, and only used server-side for your own runs.</p>
      </Card>
      <Notice className="mt-6" title="Automation and app integrations">
        Workflow products connect to Gmail, HubSpot, Slack and others inside n8n using credentials you manage there. Agent Studio can call external APIs through API-request nodes restricted to hosts you allowlist, with human approval.
      </Notice>
    </>
  );
}
