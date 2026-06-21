import { expect, test } from "./fixtures";

test("keeps model management inside system settings instead of the top toolbar", async ({
  page
}) => {
  await page.goto("/");

  const header = page.getByRole("banner");
  await expect(page.getByRole("heading", { name: "Project Library" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Models" })).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Model Manager" })).toHaveCount(0);

  await header.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("main", { name: "System Settings" })).toBeVisible();
  const everydaySettings = page.getByRole("group", { name: "Everyday settings" });
  const advancedTools = page.getByRole("group", { name: "Advanced tools" });
  await expect(everydaySettings.getByRole("button", { name: "Language" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(everydaySettings.getByRole("button", { name: "Models" })).toBeVisible();
  await expect(everydaySettings.getByRole("button", { name: "New project defaults" })).toBeVisible();
  await expect(everydaySettings.getByRole("button", { name: "General" })).toHaveCount(0);
  await expect(everydaySettings.getByRole("button", { name: "Privacy" })).toHaveCount(0);
  await expect(everydaySettings.getByRole("button", { name: "About" })).toHaveCount(0);
  await expect(everydaySettings.getByRole("button", { name: "Release" })).toHaveCount(0);
  await expect(advancedTools.getByRole("button", { name: "Advanced tools" })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  await expect(advancedTools.getByRole("button", { name: "Diagnostics" })).toHaveCount(0);
  await expect(advancedTools.getByRole("button", { name: "Release" })).toHaveCount(0);

  await advancedTools.getByRole("button", { name: "Advanced tools" }).click();

  await expect(advancedTools.getByRole("button", { name: "Advanced tools" })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  await expect(advancedTools.getByRole("button", { name: "General" })).toBeVisible();
  await expect(advancedTools.getByRole("button", { name: "Privacy" })).toBeVisible();
  await expect(advancedTools.getByRole("button", { name: "Diagnostics" })).toBeVisible();
  await expect(advancedTools.getByRole("button", { name: "About" })).toBeVisible();
  await expect(advancedTools.getByRole("button", { name: "Release" })).toBeVisible();
  await page.getByRole("button", { name: "Models" }).click();

  await expect(page.getByRole("heading", { name: "Models" })).toBeVisible();
  await expect(page.getByRole("main", { name: "System Settings" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Models" })).toHaveCount(0);
});

test("keeps current project settings in the workbench inspector", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("project-row-project-demo").getByRole("button", { name: "Open" }).click();

  await expect(page.getByRole("main", { name: "Workbench" })).toBeVisible();
  await page.getByRole("button", { name: "Project settings" }).click();

  const inspector = page.getByRole("region", { name: "Inspector" });
  await expect(
    inspector.getByRole("heading", { name: "Current project settings" })
  ).toBeVisible();
  await expect(inspector.getByRole("combobox", { name: "Source language" })).toHaveValue("zh");
  await expect(inspector.getByRole("combobox", { name: "Target language" })).toHaveValue("en");
  await expect(
    inspector.getByText("Applies only to the open project. System defaults stay in Settings.")
  ).toBeVisible();

  await page
    .getByRole("banner")
    .getByRole("button", { name: "Settings", exact: true })
    .click();

  await expect(page.getByRole("main", { name: "System Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "System Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Subtitles & translation" })).toHaveCount(0);
  await page.getByRole("button", { name: "New project defaults" }).click();
  await expect(
    page.getByText(
      "Used when creating new projects only. Current project language and export settings are edited in the Workbench inspectors."
    )
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current project settings" })).toHaveCount(0);
});
