"use client";

import Link from "next/link";
import { useLocalStorage, writeLocal } from "@/lib/client-store";
import { buttonClass } from "./ui";

/**
 * Consent banner. Only strictly-necessary cookies (session, cart, theme) are
 * used today; analytics is not loaded unless the visitor opts in AND an
 * analytics provider is configured. Reject is as prominent as Accept.
 */
export function CookieBanner() {
  const consent = useLocalStorage("af-consent");
  if (consent !== null) return null; // undefined = not hydrated yet; string = already chosen
  const choose = (v: "necessary" | "all") => writeLocal("af-consent", JSON.stringify({ v, at: new Date().toISOString() }));
  return (
    <div role="dialog" aria-label="Cookie preferences" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-border bg-surface p-4 shadow-2xl sm:inset-x-auto sm:right-4">
      <p className="text-[13.5px] leading-relaxed text-muted">
        We use strictly necessary cookies for sign-in, your cart and theme. Optional analytics cookies are off unless you allow them. <Link href="/legal/cookies" className="underline underline-offset-2">Cookie Policy</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose("necessary")} className={buttonClass("outline", "sm")}>Necessary only</button>
        <button type="button" onClick={() => choose("all")} className={buttonClass("outline", "sm")}>Allow analytics</button>
      </div>
    </div>
  );
}
