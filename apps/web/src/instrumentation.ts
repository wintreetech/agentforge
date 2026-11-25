/**
 * Runs once when the Node.js server boots.
 * - Demo login: if DEMO_LOGIN_EMAIL and DEMO_LOGIN_PASSWORD are set, make sure that
 *   (verified) account exists. On hosts without a persistent disk (e.g. Render Free)
 *   the data store is wiped on every restart, so this keeps a known login available.
 *   The account is an admin when its email is also listed in ADMIN_EMAILS.
 * - Starts the in-process scheduler for Agent Studio schedules. In multi-instance
 *   production, disable this (SCHEDULER=off) and run a single scheduler worker.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const email = process.env.DEMO_LOGIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_LOGIN_PASSWORD;
  if (email && password) {
    try {
      const { registerUser } = await import("./lib/auth");
      const { mutate, read } = await import("./lib/db");
      const exists = await read((db) => db.users.some((u) => u.email === email && !u.deletedAt));
      if (!exists) {
        const r = await registerUser({ email, name: process.env.DEMO_LOGIN_NAME || "Demo User", password, marketingConsent: false });
        if (r.ok) {
          await mutate((db) => {
            const u = db.users.find((x) => x.id === r.userId);
            if (u && !u.emailVerifiedAt) u.emailVerifiedAt = new Date().toISOString();
          });
          console.log(`[demo] created login ${email}`);
        }
      }
    } catch (e) {
      console.error("[demo] could not create demo login", e);
    }
  }

  if (process.env.SCHEDULER === "off") return;
  const g = globalThis as unknown as { __afScheduler?: NodeJS.Timeout };
  if (g.__afScheduler) return;
  const { runDueSchedules } = await import("./lib/studio");
  g.__afScheduler = setInterval(() => {
    runDueSchedules().catch((e) => console.error("[scheduler]", e));
  }, 60_000);
}
