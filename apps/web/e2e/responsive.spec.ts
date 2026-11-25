import { expect, test } from "@playwright/test";
import { dismissCookies } from "./helpers";

const PAGES = ["/", "/marketplace", "/category/ai-agents", "/products/multi-agent-research-team", "/playground", "/pricing", "/developers", "/blog", "/signin", "/legal/terms", "/status"];

for (const path of PAGES) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path);
    await dismissCookies(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
