#!/usr/bin/env node
/**
 * Generates original SVG artwork for every product, category, blog post and
 * marketing page, and writes an asset manifest (source, licence, generator
 * parameters). Deterministic: the same slug always yields the same artwork.
 *
 * Usage: node scripts/generate-assets.mjs
 * Requires Node ≥ 22.6 (native TypeScript type stripping for the catalog import).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rawProducts } from "../packages/catalog/src/raw-products.ts";
import { categories } from "../packages/catalog/src/categories.ts";
import { slugify } from "../packages/catalog/src/build.ts";
import { blogPosts } from "../apps/web/src/content/blog-data.ts";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, "apps/web/public/assets");
const manifest = [];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const W = 1200, H = 800;
const FONT = `font-family="Inter, 'Segoe UI', system-ui, sans-serif"`;

function frame(id, accent, accent2, r, body, opts = {}) {
  const gx = 200 + r() * 800, gy = 120 + r() * 400;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${opts.w ?? W} ${opts.h ?? H}" role="img">
<defs>
<linearGradient id="bg${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b0c12"/><stop offset="1" stop-color="#11131c"/></linearGradient>
<radialGradient id="gl${id}" cx="${gx}" cy="${gy}" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${accent}" stop-opacity=".55"/><stop offset=".55" stop-color="${accent2}" stop-opacity=".12"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
<linearGradient id="ac${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent2}"/><stop offset="1" stop-color="${accent}"/></linearGradient>
<pattern id="gr${id}" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#fff" stroke-opacity=".045"/></pattern>
<filter id="bl${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
</defs>
<rect width="100%" height="100%" fill="url(#bg${id})"/>
<rect width="100%" height="100%" fill="url(#gr${id})"/>
<rect width="100%" height="100%" fill="url(#gl${id})"/>
${body}
</svg>`;
}

function panel(x, y, w, h, stroke = "#ffffff", strokeOpacity = ".09") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#161925" fill-opacity=".86" stroke="${stroke}" stroke-opacity="${strokeOpacity}"/>`;
}

function textLines(x, y, w, n, r, accentId) {
  let s = "";
  for (let i = 0; i < n; i++) {
    const lw = w * (0.45 + r() * 0.5);
    s += `<rect x="${x}" y="${y + i * 26}" width="${lw}" height="10" rx="5" fill="${i === 0 ? `url(#ac${accentId})` : "#ffffff"}" fill-opacity="${i === 0 ? 0.9 : 0.14 + r() * 0.1}"/>`;
  }
  return s;
}

// ───────────── Motifs ─────────────
const icons = {
  doc: (x, y, c) => `<g transform="translate(${x} ${y})" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round"><path d="M0 0h44l22 22v66H0z"/><path d="M44 0v22h22"/><path d="M14 44h38M14 58h38M14 72h24" stroke-linecap="round"/></g>`,
  mail: (x, y, c) => `<g transform="translate(${x} ${y})" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round"><rect width="80" height="58" rx="8"/><path d="M4 6l36 28L76 6"/></g>`,
  chart: (x, y, c) => `<g transform="translate(${x} ${y})" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"><path d="M0 70h80"/><path d="M10 60V36M30 60V18M50 60V42M70 60V8"/></g>`,
  spark: (x, y, c) => `<g transform="translate(${x} ${y})" fill="${c}"><path d="M40 0l8 30 30 10-30 10-8 30-8-30L2 40l30-10z"/></g>`,
  person: (x, y, c) => `<g transform="translate(${x} ${y})" fill="none" stroke="${c}" stroke-width="5"><circle cx="34" cy="22" r="18"/><path d="M0 84c4-22 18-34 34-34s30 12 34 34" stroke-linecap="round"/></g>`,
  globe: (x, y, c) => `<g transform="translate(${x} ${y})" fill="none" stroke="${c}" stroke-width="5"><circle cx="40" cy="40" r="36"/><path d="M4 40h72M40 4c14 14 14 58 0 72M40 4c-14 14-14 58 0 72"/></g>`,
  cart: (x, y, c) => `<g transform="translate(${x} ${y})" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M0 6h14l12 50h44l10-36H22"/><circle cx="32" cy="72" r="6"/><circle cx="64" cy="72" r="6"/></g>`,
  code: (x, y, c) => `<g transform="translate(${x} ${y})" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M24 10L0 40l24 30M60 10l24 30-24 30M50 0L34 80"/></g>`,
};
function iconFor(sub) {
  const s = sub.toLowerCase();
  if (/(document|knowledge|legal|career|research)/.test(s)) return "doc";
  if (/(email|communication|support)/.test(s)) return "mail";
  if (/(finance|accounting|analytics|data|seo|marketing|strategy)/.test(s)) return "chart";
  if (/(hr|sales)/.test(s)) return "person";
  if (/(e-commerce)/.test(s)) return "cart";
  if (/(mcp|rag|chat|agents|integration|boilerplate|prompting|engineering|bundle|saas)/.test(s)) return "code";
  if (/(real estate|education|operations|agency|content|creative)/.test(s)) return "globe";
  return "spark";
}

function motifSpark(p, c, r, id) {
  const px = 250 + r() * 120, py = 170 + r() * 60;
  const ic = iconFor(p.sub);
  const lines = 4 + Math.floor(r() * 4);
  return `
<g filter="url(#bl${id})" opacity=".55"><circle cx="${px + 520}" cy="${py + 140}" r="90" fill="${c.accent}"/></g>
${panel(px, py, 560, 430)}
<circle cx="${px + 28}" cy="${py + 28}" r="6" fill="#fff" fill-opacity=".25"/><circle cx="${px + 48}" cy="${py + 28}" r="6" fill="#fff" fill-opacity=".18"/><circle cx="${px + 68}" cy="${py + 28}" r="6" fill="#fff" fill-opacity=".12"/>
<rect x="${px + 32}" y="${py + 70}" width="220" height="150" rx="14" fill="#0e1018" stroke="#fff" stroke-opacity=".07"/>
${icons[ic](px + 105, py + 100, c.accent2)}
${textLines(px + 280, py + 80, 240, lines, r, id)}
<rect x="${px + 32}" y="${py + 250}" width="496" height="140" rx="14" fill="#0e1018" stroke="${c.accent}" stroke-opacity=".35"/>
${textLines(px + 56, py + 278, 440, 4, r, id)}
${panel(px + 400 + r() * 60, py + 330, 300, 120, c.accent, ".5")}
${icons.spark(px + 430 + r() * 60, py + 350, `url(#ac${id})`).replace('fill="url', 'fill="url')}
<rect x="${px + 530 + r() * 40}" y="${py + 370}" width="130" height="12" rx="6" fill="#fff" fill-opacity=".5"/>
<rect x="${px + 530 + r() * 40}" y="${py + 396}" width="90" height="10" rx="5" fill="#fff" fill-opacity=".2"/>`;
}

function chain(steps, c, r, id, y0 = 400, labels = true) {
  const n = steps.length;
  const gap = (W - 240) / (n - 1);
  let s = "";
  const pts = steps.map((_, i) => [120 + i * gap, y0 + Math.sin(i * 1.3 + r() * 2) * 70]);
  for (let i = 0; i < n - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const mx = (x1 + x2) / 2;
    s += `<path d="M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" fill="none" stroke="${c.accent2}" stroke-opacity=".55" stroke-width="3" stroke-dasharray="6 10"/>`;
  }
  pts.forEach(([x, y], i) => {
    s += `<g><rect x="${x - 95}" y="${y - 44}" width="190" height="88" rx="18" fill="#161925" stroke="${i === 0 || i === n - 1 ? c.accent : "#ffffff"}" stroke-opacity="${i === 0 || i === n - 1 ? 0.7 : 0.12}"/>
<circle cx="${x - 62}" cy="${y}" r="16" fill="url(#ac${id})"/><text x="${x - 62}" y="${y + 6}" text-anchor="middle" font-size="16" font-weight="700" fill="#0b0c12" ${FONT}>${i + 1}</text>
${labels ? `<text x="${x - 36}" y="${y + 6}" font-size="17" font-weight="600" fill="#e8eaf2" ${FONT}>${esc(clip(steps[i], 13))}</text>` : ""}</g>`;
  });
  return s;
}

function motifFlow(p, c, r, id) {
  const ints = p.integrations.filter((x) => x !== "n8n").slice(0, 4);
  const chips = ints.map((t, i) => `<g transform="translate(${120 + i * 250} ${150 + (i % 2) * 30})"><rect width="${Math.min(220, 40 + t.length * 11)}" height="46" rx="23" fill="#ffffff" fill-opacity=".06" stroke="#fff" stroke-opacity=".12"/><circle cx="23" cy="23" r="7" fill="${c.accent}"/><text x="40" y="29" font-size="17" fill="#cfd3e0" ${FONT}>${esc(clip(t, 16))}</text></g>`).join("");
  return chips + chain(p.workflow, c, r, id, 450) + `<text x="120" y="690" font-size="18" fill="#8a90a6" ${FONT} letter-spacing="2">N8N WORKFLOW TEMPLATE</text>`;
}

function motifOrbit(p, c, r, id) {
  const cx = 600 + (r() - 0.5) * 160, cy = 400;
  let s = `<g filter="url(#bl${id})" opacity=".7"><circle cx="${cx}" cy="${cy}" r="80" fill="${c.accent}"/></g>`;
  for (let k = 1; k <= 3; k++) s += `<ellipse cx="${cx}" cy="${cy}" rx="${110 + k * 85}" ry="${60 + k * 48}" fill="none" stroke="#fff" stroke-opacity="${0.12 - k * 0.025}" transform="rotate(${-12 + r() * 24} ${cx} ${cy})"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="74" fill="#141724" stroke="url(#ac${id})" stroke-width="4"/>`;
  s += icons[iconFor(p.sub)](cx - 38, cy - 42, c.accent2);
  const sats = [...p.integrations.slice(0, 3), ...p.caps.slice(0, 2).map((x) => x.split(" ").slice(0, 2).join(" "))].slice(0, 5);
  sats.forEach((t, i) => {
    const a = (i / sats.length) * Math.PI * 2 + r();
    const x = cx + Math.cos(a) * (230 + r() * 90), y = cy + Math.sin(a) * (170 + r() * 50);
    const w = Math.min(240, 50 + t.length * 10);
    s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${c.accent2}" stroke-opacity=".3" stroke-width="2"/>
<g transform="translate(${x - w / 2} ${y - 22})"><rect width="${w}" height="44" rx="12" fill="#161925" stroke="#fff" stroke-opacity=".12"/><circle cx="20" cy="22" r="6" fill="${c.accent}"/><text x="34" y="28" font-size="16" fill="#dfe2ec" ${FONT}>${esc(clip(t, 20))}</text></g>`;
  });
  return s;
}

function motifConstellation(p, c, r, id) {
  const roles = p.workflow;
  const pts = roles.map((_, i) => {
    const a = (i / roles.length) * Math.PI * 2 - Math.PI / 2 + (r() - 0.5) * 0.4;
    return [600 + Math.cos(a) * 300, 410 + Math.sin(a) * 220];
  });
  let s = "";
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      s += `<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${pts[j][0]}" y2="${pts[j][1]}" stroke="${c.accent2}" stroke-opacity="${j === i + 1 ? 0.5 : 0.14}" stroke-width="${j === i + 1 ? 3 : 1.5}" ${j === i + 1 ? 'stroke-dasharray="6 9"' : ""}/>`;
  s += `<circle cx="600" cy="410" r="64" fill="#141724" stroke="url(#ac${id})" stroke-width="3"/><text x="600" y="404" text-anchor="middle" font-size="15" fill="#9aa1b8" ${FONT} letter-spacing="2">SHARED</text><text x="600" y="426" text-anchor="middle" font-size="15" fill="#9aa1b8" ${FONT} letter-spacing="2">STATE</text>`;
  pts.forEach(([x, y], i) => {
    s += `<line x1="600" y1="410" x2="${x}" y2="${y}" stroke="#fff" stroke-opacity=".08"/>
<g><circle cx="${x}" cy="${y}" r="58" fill="#161925" stroke="${c.accent}" stroke-opacity=".7" stroke-width="2"/><circle cx="${x}" cy="${y - 14}" r="14" fill="url(#ac${id})"/><path d="M${x - 22} ${y + 26}c4-14 12-20 22-20s18 6 22 20" fill="none" stroke="url(#ac${id})" stroke-width="5" stroke-linecap="round"/>
<text x="${x}" y="${y + 86}" text-anchor="middle" font-size="18" font-weight="600" fill="#e8eaf2" ${FONT}>${esc(clip(roles[i], 16))}</text></g>`;
  });
  return s;
}

function motifBlocks(p, c, r, id) {
  let s = panel(110, 110, 980, 580);
  s += `<rect x="110" y="110" width="220" height="580" rx="18" fill="#12141e"/>`;
  for (let i = 0; i < 6; i++) s += `<rect x="140" y="${170 + i * 56}" width="${110 + r() * 50}" height="12" rx="6" fill="#fff" fill-opacity="${i === 1 ? 0.6 : 0.15}"/>${i === 1 ? `<rect x="128" y="${158 + i * 56}" width="184" height="36" rx="10" fill="${c.accent}" fill-opacity=".18"/>` : ""}`;
  for (let k = 0; k < 3; k++) {
    s += `<rect x="${360 + k * 238}" y="140" width="218" height="110" rx="14" fill="#0f111a" stroke="#fff" stroke-opacity=".07"/><rect x="${384 + k * 238}" y="166" width="90" height="10" rx="5" fill="#fff" fill-opacity=".2"/><rect x="${384 + k * 238}" y="196" width="${70 + r() * 60}" height="26" rx="8" fill="${k === 0 ? `url(#ac${id})` : "#ffffff"}" fill-opacity="${k === 0 ? 0.9 : 0.35}"/>`;
  }
  s += `<rect x="360" y="270" width="456" height="390" rx="14" fill="#0f111a" stroke="#fff" stroke-opacity=".07"/>`;
  let d = "";
  for (let i = 0; i <= 10; i++) d += `${i ? "L" : "M"}${390 + i * 40} ${600 - (60 + r() * 220 + i * 8)} `;
  s += `<path d="${d}" fill="none" stroke="url(#ac${id})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<rect x="836" y="270" width="218" height="390" rx="14" fill="#0f111a" stroke="#fff" stroke-opacity=".07"/>`;
  for (let i = 0; i < 6; i++) s += `<rect x="860" y="${300 + i * 56}" width="${60 + r() * 110}" height="26" rx="8" fill="${c.accent}" fill-opacity="${0.25 + r() * 0.5}"/>`;
  s += icons[iconFor(p.sub)](955, 140 + 20, c.accent2).replace("translate(955 160)", "translate(965 160) scale(.8)");
  return s;
}

function motifBrackets(p, c, r, id) {
  const kws = ["export", "const", "async", "await", "import", "return", "function"];
  let s = panel(150, 120, 700, 520);
  s += `<rect x="150" y="120" width="700" height="52" rx="18" fill="#12141e"/><circle cx="182" cy="146" r="7" fill="#ff5f57" fill-opacity=".7"/><circle cx="206" cy="146" r="7" fill="#febc2e" fill-opacity=".7"/><circle cx="230" cy="146" r="7" fill="#28c840" fill-opacity=".7"/>`;
  s += `<text x="270" y="152" font-size="16" fill="#8a90a6" font-family="ui-monospace, Menlo, monospace">${esc(slugify(p.title).slice(0, 34))}/src/index.ts</text>`;
  for (let i = 0; i < 12; i++) {
    const indent = (i % 4 === 0 ? 0 : i % 3 === 0 ? 2 : 1) * 28;
    s += `<text x="190" y="${212 + i * 34}" font-size="15" fill="#565d75" font-family="ui-monospace, Menlo, monospace">${String(i + 1).padStart(2, " ")}</text>`;
    s += `<rect x="${236 + indent}" y="${200 + i * 34}" width="${40 + r() * 60}" height="13" rx="4" fill="${c.accent}" fill-opacity=".8"/>`;
    s += `<rect x="${290 + indent + r() * 50}" y="${200 + i * 34}" width="${80 + r() * 260}" height="13" rx="4" fill="#fff" fill-opacity="${0.12 + r() * 0.18}"/>`;
  }
  s += panel(640, 460, 420, 200, c.accent, ".55");
  s += `<text x="670" y="508" font-size="17" fill="${c.accent2}" font-family="ui-monospace, Menlo, monospace">$ npm test</text>`;
  s += `<text x="670" y="546" font-size="17" fill="#cfd3e0" font-family="ui-monospace, Menlo, monospace">✓ ${esc(kws[Math.floor(r() * kws.length)])} …</text>`;
  s += `<text x="670" y="584" font-size="17" fill="#cfd3e0" font-family="ui-monospace, Menlo, monospace">✓ ${esc(clip(p.caps[0].toLowerCase(), 28))}</text>`;
  s += `<text x="670" y="622" font-size="17" fill="#6ee7b7" font-family="ui-monospace, Menlo, monospace">tests passed</text>`;
  s += icons.code(920, 220, `url(#ac${id})`);
  return s;
}

const motifs = { spark: motifSpark, flow: motifFlow, orbit: motifOrbit, constellation: motifConstellation, blocks: motifBlocks, brackets: motifBrackets };

function cover(p) {
  const c = categories.find((x) => x.slug === p.category);
  const slug = slugify(p.title);
  const r = rng(hash(slug));
  const idk = hash(slug).toString(36).slice(0, 5);
  return frame(idk, c.accent, c.accent2, r, motifs[c.motif](p, c, r, idk));
}

function workflowSvg(p) {
  const c = categories.find((x) => x.slug === p.category);
  const slug = slugify(p.title);
  const r = rng(hash(slug + "wf"));
  const idk = "w" + hash(slug).toString(36).slice(0, 5);
  const header = `<text x="120" y="130" font-size="22" fill="#8a90a6" ${FONT} letter-spacing="3">HOW IT WORKS</text><text x="120" y="182" font-size="40" font-weight="700" fill="#f4f5f8" ${FONT}>${esc(clip(p.title, 44))}</text>`;
  const notes = p.caps.slice(0, 3).map((cap, i) => `<g transform="translate(${120 + i * 340} 610)"><rect width="320" height="90" rx="14" fill="#161925" stroke="#fff" stroke-opacity=".08"/><circle cx="26" cy="30" r="6" fill="${c.accent}"/><text x="44" y="36" font-size="17" fill="#e1e4ee" ${FONT}>${esc(clip(cap, 26))}</text><text x="44" y="64" font-size="15" fill="#8a90a6" ${FONT}>${esc(clip(cap.slice(26), 30))}</text></g>`).join("");
  return frame(idk, c.accent, c.accent2, r, header + chain(p.workflow, c, r, idk, 390) + notes);
}

function specSvg(p) {
  const c = categories.find((x) => x.slug === p.category);
  const slug = slugify(p.title);
  const r = rng(hash(slug + "spec"));
  const idk = "s" + hash(slug).toString(36).slice(0, 5);
  const col = (x, title, items) =>
    panel(x, 210, 400, 470) +
    `<text x="${x + 32}" y="262" font-size="20" fill="#8a90a6" ${FONT} letter-spacing="3">${title}</text>` +
    items.slice(0, 5).map((t, i) => `<g transform="translate(${x + 32} ${296 + i * 72})"><rect width="336" height="56" rx="12" fill="#0f111a" stroke="#fff" stroke-opacity=".07"/><circle cx="24" cy="28" r="7" fill="${c.accent}"/><text x="44" y="34" font-size="17" fill="#e5e8f0" ${FONT}>${esc(clip(t, 30))}</text></g>`).join("");
  const mid = `<circle cx="600" cy="445" r="58" fill="#141724" stroke="url(#ac${idk})" stroke-width="3"/>${icons.spark(560, 405, `url(#ac${idk})`)}<path d="M520 445h-40M720 445h-40" stroke="${c.accent2}" stroke-width="3" stroke-dasharray="6 8"/>`;
  return frame(idk, c.accent, c.accent2, r, `<text x="120" y="150" font-size="38" font-weight="700" fill="#f4f5f8" ${FONT}>Inputs → Outputs</text>` + col(80, "INPUTS", p.inputs) + mid + col(720, "OUTPUTS", p.outputs));
}

function categorySvg(c, i) {
  const r = rng(hash(c.slug));
  const idk = "c" + i;
  const sample = rawProducts.filter((p) => p.category === c.slug)[Math.floor(r() * 3)];
  return frame(idk, c.accent, c.accent2, r, motifs[c.motif](sample, c, r, idk));
}

function abstractSvg(name, accent, accent2, kind) {
  const r = rng(hash(name));
  const idk = "a" + hash(name).toString(36).slice(0, 4);
  const c = { accent, accent2 };
  let body = "";
  if (kind === "network") {
    const pts = Array.from({ length: 14 }, () => [100 + r() * 1000, 100 + r() * 600]);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < 330) body += `<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${pts[j][0]}" y2="${pts[j][1]}" stroke="${accent2}" stroke-opacity=".25"/>`;
    body += pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 4 === 0 ? 16 : 7}" fill="${i % 4 === 0 ? `url(#ac${idk})` : "#fff"}" fill-opacity="${i % 4 === 0 ? 1 : 0.35}"/>`).join("");
  } else if (kind === "layers") {
    for (let i = 0; i < 4; i++) body += `<g transform="translate(600 ${250 + i * 110}) skewX(-20)"><rect x="-300" y="-50" width="600" height="100" rx="20" fill="#161925" fill-opacity=".9" stroke="${i === 0 ? accent : "#fff"}" stroke-opacity="${i === 0 ? 0.8 : 0.12}"/><rect x="-260" y="-12" width="${160 + r() * 200}" height="24" rx="8" fill="${i === 0 ? `url(#ac${idk})` : "#fff"}" fill-opacity="${i === 0 ? 0.9 : 0.15}"/></g>`;
  } else if (kind === "terminal") {
    body = motifBrackets({ title: name, caps: ["typed sdk and rest api"], sub: "Integration" }, c, r, idk);
  } else if (kind === "workspace") {
    body = motifBlocks({ sub: "Operations" }, c, r, idk);
  } else {
    body = motifOrbit({ sub: "Agents", integrations: ["Docs", "CRM", "Inbox"], caps: ["Approvals required", "Audit trail"] }, c, r, idk);
  }
  return frame(idk, accent, accent2, r, body);
}

async function write(rel, svg, meta) {
  const f = path.join(out, rel);
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, svg);
  manifest.push({ path: `/assets/${rel.replace(/\\/g, "/")}`, type: "svg-illustration", source: "Generated by scripts/generate-assets.mjs (original work)", license: "Proprietary — original artwork created for AgentForge AI", attribution: "None required", generation: meta });
}

for (const p of rawProducts) {
  if (p.category === "multi-agent-systems") continue;
  const slug = slugify(p.title);
  const cat = categories.find((x) => x.slug === p.category);
  await write(`products/${slug}/cover.svg`, cover(p), { seed: hash(slug), motif: cat.motif, kind: "product cover" });
  await write(`products/${slug}/workflow.svg`, workflowSvg(p), { seed: hash(slug + "wf"), kind: "workflow diagram", steps: p.workflow });
  await write(`products/${slug}/spec.svg`, specSvg(p), { seed: hash(slug + "spec"), kind: "inputs/outputs diagram" });
}
for (const [i, c] of categories.entries()) await write(`categories/${c.slug}.svg`, categorySvg(c, i), { seed: hash(c.slug), motif: c.motif });
for (const b of blogPosts) await write(`blog/${b.slug}.svg`, abstractSvg(b.slug, b.accent, "#22D3EE", b.art), { kind: "blog cover", art: b.art });
const pages = [
  ["enterprise", "#6366F1", "#22D3EE", "layers"],
  ["developers", "#10B981", "#6EE7B7", "terminal"],
  ["about", "#7C3AED", "#A78BFA", "network"],
  ["studio", "#A855F7", "#22D3EE", "orbit"],
  ["workspace", "#F59E0B", "#7C3AED", "workspace"],
];
for (const [name, a, b, kind] of pages) await write(`pages/${name}.svg`, abstractSvg(name, a, b, kind), { kind: "page illustration", art: kind });

await writeFile(path.join(root, "apps/web/public/assets/manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), count: manifest.length, notes: "All images are original generated SVG illustrations and diagrams. None are screenshots unless listed under /screenshots. Photographic assets: none (see PROGRESS.md).", assets: manifest }, null, 2));
console.log(`Wrote ${manifest.length} assets to ${out}`);
