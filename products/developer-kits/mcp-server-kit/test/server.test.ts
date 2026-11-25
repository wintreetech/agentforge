import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** End-to-end: spawn the server over stdio and talk to it with the official MCP client. */
test("server lists tools and executes calls over stdio", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--experimental-strip-types", "--no-warnings", path.join(root, "src", "index.ts")],
    cwd: root,
    env: { ...process.env, MCP_FILES_ROOT: path.join(root, "sandbox"), MCP_HTTP_ALLOWLIST: "" } as Record<string, string>,
    stderr: "ignore",
  });
  const client = new Client({ name: "kit-test", version: "1.0.0" });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ["calculate", "http_get", "read_file"]);
    const calc = await client.callTool({ name: "calculate", arguments: { expression: "(2 + 3) * 4" } });
    assert.equal((calc.content as { text: string }[])[0].text, "20");
    const file = await client.callTool({ name: "read_file", arguments: { path: "hello.txt" } });
    assert.match((file.content as { text: string }[])[0].text, /Hello from the MCP kit/);
    const escape = await client.callTool({ name: "read_file", arguments: { path: "../package.json" } });
    assert.equal(escape.isError, true);
  } finally {
    await client.close();
  }
});
