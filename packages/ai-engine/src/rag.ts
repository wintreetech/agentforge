import { terms } from "./text.ts";

export interface SourceDoc {
  id: string;
  name: string;
  /** Text per page (PDF) or a single entry for plain text. */
  pages: string[];
}

export interface Chunk {
  id: string;
  docId: string;
  docName: string;
  page: number | null;
  text: string;
}

export function chunkDocument(doc: SourceDoc, size = 900, overlap = 150): Chunk[] {
  const chunks: Chunk[] = [];
  doc.pages.forEach((pageText, pi) => {
    const text = pageText.replace(/\s+/g, " ").trim();
    if (!text) return;
    let start = 0;
    let n = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + size);
      if (end < text.length) {
        const stop = text.lastIndexOf(". ", end);
        if (stop > start + size * 0.5) end = stop + 1;
      }
      chunks.push({
        id: `${doc.id}:${pi + 1}:${n++}`,
        docId: doc.id,
        docName: doc.name,
        page: doc.pages.length > 1 ? pi + 1 : null,
        text: text.slice(start, end).trim(),
      });
      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  });
  return chunks;
}

export interface Hit {
  chunk: Chunk;
  score: number;
}

/** BM25 over chunks. Deterministic and dependency-free; used alone or fused with embeddings. */
export class Bm25Index {
  private docs: { chunk: Chunk; tf: Map<string, number>; len: number }[] = [];
  private df = new Map<string, number>();
  private avgLen = 0;
  constructor(chunks: Chunk[], private k1 = 1.4, private b = 0.75) {
    for (const chunk of chunks) {
      const ts = terms(chunk.text);
      const tf = new Map<string, number>();
      for (const t of ts) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.docs.push({ chunk, tf, len: ts.length });
    }
    this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(1, this.docs.length);
  }
  search(query: string, k = 5): Hit[] {
    const qs = [...new Set(terms(query))];
    const N = this.docs.length;
    const hits: Hit[] = [];
    for (const d of this.docs) {
      let score = 0;
      for (const q of qs) {
        const f = d.tf.get(q);
        if (!f) continue;
        const df = this.df.get(q) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        score += (idf * (f * (this.k1 + 1))) / (f + this.k1 * (1 - this.b + (this.b * d.len) / (this.avgLen || 1)));
      }
      if (score > 0) hits.push({ chunk: d.chunk, score });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, k);
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Reciprocal-rank fusion of lexical and vector results. */
export function fuse(lists: Hit[][], k = 60, limit = 5): Hit[] {
  const scores = new Map<string, { chunk: Chunk; score: number }>();
  for (const list of lists)
    list.forEach((h, rank) => {
      const cur = scores.get(h.chunk.id) ?? { chunk: h.chunk, score: 0 };
      cur.score += 1 / (k + rank + 1);
      scores.set(h.chunk.id, cur);
    });
  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
