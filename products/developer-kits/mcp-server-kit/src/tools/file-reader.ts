import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { defineTool } from "../registry.ts";

/**
 * Reads text files, but only inside an allowlisted root directory. Paths are
 * resolved through realpath so "../" segments and symlinks cannot escape.
 */
export async function resolveInside(root: string, requested: string): Promise<string> {
  const realRoot = await realpath(path.resolve(root));
  const target = path.resolve(realRoot, requested);
  let real: string;
  try {
    real = await realpath(target);
  } catch {
    throw new Error("File not found");
  }
  const rel = path.relative(realRoot, real);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Access outside the allowed directory is not permitted");
  return real;
}

export function createFileReader(opts: { root: string; maxBytes: number }) {
  return defineTool({
    name: "read_file",
    title: "Read file",
    description: `Read a UTF-8 text file from the server's allowed directory (${opts.root}). Paths are relative to that directory.`,
    input: z.object({ path: z.string().min(1).max(500).describe("Relative path, e.g. notes/todo.md") }),
    handler: async ({ path: p }) => {
      const real = await resolveInside(opts.root, p);
      const s = await stat(real);
      if (!s.isFile()) throw new Error("Not a file");
      if (s.size > opts.maxBytes) throw new Error(`File is larger than the ${opts.maxBytes}-byte limit`);
      const buf = await readFile(real);
      if (buf.subarray(0, 4096).includes(0)) throw new Error("Binary files are not supported");
      return { text: buf.toString("utf8") };
    },
  });
}
