import { requireAdmin } from "@/lib/auth";
import { read } from "@/lib/db";
import { env } from "@/lib/env";
import { saveSettingsAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/forms";
import { DashHeader } from "@/components/dash";
import { Badge, Card, Input, Label, Table } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function AdminSettings() {
  await requireAdmin();
  const s = await read((db) => db.settings);
  const flags: [string, string | boolean][] = [
    ["Payment provider", env.paymentProvider],
    ["Stripe configured", !!env.stripeSecretKey],
    ["Supabase configured", !!env.supabaseUrl],
    ["Redis configured", !!env.redisUrl],
    ["Google sign-in", !!env.googleClientId],
    ["Seller marketplace (FEATURE_SELLERS)", env.sellersEnabled],
    ["Data directory", env.dataDir],
  ];
  return (
    <>
      <DashHeader title="Platform settings" />
      <Card className="p-5">
        <ActionForm action={saveSettingsAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="c">Credits included with hosted purchases</Label><Input id="c" name="creditsPerHostedPurchase" type="number" min={0} defaultValue={s.creditsPerHostedPurchase} /></div>
          </div>
          <div><Label htmlFor="b">Homepage announcement banner (empty = hidden)</Label><Input id="b" name="maintenanceBanner" maxLength={300} defaultValue={s.maintenanceBanner} /></div>
          <SubmitButton>Save settings</SubmitButton>
        </ActionForm>
      </Card>
      <h2 className="mb-3 mt-8 font-semibold">Environment (read-only)</h2>
      <Table><tbody>{flags.map(([k, v]) => <tr key={k}><td className="text-muted">{k}</td><td>{typeof v === "boolean" ? <Badge tone={v ? "success" : "neutral"}>{v ? "yes" : "no"}</Badge> : <code className="font-mono text-[12.5px]">{v}</code>}</td></tr>)}</tbody></Table>
    </>
  );
}
