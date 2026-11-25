import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** ISO timestamp N days ago (kept out of component bodies for render purity). */
export const daysAgoIso = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const eur = (cents: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100);

export const eur2 = (cents: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "—";

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";

export const statusLabel: Record<string, string> = {
  draft: "Draft",
  coming_soon: "Coming soon",
  beta: "Beta",
  published: "Available",
  unavailable: "Unavailable",
  archived: "Archived",
};

export const deliveryShort: Record<string, string> = {
  "hosted-tool": "Hosted tool",
  "cloud-agent": "Cloud agent",
  "self-hosted-agent": "Self-hosted agent",
  "workflow-template": "n8n workflow",
  "source-code": "Source code",
  subscription: "Subscription",
};

export const licenseLabel: Record<string, string> = {
  personal: "Personal",
  commercial: "Commercial",
  developer: "Developer",
  agency: "Agency",
  "white-label": "White-label",
};
