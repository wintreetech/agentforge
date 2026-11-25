import { z } from "zod";
import {
  Bm25Index,
  UNTRUSTED_POLICY,
  bulletLines,
  chunkDocument,
  detectInjection,
  escapeMd,
  sentences,
  terms,
  titleCase,
  topSentences,
  truncate,
  words,
  wrapUntrusted,
  type ChatMessage,
  type RunContext,
  type RunOutput,
  type SourceDoc,
  type Step,
} from "@agentforge/ai-engine";
import { getRunnable, type RunnableMeta } from "./fields.ts";
import { extractInvoice, invoiceLinesCsv, validateInvoice, type InvoiceData } from "./invoice.ts";

export interface RunDeps {
  /** SSRF-guarded fetcher provided by the server. Only called after explicit per-run approval. */
  fetchUrl?: (url: string) => Promise<{ url: string; text: string }>;
}

export interface ProductSpec<I = any> {
  meta: RunnableMeta;
  schema: z.ZodType<I>;
  steps(ctx: RunContext<I>, deps: RunDeps): Step<I>[];
  finalize(ctx: RunContext<I>): RunOutput;
}

const sys = (role: string): ChatMessage => ({ role: "system", content: `${role}\n\n${UNTRUSTED_POLICY}` });
const user = (content: string): ChatMessage => ({ role: "user", content });
const out = (ctx: RunContext, markdown: string, extra: Partial<RunOutput> = {}): RunOutput => ({
  markdown,
  warnings: [],
  simulated: ctx.sandbox,
  ...extra,
});
const sourceDoc = z.object({ id: z.string().max(64), name: z.string().max(300), pages: z.array(z.string().max(400_000)).min(1).max(1000) });
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const sentence = (s: string) => {
  const t = cap(s.trim());
  return /[.!?]$/.test(t) ? t : `${t}.`;
};
function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

// ───────────────────────── Resume & cover letter ─────────────────────────

const GENERIC = new Set(["experience", "year", "strong", "excellent", "skill", "work", "ability", "abilitie", "proven", "plus", "including", "require", "requirement", "candidate", "role", "team", "you", "will"]);

function yearsOfExperience(history: string): number | null {
  const ranges = [...history.matchAll(/((?:19|20)\d{2})\s*(?:–|-|—|to)\s*((?:19|20)\d{2}|present|now|current|today)/gi)];
  if (!ranges.length) return null;
  const now = new Date().getFullYear();
  const starts = ranges.map((r) => +r[1]);
  const ends = ranges.map((r) => (/^\d/.test(r[2]) ? +r[2] : now));
  return Math.max(...ends) - Math.min(...starts);
}

