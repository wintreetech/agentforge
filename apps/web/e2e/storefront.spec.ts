import { expect, test } from "@playwright/test";
import { collectConsoleErrors, dismissCookies } from "./helpers";

test("homepage renders hero, sections and no console errors", async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto("/");
  await dismissCookies(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your AI Workforce");
  await expect(page.getByRole("link", { name: /Explore Marketplace/ })).toBeVisible();
  for (const h of ["Built, tested and ready to run", "From a €10 tool to a complete AI operation", "Run a real product, right here", "Questions, answered"]) await expect(page.getByText(h)).toBeVisible();
  // Every image on the page must load.
  const srcs = await page.evaluate(() => [...new Set([...document.images].map((i) => i.currentSrc || i.src).filter(Boolean))]);
  expect(srcs.length).toBeGreaterThan(5);
  const broken: string[] = [];
  for (const s of srcs) if (!(await page.request.get(s)).ok()) broken.push(s);
  expect(broken).toEqual([]);
  expect(errors).toEqual([]);
});

test("problem search returns real catalogue products", async ({ page }) => {
  await page.goto("/");
  await dismissCookies(page);
  await page.getByLabel("Describe your business problem").fill("extract data from supplier invoices, budget under €100");
  await page.getByRole("button", { name: "Find products" }).click();
  await expect(page.getByRole("link", { name: /AI Invoice Data Extractor/ }).first()).toBeVisible();
});

test("marketplace filters, sort, pagination and shareable URLs work", async ({ page }) => {
  await page.goto("/marketplace?availability=available");
  await expect(page.getByText(/^10$/).first()).toBeVisible();
  await page.goto("/marketplace?category=ai-agents&min=100&max=200&sort=price-asc");
  const prices = await page.locator("article .tabular-nums").allTextContents();
  const nums = prices.map((p) => Number(p.replace(/[^\d]/g, "")));
  expect(nums.length).toBeGreaterThan(0);
  for (const n of nums) expect(n).toBeGreaterThanOrEqual(100), expect(n).toBeLessThanOrEqual(200);
  expect([...nums].sort((a, b) => a - b)).toEqual(nums);
  await page.goto("/marketplace?q=invoice");
  await expect(page.locator("article").first()).toContainText("Invoice");
  await page.goto("/marketplace?page=2");
  await expect(page.locator('nav[aria-label="Pagination"] [aria-current="page"]')).toHaveText("2");
  await page.goto("/marketplace?q=zzzzqqqq");
  await expect(page.getByText("No products match these filters")).toBeVisible();
});

test("coming-soon products cannot be bought", async ({ page }) => {
  await page.goto("/products/gmail-inbox-organizer");
  await expect(page.getByText("Not available to buy yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Coming soon" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
});

test("product page shows correct price, gallery and structured data without fake ratings", async ({ page }) => {
  await page.goto("/products/mcp-server-developer-kit");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("MCP Server Developer Kit");
  await expect(page.getByText("€99").first()).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(3);
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(JSON.parse(ld!).offers.price).toBe("99.00");
  expect(ld).not.toContain("aggregateRating");
});

test("playground demo runs and labels sandbox output", async ({ page }) => {
  await page.goto("/playground?product=ai-prompt-optimizer");
  await dismissCookies(page);
  await page.getByRole("button", { name: "Vague summary prompt" }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("Simulated output (sandbox).")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Optimized prompt" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Markdown" })).toBeVisible();
});

test("API: catalogue, product, licence verification, health", async ({ request }) => {
  const list = await (await request.get("/api/v1/products?availability=available&per_page=60")).json();
  expect(list.total).toBe(10);
  const one = await request.get("/api/v1/products/does-not-exist");
  expect(one.status()).toBe(404);
  const bad = await (await request.post("/api/v1/licenses/verify", { data: { key: "AF-AAAAA-BBBBB-CCCCC-DDDD" } })).json();
  expect(bad.valid).toBe(false);
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
});

test("payment webhook rejects forged signatures", async ({ request }) => {
  const r = await request.post("/api/webhooks/payments", { data: { id: "evt_x", type: "checkout.completed", orderId: "ord_x", paymentRef: "p", amountCents: 1, currency: "EUR" }, headers: { "x-agentforge-signature": "t=1,v1=deadbeef" } });
  expect(r.status()).toBe(400);
});
