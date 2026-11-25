import { z } from "zod";
import { defineTool } from "../registry.ts";

/**
 * HTTPS GET restricted to an explicit host allowlist. Redirects are not
 * followed automatically (each hop would need re-validation), responses are
 * size-capped and time-limited.
 */
export function assertAllowed(raw: string, allowlist: string[]): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "https:") throw new Error("Only https URLs are allowed");
  if (url.username || url.password) throw new Error("Credentials in URLs are not allowed");
  if (url.port && url.port !== "443") throw new Error("Non-standard ports are not allowed");
  const host = url.hostname.toLowerCase();
  if (!allowlist.some((h) => host === h || host.endsWith(`.${h}`))) throw new Error(`Host ${host} is not on the allowlist`);
  return url;
}

export function createHttpGet(opts: { allowlist: string[]; maxBytes: number; fetchImpl?: typeof fetch; timeoutMs?: number }) {
  const f = opts.fetchImpl ?? fetch;
  return defineTool({
    name: "http_get",
    title: "HTTP GET (allowlisted)",
    description: `Fetch a URL over HTTPS from an allowlisted host (${opts.allowlist.join(", ") || "none configured"}). Returns status and up to ${opts.maxBytes} bytes of text.`,
    sideEffects: true,
    input: z.object({ url: z.string().url().max(2000) }),
    handler: async ({ url }) => {
      if (!opts.allowlist.length) throw new Error("http_get is disabled: MCP_HTTP_ALLOWLIST is empty");
      const target = assertAllowed(url, opts.allowlist);
      const res = await f(target, { redirect: "manual", signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000), headers: { "User-Agent": "agentforge-mcp-kit/1.0" } });
      if (res.status >= 300 && res.status < 400) return { text: `Redirect (${res.status}) to ${res.headers.get("location") ?? "unknown"} — not followed. Call http_get on that URL if it is allowlisted.` };
      const text = (await res.text()).slice(0, opts.maxBytes);
      return { text: `HTTP ${res.status}\n\n${text}`, isError: !res.ok };
    },
  });
}
