import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { Container, LinkButton, PageHeader } from "@/components/ui";
import { DevNav } from "../dev-nav";

export const metadata: Metadata = { title: "MCP integration", alternates: { canonical: "/developers/mcp" } };

const DOC = `The [Model Context Protocol](https://modelcontextprotocol.io) lets AI clients discover and call tools exposed by MCP servers.

## Build your own MCP server
The **MCP Server Developer Kit** is a tested TypeScript template: a typed tool registry with zod validation, three example tools (calculator, root-confined file reader, allowlisted HTTP GET), stdio transport via the official SDK, and an end-to-end test that talks to the server with the official MCP client.

\`\`\`bash
npm install && npm test && npm run build
\`\`\`

\`\`\`json
{
  "mcpServers": {
    "my-tools": { "command": "node", "args": ["/absolute/path/dist/index.js"],
                  "env": { "MCP_FILES_ROOT": "/absolute/path/allowed", "MCP_HTTP_ALLOWLIST": "api.github.com" } }
  }
}
\`\`\`

## Expose AgentForge products as MCP tools
Wrap the REST API in a tool so any MCP client can run products you own:

\`\`\`ts
defineTool({
  name: "extract_invoice",
  title: "Extract invoice",
  description: "Extract structured data from invoice text via AgentForge.",
  input: z.object({ text: z.string().min(20).max(100_000) }),
  sideEffects: true,
  handler: async ({ text }) => {
    const r = await fetch(\`\${process.env.AGENTFORGE_URL}/api/v1/execute/ai-invoice-data-extractor\`, {
      method: "POST",
      headers: { Authorization: \`Bearer \${process.env.AGENTFORGE_API_KEY}\`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: { text } }),
    });
    const j = await r.json();
    return { text: JSON.stringify(j.output?.data?.invoice ?? j.error), isError: !r.ok };
  },
});
\`\`\`

## Safety notes
- Mark tools with side effects so clients can ask the user first.
- Keep the AgentForge API key in the server's environment, never in client configuration that syncs elsewhere.
- Validate every argument; never pass model-provided paths or URLs to the filesystem or network without an allowlist.`;

export default function Mcp() {
  return (
    <>
      <PageHeader eyebrow="Developers" title="MCP integration" />
      <Container className="grid grid-cols-1 [&>*]:min-w-0 gap-10 py-12 lg:grid-cols-[220px_1fr]">
        <DevNav current="/developers/mcp" />
        <div className="min-w-0 max-w-3xl">
          <Markdown source={DOC} />
          <LinkButton href="/products/mcp-server-developer-kit" className="mt-6">Get the MCP Server Developer Kit</LinkButton>
        </div>
      </Container>
    </>
  );
}
