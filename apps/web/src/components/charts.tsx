"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { stroke: "var(--fg-subtle)", fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12.5, color: "var(--fg)" };

export function TimeArea({ data, dataKey, label, format }: { data: { day: string; [k: string]: number | string }[]; dataKey: string; label: string; format?: "eur" | "int" }) {
  const fmt = (v: number) => (format === "eur" ? `€${v.toFixed(v < 10 ? 2 : 0)}` : v.toLocaleString("en"));
  return (
    <div className="h-64 w-full" role="img" aria-label={`${label} per day chart`}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent-2)" stopOpacity={0.35} />
              <stop offset="1" stopColor="var(--accent-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" {...axis} minTickGap={24} />
          <YAxis {...axis} width={48} tickFormatter={fmt} allowDecimals={format === "eur"} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmt(Number(v)), label]} />
          <Area type="monotone" dataKey={dataKey} stroke="var(--accent-2)" strokeWidth={2} fill={`url(#g-${dataKey})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBars({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  return (
    <div className="h-64 w-full" role="img" aria-label={`${label} chart`}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" {...axis} allowDecimals={false} />
          <YAxis type="category" dataKey="name" {...axis} width={150} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="value" name={label} fill="var(--accent)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
