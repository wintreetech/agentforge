import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { z } from "zod";
import { ToolRegistry, defineTool } from "../src/registry.ts";
import { evaluate, calculator } from "../src/tools/calculator.ts";
import { createFileReader, resolveInside } from "../src/tools/file-reader.ts";
import { createHttpGet, assertAllowed } from "../src/tools/http-get.ts";
import { buildRegistry, loadConfig } from "../src/config.ts";

test("calculator evaluates precedence, parentheses, unary minus and powers", () => {
  assert.equal(evaluate("1 + 2 * 3"), 7);
  assert.equal(evaluate("(1200 + 850) * 2"), 4100);
  assert.equal(evaluate("-3 + 5"), 2);
  assert.equal(evaluate("2 ^ 3 ^ 2"), 512);
  assert.equal(evaluate("10 % 4"), 2);
});

test("calculator rejects code and bad input", () => {
  assert.throws(() => evaluate("process.exit()"));
  assert.throws(() => evaluate("1 / 0"), /Division by zero/);
  assert.throws(() => evaluate("(1 + 2"), /parenthesis/);
  assert.throws(() => evaluate("1 +"));
});

test("registry validates arguments before calling handlers", async () => {
  let called = false;
  const reg = new ToolRegistry().register(
    defineTool({ name: "echo", title: "Echo", description: "Echo", input: z.object({ msg: z.string().min(1) }), handler: ({ msg }) => ((called = true), { text: msg }) }),
  );
  const bad = await reg.call("echo", { msg: 42 });
  assert.equal(bad.isError, true);
  assert.equal(called, false);
  assert.deepEqual(await reg.call("echo", { msg: "hi" }), { text: "hi" });
  assert.equal((await reg.call("nope", {})).isError, true);
});

test("registry turns handler exceptions into tool errors and rejects duplicates and bad names", async () => {
  const reg = new ToolRegistry().register(calculator);
  const r = await reg.call("calculate", { expression: "1/0" });
  assert.equal(r.isError, true);
  assert.throws(() => reg.register(calculator), /already registered/);
  assert.throws(() => defineTool({ name: "Bad Name", title: "", description: "", input: z.object({}), handler: () => ({ text: "" }) }));
});

test("file reader stays inside its root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mcpkit-"));
  await mkdir(path.join(root, "docs"));
  await writeFile(path.join(root, "docs", "a.txt"), "hello");
  const tool = createFileReader({ root, maxBytes: 1000 });
  const reg = new ToolRegistry().register(tool);
  assert.deepEqual(await reg.call("read_file", { path: "docs/a.txt" }), { text: "hello" });
  const escape = await reg.call("read_file", { path: "../../etc/passwd" });
  assert.equal(escape.isError, true);
  await assert.rejects(resolveInside(root, path.resolve(root, "..")), /outside|not found/i);
});

test("file reader enforces size limits and rejects binaries", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mcpkit-"));
  await writeFile(path.join(root, "big.txt"), "x".repeat(50));
  await writeFile(path.join(root, "bin.dat"), Buffer.from([1, 0, 2]));
  const reg = new ToolRegistry().register(createFileReader({ root, maxBytes: 10 }));
  assert.match((await reg.call("read_file", { path: "big.txt" })).text, /limit/);
  const reg2 = new ToolRegistry().register(createFileReader({ root, maxBytes: 1000 }));
  assert.match((await reg2.call("read_file", { path: "bin.dat" })).text, /Binary/);
});

test("http_get enforces https and the host allowlist", async () => {
  assert.throws(() => assertAllowed("http://example.com", ["example.com"]), /https/);
  assert.throws(() => assertAllowed("https://evil.com", ["example.com"]), /allowlist/);
  assert.throws(() => assertAllowed("https://example.com:8443/", ["example.com"]), /port/);
  assert.equal(assertAllowed("https://api.example.com/x", ["example.com"]).hostname, "api.example.com");
});

test("http_get uses fetch without following redirects and caps output", async () => {
  let init: RequestInit | undefined;
  const fake = (async (_u: URL, i: RequestInit) => ((init = i), new Response("abcdefghij", { status: 200 }))) as unknown as typeof fetch;
  const reg = new ToolRegistry().register(createHttpGet({ allowlist: ["example.com"], maxBytes: 4, fetchImpl: fake }));
  const r = await reg.call("http_get", { url: "https://example.com/" });
  assert.equal(r.text, "HTTP 200\n\nabcd");
  assert.equal(init?.redirect, "manual");
  const disabled = new ToolRegistry().register(createHttpGet({ allowlist: [], maxBytes: 4, fetchImpl: fake }));
  assert.match((await disabled.call("http_get", { url: "https://example.com/" })).text, /disabled/);
});

test("default registry exposes three tools from env config", () => {
  const reg = buildRegistry(loadConfig({ MCP_HTTP_ALLOWLIST: "Example.com, api.github.com", MCP_MAX_BYTES: "abc" } as NodeJS.ProcessEnv));
  assert.deepEqual(reg.list().map((t) => t.name), ["calculate", "read_file", "http_get"]);
  assert.equal(loadConfig({ MCP_MAX_BYTES: "abc" } as NodeJS.ProcessEnv).maxBytes, 200_000);
});
