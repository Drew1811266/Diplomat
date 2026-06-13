import { expect, test } from "./fixtures";

test("matches the deterministic workbench desktop layout", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open" }).click();
  await page.getByRole("button", { name: "Select line line-1" }).click();

  await expect(page.getByRole("main", { name: "Workbench" })).toBeVisible();
  await expect(page.getByRole("main", { name: "Workbench" })).toHaveScreenshot(
    "workbench-desktop.png"
  );
});
