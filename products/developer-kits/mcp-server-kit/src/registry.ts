import { z } from "zod";

/**
 * A typed tool registry. Each tool declares a zod input schema; every call is
 * validated before the handler runs, so handlers never see malformed input.
 */

export interface ToolResult {
  text: string;
  isError?: boolean;
}

export interface ToolDefinition<S extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  input: S;
  /** Set true for tools with side effects outside the server (writes, network). Documented to the client. */
  sideEffects?: boolean;
  handler: (args: z.infer<S>) => Promise<ToolResult> | ToolResult;
}

export function defineTool<S extends z.ZodObject>(def: ToolDefinition<S>): ToolDefinition<S> {
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(def.name)) throw new Error(`Invalid tool name "${def.name}": use lowercase letters, digits and underscores.`);
  return def;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition<any>): this {
    if (this.tools.has(tool.name)) throw new Error(`Tool "${tool.name}" is already registered`);
    this.tools.set(tool.name, tool);
    return this;
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** Validate and execute. Validation and handler errors become tool errors, never crashes. */
  async call(name: string, rawArgs: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { text: `Unknown tool: ${name}`, isError: true };
    const parsed = tool.input.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return { text: `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`, isError: true };
    }
    try {
      return await tool.handler(parsed.data);
    } catch (e) {
      return { text: `Tool failed: ${(e as Error).message}`, isError: true };
    }
  }
}
