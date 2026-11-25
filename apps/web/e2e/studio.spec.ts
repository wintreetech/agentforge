import { expect, test } from "@playwright/test";
import { dismissCookies, signUpVerified } from "./helpers";

test("Agent Studio: knowledge base, failing step, retry, approval and completion", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpVerified(page, "studio");
  await dismissCookies(page);

  // Buy the Knowledge Base Agent.
  await page.goto("/products/ai-knowledge-base-agent");
  await page.getByRole("button", { name: "Buy now" }).click();
  await page.waitForURL(/\/checkout$/);
  await page.getByLabel(/I request immediate access/).check();
  await page.getByLabel(/I accept the/).check();
  await page.getByRole("button", { name: /^Pay / }).click();
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page.getByRole("heading", { name: "Payment confirmed" })).toBeVisible();

  // Create a knowledge base with one document.
  await page.goto("/dashboard/knowledge");
  await page.getByLabel("New knowledge base").fill("Handbook");
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/\/dashboard\/knowledge\/kb_/);
  await page.getByLabel("Title").fill("Leave policy");
  await page.getByLabel("Text").fill("Full-time employees receive 28 days of paid annual leave plus public holidays. Unused leave of up to five days can be carried over to the following year.");
  await page.getByRole("button", { name: "Add to knowledge base" }).click();
  await expect(page.getByText(/Added “Leave policy”/)).toBeVisible();

  // Create a Studio workflow. First run without a knowledge base → retrieval step fails.
  await page.goto("/dashboard/studio");
  await page.getByRole("button", { name: "+ AI Knowledge Base Agent" }).click();
  await page.waitForURL(/\/dashboard\/studio\/agc_/);
  await expect(page.locator(".react-flow__node")).toHaveCount(7);
  await page.getByLabel("Input", { exact: true }).fill("How many days of annual leave do I get?");
  await page.getByRole("button", { name: "Save & run" }).click();
  await expect(page.getByText("failed", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/No knowledge base selected/)).toBeVisible();

  // Fix the configuration, save, and retry the failed step.
  await page.getByLabel("Knowledge base").selectOption({ label: "Handbook" });
  await page.getByRole("button", { name: "Save workflow" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.getByRole("button", { name: "Retry failed step" }).click();

  // Run pauses for human approval.
  await expect(page.getByText("Approval required")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("completed", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Execution log")).toContainText("Approved by user.");
  await expect(page.locator(".prose-af").first()).toContainText("28 days");
});
