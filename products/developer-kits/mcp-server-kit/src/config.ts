import { ToolRegistry } from "./registry.ts";
import { calculator } from "./tools/calculator.ts";
import { createFileReader } from "./tools/file-reader.ts";
import { createHttpGet } from "./tools/http-get.ts";

export interface KitConfig {
  filesRoot: string;
  httpAllowlist: string[];
  maxBytes: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): KitConfig {
  const maxBytes = Number(env.MCP_MAX_BYTES ?? 200_000);
  return {
    filesRoot: env.MCP_FILES_ROOT ?? "./sandbox",
    httpAllowlist: (env.MCP_HTTP_ALLOWLIST ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    maxBytes: Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : 200_000,
  };
}

/** Build the registry. Add your own tools here. */
export function buildRegistry(cfg: KitConfig): ToolRegistry {
  return new ToolRegistry()
    .register(calculator)
    .register(createFileReader({ root: cfg.filesRoot, maxBytes: cfg.maxBytes }))
    .register(createHttpGet({ allowlist: cfg.httpAllowlist, maxBytes: cfg.maxBytes }));
}
