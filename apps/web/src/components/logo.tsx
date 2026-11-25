import Link from "next/link";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="af-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset=".45" stopColor="#6366F1" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#af-logo)" />
      <path d="M9 23l7-14 7 14" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.8 18h8.4" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="9" r="2.2" fill="#fff" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="AgentForge AI home">
      <LogoMark />
      <span className="whitespace-nowrap text-[15.5px] font-semibold tracking-tight">
        AgentForge<span className="text-muted"> AI</span>
      </span>
    </Link>
  );
}
