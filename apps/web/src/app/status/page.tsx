import type { Metadata } from "next";
import { CheckCircle2, CircleSlash, XCircle } from "lucide-react";
import { runHealthChecks } from "@/lib/health";
import { Card, Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "System status", alternates: { canonical: "/status" } };
export const dynamic = "force-dynamic";

export default async function Status() {
  const checks = await runHealthChecks();
  const worst = checks.some((c) => c.state === "down") ? "Degraded" : "Operational";
  return (
    <>
      <PageHeader eyebrow="System status" title={worst === "Operational" ? "Configured services are operational" : "Some services have problems"} intro={`Live checks run when this page loads (${new Date().toUTCString()}). Services that are not configured in this environment are shown as such — we don't report uptime we don't measure.`} />
      <Container className="max-w-3xl py-12">
        <Card className="divide-y divide-border">
          {checks.map((c) => (
            <div key={c.name} className="flex items-start gap-3 p-4">
              {c.state === "up" ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : c.state === "down" ? <XCircle className="mt-0.5 size-5 text-danger" /> : <CircleSlash className="mt-0.5 size-5 text-subtle" />}
              <div className="flex-1"><p className="font-medium">{c.name}</p><p className="text-[13px] text-muted">{c.detail}</p></div>
              <span className="text-[12.5px] text-subtle">{c.state === "not_configured" ? "not configured" : c.state}{c.ms != null ? ` · ${c.ms} ms` : ""}</span>
            </div>
          ))}
        </Card>
        <p className="mt-4 text-[12.5px] text-subtle">Machine-readable: <a href="/api/health" className="underline">/api/health</a>. Historical uptime monitoring is not configured.</p>
      </Container>
    </>
  );
}
