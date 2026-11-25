import { expect, type Page } from "@playwright/test";

export const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
export const PASSWORD = "e2e-Password-2026!";

export async function dismissCookies(page: Page) {
  const btn = page.getByRole("button", { name: "Necessary only" });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

/** Sign up, then verify the email through the development outbox. */
export async function signUpVerified(page: Page, tag: string) {
  const email = uniqueEmail(tag);
  await page.goto("/signup");
  await dismissCookies(page);
  await page.getByLabel("Full name").fill(`E2E ${tag}`);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/verify/);
  await page.goto("/dev/outbox");
  await page.getByRole("link", { name: /\/verify\?token=/ }).first().click();
  await page.getByRole("button", { name: "Confirm email address" }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText("Email verified")).toBeVisible();
  return email;
}

export async function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
