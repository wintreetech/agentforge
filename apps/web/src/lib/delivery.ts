import "server-only";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createZip, signPayload, verifyPayload, type ZipEntry } from "@agentforge/commerce";
import { env } from "./env";

/**
 * Registered downloadable deliverables. Only products listed here can be
 * downloaded, and each points at a real, tested source directory.
 */
export const DELIVERABLES: Record<string, { dir: string; version: string; fileName: string }> = {
  "mcp-server-developer-kit": { dir: "developer-kits/mcp-server-kit", version: "1.0.0", fileName: "agentforge-mcp-server-kit" },
};

const EXCLUDE = new Set(["node_modules", "dist", ".env", ".DS_Store", "coverage"]);

const productsRoot = () => process.env.PRODUCTS_DIR ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../products");

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, base)));
    else if (e.isFile()) out.push(path.relative(base, full));
  }
  return out.sort();
}

export async function listDeliverableFiles(slug: string): Promise<{ path: string; bytes: number }[]> {
  const d = DELIVERABLES[slug];
  if (!d) return [];
  const root = path.join(productsRoot(), d.dir);
  const files = await walk(root);
  return Promise.all(files.map(async (f) => ({ path: f.replace(/\\/g, "/"), bytes: (await stat(path.join(root, f))).size })));
}

export async function buildPackage(slug: string, licence: { key: string; license: string; email: string }): Promise<{ bytes: Uint8Array; fileName: string }> {
  const d = DELIVERABLES[slug];
  if (!d) throw new Error("No deliverable registered for this product");
  const root = path.join(productsRoot(), d.dir);
  const prefix = `${d.fileName}-${d.version}/`;
  const entries: ZipEntry[] = [];
  for (const f of await walk(root)) entries.push({ path: prefix + f.replace(/\\/g, "/"), data: new Uint8Array(await readFile(path.join(root, f))) });
  entries.push({
    path: `${prefix}LICENSE-KEY.txt`,
    data: new TextEncoder().encode(`Product: ${slug}\nVersion: ${d.version}\nLicence: ${licence.license}\nLicensed to: ${licence.email}\nLicence key: ${licence.key}\n\nVerify: POST ${env.appUrl}/api/v1/licenses/verify {"key":"..."}\n`),
  });
  return { bytes: createZip(entries), fileName: `${d.fileName}-${d.version}.zip` };
}

export function signDownload(userId: string, slug: string, ttlSec = 300) {
  return signPayload(env.downloadSecret, { u: userId, s: slug, v: DELIVERABLES[slug]?.version, exp: Date.now() + ttlSec * 1000 });
}

export function verifyDownload(token: string) {
  return verifyPayload<{ u: string; s: string; v: string; exp: number }>(env.downloadSecret, token);
}
