import { MODELS } from "@agentforge/ai-engine/models";
import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { env } from "@/lib/env";
import { toggleProviderAction } from "@/app/actions/admin";
import { DashHeader } from "@/components/dash";
import { Badge, Card, Notice, Table, buttonClass } from "@/components/ui";

export const metadata = { title: "AI providers" };

export default async function AdminProviders() {
  await requireAdmin();
  const disabled = await read((db) => db.settings.disabledProviders);
  const provs = [
    { id: "anthropic", name: "Anthropic", env: "ANTHROPIC_API_KEY" },
    { id: "openai", name: "OpenAI", env: "OPENAI_API_KEY" },
    { id: "gemini", name: "Google Gemini", env: "GEMINI_API_KEY" },
  ] as const;
  return (
    <>
      <DashHeader title="AI providers" intro="Platform keys come from environment variables and are never shown or sent to browsers. You can disable a provider platform-wide without removing its key." />
      <div className="grid gap-4 md:grid-cols-3">
        {provs.map((p) => {
          const configured = !!env.providerKeys[p.id];
          const off = disabled.includes(p.id);
          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-center justify-between"><p className="font-semibold">{p.name}</p><Badge tone={configured && !off ? "success" : off ? "warning" : "neutral"}>{!configured ? "not configured" : off ? "disabled" : "enabled"}</Badge></div>
              <p className="mt-2 font-mono text-[12px] text-subtle">{p.env}</p>
              <form action={toggleProviderAction} className="mt-3"><input type="hidden" name="provider" value={p.id} /><button className={buttonClass("outline", "sm")}>{off ? "Enable" : "Disable"}</button></form>
            </Card>
          );
        })}
      </div>
      {!Object.values(env.providerKeys).some(Boolean) && <Notice tone="sandbox" className="mt-6">No provider keys are configured, so all runs use the deterministic sandbox and are labelled as simulated.</Notice>}
      <h2 className="mb-3 mt-8 font-semibold">Model price table (estimates, EUR per 1M tokens)</h2>
      <Table>
        <thead><tr><th>Model</th><th>Provider</th><th>Tier</th><th className="text-right">Input</th><th className="text-right">Output</th><th className="text-right">Context</th></tr></thead>
        <tbody>{MODELS.map((m) => <tr key={m.id}><td className="font-mono text-[12.5px]">{m.id}</td><td>{m.provider}</td><td>{m.tier}</td><td className="text-right tabular-nums">€{m.inputEurPerM}</td><td className="text-right tabular-nums">€{m.outputEurPerM}</td><td className="text-right tabular-nums">{(m.contextTokens / 1000).toLocaleString("en")}k</td></tr>)}</tbody>
      </Table>
      <p className="mt-3 text-[12.5px] text-subtle">Prices are maintained in packages/ai-engine/src/models.ts and must be checked against each provider&apos;s current price list before launch.</p>
    </>
  );
}
