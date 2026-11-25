/** Text utilities shared by deterministic sandbox implementations and retrieval. */

const STOPWORDS = new Set(
  "a an and are as at be been but by can could did do does for from had has have he her his how i if in into is it its may more most no not of on or our she should so some such than that the their them then there these they this those to too was we were what when where which while who why will with would you your about also after all any before between both each just like only other over same through under up very".split(
    " ",
  ),
);

export function words(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9][a-z0-9'’-]*/g) ?? [];
}

export function terms(s: string): string[] {
  return words(s)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map((w) => w.replace(/(ies)$/, "y").replace(/(ing|ed|es|s)$/, ""));
}

export function sentences(s: string): string[] {
  return (
    s
      .replace(/\s+/g, " ")
      .match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)
      ?.map((x) => x.trim())
      .filter((x) => x.length > 25 && x.length < 600) ?? []
  );
}

/** Extractive summarisation: score sentences by normalised term frequency, keep original order. */
export function topSentences(text: string, n: number): { sentence: string; score: number; index: number }[] {
  const sents = sentences(text);
  if (!sents.length) return [];
  const tf = new Map<string, number>();
  for (const t of terms(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
  const max = Math.max(...tf.values(), 1);
  const scored = sents.map((sentence, index) => {
    const ts = terms(sentence);
    const score = ts.reduce((s, t) => s + (tf.get(t) ?? 0) / max, 0) / Math.sqrt(ts.length + 1) + (index === 0 ? 0.3 : 0);
    return { sentence, score, index };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .sort((a, b) => a.index - b.index);
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, "") + "…";
}

export function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w));
}

export function bulletLines(s: string): string[] {
  return s
    .split(/\r?\n|•|;(?=\s)/)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter((l) => l.length > 1);
}

export function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
