import { runHealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = await runHealthChecks();
  const down = checks.some((c) => c.state === "down");
  return Response.json({ status: down ? "degraded" : "ok", checks, at: new Date().toISOString() }, { status: down ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
