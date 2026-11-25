#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildRegistry, loadConfig } from "./config.ts";

/**
 * Entry point: exposes every registered tool over the MCP stdio transport.
 * Logs go to stderr — stdout is reserved for protocol messages.
 */
const cfg = loadConfig();
const registry = buildRegistry(cfg);
const server = new McpServer({ name: "agentforge-mcp-server-kit", version: "1.0.0" });

for (const tool of registry.list()) {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.sideEffects ? `${tool.description} (Makes network requests.)` : tool.description,
      inputSchema: tool.input.shape,
    },
    async (args: unknown) => {
      const r = await registry.call(tool.name, args);
      return { content: [{ type: "text" as const, text: r.text }], isError: r.isError };
    },
  );
}

await server.connect(new StdioServerTransport());
console.error(`[mcp-kit] ready with tools: ${registry.list().map((t) => t.name).join(", ")}`);
