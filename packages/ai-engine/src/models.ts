/**
 * Client-safe model catalogue. Prices are ESTIMATES in EUR per 1M tokens used
 * for pre-run cost display and usage metering; verify against each provider's
 * current price list and override via the admin console. Model IDs can be
 * overridden with environment variables because providers rename models.
 */

export type ProviderId = "openai" | "anthropic" | "gemini" | "sandbox";

export interface ModelInfo {
  id: string;
  provider: ProviderId;
  label: string;
  tier: "fast" | "balanced" | "best" | "sandbox";
  inputEurPerM: number;
  outputEurPerM: number;
  contextTokens: number;
}

export const MODELS: ModelInfo[] = [
  { id: "sandbox-deterministic", provider: "sandbox", label: "Sandbox (deterministic, no AI)", tier: "sandbox", inputEurPerM: 0, outputEurPerM: 0, contextTokens: 200_000 },
  { id: "claude-haiku-5-5", provider: "anthropic", label: "Claude Haiku 5.5", tier: "fast", inputEurPerM: 0.95, outputEurPerM: 4.7, contextTokens: 200_000 },
  { id: "claude-sonnet-5-5", provider: "anthropic", label: "Claude Sonnet 5.5", tier: "balanced", inputEurPerM: 2.8, outputEurPerM: 14, contextTokens: 200_000 },
  { id: "claude-opus-5-5", provider: "anthropic", label: "Claude Opus 5.5", tier: "best", inputEurPerM: 4.7, outputEurPerM: 23.5, contextTokens: 200_000 },
  { id: "gpt-5-mini", provider: "openai", label: "OpenAI GPT-5 mini", tier: "fast", inputEurPerM: 0.25, outputEurPerM: 1.9, contextTokens: 128_000 },
  { id: "gpt-5", provider: "openai", label: "OpenAI GPT-5", tier: "balanced", inputEurPerM: 1.2, outputEurPerM: 9.4, contextTokens: 128_000 },
  { id: "gemini-2.5-flash", provider: "gemini", label: "Gemini 2.5 Flash", tier: "fast", inputEurPerM: 0.28, outputEurPerM: 2.35, contextTokens: 1_000_000 },
  { id: "gemini-2.5-pro", provider: "gemini", label: "Gemini 2.5 Pro", tier: "balanced", inputEurPerM: 1.2, outputEurPerM: 9.4, contextTokens: 1_000_000 },
];

export const getModel = (id: string) => MODELS.find((m) => m.id === id);

export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export function estimateCostEur(modelId: string, inputTokens: number, outputTokens: number): number {
  const m = getModel(modelId);
  if (!m) return 0;
  return (inputTokens * m.inputEurPerM + outputTokens * m.outputEurPerM) / 1_000_000;
}

/** Usage credits: 1 credit = €0.01 of estimated provider cost, minimum 1 credit per hosted run. */
export const creditsForCost = (eur: number, sandbox: boolean) => (sandbox ? 1 : Math.max(1, Math.ceil(eur * 100)));
