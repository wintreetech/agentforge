/**
 * Deterministic invoice field extraction. Used on its own in sandbox mode and
 * as a cross-check of model output in provider mode. It never guesses: a field
 * it cannot find is null with a reason.
 */

export interface InvoiceLine {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
}

export interface InvoiceData {
  vendor: string | null;
  vendorVatId: string | null;
  customer: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string | null;
  lines: InvoiceLine[];
  subtotal: number | null;
  vatRate: number | null;
  vat: number | null;
  total: number | null;
}

export interface Validation {
  check: string;
  ok: boolean;
  detail: string;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // 1.234,56 or 1234,56 → decimal comma (if 2 digits follow)
    s = /,\d{2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) {
    // European day-first unless the first number cannot be a day.
    const a = +m[1], b = +m[2];
    return a > 12 || b <= 12 ? iso(+m[3], b, a) : iso(+m[3], a, b);
  }
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return iso(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return iso(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const DATE_RE = String.raw`(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./]\d{1,2}[./]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4}|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})`;
const AMT = String.raw`([-]?[€$£]?\s?\d[\d.,]*\d|\d)`;

function findAmount(text: string, labels: string[]): number | null {
  let found: number | null = null;
  for (const label of labels) {
    const re = new RegExp(String.raw`(?:^|\n)\s*${label}[^\n\d€$£]{0,25}${AMT}`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) found = parseAmount(m[1]) ?? found;
    if (found != null) return found;
  }
  return found;
}

export function extractInvoice(text: string): { data: InvoiceData; missing: Record<string, string> } {
  const t = text.replace(/\r/g, "");
  const lines = t.split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  const missing: Record<string, string> = {};

  const num = t.match(/invoice\s*(?:no\.?|number|nr\.?|#|id)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/.]{2,})/i)?.[1] ?? null;
  const issueRaw = t.match(new RegExp(String.raw`(?:invoice date|date of issue|issue date|issued|^date)\s*[:]?\s*${DATE_RE}`, "im"))?.[1];
  const dueRaw = t.match(new RegExp(String.raw`(?:due date|payment due|due by|due)\s*[:]?\s*${DATE_RE}`, "i"))?.[1];

  const currency = /€|\bEUR\b/.test(t) ? "EUR" : /£|\bGBP\b/.test(t) ? "GBP" : /\$|\bUSD\b/.test(t) ? "USD" : null;

  const vendorVatId = t.match(/(?:VAT|USt-?IdNr\.?|TVA|BTW|IVA)\s*(?:ID|No\.?|number|reg\.?)?\s*[:#]?\s*([A-Z]{2}\s?[0-9A-Z]{8,12})/i)?.[1]?.replace(/\s/g, "") ?? null;

  const vendor = nonEmpty.find((l) => !/^(invoice|tax invoice|bill|receipt)$/i.test(l) && /[A-Za-z]{2}/.test(l)) ?? null;

  let customer: string | null = null;
  const billIdx = lines.findIndex((l) => /^(bill(ed)? to|invoice to|customer|sold to)\s*:?/i.test(l));
  if (billIdx >= 0) {
    const inline = lines[billIdx].replace(/^(bill(ed)? to|invoice to|customer|sold to)\s*:?\s*/i, "");
    customer = inline || lines.slice(billIdx + 1).find(Boolean) || null;
  }

  // Line items: "<description> <qty> <unit> <amount>" with optional currency symbols.
  const items: InvoiceLine[] = [];
  const lineRe = /^(.{3,}?)\s+(\d+(?:[.,]\d+)?)\s*(?:x\s*)?[€$£]?\s?(\d[\d.,]*\d)\s+[€$£]?\s?(\d[\d.,]*\d)$/i;
  for (const l of lines) {
    if (/sub ?total|total|vat|tax|amount due|balance/i.test(l)) continue;
    const m = l.match(lineRe);
    if (m) {
      const amount = parseAmount(m[4]);
      if (amount != null) items.push({ description: m[1].trim(), quantity: parseAmount(m[2]), unitPrice: parseAmount(m[3]), amount });
    }
  }

  const subtotal = findAmount(t, ["sub ?total", "net (?:amount|total)", "total net", "amount excl\\.? vat", "total excl\\.? (?:vat|tax)"]);
  const vatLine = t.match(/(?:^|\n)\s*(?:vat|tax|mwst|ust)(?!\s*(?:id\b|no\b|number|reg|identification|-?idnr))\s*(?:\(?\s*(\d{1,2}(?:[.,]\d+)?)\s*%\s*\)?)?[^\n\d€$£]{0,15}([-]?[€$£]?\s?\d[\d.,]*\d)/i);
  const vat = vatLine ? parseAmount(vatLine[2]) : null;
  const vatRate = vatLine?.[1] ? parseAmount(vatLine[1]) : null;
  const total = findAmount(t, ["total due", "amount due", "grand total", "total \\(incl[^)]*\\)", "total incl\\.? (?:vat|tax)", "balance due", "total"]);

  const data: InvoiceData = {
    vendor,
    vendorVatId,
    customer,
    invoiceNumber: num,
    issueDate: issueRaw ? parseDate(issueRaw) : null,
    dueDate: dueRaw ? parseDate(dueRaw) : null,
    currency,
    lines: items,
    subtotal,
    vatRate,
    vat,
    total,
  };
  for (const [k, v] of Object.entries(data)) {
    if (v == null) missing[k] = "Not found in the document text";
  }
  if (!items.length) missing.lines = "No line items in a recognisable 'description qty unit amount' layout";
  return { data, missing };
}

export function validateInvoice(d: InvoiceData): Validation[] {
  const out: Validation[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) <= 0.02;
  if (d.lines.length && d.subtotal != null) {
    const sum = Math.round(d.lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    out.push({ check: "Line items add up to subtotal", ok: near(sum, d.subtotal), detail: `Lines sum to ${sum.toFixed(2)}; subtotal is ${d.subtotal.toFixed(2)}` });
  }
  for (const l of d.lines) {
    if (l.quantity != null && l.unitPrice != null && !near(l.quantity * l.unitPrice, l.amount))
      out.push({ check: `Line "${l.description}" quantity × unit price`, ok: false, detail: `${l.quantity} × ${l.unitPrice} ≠ ${l.amount}` });
  }
  if (d.subtotal != null && d.vat != null && d.total != null)
    out.push({ check: "Subtotal + VAT = total", ok: near(d.subtotal + d.vat, d.total), detail: `${d.subtotal.toFixed(2)} + ${d.vat.toFixed(2)} vs ${d.total.toFixed(2)}` });
  if (d.subtotal != null && d.vat != null && d.vatRate != null)
    out.push({ check: "VAT amount matches stated rate", ok: Math.abs((d.subtotal * d.vatRate) / 100 - d.vat) <= 0.05, detail: `${d.vatRate}% of ${d.subtotal.toFixed(2)} = ${((d.subtotal * d.vatRate) / 100).toFixed(2)}` });
  if (d.issueDate && d.dueDate) out.push({ check: "Due date is on or after issue date", ok: d.dueDate >= d.issueDate, detail: `${d.issueDate} → ${d.dueDate}` });
  return out;
}

export function invoiceLinesCsv(d: InvoiceData): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // Prevent CSV formula injection when opened in spreadsheet software.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = [["invoice_number", "description", "quantity", "unit_price", "amount", "currency"]];
  for (const l of d.lines) rows.push([d.invoiceNumber ?? "", l.description, String(l.quantity ?? ""), String(l.unitPrice ?? ""), String(l.amount), d.currency ?? ""]);
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}
