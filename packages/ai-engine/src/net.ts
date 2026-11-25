import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF protection for any server-side fetch triggered by an agent or workflow.
 * - https only (http allowed only when explicitly enabled for local development)
 * - default ports only
 * - every resolved address must be public (no loopback, private, link-local, CGNAT, metadata)
 * - redirects are followed manually and re-validated
 * - response size and time are capped
 */

export class UnsafeUrlError extends Error {}

function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
}
const inRange = (ip: string, cidr: string) => {
  const [base, bits] = cidr.split("/");
  const mask = bits === "0" ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
};
const BLOCKED_V4 = ["0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.168.0.0/16", "198.18.0.0/15", "224.0.0.0/4", "240.0.0.0/4"];

export function isPublicAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return !BLOCKED_V4.some((c) => inRange(ip, c));
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return false;
    if (x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80") || x.startsWith("ff")) return false;
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    return true;
  }
  return false;
}

export async function assertSafeUrl(raw: string, opts: { allowHttp?: boolean; allowHosts?: string[] } = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }
  if (url.protocol !== "https:" && !(opts.allowHttp && url.protocol === "http:")) throw new UnsafeUrlError("Only https URLs are allowed");
  if (url.username || url.password) throw new UnsafeUrlError("Credentials in URLs are not allowed");
  if (url.port && !["443", "80"].includes(url.port)) throw new UnsafeUrlError("Non-standard ports are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (opts.allowHosts?.length && !opts.allowHosts.some((h) => host === h || host.endsWith(`.${h}`))) throw new UnsafeUrlError(`Host ${host} is not on the allowlist`);
  if (/^(localhost|metadata\.google\.internal)$/i.test(host) || host.endsWith(".local") || host.endsWith(".internal")) throw new UnsafeUrlError("Internal hosts are not allowed");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (!addrs.length || addrs.some((a) => !isPublicAddress(a.address))) throw new UnsafeUrlError("URL resolves to a non-public address");
  return url;
}

export async function safeFetchText(
  raw: string,
  opts: { timeoutMs?: number; maxBytes?: number; allowHosts?: string[]; fetchImpl?: typeof fetch } = {},
): Promise<{ url: string; status: number; contentType: string; text: string }> {
  const max = opts.maxBytes ?? 1_000_000;
  const f = opts.fetchImpl ?? fetch;
  let current = raw;
  for (let hop = 0; hop < 4; hop++) {
    const url = await assertSafeUrl(current, { allowHosts: opts.allowHosts });
    const res = await f(url, { redirect: "manual", signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000), headers: { "User-Agent": "AgentForgeBot/0.1 (+agent fetch)" } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    return { url: url.toString(), status: res.status, contentType: res.headers.get("content-type") ?? "", text };
  }
  throw new UnsafeUrlError("Too many redirects");
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}
