import { z } from "zod";
import { defineTool } from "../registry.ts";

/**
 * Safe arithmetic evaluator (no eval). Supports + - * / % ^, parentheses,
 * unary minus and decimal numbers.
 */
export function evaluate(expr: string): number {
  const tokens = expr.match(/\d+(?:\.\d+)?|[-+*/%^()]/g);
  if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "")) throw new Error("Expression contains unsupported characters");
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];

  function primary(): number {
    const t = next();
    if (t === "(") {
      const v = additive();
      if (next() !== ")") throw new Error("Missing closing parenthesis");
      return v;
    }
    if (t === "-") return -primary();
    if (t === "+") return primary();
    if (t !== undefined && /^\d/.test(t)) return Number(t);
    throw new Error(`Unexpected token "${t ?? "end of input"}"`);
  }
  function power(): number {
    const base = primary();
    if (peek() === "^") {
      next();
      return base ** power(); // right-associative
    }
    return base;
  }
  function multiplicative(): number {
    let v = power();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = next();
      const r = power();
      if ((op === "/" || op === "%") && r === 0) throw new Error("Division by zero");
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  }
  function additive(): number {
    let v = multiplicative();
    while (peek() === "+" || peek() === "-") v = next() === "+" ? v + multiplicative() : v - multiplicative();
    return v;
  }
  const result = additive();
  if (i !== tokens.length) throw new Error(`Unexpected token "${tokens[i]}"`);
  if (!Number.isFinite(result)) throw new Error("Result is not a finite number");
  return result;
}

export const calculator = defineTool({
  name: "calculate",
  title: "Calculator",
  description: "Evaluate an arithmetic expression exactly. Supports + - * / % ^ and parentheses.",
  input: z.object({ expression: z.string().min(1).max(500).describe("e.g. (1200 + 850) * 1.19") }),
  handler: ({ expression }) => ({ text: String(evaluate(expression)) }),
});
