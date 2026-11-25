import Link from "next/link";

const LINKS = [
  ["/developers", "Getting started"],
  ["/developers/api", "REST API reference"],
  ["/developers/webhooks", "Webhooks"],
  ["/developers/mcp", "MCP integration"],
  ["/dashboard/api-keys", "API keys"],
  ["/dashboard/usage", "API usage analytics"],
];

export function DevNav({ current }: { current: string }) {
  return (
    <nav aria-label="Developer docs" className="space-y-1 text-[13.5px] lg:sticky lg:top-24">
      {LINKS.map(([h, l]) => (
        <Link key={h} href={h} aria-current={h === current ? "page" : undefined} className={`block rounded-lg px-3 py-1.5 ${h === current ? "bg-surface-2 font-medium" : "text-muted hover:text-fg"}`}>{l}</Link>
      ))}
    </nav>
  );
}
