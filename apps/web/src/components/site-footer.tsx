import Link from "next/link";
import { categories } from "@agentforge/catalog";
import { Container } from "./ui";
import { Logo } from "./logo";
import { NewsletterForm } from "./forms";

const cols: { title: string; links: [string, string][] }[] = [
  { title: "Marketplace", links: [["/marketplace", "All products"], ...categories.map((c) => [`/category/${c.slug}`, c.name] as [string, string]), ["/compare", "Compare products"]] },
  { title: "Platform", links: [["/dashboard/studio", "Agent Studio"], ["/assistant", "Product assistant"], ["/pricing", "Pricing"], ["/enterprise", "Enterprise"], ["/integrations", "Integrations"], ["/docs", "Documentation"], ["/status", "System status"]] },
  { title: "Company", links: [["/how-it-works", "How it works"], ["/about", "About"], ["/blog", "Blog"], ["/careers", "Careers"], ["/contact", "Contact"], ["/affiliates", "Affiliate program"], ["/sellers", "Sell on AgentForge"], ["/changelog", "Changelog"]] },
  { title: "Legal", links: [["/legal/terms", "Terms of Service"], ["/legal/privacy", "Privacy Policy"], ["/legal/cookies", "Cookie Policy"], ["/legal/refunds", "Refund Policy"], ["/legal/license", "Licence Agreement"], ["/security", "Security"], ["/help", "Help center"], ["/faq", "FAQ"]] },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-bg-2/40">
      <Container className="py-14">
        <div className="grid grid-cols-1 [&>*]:min-w-0 gap-10 lg:grid-cols-[1.3fr_3fr]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-[14px] leading-relaxed text-muted">Intelligence. Automated. A marketplace for AI tools, agents and automation systems, with transparent running costs.</p>
            <div className="mt-6">
              <p className="mb-2 text-[13px] font-medium">Product updates</p>
              <NewsletterForm source="footer" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {cols.map((c) => (
              <div key={c.title}>
                <p className="text-[12.5px] font-semibold text-fg">{c.title}</p>
                <ul className="mt-3 space-y-2">
                  {c.links.map(([href, label]) => (
                    <li key={href}>
                      <Link href={href} className="text-[13px] text-muted transition hover:text-fg">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-[12.5px] text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} AgentForge AI. Prices in EUR, excluding VAT where applicable.</p>
          <div className="flex shrink-0 items-center gap-2" aria-label="Card payment brands">
            <svg role="img" aria-label="Visa" viewBox="0 0 64 40" className="h-8 w-[51px] rounded border border-slate-200 bg-white">
              <text x="32" y="26" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="21" fontWeight="900" fontStyle="italic" fill="#1434CB">VISA</text>
            </svg>
            <svg role="img" aria-label="Mastercard" viewBox="0 0 64 40" className="h-8 w-[51px] rounded border border-slate-200 bg-white">
              <circle cx="24" cy="20" r="12" fill="#EB001B" />
              <circle cx="40" cy="20" r="12" fill="#F79E1B" />
              <path d="M32 11.056a12 12 0 0 1 0 17.888 12 12 0 0 1 0-17.888Z" fill="#FF5F00" />
            </svg>
          </div>
          <p>Legal pages are drafts pending legal review. <Link href="/legal/cookies" className="underline underline-offset-2">Cookie settings</Link></p>
        </div>
      </Container>
    </footer>
  );
}
