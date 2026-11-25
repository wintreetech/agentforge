import { expect, test } from "@playwright/test";
import { dismissCookies, signUpVerified } from "./helpers";

test.describe.configure({ mode: "serial" });

test("full purchase → fulfilment → download → licence → owned run, and tenant isolation", async ({ page, browser, request }) => {
  await signUpVerified(page, "buyer");

  // Add two products, apply the dev coupon, pay in the sandbox.
  await page.goto("/products/mcp-server-developer-kit");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.waitForURL(/\/cart/);
  await page.goto("/products/ai-knowledge-base-agent");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.waitForURL(/\/cart/);
  await expect(page.locator("li", { hasText: "MCP Server Developer Kit" })).toBeVisible();
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await page.waitForURL(/\/checkout/);
  await page.getByLabel("Discount code").fill("DEVTEST10");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Code applied.")).toBeVisible();
  // Germany: 19% VAT on (99+129)*0.9 = 205.20 → 38.99 VAT → 244.19
  await expect(page.getByText("€244.19").first()).toBeVisible();
  await page.getByLabel(/I request immediate access/).check();
  await page.getByLabel(/I accept the/).check();
  await page.getByRole("button", { name: /Pay €244.19/ }).click();
  await page.waitForURL(/\/checkout\/sandbox\//);
  await expect(page.getByText("no real payment is taken")).toBeVisible();

  // Access must not exist before the webhook.
  const before = await page.request.get("/dashboard/downloads");
  expect(await before.text()).not.toContain("Download ZIP");

  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await page.waitForURL(/\/checkout\/success/);
  await expect(page.getByRole("heading", { name: "Payment confirmed" })).toBeVisible();

  // Download the real package.
  await page.goto("/dashboard/downloads");
  const href = await page.getByRole("link", { name: "Download ZIP" }).getAttribute("href");
  const zip = await page.request.get(href!);
  expect(zip.status()).toBe(200);
  expect(zip.headers()["content-type"]).toBe("application/zip");
  const body = await zip.body();
  expect(body.subarray(0, 4).toString("hex")).toBe("504b0304");
  expect(body.length).toBeGreaterThan(5000);

  // Licence key verifies via the public API.
  await page.goto("/dashboard/licenses");
  const key = (await page.locator("code").filter({ hasText: /^AF-/ }).first().textContent())!.trim();
  const v = await (await request.post("/api/v1/licenses/verify", { data: { key } })).json();
  expect(v).toMatchObject({ valid: true, status: "active" });

  // Owned run in the dashboard.
  await page.goto("/dashboard/tools/ai-knowledge-base-agent");
  await dismissCookies(page);
  await page.getByRole("button", { name: "Company handbook" }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".prose-af").first()).toContainText("€400");

  // Invoice exists.
  await page.goto("/dashboard/invoices");
  const invoiceHref = await page.getByRole("link", { name: /^AF-\d{4}-/ }).first().getAttribute("href");
  const execHref = await (async () => {
    await page.goto("/dashboard/executions");
    return page.getByRole("link", { name: "ai-knowledge-base-agent" }).first().getAttribute("href");
  })();

  // A second user can't see the first user's invoice, run, or download.
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await signUpVerified(p2, "intruder");
  expect((await p2.goto(invoiceHref!))!.status()).toBe(404);
  expect((await p2.goto(execHref!))!.status()).toBe(404);
  const stolen = await p2.request.get(href!);
  expect(stolen.status()).toBe(403);
  // Not owned → tool page redirects to the product page.
  await p2.goto("/dashboard/tools/ai-knowledge-base-agent");
  await expect(p2).toHaveURL(/\/products\/ai-knowledge-base-agent/);
  // Non-admins can't reach admin.
  await p2.goto("/admin");
  await expect(p2).toHaveURL(/\/dashboard\?error=forbidden/);
  await ctx2.close();
});

test("unauthenticated users are redirected from protected areas", async ({ page }) => {
  for (const path of ["/dashboard", "/admin", "/checkout", "/dashboard/studio"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/signin\?next=/);
  }
});
