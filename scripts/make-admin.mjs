#!/usr/bin/env node
/**
 * Promote an existing account to platform admin in the development data store.
 * Usage: npm run make-admin -- you@example.com
 * (In production, set ADMIN_EMAILS or update profiles.platform_role in Supabase.)
 * Stop the dev server first, or restart it afterwards: the server caches the store in memory.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run make-admin -- <email>");
  process.exit(1);
}
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const file = path.join(root, "apps/web", process.env.DATA_DIR ?? ".data", "db.json");
const db = JSON.parse(await readFile(file, "utf8"));
const u = db.users.find((x) => x.email === email && !x.deletedAt);
if (!u) {
  console.error(`No account with email ${email}. Sign up first.`);
  process.exit(1);
}
u.role = "admin";
db.audit.push({ id: `aud_cli_${Date.now()}`, actorId: null, action: "user.role_changed", target: u.id, meta: { role: "admin", via: "cli" }, at: new Date().toISOString() });
await writeFile(file, JSON.stringify(db));
console.log(`${email} is now an admin. Restart the dev server to pick up the change.`);
