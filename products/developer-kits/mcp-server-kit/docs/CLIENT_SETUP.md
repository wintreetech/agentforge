# Connecting an MCP client

Build first: `npm run build`. Use absolute paths below.

## Clients with an `mcpServers` JSON config (e.g. Claude Desktop)

```json
{
  "mcpServers": {
    "agentforge-kit": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-kit/dist/index.js"],
      "env": {
        "MCP_FILES_ROOT": "/absolute/path/to/allowed/folder",
        "MCP_HTTP_ALLOWLIST": "api.github.com"
      }
    }
  }
}
```

Restart the client after editing its configuration. The three tools should appear in its tool list.

## Programmatic client (TypeScript)

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "my-app", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"] }));
console.log(await client.listTools());
console.log(await client.callTool({ name: "calculate", arguments: { expression: "2 * 21" } }));
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Client shows no tools | Check the path in `args` is absolute and the build exists. Run `node dist/index.js` manually; you should see `[mcp-kit] ready…` on stderr. |
| "Unexpected token" / protocol errors | Something is writing to stdout. Use `console.error` for logs. |
| `read_file` says "outside the allowed directory" | The path must be relative to `MCP_FILES_ROOT` and must not resolve outside it (symlinks included). |
| `http_get` says "disabled" | Set `MCP_HTTP_ALLOWLIST` to a comma-separated list of hostnames. |
| Node errors about type stripping | Use Node 22.6+ for `npm run dev`/`npm test`, or run the compiled `dist/` build. |
