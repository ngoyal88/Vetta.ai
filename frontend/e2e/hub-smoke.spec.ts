import { expect, test } from "@playwright/test";

test.describe("hub smoke", () => {
  test.skip(!process.env.PLAYWRIGHT_E2E_ENABLED, "Set PLAYWRIGHT_E2E_ENABLED=1 to run E2E locally");

  test("marketing home loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Vetta/i);
  });
});