const resume: ProductSpec<{ fullName: string; targetRole: string; history: string; jobDescription: string; tone: "formal" | "warm" | "concise" }> = {
  meta: getRunnable("ai-resume-cover-letter-builder")!,
  schema: z.object({
    fullName: z.string().trim().min(2).max(120),
    targetRole: z.string().trim().min(2).max(160),
    history: z.string().trim().min(40, "Add a little more work history (at least 40 characters).").max(12000),
    jobDescription: z.string().trim().min(40, "Paste the job description (at least 40 characters).").max(12000),
    tone: z.enum(["formal", "warm", "concise"]).default("warm"),
  }),
  steps: () => [
    {
      kind: "compute",
      id: "requirements",
      label: "Extract job requirements",
      agent: "Analyst",
      run: (ctx) => {
        const lines = bulletLines(ctx.input.jobDescription).filter((l) => l.length >= 8 && l.length <= 220);
        const req = lines.filter((l) => /\b(experience|skills?|years?|knowledge|ability|proficien|familiar|degree|must|required?|strong|excellent|background)\b/i.test(l) || l.split(" ").length <= 14);
        return req.filter((l) => !/^(we are|we're|about|requirements?:?|responsibilities:?|who you are|apply)/i.test(l)).slice(0, 12);
      },
    },
    {
      kind: "compute",
      id: "match",
      label: "Match experience to requirements",
      agent: "Analyst",
      run: (ctx) => {
        const histLines = bulletLines(ctx.input.history);
        const years = yearsOfExperience(ctx.input.history);
        return (ctx.state.requirements as string[]).map((req) => {
          const yearsReq = req.match(/(\d+)\s*\+?\s*years?/i);
          if (yearsReq) {
            const need = +yearsReq[1];
            return { req, evidence: years != null ? `${years} years from the dates in your history` : null, matched: years != null && years >= need };
          }
          const rt = terms(req).filter((t) => !GENERIC.has(t));
          let best: { line: string; overlap: number } | null = null;
          for (const line of histLines) {
            const lt = new Set(terms(line));
            const overlap = rt.filter((t) => lt.has(t) || [...lt].some((x) => x.length > 4 && (x.startsWith(t) || t.startsWith(x)))).length;
            if (overlap && (!best || overlap > best.overlap)) best = { line, overlap };
          }
          // Require at least half of the requirement's distinctive terms to be evidenced by one line.
          const matched = !!best && best.overlap / Math.max(1, rt.length) >= 0.5;
          return { req, evidence: matched ? best!.line : null, matched };
        });
      },
    },
    {
      kind: "llm",
      id: "draft",
      label: "Write resume and cover letter",
      agent: "Writer",
      stream: true,
      maxTokens: 3000,
      build: (ctx) => [
        sys(
          "You are an expert resume writer. Write an ATS-friendly resume and a cover letter in Markdown. Use ONLY facts present in the candidate's work history: never invent employers, dates, metrics, degrees or skills. Where a requirement is not evidenced, do not claim it. Start with '# Resume' and then '# Cover letter'. Keep bullets outcome-focused and under 25 words.",
        ),
        user(
          `Candidate: ${ctx.input.fullName}\nTarget role: ${ctx.input.targetRole}\nCover letter tone: ${ctx.input.tone}\n\nWork history:\n${wrapUntrusted("work history", ctx.input.history)}\n\nJob description:\n${wrapUntrusted("job description", ctx.input.jobDescription)}\n\nRequirement matching already computed (use it):\n${JSON.stringify(ctx.state.match)}`,
        ),
      ],
      sandbox: (ctx) => {
        const { fullName, targetRole, history, tone } = ctx.input;
        const matched = (ctx.state.match as { req: string; evidence: string | null; matched: boolean }[]).filter((m) => m.matched);
        const lines = bulletLines(history);
        const companies = lines.map((l) => l.match(/,\s*([^,(]+?)\s*\(/)?.[1]).filter(Boolean) as string[];
        const exp = lines.map((l) => (/\b(19|20)\d{2}\b/.test(l) ? `\n### ${l}` : `- ${sentence(l)}`)).join("\n");
        const opening = { formal: "Dear Hiring Manager,", warm: "Dear Hiring Team,", concise: "Hello," }[tone];
        const close = { formal: "Yours faithfully,", warm: "Kind regards,", concise: "Best," }[tone];
        const evidenceParas = matched.slice(0, 3).map((m) => `You ask for ${m.req.replace(/\.$/, "").toLowerCase()}. In my experience: ${m.evidence?.replace(/\.$/, "")}.`);
        return [
          `# Resume`,
          `## ${fullName}`,
          `**${targetRole}**`,
          ``,
          `### Profile`,
          `${targetRole} candidate${companies.length ? ` with experience at ${[...new Set(companies)].join(", ")}` : ""}. Your history provides evidence for ${matched.length} of ${(ctx.state.match as unknown[]).length} stated requirements.`,
          ``,
          `### Experience`,
          exp,
          ``,
          `# Cover letter`,
          opening,
          ``,
          `I am applying for the ${targetRole} role.${evidenceParas.length ? "" : " [Add two or three examples from your experience that match the role.]"}`,
          ``,
          ...evidenceParas.map((p) => `${p}\n`),
          `I would welcome the chance to discuss how my experience fits your team.`,
          ``,
          close,
          fullName,
        ].join("\n");
      },
    },
  ],
  finalize: (ctx) => {
    const match = ctx.state.match as { req: string; evidence: string | null; matched: boolean }[];
    const gaps = match.filter((m) => !m.matched);
    const table = ["| Requirement | Evidence in your history |", "|---|---|", ...match.map((m) => `| ${escapeMd(m.req)} | ${m.matched ? escapeMd(m.evidence ?? "") : "⚠ Not found"} |`)].join("\n");
    const gapMd = gaps.length
      ? `## Gaps to address\nThese requirements are not evidenced in the history you provided. Add real examples if you have them — do not claim them otherwise.\n${gaps.map((g) => `- [ ] ${g.req}`).join("\n")}`
      : "## Gaps to address\nEvery extracted requirement has supporting evidence in your history.";
    return out(ctx, `${ctx.state.draft}\n\n---\n\n## Requirement match\n${table}\n\n${gapMd}`, { data: { requirements: match } });
  },
};

// ───────────────────────── Prompt optimizer ─────────────────────────

function analysePrompt(draft: string) {
  const issues: { issue: string; fix: string }[] = [];
  const w = words(draft);
  if (w.length < 15) issues.push({ issue: "Very short prompt with little context", fix: "Add who the output is for, the input it works on and what good looks like." });
  const vague = [...new Set(draft.match(/\b(good|nice|some|etc|stuff|things|maybe|properly|better|interesting|nicely)\b/gi) ?? [])];
  if (vague.length) issues.push({ issue: `Vague wording: ${vague.map((v) => `"${v}"`).join(", ")}`, fix: "Replace with measurable criteria (length, audience, required elements)." });
  if (!/(format|json|bullet|list|table|markdown|heading|paragraph|xml|csv)/i.test(draft)) issues.push({ issue: "No output format specified", fix: "State the exact structure of the response." });
  if (!/\d+\s*(words?|bullets?|sentences?|characters?|items?|points?|paragraphs?)/i.test(draft)) issues.push({ issue: "No length constraint", fix: "Give a concrete length limit." });
  if (!/(you are|act as|audience|for (a|an|the) |reader)/i.test(draft)) issues.push({ issue: "No role or audience", fix: "Define the role the model plays and who reads the output." });
  if (/\b(this|the following|below|above) (article|text|document|email|data)\b/i.test(draft) && !/<\w+>|"""|```|\{\{/.test(draft))
    issues.push({ issue: "Refers to an input without a delimited input block", fix: "Put the input inside clear delimiters, e.g. <article>…</article>." });
  if (/\b(don't|do not|never|avoid)\b/i.test(draft) && !/\b(instead|rather)\b/i.test(draft)) issues.push({ issue: "Negative-only instructions", fix: "Say what to do instead, not only what to avoid." });
  if ((draft.match(/\b(and also|also|additionally)\b/gi) ?? []).length >= 3) issues.push({ issue: "Several tasks in one instruction", fix: "Number the tasks or split them into steps." });
  return issues;
}

const promptOptimizer: ProductSpec<{ draft: string; goal: string; family: "any" | "openai" | "anthropic" | "gemini" }> = {
  meta: getRunnable("ai-prompt-optimizer")!,
  schema: z.object({
    draft: z.string().trim().min(5, "Enter a draft prompt.").max(8000),
    goal: z.string().trim().min(3, "Describe the outcome you want.").max(400),
    family: z.enum(["any", "openai", "anthropic", "gemini"]).default("any"),
  }),
  steps: () => [
    { kind: "compute", id: "analysis", label: "Analyse draft for ambiguity", agent: "Reviewer", run: (ctx) => analysePrompt(ctx.input.draft) },
    {
      kind: "llm",
      id: "optimize",
      label: "Rewrite prompt",
      agent: "Prompt engineer",
      stream: true,
      maxTokens: 2000,
      build: (ctx) => [
        sys(
          `You are a senior prompt engineer. Rewrite the user's draft prompt so it reliably achieves their goal on ${ctx.input.family === "any" ? "any major model" : ctx.input.family} models. Structure it as role, context, task, constraints and output format. Keep any placeholders the user needs. Respond in Markdown with exactly these sections: '## Optimized prompt' (inside a fenced code block), '## What changed and why' (bullets), '## Suggested test inputs' (3 bullets).`,
        ),
        user(`Goal: ${ctx.input.goal}\n\nIssues already detected: ${JSON.stringify(ctx.state.analysis)}\n\nDraft prompt:\n${wrapUntrusted("draft prompt", ctx.input.draft)}`),
      ],
      sandbox: (ctx) => {
        const { draft, goal, family } = ctx.input;
        const issues = ctx.state.analysis as { issue: string; fix: string }[];
        const task = sentence(draft.replace(/\b(etc|maybe|some|nice|good)\b\.?/gi, "").replace(/\s+/g, " ").trim());
        const xml = family === "anthropic";
        const sec = (tag: string, body: string) => (xml ? `<${tag}>\n${body}\n</${tag}>` : `### ${titleCase(tag.replace(/_/g, " "))}\n${body}`);
        const prompt = [
          sec("role", "You are an expert assistant producing work for the audience described below."),
          sec("goal", sentence(goal)),
          sec("task", task),
          sec("input", xml ? "<input>\n{{INPUT}}\n</input>" : '"""\n{{INPUT}}\n"""'),
          sec("constraints", ["Use only information present in the input.", "If something required is missing, say what is missing instead of guessing.", "Write in plain, specific language."].map((c) => `- ${c}`).join("\n")),
          sec("output_format", "[Specify the exact structure and length here — e.g. 5 bullets of at most 20 words each.]"),
        ].join("\n\n");
        return [
          "## Optimized prompt",
          "```text",
          prompt,
          "```",
          "",
          "## What changed and why",
          ...issues.map((i) => `- **${i.issue}** → ${i.fix}`),
          "- Separated role, goal, task, input and constraints so each can be tested and edited independently.",
          "",
          "## Suggested test inputs",
          "- A typical input from your real workload",
          "- An input that is missing information the task needs",
          "- An unusually long input, to check the length constraint holds",
        ].join("\n");
      },
    },
  ],
  finalize: (ctx) => {
    const issues = ctx.state.analysis as { issue: string; fix: string }[];
    return out(ctx, ctx.state.optimize, { data: { issues } });
  },
};

// ───────────────────────── PDF summarizer ─────────────────────────

const pdfSummarizer: ProductSpec<{ fileName: string; pages: string[]; length: "brief" | "standard" | "detailed" }> = {
  meta: getRunnable("ai-pdf-summarizer")!,
  schema: z.object({
    fileName: z.string().max(300),
    pages: z.array(z.string().max(200_000)).min(1, "The document has no pages.").max(500, "Documents over 500 pages are not supported."),
    length: z.enum(["brief", "standard", "detailed"]).default("standard"),
  }),
  steps: () => [
    {
      kind: "compute",
      id: "stats",
      label: "Extract and inspect text",
      agent: "Extractor",
      run: (ctx) => {
        const perPage = ctx.input.pages.map((p) => words(p).length);
        const total = perPage.reduce((a, b) => a + b, 0);
        if (total < 30) {
          const e = new Error("This document contains no extractable text — it is probably a scanned image. OCR is not enabled, so it cannot be summarised.") as Error & { code: string };
          e.code = "scanned_pdf";
          throw e;
        }
        const imagePages = perPage.map((n, i) => (n < 20 ? i + 1 : 0)).filter(Boolean);
        if (imagePages.length && imagePages.length < perPage.length)
          ctx.warnings.push(`Pages ${imagePages.slice(0, 10).join(", ")}${imagePages.length > 10 ? "…" : ""} have little or no text (possibly images) and were not summarised.`);
        const inj = detectInjection(ctx.input.pages.join("\n"));
        if (inj.length) ctx.warnings.push("The document contains text that looks like instructions to an AI. It was treated as content only.");
        return { pages: perPage.length, words: total, imagePages };
      },
    },
    {
      kind: "compute",
      id: "keypoints",
      label: "Rank key passages by page",
      agent: "Extractor",
      run: (ctx) => {
        const n = { brief: 5, standard: 8, detailed: 12 }[ctx.input.length];
        const all = ctx.input.pages.flatMap((p, i) => topSentences(p, 3).map((s) => ({ ...s, page: i + 1 })));
        return all
          .sort((a, b) => b.score - a.score)
          .slice(0, n)
          .sort((a, b) => a.page - b.page || a.index - b.index)
          .map((s) => ({ text: s.sentence, page: s.page }));
      },
    },
    {
      kind: "llm",
      id: "summary",
      label: "Write summary",
      agent: "Summariser",
      stream: true,
      maxTokens: 1800,
      build: (ctx) => {
        const tagged = ctx.input.pages.map((p, i) => `[Page ${i + 1}]\n${p}`).join("\n\n").slice(0, 180_000);
        const len = { brief: "one paragraph of about 80 words", standard: "two to three paragraphs (about 200 words)", detailed: "a structured summary with short headings (about 450 words)" }[ctx.input.length];
        return [
          sys(`You summarise documents faithfully. Write ${len} in Markdown under the heading '## Summary'. After each claim, cite the page as (p. N). Do not add information that is not in the document.`),
          user(`Document "${ctx.input.fileName}":\n${wrapUntrusted(ctx.input.fileName, tagged)}`),
        ];
      },
      sandbox: (ctx) => {
        const n = { brief: 3, standard: 5, detailed: 8 }[ctx.input.length];
        const full = ctx.input.pages.map((p, i) => ({ p, i }));
        const picks = full.flatMap(({ p, i }) => topSentences(p, 2).map((s) => ({ ...s, page: i + 1 }))).sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.page - b.page || a.index - b.index);
        return `## Summary\n${picks.map((s) => `${s.sentence} (p. ${s.page})`).join(" ")}`;
      },
    },
  ],
  finalize: (ctx) => {
    const kp = ctx.state.keypoints as { text: string; page: number }[];
    const st = ctx.state.stats as { pages: number; words: number };
    const md = `${ctx.state.summary}\n\n## Key points\n${kp.map((k) => `- ${k.text} *(p. ${k.page})*`).join("\n")}\n\n## Document\n- File: ${ctx.input.fileName}\n- Pages: ${st.pages}\n- Words extracted: ${st.words.toLocaleString("en")}`;
    return out(ctx, md, { data: { keyPoints: kp, stats: st } });
  },
};

// ───────────────────────── Product description ─────────────────────────

const copySchema = z.object({
  headline: z.string().min(3).max(200),
  description: z.string().min(20).max(3000),
  bullets: z.array(z.string().min(2).max(300)).min(2).max(10),
  metaTitle: z.string().min(5).max(200),
  metaDescription: z.string().min(20).max(400),
});

const productDescription: ProductSpec<{ name: string; attributes: string; audience: string; tone: "premium" | "friendly" | "technical" }> = {
  meta: getRunnable("ai-product-description-generator")!,
  schema: z.object({
    name: z.string().trim().min(2).max(160),
    attributes: z.string().trim().min(10, "Add at least one attribute.").max(4000),
    audience: z.string().trim().min(3).max(200),
    tone: z.enum(["premium", "friendly", "technical"]).default("friendly"),
  }),
  steps: () => [
    { kind: "compute", id: "facts", label: "Parse attributes", agent: "Analyst", run: (ctx) => bulletLines(ctx.input.attributes).slice(0, 30) },
    {
      kind: "llm",
      id: "copy",
      label: "Write product copy",
      agent: "Copywriter",
      json: true,
      maxTokens: 1500,
      build: (ctx) => [
        sys(
          `You are an e-commerce copywriter. Tone: ${ctx.input.tone}. Use ONLY the facts provided — never invent materials, certifications, numbers or guarantees. Return JSON only: {"headline": string (max 80 chars), "description": string (120-220 words), "bullets": string[] (4-6), "metaTitle": string (max 60 chars), "metaDescription": string (max 155 chars)}.`,
        ),
        user(`Product: ${ctx.input.name}\nAudience: ${ctx.input.audience}\nFacts:\n${wrapUntrusted("attributes", (ctx.state.facts as string[]).map((f) => `- ${f}`).join("\n"))}`),
      ],
      sandbox: (ctx) => {
        const { name, audience, tone } = ctx.input;
        const f = ctx.state.facts as string[];
        const lead = { premium: `Meet the ${name}.`, friendly: `Say hello to the ${name}.`, technical: `${name}: specifications at a glance.` }[tone];
        const listed = f.slice(0, 3).map((x) => x.charAt(0).toLowerCase() + x.slice(1));
        return JSON.stringify({
          headline: truncate(`${name} — ${f[0] ?? ""}`, 80),
          description: `${lead} Made for ${audience.charAt(0).toLowerCase() + audience.slice(1)}, it combines ${listed.join(", ").replace(/, ([^,]*)$/, " and $1")}.${f.length > 3 ? ` It also features ${f.slice(3).map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join("; ")}.` : ""}`,
          bullets: f.slice(0, 6).map((x) => cap(x)),
          metaTitle: truncate(`${name} | ${f[0] ?? audience}`, 60),
          metaDescription: truncate(`${name} for ${audience.charAt(0).toLowerCase() + audience.slice(1)}: ${f.slice(0, 3).join(", ")}.`, 155),
        });
      },
      after: (text, ctx) => {
        const parsed = copySchema.safeParse(parseJsonObject(text));
        if (!parsed.success) throw new Error("The model returned copy in an unexpected format. Please retry.");
        const c = parsed.data;
        if (c.metaTitle.length > 60) {
          c.metaTitle = truncate(c.metaTitle, 60);
          ctx.warnings.push("Meta title was shortened to 60 characters.");
        }
        if (c.metaDescription.length > 155) {
          c.metaDescription = truncate(c.metaDescription, 155);
          ctx.warnings.push("Meta description was shortened to 155 characters.");
        }
        // Grounding check: numbers in the copy must appear in the attributes.
        const factNums = new Set(ctx.input.attributes.match(/\d+(?:[.,]\d+)?/g) ?? []);
        const copyNums = [...new Set(JSON.stringify(c).match(/\d+(?:[.,]\d+)?/g) ?? [])].filter((n) => !factNums.has(n));
        if (copyNums.length) ctx.warnings.push(`The copy contains figures that are not in your attributes (${copyNums.join(", ")}). Check them before publishing.`);
        ctx.state.copy = c;
      },
    },
  ],
  finalize: (ctx) => {
    const c = ctx.state.copy as z.infer<typeof copySchema>;
    const md = `## ${c.headline}\n\n${c.description}\n\n${c.bullets.map((b) => `- ${b}`).join("\n")}\n\n### SEO\n| Field | Value | Length |\n|---|---|---|\n| Meta title | ${escapeMd(c.metaTitle)} | ${c.metaTitle.length}/60 |\n| Meta description | ${escapeMd(c.metaDescription)} | ${c.metaDescription.length}/155 |`;
    return out(ctx, md, { data: c });
  },
};

// ───────────────────────── Email assistant ─────────────────────────

const emailAssistant: ProductSpec<{ points: string; original?: string; recipient?: string; tone: string; length: "short" | "medium" | "long" }> = {
  meta: getRunnable("ai-email-writing-assistant")!,
  schema: z.object({
    points: z.string().trim().min(3, "Add at least one point.").max(3000),
    original: z.string().max(12000).optional().default(""),
    recipient: z.string().max(120).optional().default(""),
    tone: z.enum(["professional", "friendly", "firm", "apologetic"]).default("professional"),
    length: z.enum(["short", "medium", "long"]).default("medium"),
  }),
  steps: () => [
    {
      kind: "compute",
      id: "context",
      label: "Read context safely",
      agent: "Reader",
      run: (ctx) => {
        const original = ctx.input.original ?? "";
        if (original && detectInjection(original).length) ctx.warnings.push("The quoted email contains text that looks like instructions to an AI. It was ignored as instructions and treated only as the message you are replying to.");
        const signOff = original.trim().split(/\n/).map((l) => l.trim()).filter(Boolean).pop();
        const guessed = signOff && /^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(signOff) ? signOff : "";
        return { recipient: ctx.input.recipient || guessed, isReply: !!original.trim() };
      },
    },
    {
      kind: "llm",
      id: "draft",
      label: "Draft email",
      agent: "Writer",
      stream: true,
      maxTokens: 1200,
      build: (ctx) => [
        sys(
          `You write clear emails. Tone: ${ctx.input.tone}. Length: ${ctx.input.length}. Cover every point the user lists and nothing they did not ask for; do not make promises beyond the points. Output exactly:\nSubject: <subject>\n\n<email body>\n\n---\n**Short alternative**\n\n<2-3 sentence version>`,
        ),
        user(`Recipient: ${ctx.state.context.recipient || "unknown"}\nPoints to cover:\n${wrapUntrusted("user points", ctx.input.points)}${ctx.input.original ? `\n\nEmail being replied to:\n${wrapUntrusted("quoted email", ctx.input.original)}` : ""}`),
      ],
      sandbox: (ctx) => {
        const { tone, length } = ctx.input;
        const { recipient, isReply } = ctx.state.context as { recipient: string; isReply: boolean };
        const pts = bulletLines(ctx.input.points).map(sentence);
        const greet = { professional: "Hello", friendly: "Hi", firm: "Hello", apologetic: "Hi" }[tone];
        const open = isReply
          ? { professional: "Thank you for your message.", friendly: "Thanks for getting in touch.", firm: "Thank you for your email.", apologetic: "Thank you for letting us know, and I'm sorry for the trouble." }[tone]
          : { professional: "I'm writing about the following.", friendly: "A quick note from me.", firm: "I'm writing to set out the following clearly.", apologetic: "I want to start by apologising." }[tone];
        const shown = length === "short" ? pts.slice(0, 4) : pts;
        const close = { professional: "Best regards,", friendly: "Cheers,", firm: "Regards,", apologetic: "With apologies and best regards," }[tone];
        const subject = isReply ? `Re: ${truncate(sentences(ctx.input.original ?? "")[0]?.replace(/^(hi|hello|dear)[^,]*,\s*/i, "") ?? "your message", 60)}` : truncate(pts[0]?.replace(/\.$/, "") ?? "Update", 60);
        return `Subject: ${subject}\n\n${greet}${recipient ? ` ${recipient}` : ""},\n\n${open}\n\n${shown.join("\n\n")}\n\n${close}\n[Your name]\n\n---\n**Short alternative**\n\n${greet}${recipient ? ` ${recipient}` : ""}, ${shown.slice(0, 2).join(" ")} ${close}`;
      },
    },
  ],
  finalize: (ctx) => out(ctx, ctx.state.draft),
};

// ───────────────────────── Invoice extractor ─────────────────────────

const invoiceSchema = z.object({
  vendor: z.string().nullable(),
  vendorVatId: z.string().nullable(),
  customer: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  issueDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  currency: z.string().nullable(),
  lines: z.array(z.object({ description: z.string(), quantity: z.number().nullable(), unitPrice: z.number().nullable(), amount: z.number() })),
  subtotal: z.number().nullable(),
  vatRate: z.number().nullable(),
  vat: z.number().nullable(),
  total: z.number().nullable(),
});

const invoiceExtractor: ProductSpec<{ text: string; fileName?: string }> = {
  meta: getRunnable("ai-invoice-data-extractor")!,
  schema: z.object({ text: z.string().trim().min(20, "Upload an invoice or paste its text.").max(200_000), fileName: z.string().max(300).optional() }),
  steps: () => [
    { kind: "compute", id: "heuristic", label: "Locate fields", agent: "Extractor", run: (ctx) => extractInvoice(ctx.input.text) },
    {
      kind: "llm",
      id: "model",
      label: "Extract structured data",
      agent: "Extractor",
      json: true,
      maxTokens: 2500,
      build: (ctx) => [
        sys(
          `Extract invoice data as JSON matching exactly: ${JSON.stringify(z.toJSONSchema(invoiceSchema))}. Dates as YYYY-MM-DD. Numbers as plain numbers. Use null for anything not present — never guess.`,
        ),
        user(wrapUntrusted("invoice", ctx.input.text.slice(0, 60_000))),
      ],
      sandbox: (ctx) => JSON.stringify(ctx.state.heuristic.data),
      after: (text, ctx) => {
        const parsed = invoiceSchema.safeParse(parseJsonObject(text));
        if (!parsed.success) {
          ctx.warnings.push("Model output did not match the invoice schema; falling back to rule-based extraction.");
          ctx.state.model = ctx.state.heuristic.data;
          return;
        }
        ctx.state.model = parsed.data;
        // Cross-check model totals against the rule-based reading of the document.
        const h = ctx.state.heuristic.data as InvoiceData;
        for (const k of ["subtotal", "vat", "total"] as const)
          if (h[k] != null && parsed.data[k] != null && Math.abs(h[k]! - parsed.data[k]!) > 0.02) ctx.warnings.push(`Model and rule-based readings of ${k} differ (${parsed.data[k]} vs ${h[k]}). Check the source.`);
      },
    },
    { kind: "compute", id: "validation", label: "Validate arithmetic", agent: "Validator", run: (ctx) => validateInvoice(ctx.state.model as InvoiceData) },
  ],
  finalize: (ctx) => {
    const d = ctx.state.model as InvoiceData;
    const v = ctx.state.validation as ReturnType<typeof validateInvoice>;
    const missing = ctx.state.heuristic.missing as Record<string, string>;
    const money = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)}${d.currency ? ` ${d.currency}` : ""}`);
    const fields: [string, string | null][] = [
      ["Vendor", d.vendor], ["Vendor VAT ID", d.vendorVatId], ["Customer", d.customer], ["Invoice number", d.invoiceNumber],
      ["Issue date", d.issueDate], ["Due date", d.dueDate], ["Currency", d.currency], ["Subtotal", money(d.subtotal)],
      ["VAT", d.vat == null ? null : `${money(d.vat)}${d.vatRate != null ? ` (${d.vatRate}%)` : ""}`], ["Total", money(d.total)],
    ];
    const md = [
      "## Extracted fields",
      "| Field | Value |",
      "|---|---|",
      ...fields.map(([k, val]) => `| ${k} | ${val == null || val === "—" ? "⚠ not found" : escapeMd(val)} |`),
      "",
      "## Line items",
      d.lines.length ? ["| Description | Qty | Unit price | Amount |", "|---|---:|---:|---:|", ...d.lines.map((l) => `| ${escapeMd(l.description)} | ${l.quantity ?? "—"} | ${l.unitPrice?.toFixed(2) ?? "—"} | ${l.amount.toFixed(2)} |`)].join("\n") : "_No line items recognised._",
      "",
      "## Validation",
      v.length ? v.map((x) => `- ${x.ok ? "✅" : "❌"} ${x.check} — ${x.detail}`).join("\n") : "_Not enough fields found to validate totals._",
      ...(ctx.sandbox && Object.keys(missing).length ? ["", "## Not found", ...Object.entries(missing).map(([k, r]) => `- **${k}**: ${r}`)] : []),
    ].join("\n");
    return out(ctx, md, { data: { invoice: d, validation: v, csv: invoiceLinesCsv(d) } });
  },
};

// ───────────────────────── SEO content ─────────────────────────

function seoOutline(kw: string, intent: string, audience: string, secondary: string[]) {
  const K = titleCase(kw);
  const sections: Record<string, string[]> = {
    informational: [`What is ${kw}?`, `Why ${kw} matters for ${audience.toLowerCase()}`, `How ${kw} works`, `Getting started: a step-by-step approach`, `Common mistakes to avoid`, `Measuring results`],
    commercial: [`What to look for in ${kw}`, `Key features compared`, `Pricing and total cost`, `Pros and cons`, `How to choose for your situation`],
    transactional: [`What you get with ${kw}`, `Who it is for`, `How to get started today`, `Pricing and what's included`, `Next steps`],
  };
  const h2 = sections[intent] ?? sections.informational;
  const assigned = h2.map((h, i) => ({ h2: h, include: secondary.filter((_, j) => j % h2.length === i) }));
  const faq = [`How long does it take to set up ${kw}?`, `How much does ${kw} cost?`, `Is ${kw} worth it for ${audience.toLowerCase()}?`, `What are common alternatives to ${kw}?`];
  const metaTitle = truncate(`${K}: ${intent === "commercial" ? "How to Choose" : intent === "transactional" ? "Get Started" : "A Practical Guide"}`, 60);
  const metaDescription = truncate(`${K} explained for ${audience.toLowerCase()}: ${h2.slice(0, 3).map((h) => h.toLowerCase().replace(/\?$/, "")).join(", ")}.`, 155);
  return { h1: `${K}: ${intent === "commercial" ? "A Buyer's Guide" : "A Practical Guide"}`, sections: assigned, faq, metaTitle, metaDescription };
}

const seoContent: ProductSpec<{ keyword: string; secondary: string; intent: "informational" | "commercial" | "transactional"; audience: string; words: "800" | "1500" | "2500" }> = {
  meta: getRunnable("ai-seo-content-generator")!,
  schema: z.object({
    keyword: z.string().trim().min(2).max(120),
    secondary: z.string().max(400).optional().default(""),
    intent: z.enum(["informational", "commercial", "transactional"]).default("informational"),
    audience: z.string().trim().min(3).max(200),
    words: z.enum(["800", "1500", "2500"]).default("1500"),
  }),
  steps: () => [
    {
      kind: "compute",
      id: "outline",
      label: "Build outline from intent",
      agent: "Strategist",
      run: (ctx) => seoOutline(ctx.input.keyword, ctx.input.intent, ctx.input.audience, ctx.input.secondary.split(",").map((s) => s.trim()).filter(Boolean)),
    },
    {
      kind: "llm",
      id: "article",
      label: "Draft article",
      agent: "Writer",
      stream: true,
      maxTokens: Math.round(4000),
      build: (ctx) => [
        sys(
          `You are an SEO content writer who writes for readers first. Write about ${ctx.input.words} words in Markdown following the outline exactly (H1, H2s), then an '## FAQ' section answering the listed questions. Do not claim statistics, search volumes or rankings unless they are in the input. Use the primary keyword naturally in the H1, intro and one H2.`,
        ),
        user(`Primary keyword: ${ctx.input.keyword}\nAudience: ${ctx.input.audience}\nIntent: ${ctx.input.intent}\nOutline: ${JSON.stringify(ctx.state.outline)}`),
      ],
      sandbox: (ctx) => {
        const o = ctx.state.outline as ReturnType<typeof seoOutline>;
        const per = Math.round(Number(ctx.input.words) / (o.sections.length + 1));
        return [
          `# ${o.h1}`,
          "",
          `> **Sandbox:** article prose is written by a configured AI provider. This sandbox run returns the full outline with a writing brief for each section (~${per} words each), which you can hand to a writer.`,
          "",
          `**Intro brief:** Open with the problem ${ctx.input.audience.toLowerCase()} face, use "${ctx.input.keyword}" in the first two sentences, and state what the reader will be able to do after reading.`,
          "",
          ...o.sections.flatMap((s) => [`## ${s.h2}`, `**Brief:** ~${per} words.${s.include.length ? ` Work in: ${s.include.map((k) => `"${k}"`).join(", ")}.` : ""} Use a concrete example relevant to ${ctx.input.audience.toLowerCase()}.`, ""]),
          "## FAQ",
          ...o.faq.map((q) => `### ${q}\n**Brief:** Answer in 40–60 words.`),
        ].join("\n");
      },
    },
  ],
  finalize: (ctx) => {
    const o = ctx.state.outline as ReturnType<typeof seoOutline>;
    const md = `${ctx.state.article}\n\n---\n\n## Meta tags\n| Tag | Value | Length |\n|---|---|---|\n| Title | ${escapeMd(o.metaTitle)} | ${o.metaTitle.length}/60 |\n| Description | ${escapeMd(o.metaDescription)} | ${o.metaDescription.length}/155 |\n\n## Internal link ideas\n${o.sections.slice(0, 4).map((s) => `- Link from "${s.h2.replace(/\?$/, "")}" to a related page on your site`).join("\n")}\n\n_Keyword volumes and rankings are not estimated. Use your own SEO tool for keyword data._`;
    return out(ctx, md, { data: { outline: o } });
  },
};

// ───────────────────────── Knowledge base agent ─────────────────────────

interface Cite {
  n: number;
  source: string;
  page: number | null;
  excerpt: string;
}

const kbAgent: ProductSpec<{ question: string; docs: SourceDoc[] }> = {
  meta: getRunnable("ai-knowledge-base-agent")!,
  schema: z.object({ question: z.string().trim().min(3, "Ask a question.").max(500), docs: z.array(sourceDoc).min(1, "Add at least one document or choose a knowledge base.").max(200) }),
  steps: () => [
    {
      kind: "compute",
      id: "retrieve",
      label: "Retrieve relevant passages",
      agent: "Retriever",
      run: (ctx) => {
        const chunks = ctx.input.docs.flatMap((d) => chunkDocument(d));
        const hits = new Bm25Index(chunks).search(ctx.input.question, 5);
        if (hits.some((h) => detectInjection(h.chunk.text).length)) ctx.warnings.push("A retrieved passage contains text that looks like instructions to an AI. It was used only as information.");
        return { chunks: chunks.length, hits: hits.map((h, i) => ({ n: i + 1, source: h.chunk.docName, page: h.chunk.page, text: h.chunk.text, score: Math.round(h.score * 100) / 100 })) };
      },
    },
    {
      kind: "llm",
      id: "answer",
      label: "Answer from evidence",
      agent: "Answerer",
      stream: true,
      maxTokens: 900,
      skip: (ctx) => (ctx.state.retrieve.hits.length ? false : "no relevant passages found"),
      build: (ctx) => [
        sys(
          "Answer the question using ONLY the numbered passages. Cite passages inline as [n]. If the passages do not contain the answer, reply exactly: 'I couldn't find this in your documents.' and suggest what document might contain it. Be concise.",
        ),
        user(`Question: ${ctx.input.question}\n\nPassages:\n${ctx.state.retrieve.hits.map((h: { n: number; text: string; source: string }) => `[${h.n}] (${h.source})\n${wrapUntrusted(h.source, h.text)}`).join("\n\n")}`),
      ],
      sandbox: (ctx) => {
        const q = new Set(terms(ctx.input.question));
        const picks = (ctx.state.retrieve.hits as { n: number; text: string }[])
          .flatMap((h) => sentences(h.text).map((s) => ({ s, n: h.n, overlap: terms(s).filter((t) => q.has(t)).length })))
          .filter((x) => x.overlap > 0)
          .sort((a, b) => b.overlap - a.overlap)
          .slice(0, 3);
        if (!picks.length) return "I couldn't find this in your documents.";
        return `From your documents:\n\n${picks.map((p) => `- ${p.s} [${p.n}]`).join("\n")}`;
      },
    },
  ],
  finalize: (ctx) => {
    const hits = ctx.state.retrieve.hits as (Cite & { text: string })[];
    if (!hits.length) return out(ctx, "I couldn't find anything related to this question in your documents. Try different wording, or add the document that covers it.", { citations: [] });
    const citations: Cite[] = hits.map((h) => ({ n: h.n, source: h.source, page: h.page, excerpt: truncate(h.text, 280) }));
    const md = `${ctx.state.answer}\n\n## Sources\n${citations.map((c) => `${c.n}. **${c.source}**${c.page ? `, p. ${c.page}` : ""} — “${c.excerpt}”`).join("\n")}`;
    return out(ctx, md, { citations });
  },
};

// ───────────────────────── Multi-agent research team ─────────────────────────

interface Evidence {
  q: string;
  hits: { label: string; source: string; page: number | null; excerpt: string; score: number }[];
}

function decompose(question: string): string[] {
  const core = question.replace(/^(what|how|why|which|who|when|where|is|are|does|do|can|should)\b\s*/i, "").replace(/\?$/, "").trim();
  const parts = core.split(/,?\s+and\s+(?=what|how|why|which)/i);
  const subs = parts.length > 1 ? parts.map((p) => sentence(p).replace(/\.$/, "?")) : [];
  return [
    ...subs,
    ...(subs.length ? [] : [`What do the sources say about ${core.toLowerCase()}?`]),
    `What causes or factors do the sources identify?`,
    `What solutions, policies or recommendations do the sources describe?`,
    `What limitations, risks or disagreements do the sources mention?`,
  ].slice(0, 5);
}

const researchTeam: ProductSpec<{ question: string; docs: SourceDoc[]; urls: string[]; approveFetch: boolean; depth: "brief" | "standard" }> = {
  meta: getRunnable("multi-agent-research-team")!,
  schema: z.object({
    question: z.string().trim().min(8, "Enter a research question.").max(400),
    docs: z.array(sourceDoc).max(50).default([]),
    urls: z.array(z.string().url().max(2000)).max(5, "At most 5 URLs per run.").default([]),
    approveFetch: z.boolean().default(false),
    depth: z.enum(["brief", "standard"]).default("standard"),
  }),
  steps: (_ctx, deps) => [
    {
      kind: "compute",
      id: "gather",
      label: "Gather approved sources",
      agent: "Researcher",
      run: async (ctx) => {
        const docs: SourceDoc[] = [...ctx.input.docs];
        if (ctx.input.urls.length && !ctx.input.approveFetch) ctx.warnings.push(`${ctx.input.urls.length} URL(s) were not fetched because fetching was not approved for this run.`);
        if (ctx.input.urls.length && ctx.input.approveFetch) {
          if (!deps.fetchUrl) ctx.warnings.push("URL fetching is not available in this environment.");
          else
            for (const u of ctx.input.urls) {
              try {
                const r = await deps.fetchUrl(u);
                if (r.text.trim().length > 50) docs.push({ id: `url${docs.length}`, name: r.url, pages: [r.text.slice(0, 200_000)] });
                else ctx.warnings.push(`${u} returned no readable text.`);
              } catch (e) {
                ctx.warnings.push(`Could not fetch ${u}: ${(e as Error).message}`);
              }
            }
        }
        if (!docs.length) throw Object.assign(new Error("Provide at least one source: paste text, upload a document, or approve fetching URLs."), { code: "no_sources" });
        return docs.map((d, i) => ({ ...d, label: `S${i + 1}` }));
      },
    },
    {
      kind: "llm",
      id: "plan",
      label: "Plan sub-questions",
      agent: "Planner",
      json: true,
      maxTokens: 600,
      build: (ctx) => [
        sys('You are a research planner. Break the question into 3-5 specific sub-questions that the provided sources could answer. Return JSON only: {"subquestions": string[]}.'),
        user(`Question: ${ctx.input.question}\nSources available: ${(ctx.state.gather as { label: string; name: string }[]).map((d) => `${d.label} ${d.name}`).join("; ")}`),
      ],
      sandbox: (ctx) => JSON.stringify({ subquestions: decompose(ctx.input.question) }),
      after: (text, ctx) => {
        try {
          const p = z.object({ subquestions: z.array(z.string().min(5).max(300)).min(2).max(6) }).parse(parseJsonObject(text));
          ctx.state.plan = p.subquestions;
        } catch {
          ctx.warnings.push("The planner's output was malformed; a default plan was used.");
          ctx.state.plan = decompose(ctx.input.question);
        }
      },
    },
    {
      kind: "compute",
      id: "research",
      label: "Collect evidence per sub-question",
      agent: "Researcher",
      run: (ctx) => {
        const docs = ctx.state.gather as (SourceDoc & { label: string })[];
        const labelOf = new Map(docs.map((d) => [d.id, d.label]));
        const index = new Bm25Index(docs.flatMap((d) => chunkDocument(d, 700, 120)));
        const k = ctx.input.depth === "brief" ? 2 : 3;
        // Evidence per sub-question: the sentences most relevant to that sub-question,
        // avoiding sentences already cited for an earlier sub-question.
        const used = new Set<string>();
        const qTerms = new Set(terms(ctx.input.question));
        const ev: Evidence[] = (ctx.state.plan as string[]).map((q) => {
          const sq = new Set(terms(q).filter((t) => !["source", "describe", "identify", "mention", "say"].includes(t)));
          const hits: Evidence["hits"] = [];
          for (const h of index.search(`${q} ${q} ${ctx.input.question}`, k + 2)) {
            const ranked = sentences(h.chunk.text)
              .filter((s) => !used.has(s))
              .map((s) => {
                const ts = terms(s);
                return { s, score: ts.filter((t) => sq.has(t)).length * 2 + ts.filter((t) => qTerms.has(t)).length * 0.5 };
              })
              .filter((x) => x.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 2);
            if (!ranked.length) continue;
            ranked.forEach((r) => used.add(r.s));
            hits.push({ label: labelOf.get(h.chunk.docId) ?? "S?", source: h.chunk.docName, page: h.chunk.page, excerpt: ranked.map((r) => r.s).join(" "), score: Math.round(h.score * 100) / 100 });
            if (hits.length >= k) break;
          }
          return { q, hits };
        });
        if (ev.some((e) => e.hits.some((h) => detectInjection(h.excerpt).length))) ctx.warnings.push("A source contains text that looks like instructions to an AI. It was treated only as evidence.");
        return ev;
      },
    },
    {
      kind: "llm",
      id: "critique",
      label: "Check claims against evidence",
      agent: "Critic",
      json: true,
      maxTokens: 800,
      build: (ctx) => [
        sys('You are a critical reviewer. For each sub-question, judge whether the evidence actually answers it. Return JSON only: {"issues": [{"subquestion": string, "issue": string}]}. Only list real problems: missing, weak, single-source or conflicting evidence.'),
        user(wrapUntrusted("evidence table", JSON.stringify(ctx.state.research))),
      ],
      sandbox: (ctx) => {
        const ev = ctx.state.research as Evidence[];
        const docs = ctx.state.gather as { label: string }[];
        const issues: { subquestion: string; issue: string }[] = [];
        for (const e of ev) {
          if (!e.hits.length) issues.push({ subquestion: e.q, issue: "No evidence found in the sources." });
          else if (e.hits[0].score < 1.5) issues.push({ subquestion: e.q, issue: "Only weakly related passages were found." });
          else if (new Set(e.hits.map((h) => h.label)).size === 1 && docs.length > 1) issues.push({ subquestion: e.q, issue: `Supported by a single source (${e.hits[0].label}).` });
        }
        const used = new Set(ev.flatMap((e) => e.hits.map((h) => h.label)));
        for (const d of docs) if (!used.has(d.label)) issues.push({ subquestion: "—", issue: `Source ${d.label} was not used as evidence for any sub-question.` });
        return JSON.stringify({ issues });
      },
      after: (text, ctx) => {
        try {
          ctx.state.critique = z.object({ issues: z.array(z.object({ subquestion: z.string(), issue: z.string() })) }).parse(parseJsonObject(text)).issues;
        } catch {
          ctx.state.critique = [];
          ctx.warnings.push("The critic's output was malformed and was skipped.");
        }
      },
    },
    {
      kind: "llm",
      id: "report",
      label: "Write cited report",
      agent: "Writer",
      stream: true,
      maxTokens: 2500,
      build: (ctx) => [
        sys(
          `You are a research writer. Write a ${ctx.input.depth} report in Markdown: '# <question>', '## Summary', one '## ' section per sub-question, and '## Gaps and caveats'. Every factual sentence must cite a source label like [S1]. Use ONLY the evidence provided; where the critic found gaps, say so rather than filling them.`,
        ),
        user(`Question: ${ctx.input.question}\n\nEvidence:\n${wrapUntrusted("evidence", JSON.stringify(ctx.state.research))}\n\nCritic findings: ${JSON.stringify(ctx.state.critique)}`),
      ],
      sandbox: (ctx) => {
        const ev = ctx.state.research as Evidence[];
        const issues = ctx.state.critique as { subquestion: string; issue: string }[];
        const summary = ev.filter((e) => e.hits.length).slice(0, 3).map((e) => `${sentences(e.hits[0].excerpt)[0] ?? e.hits[0].excerpt} [${e.hits[0].label}]`);
        return [
          `# ${ctx.input.question}`,
          "",
          "## Summary",
          summary.join(" ") || "The sources did not contain enough evidence to answer this question.",
          "",
          ...ev.flatMap((e) => [`## ${e.q}`, ...(e.hits.length ? e.hits.map((h) => `- ${h.excerpt} [${h.label}${h.page ? `, p. ${h.page}` : ""}]`) : ["- No evidence in the provided sources."]), ""]),
          "## Gaps and caveats",
          ...(issues.length ? issues.map((i) => `- ${i.subquestion !== "—" ? `**${i.subquestion}** — ` : ""}${i.issue}`) : ["- No gaps flagged by the critic."]),
        ].join("\n");
      },
    },
  ],
  finalize: (ctx) => {
    const docs = ctx.state.gather as (SourceDoc & { label: string })[];
    const ev = ctx.state.research as Evidence[];
    const table = ["| Sub-question | Sources | Top relevance |", "|---|---|---:|", ...ev.map((e) => `| ${escapeMd(e.q)} | ${[...new Set(e.hits.map((h) => h.label))].join(", ") || "—"} | ${e.hits[0]?.score ?? 0} |`)].join("\n");
    const md = `${ctx.state.report}\n\n## Evidence table\n${table}\n\n## Sources\n${docs.map((d) => `- **${d.label}** — ${d.name}`).join("\n")}`;
    return out(ctx, md, { data: { plan: ctx.state.plan, evidence: ev, critique: ctx.state.critique } });
  },
};

export const SPECS: Record<string, ProductSpec> = {
  [resume.meta.slug]: resume,
  [promptOptimizer.meta.slug]: promptOptimizer,
  [pdfSummarizer.meta.slug]: pdfSummarizer,
  [productDescription.meta.slug]: productDescription,
  [emailAssistant.meta.slug]: emailAssistant,
  [invoiceExtractor.meta.slug]: invoiceExtractor,
  [seoContent.meta.slug]: seoContent,
  [kbAgent.meta.slug]: kbAgent,
  [researchTeam.meta.slug]: researchTeam,
};

export const getSpec = (slug: string): ProductSpec | undefined => SPECS[slug];
