import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Browsers refuse to render an SVG with a duplicated attribute; it shows as a blank image. */
const root = path.resolve(__dirname, "../../apps/web/public");

function svgFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? svgFiles(p) : p.endsWith(".svg") ? [p] : [];
  });
}

describe("public SVG assets", () => {
  const files = svgFiles(root);

  it("finds the generated assets", () => {
    expect(files.length).toBeGreaterThan(150);
  });

  it("has no element with a duplicated attribute", () => {
    const problems: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const tag of src.matchAll(/<([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g)) {
        const names = [...tag[2].matchAll(/([\w:-]+)="/g)].map((m) => m[1]);
        const dup = names.find((n, i) => names.indexOf(n) !== i);
        if (dup) problems.push(`${path.relative(root, f)}: <${tag[1]}> repeats ${dup}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
