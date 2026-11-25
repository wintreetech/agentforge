import { estimateCostEur, estimateTokens } from "./models.ts";
import { ProviderError, type ChatMessage, type ModelProvider } from "./providers.ts";
import { sanitizeModelText } from "./safety.ts";

/**
 * Shared execution engine. Every hosted product is a list of steps run by this
 * engine, so budgets, streaming, retries, cancellation, metering and audit
 * events behave identically across products.
 */

export interface Budget {
  maxSteps: number;
  maxTokens: number;
  timeoutMs: number;
  maxCostEur: number;
}

export interface RunContext<I = any> {
  input: I;
  state: Record<string, any>;
  sandbox: boolean;
  warnings: string[];
}

export interface LlmStep<I = any> {
  kind: "llm";
  id: string;
  label: string;
  agent?: string;
  stream?: boolean;
  maxTokens: number;
  json?: boolean;
  /** Skip the step (e.g. nothing was retrieved). The step still appears in the log. */
  skip?(ctx: RunContext<I>): string | false;
  build(ctx: RunContext<I>): ChatMessage[];
  /** Deterministic implementation used in sandbox mode. Output is labelled as simulated by the caller. */
  sandbox(ctx: RunContext<I>): string;
  /** Store/parse the step's text output. Defaults to ctx.state[id] = text. */
  after?(text: string, ctx: RunContext<I>): void;
}

export interface ComputeStep<I = any> {
  kind: "compute";
  id: string;
  label: string;
  agent?: string;
  run(ctx: RunContext<I>, signal: AbortSignal): Promise<unknown> | unknown;
}

export type Step<I = any> = LlmStep<I> | ComputeStep<I>;

export interface RunOutput {
  markdown: string;
  data?: unknown;
  citations?: { n: number; source: string; page: number | null; excerpt: string }[];
  warnings: string[];
  simulated: boolean;
}

export type RunEvent =
  | { type: "step"; id: string; label: string; agent?: string; status: "running" | "done" | "failed"; ms?: number; tokens?: number; detail?: string }
  | { type: "token"; stepId: string; text: string }
  | { type: "output"; output: RunOutput }
  | { type: "error"; message: string; code: string }
  | { type: "done"; usage: Usage };

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costEur: number;
  steps: number;
  ms: number;
}

export class BudgetExceededError extends Error {
  code = "budget_exceeded";
}

export interface RunOptions<I> {
  steps: (ctx: RunContext<I>) => Step<I>[];
  finalize: (ctx: RunContext<I>) => RunOutput;
  input: I;
  provider: ModelProvider;
  model: string;
  budget: Budget;
  signal?: AbortSignal;
  emit: (e: RunEvent) => void;
  sleep?: (ms: number) => Promise<void>;
}

export async function runProduct<I>(opts: RunOptions<I>): Promise<{ output: RunOutput | null; usage: Usage; error?: { message: string; code: string } }> {
  const sandbox = opts.provider.id === "sandbox";
  const ctx: RunContext<I> = { input: opts.input, state: {}, sandbox, warnings: [] };
  const started = Date.now();
  const usage: Usage = { inputTokens: 0, outputTokens: 0, costEur: 0, steps: 0, ms: 0 };
  const timeout = AbortSignal.timeout(opts.budget.timeoutMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  const charge = (inT: number, outT: number) => {
    usage.inputTokens += inT;
    usage.outputTokens += outT;
    usage.costEur = sandbox ? 0 : estimateCostEur(opts.model, usage.inputTokens, usage.outputTokens);
    if (usage.inputTokens + usage.outputTokens > opts.budget.maxTokens) throw new BudgetExceededError(`Token budget of ${opts.budget.maxTokens} exceeded`);
    if (usage.costEur > opts.budget.maxCostEur) throw new BudgetExceededError(`Cost budget of €${opts.budget.maxCostEur} exceeded`);
  };

  try {
    const steps = opts.steps(ctx);
    if (steps.length > opts.budget.maxSteps) throw new BudgetExceededError(`Product defines ${steps.length} steps; limit is ${opts.budget.maxSteps}`);
    for (const step of steps) {
      if (signal.aborted) throw signal.reason ?? new Error("Aborted");
      const t0 = Date.now();
      usage.steps++;
      opts.emit({ type: "step", id: step.id, label: step.label, agent: step.agent, status: "running" });
      let stepTokens = 0;
      try {
        const skipReason = step.kind === "llm" && step.skip ? step.skip(ctx) : false;
        if (skipReason) {
          opts.emit({ type: "step", id: step.id, label: step.label, agent: step.agent, status: "done", ms: 0, tokens: 0, detail: `Skipped: ${skipReason}` });
          continue;
        }
        if (step.kind === "compute") {
          const r = await step.run(ctx, signal);
          if (r !== undefined) ctx.state[step.id] = r;
        } else {
          const messages = step.build(ctx);
          const preIn = messages.reduce((s, m) => s + estimateTokens(m.content), 0);
          if (preIn + step.maxTokens + usage.inputTokens + usage.outputTokens > opts.budget.maxTokens * 1.5)
            throw new BudgetExceededError("Input is too large for this product's token budget. Shorten the input.");
          let text = "";
          let attempt = 0;
          for (;;) {
            try {
              text = "";
              let reported = false;
              const req = { model: opts.model, messages, maxTokens: step.maxTokens, json: step.json, signal, sandboxText: sandbox ? step.sandbox(ctx) : undefined };
              for await (const chunk of (opts.provider.stream as any)(req) as AsyncGenerator<any>) {
                if (chunk.type === "text") {
                  text += chunk.text;
                  if (step.stream) opts.emit({ type: "token", stepId: step.id, text: chunk.text });
                } else if (chunk.type === "usage") {
                  reported = true;
                  stepTokens = chunk.inputTokens + chunk.outputTokens;
                  charge(chunk.inputTokens, chunk.outputTokens);
                }
              }
              if (!reported) {
                stepTokens = preIn + estimateTokens(text);
                charge(preIn, estimateTokens(text));
              }
              break;
            } catch (e) {
              if (e instanceof ProviderError && e.retryable && attempt < 2 && !signal.aborted) {
                attempt++;
                await sleep(500 * 2 ** attempt);
                continue;
              }
              throw e;
            }
          }
          text = sanitizeModelText(text);
          if (step.after) step.after(text, ctx);
          else ctx.state[step.id] = text;
        }
        opts.emit({ type: "step", id: step.id, label: step.label, agent: step.agent, status: "done", ms: Date.now() - t0, tokens: stepTokens });
      } catch (e) {
        opts.emit({ type: "step", id: step.id, label: step.label, agent: step.agent, status: "failed", ms: Date.now() - t0, detail: (e as Error).message });
        throw e;
      }
    }
    const output = opts.finalize(ctx);
    output.warnings = [...new Set([...ctx.warnings, ...output.warnings])];
    usage.ms = Date.now() - started;
    opts.emit({ type: "output", output });
    opts.emit({ type: "done", usage });
    return { output, usage };
  } catch (e) {
    usage.ms = Date.now() - started;
    const err = e as Error & { code?: string };
    let code = err.code ?? "execution_failed";
    let message = err.message;
    if (timeout.aborted) {
      code = "timeout";
      message = `Execution exceeded the ${Math.round(opts.budget.timeoutMs / 1000)}s time limit.`;
    } else if (opts.signal?.aborted) {
      code = "cancelled";
      message = "Execution was cancelled.";
    }
    opts.emit({ type: "error", message, code });
    opts.emit({ type: "done", usage });
    return { output: null, usage, error: { message, code } };
  }
}
