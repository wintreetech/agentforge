import { Fragment, type ReactNode } from "react";

/**
 * Small, safe Markdown renderer for model output and docs. It builds React
 * elements (never innerHTML), so HTML in the source is shown as text. Links are
 * limited to http(s), mailto and same-site paths.
 */

function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:|mailto:)/i.test(h) || h.startsWith("/") || h.startsWith("#")) return h;
  return null;
}

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{inline(t.slice(2, -2), i)}</strong>);
    else if (m[3]) out.push(<em key={k}>{t.slice(1, -1)}</em>);
    else {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t)!;
      const href = safeHref(lm[2]);
      out.push(href ? <a key={k} href={href} rel="noopener noreferrer nofollow" target={href.startsWith("http") ? "_blank" : undefined}>{lm[1]}</a> : lm[1]);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++}><code>{buf.join("\n")}</code></pre>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(h[1].length, 3);
      const content = inline(h[2], k);
      blocks.push(level === 1 ? <h1 key={k++}>{content}</h1> : level === 2 ? <h2 key={k++}>{content}</h2> : <h3 key={k++}>{content}</h3>);
      i++;
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      blocks.push(<hr key={k++} />);
      i++;
      continue;
    }
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(
        <table key={k++}>
          <thead><tr>{head.map((c, j) => <th key={j}>{inline(c, j)}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, j)}</td>)}</tr>)}</tbody>
        </table>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
      const lis = items.map((it, j) => {
        const cb = /^\[( |x)\]\s+(.*)$/i.exec(it);
        return <li key={j}>{cb ? <><input type="checkbox" disabled defaultChecked={cb[1] !== " "} className="mr-2 align-middle" aria-label="checklist item" />{inline(cb[2], j)}</> : inline(it, j)}</li>;
      });
      blocks.push(ordered ? <ol key={k++}>{lis}</ol> : <ul key={k++}>{lis}</ul>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={k++}>{inline(buf.join(" "), k)}</blockquote>);
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*([-*]|\d+\.)\s|>|\|)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) buf.push(lines[i++]);
    blocks.push(<p key={k++}>{buf.map((b, j) => <Fragment key={j}>{j > 0 && <br />}{inline(b, j)}</Fragment>)}</p>);
  }
  return <div className={`prose-af ${className ?? ""}`}>{blocks}</div>;
}
