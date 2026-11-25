# AgentForge MCP Server Developer Kit

A small, production-minded TypeScript template for building [Model Context Protocol](https://modelcontextprotocol.io) servers: typed tools, validated inputs, safe defaults and tests.

## What's included

| Path | Purpose |
|---|---|
| `src/registry.ts` | Typed tool registry. Every call is validated with zod before the handler runs. |
| `src/tools/calculator.ts` | `calculate`: exact arithmetic without `eval`. |
| `src/tools/file-reader.ts` | `read_file`: reads text files only inside `MCP_FILES_ROOT` (realpath-checked, size-capped, no binaries). |
| `src/tools/http-get.ts` | `http_get`: HTTPS GET only to hosts in `MCP_HTTP_ALLOWLIST`; redirects not auto-followed; output capped. |
| `src/config.ts` | Environment config and the list of registered tools. |
| `src/index.ts` | Stdio transport using the official `@modelcontextprotocol/sdk`. |
| `test/` | Unit tests for every tool plus an end-to-end test that spawns the server and calls it with the official MCP client. |
| `docs/` | Guides for adding tools and connecting clients. |

## Requirements

- Node.js 22.6 or newer (uses native TypeScript type stripping for dev and tests)
- npm

## Quick start

```bash
npm install
cp .env.example .env        # adjust MCP_FILES_ROOT and MCP_HTTP_ALLOWLIST
npm test                    # 10 tests, including an end-to-end MCP session
npm run build               # compiles to dist/
npm start                   # runs dist/index.js over stdio
```

During development you can run the TypeScript source directly with `npm run dev`.

> stdout carries MCP protocol messages. Log to **stderr** (`console.error`) only.

## Connect a client

See [`docs/CLIENT_SETUP.md`](docs/CLIENT_SETUP.md). For desktop clients that read an `mcpServers` config, point `command` at `node` and `args` at the absolute path of `dist/index.js`.

## Add your own tool

See [`docs/ADDING_TOOLS.md`](docs/ADDING_TOOLS.md). In short: create a file in `src/tools/`, export a `defineTool({...})`, register it in `src/config.ts`, add a test.

## Security defaults

- Inputs are validated against each tool's schema; invalid calls never reach handlers.
- Handler exceptions become MCP tool errors, not crashes.
- File access is confined to one directory; symlinks and `..` cannot escape.
- Network access is off unless you allowlist hosts. Only HTTPS on port 443.
- Tools with side effects are labelled in their description so clients can ask the user before calling them.

## Licence

Developer licence. See `LICENSE.md`. You may use and modify this code in your own products and client projects; you may not resell or redistribute the kit itself as a template.
