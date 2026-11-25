import "server-only";
import type { OutboxMail } from "./db";

/**
 * Outbound email. Every message is still recorded in the store's outbox; when
 * RESEND_API_KEY and MAIL_FROM are set it is also sent through Resend's HTTP
 * API. Delivery is best-effort and never blocks or fails the calling action.
 */
export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export async function deliverMail(mails: OutboxMail[]): Promise<void> {
  if (!mailConfigured() || mails.length === 0) return;
  await Promise.all(
    mails.map(async (m) => {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: process.env.MAIL_FROM, to: [m.to], subject: m.subject, text: m.body }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) console.error("[mail] send failed", m.id, r.status, (await r.text()).slice(0, 300));
      } catch (e) {
        console.error("[mail] send error", m.id, (e as Error).message);
      }
    }),
  );
}
