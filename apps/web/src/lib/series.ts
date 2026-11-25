/** Build a zero-filled daily series for the last N days. */
export function dailySeries<T>(items: T[], at: (t: T) => string, value: (t: T) => number, days = 30) {
  const out: { day: string; key: string; v: number }[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start.getTime() - i * 864e5);
    out.push({ key: d.toISOString().slice(0, 10), day: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), v: 0 });
  }
  const idx = new Map(out.map((o, i) => [o.key, i]));
  for (const it of items) {
    const i = idx.get(at(it).slice(0, 10));
    if (i != null) out[i].v += value(it);
  }
  return out.map((o) => ({ day: o.day, value: Math.round(o.v * 10000) / 10000 }));
}
