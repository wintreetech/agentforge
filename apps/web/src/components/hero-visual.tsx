"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Original hero illustration: a network of agents collaborating across
 * business applications. Labels are generic app types, not brand logos.
 */
const apps = [
  { x: 70, y: 70, label: "Inbox" },
  { x: 470, y: 60, label: "CRM" },
  { x: 40, y: 300, label: "Docs" },
  { x: 500, y: 300, label: "Analytics" },
  { x: 120, y: 470, label: "Store" },
  { x: 440, y: 480, label: "Tickets" },
];
const agents = [
  { x: 210, y: 175, label: "Research", c: "#22D3EE" },
  { x: 365, y: 170, label: "Sales", c: "#818CF8" },
  { x: 175, y: 345, label: "Support", c: "#A78BFA" },
  { x: 380, y: 360, label: "Finance", c: "#C084FC" },
];
const core = { x: 285, y: 270 };

export function HeroVisual() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto aspect-[600/560] w-full max-w-[600px]">
      <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)] blur-2xl" />
      <svg viewBox="0 0 600 560" className="relative h-full w-full" role="img" aria-label="Illustration: four AI agents connected to a shared orchestrator and to business applications such as inbox, CRM, documents, analytics, store and tickets">
        <defs>
          <linearGradient id="hv-core" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22D3EE" />
            <stop offset=".5" stopColor="#6366F1" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        {agents.map((a, i) =>
          apps
            .filter((_, j) => j % 4 === i || (j + 1) % 4 === i)
            .map((ap, j) => <line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={ap.x + 40} y2={ap.y + 18} stroke="var(--fg-subtle)" strokeOpacity=".28" strokeWidth="1.2" />),
        )}
        {agents.map((a, i) => (
          <line key={`c${i}`} x1={core.x} y1={core.y} x2={a.x} y2={a.y} stroke={a.c} strokeOpacity=".75" strokeWidth="2" className="flow-line" />
        ))}
        {apps.map((ap, i) => (
          <motion.g key={ap.label} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07, duration: 0.5 }}>
            <rect x={ap.x} y={ap.y} width="84" height="36" rx="10" fill="var(--surface)" stroke="var(--border-strong)" />
            <circle cx={ap.x + 16} cy={ap.y + 18} r="4" fill="var(--fg-subtle)" />
            <text x={ap.x + 27} y={ap.y + 22.5} fontSize="12.5" fill="var(--fg-muted)" fontFamily="var(--font-geist-sans)">{ap.label}</text>
          </motion.g>
        ))}
        {agents.map((a, i) => (
          <motion.g key={a.label} initial={reduce ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }} style={{ transformOrigin: `${a.x}px ${a.y}px` }}>
            <circle cx={a.x} cy={a.y} r="34" fill="var(--surface)" stroke={a.c} strokeWidth="1.5" />
            <circle cx={a.x} cy={a.y - 6} r="7" fill={a.c} className="pulse-node" style={{ animationDelay: `${i * 0.6}s` }} />
            <path d={`M${a.x - 11} ${a.y + 13}c2-7 6-10 11-10s9 3 11 10`} fill="none" stroke={a.c} strokeWidth="2.5" strokeLinecap="round" />
            <text x={a.x} y={a.y + 52} textAnchor="middle" fontSize="12.5" fontWeight="600" fill="var(--fg)" fontFamily="var(--font-geist-sans)">{a.label} agent</text>
          </motion.g>
        ))}
        <motion.g initial={reduce ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.6 }} style={{ transformOrigin: `${core.x}px ${core.y}px` }}>
          <circle cx={core.x} cy={core.y} r="52" fill="url(#hv-core)" opacity=".18" />
          <circle cx={core.x} cy={core.y} r="40" fill="var(--bg-2)" stroke="url(#hv-core)" strokeWidth="2.5" />
          <path d={`M${core.x - 12} ${core.y + 11}l12-24 12 24M${core.x - 7} ${core.y + 3}h14`} fill="none" stroke="url(#hv-core)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <text x={core.x} y={core.y + 64} textAnchor="middle" fontSize="11" letterSpacing="1.5" fill="var(--fg-subtle)" fontFamily="var(--font-geist-mono)">ORCHESTRATOR</text>
        </motion.g>
        <g>
          <rect x="360" y="232" width="150" height="56" rx="12" fill="var(--surface)" stroke="var(--border-strong)" />
          <text x="374" y="254" fontSize="11" fill="var(--fg-subtle)" fontFamily="var(--font-geist-mono)">APPROVAL NEEDED</text>
          <text x="374" y="274" fontSize="12.5" fill="var(--fg)" fontFamily="var(--font-geist-sans)">Send 3 follow-ups?</text>
        </g>
      </svg>
    </div>
  );
}
