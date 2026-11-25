import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { themeScript } from "@/components/theme-toggle";
import { CookieBanner } from "@/components/cookie-banner";
import { env } from "@/lib/env";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: { default: "AgentForge AI — Intelligence. Automated.", template: "%s | AgentForge AI" },
  description: "Discover, test and buy AI tools, agents, automation workflows and complete agentic systems. Transparent running costs, priced from €10 to €800.",
  openGraph: { type: "website", siteName: "AgentForge AI", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08090D" },
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <CookieBanner />
      </body>
    </html>
  );
}
