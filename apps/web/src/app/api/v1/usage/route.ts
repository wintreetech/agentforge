import { authenticateApiKey } from "@/lib/api-auth";
import { read } from "@/lib/db";

/** GET /api/v1/usage — last 30 days of runs and credit balance for the key's account. */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof Response) return auth;
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const data = await read((db) => {
    const ex = db.executions.filter((e) => e.userId === auth.userId && e.createdAt >= since);
    return {
      period_start: since,
      runs: ex.length,
      succeeded: ex.filter((e) => e.status === "succeeded").length,
      input_tokens: ex.reduce((s, e) => s + e.inputTokens, 0),
      output_tokens: ex.reduce((s, e) => s + e.outputTokens, 0),
      estimated_cost_eur: Math.round(ex.reduce((s, e) => s + e.costEur, 0) * 10000) / 10000,
      credits_balance: db.credits.filter((c) => c.userId === auth.userId).reduce((s, c) => s + c.delta, 0),
    };
  });
  return Response.json({ data }, { headers: auth.headers });
}
