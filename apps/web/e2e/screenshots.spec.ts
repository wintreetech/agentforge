import { test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dismissCookies } from "./helpers";

/**
 * Captures desktop and mobile screenshots of key pages into docs/screenshots,
 * and real product screenshots (Playground runs) into public/screenshots/products.
 * Run with: npx playwright test e2e/screenshots.spec.ts --project=desktop
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../../docs/screenshots");
const pub = path.resolve(here, "../public/screenshots/products");
const PAGES: [string, string][] = [["home", "/"], ["marketplace", "/marketplace"], ["category", "/category/multi-agent-systems"], ["product", "/products/multi-agent-research-team"], ["playground", "/playground"], ["pricing", "/pricing"], ["developers", "/developers"], ["status", "/status"]];

test.describe("screenshots", () => {
  test.skip(({ browserName }) => browserName !== "chromium");

  for (const [name, url] of PAGES) {
    test(`page: ${name}`, async ({ page }) => {
      for (const [label, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]] as const) {
        await page.setViewportSize(vp);
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(600);
        await dismissCookies(page);
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${out}/${name}-${label}.png`, fullPage: label === "desktop" ? false : false });
      }
    });
  }

  const RUNS: [string, string][] = [
    ["ai-resume-cover-letter-builder", "Product designer"],
    ["ai-prompt-optimizer", "Vague summary prompt"],
    ["ai-product-description-generator", "Desk lamp"],
    ["ai-email-writing-assistant", "Delayed delivery reply"],
    ["ai-invoice-data-extractor", "Sample invoice"],
    ["ai-seo-content-generator", "B2B guide"],
    ["ai-knowledge-base-agent", "Company handbook"],
    ["multi-agent-research-team", "Heat pumps brief"],
  ];
  for (const [slug, example] of RUNS) {
    test(`product run: ${slug}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`/playground?product=${slug}`);
      await dismissCookies(page);
      await page.getByRole("button", { name: example }).click();
      await page.getByRole("button", { name: "Run", exact: true }).click();
      await page.getByRole("button", { name: "Markdown" }).waitFor({ timeout: 30_000 });
      // Capture one viewport of the runner, without the sticky header or cookie banner.
      await page.addStyleTag({ content: "header, [role=dialog], nextjs-portal { display: none !important; }" });
      const box = (await page.locator("form").filter({ has: page.getByRole("button", { name: "Run", exact: true }) }).locator("xpath=..").boundingBox())!;
      await page.evaluate((y) => window.scrollTo(0, y - 16), box.y + (await page.evaluate(() => window.scrollY)));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${pub}/${slug}.png`, clip: { x: box.x - 16, y: 0, width: box.width + 32, height: 900 } });
    });
  }
});
