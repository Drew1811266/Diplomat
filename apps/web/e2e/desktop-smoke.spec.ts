import { expect, test } from "./fixtures";

test("shows the project center in the desktop smoke target", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /^(Project Center|项目中心)$/ })).toBeVisible();
});
