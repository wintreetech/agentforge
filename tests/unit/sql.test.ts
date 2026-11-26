import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";

/**
 * Applies the real migration and generated seed to an embedded Postgres
 * (PGlite) with a minimal stand-in for Supabase's auth schema, then checks
 * constraints and row-level security.
 */
const root = path.resolve(__dirname, "../..");
let db: PGlite;

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

async function as(user: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.sub', '${user}', false);`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    create role authenticated;
  `);
  await db.exec(readFileSync(path.join(root, "supabase/migrations/0001_init.sql"), "utf8"));
  await db.exec(readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
  await db.exec(`
    grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant execute on all functions in schema auth to authenticated;
    insert into auth.users values ('${A}'), ('${B}');
    insert into profiles (id, full_name) values ('${A}', 'Alice'), ('${B}', 'Bob');
    insert into orders (id, user_id, email, status, subtotal_amount, total_amount, country, provider, digital_consent) values
      ('ord_a', '${A}', 'a@example.com', 'paid', 1000, 1000, 'US', 'sandbox', true),
      ('ord_b', '${B}', 'b@example.com', 'paid', 2000, 2000, 'US', 'sandbox', true);
  `);
}, 60_000);

describe("database schema", () => {
  it("seeds 50 products and 5 categories", async () => {
    expect((await db.query<{ n: number }>("select count(*)::int as n from products")).rows[0].n).toBe(50);
    expect((await db.query<{ n: number }>("select count(*)::int as n from categories")).rows[0].n).toBe(5);
    expect((await db.query<{ n: number }>("select count(*)::int as n from products where status = 'published'")).rows[0].n).toBe(9);
  });

  it("refuses to publish a product without a tested deliverable", async () => {
    await expect(db.query("update products set status = 'published' where slug = 'gmail-inbox-organizer'")).rejects.toThrow(/purchasable_requires_deliverable/);
  });

  it("enforces price bounds and order arithmetic", async () => {
    await expect(db.query("update products set price_amount = 99999 where slug = 'ai-prompt-optimizer'")).rejects.toThrow();
    await expect(db.query(`insert into orders (id,user_id,email,subtotal_amount,total_amount,country,provider,digital_consent) values ('bad','${A}','x',100,999,'US','sandbox',true)`)).rejects.toThrow();
  });

  it("makes audit logs append-only", async () => {
    await db.query("insert into audit_logs (action, target) values ('test', 'x')");
    await expect(db.query("delete from audit_logs")).rejects.toThrow(/append-only/);
  });

  it("isolates tenants with row-level security", async () => {
    const a = await as(A, "select id from orders");
    expect(a.rows.map((r: any) => r.id)).toEqual(["ord_a"]);
    const b = await as(B, "select id from orders");
    expect(b.rows.map((r: any) => r.id)).toEqual(["ord_b"]);
  });

  it("hides draft products and blocks customers from writing orders", async () => {
    await db.exec("update products set status = 'draft' where slug = 'gmail-inbox-organizer'");
    const r = await as(A, "select count(*)::int as n from products");
    expect((r.rows[0] as any).n).toBe(49);
    await expect(as(A, `insert into orders (id,user_id,email,subtotal_amount,total_amount,country,provider,digital_consent) values ('x','${A}','x',1,1,'US','s',true)`)).rejects.toThrow(/row-level security/);
  });

  it("only lets verified purchasers review", async () => {
    await expect(as(A, `insert into product_reviews (product_id,user_id,rating,title,body) values ('prd_002','${A}',5,'t','b')`)).rejects.toThrow(/row-level security/);
  });
});
