import type { ProviderId } from "./models.ts";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  json?: boolean;
  signal?: AbortSignal;
}

export type StreamChunk = { type: "text"; text: string } | { type: "usage"; inputTokens: number; outputTokens: number };

export interface ModelProvider {
  id: ProviderId;
  stream(req: GenerateRequest): AsyncGenerator<StreamChunk>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly status?: number, readonly retryable = false) {
    super(message);
  }
}

/** Parse a fetch Response body as server-sent events, yielding each `data:` payload. */
export async function* sseData(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.search(/\r?\n\r?\n/)) !== -1) {
      const event = buf.slice(0, idx);
      buf = buf.slice(idx).replace(/^\r?\n\r?\n/, "");
      const data = event
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) yield data;
    }
  }
  if (buf.trim().startsWith("data:")) yield buf.trim().slice(5).trimStart();
}

async function ensureOk(res: Response, name: string) {
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  // Never echo request headers or keys; only the provider's error message.
  let msg = text.slice(0, 300);
  try {
    const j = JSON.parse(text);
    msg = j.error?.message ?? j.message ?? msg;
  } catch {}
  throw new ProviderError(`${name} returned ${res.status}: ${msg}`, res.status, res.status === 429 || res.status >= 500);
}

// ───────────────────────── OpenAI ─────────────────────────
export class OpenAIProvider implements ModelProvider {
  id = "openai" as const;
  constructor(private apiKey: string, private fetchImpl: typeof fetch = fetch, private baseUrl = "https://api.openai.com/v1") {}
  async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        max_completion_tokens: req.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        ...(req.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: req.signal,
    });
    await ensureOk(res, "OpenAI");
    for await (const data of sseData(res)) {
      if (data === "[DONE]") break;
      const j = JSON.parse(data);
      const t = j.choices?.[0]?.delta?.content;
      if (t) yield { type: "text", text: t };
      if (j.usage) yield { type: "usage", inputTokens: j.usage.prompt_tokens ?? 0, outputTokens: j.usage.completion_tokens ?? 0 };
    }
  }
}

// ───────────────────────── Anthropic ─────────────────────────
export class AnthropicProvider implements ModelProvider {
  id = "anthropic" as const;
  constructor(private apiKey: string, private fetchImpl: typeof fetch = fetch, private baseUrl = "https://api.anthropic.com/v1") {}
  async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
    const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const messages = req.messages.filter((m) => m.role !== "system");
    const res = await this.fetchImpl(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: req.model, system: system || undefined, messages, max_tokens: req.maxTokens, stream: true }),
      signal: req.signal,
    });
    await ensureOk(res, "Anthropic");
    let input = 0;
    let output = 0;
    for await (const data of sseData(res)) {
      const j = JSON.parse(data);
      if (j.type === "message_start") input = j.message?.usage?.input_tokens ?? 0;
      else if (j.type === "content_block_delta" && j.delta?.type === "text_delta") yield { type: "text", text: j.delta.text };
      else if (j.type === "message_delta") output = j.usage?.output_tokens ?? output;
      else if (j.type === "error") throw new ProviderError(`Anthropic stream error: ${j.error?.message ?? "unknown"}`, undefined, true);
    }
    yield { type: "usage", inputTokens: input, outputTokens: output };
  }
}

// ───────────────────────── Google Gemini ─────────────────────────
export class GeminiProvider implements ModelProvider {
  id = "gemini" as const;
  constructor(private apiKey: string, private fetchImpl: typeof fetch = fetch, private baseUrl = "https://generativelanguage.googleapis.com/v1beta") {}
  async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
    const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const contents = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const res = await this.fetchImpl(`${this.baseUrl}/models/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "x-goog-api-key": this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: { maxOutputTokens: req.maxTokens, ...(req.json ? { responseMimeType: "application/json" } : {}) },
      }),
      signal: req.signal,
    });
    await ensureOk(res, "Gemini");
    let usage: StreamChunk | null = null;
    for await (const data of sseData(res)) {
      const j = JSON.parse(data);
      for (const part of j.candidates?.[0]?.content?.parts ?? []) if (part.text) yield { type: "text", text: part.text };
      if (j.usageMetadata) usage = { type: "usage", inputTokens: j.usageMetadata.promptTokenCount ?? 0, outputTokens: j.usageMetadata.candidatesTokenCount ?? 0 };
    }
    if (usage) yield usage;
  }
}

// ───────────────────────── Sandbox ─────────────────────────
/**
 * The sandbox provider never calls an AI model. Product steps supply a
 * deterministic `sandbox` implementation; this provider only streams it so the
 * UI and metering paths are exercised. All sandbox output is labelled as such.
 */
export class SandboxProvider implements ModelProvider {
  id = "sandbox" as const;
  constructor(private delayMs = 8) {}
  async *stream(req: GenerateRequest & { sandboxText?: string }): AsyncGenerator<StreamChunk> {
    const text = req.sandboxText ?? "";
    const parts = text.match(/\S+\s*|\s+/g) ?? [];
    for (let i = 0; i < parts.length; i += 3) {
      if (req.signal?.aborted) throw new ProviderError("Cancelled");
      yield { type: "text", text: parts.slice(i, i + 3).join("") };
      if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    }
    const input = Math.ceil(req.messages.reduce((s, m) => s + m.content.length, 0) / 4);
    yield { type: "usage", inputTokens: input, outputTokens: Math.ceil(text.length / 4) };
  }
}

export interface ProviderKeys {
  openai?: string;
  anthropic?: string;
  gemini?: string;
}

export function configuredProviders(keys: ProviderKeys): ProviderId[] {
  const ids: ProviderId[] = ["sandbox"];
  if (keys.openai) ids.push("openai");
  if (keys.anthropic) ids.push("anthropic");
  if (keys.gemini) ids.push("gemini");
  return ids;
}

export function createProvider(id: ProviderId, keys: ProviderKeys, fetchImpl: typeof fetch = fetch): ModelProvider {
  switch (id) {
    case "openai":
      if (!keys.openai) throw new ProviderError("OpenAI is not configured");
      return new OpenAIProvider(keys.openai, fetchImpl);
    case "anthropic":
      if (!keys.anthropic) throw new ProviderError("Anthropic is not configured");
      return new AnthropicProvider(keys.anthropic, fetchImpl);
    case "gemini":
      if (!keys.gemini) throw new ProviderError("Google Gemini is not configured");
      return new GeminiProvider(keys.gemini, fetchImpl);
    case "sandbox":
      return new SandboxProvider();
  }
}
