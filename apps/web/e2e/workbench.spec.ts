import { demoSubtitleDocument, expect, test } from "./fixtures";

test("opens the demo project and exports subtitles from the workbench", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open" }).click();

  await expect(page.getByRole("main", { name: "Workbench" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select line line-1" })).toBeVisible();
  await expect(page.getByText("2 rows")).toBeVisible();

  await page.getByRole("button", { name: "Select line line-1" }).click();

  await expect(page.getByTestId("subtitle-row-line-1")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Source text")).toHaveValue(
    demoSubtitleDocument.lines[0].sourceText
  );

  await page
    .getByRole("toolbar", { name: "Project tools" })
    .getByRole("button", { name: "Export" })
    .click();
  await expect(page.getByRole("heading", { name: "Export" })).toBeVisible();

  const inspector = page.getByTestId("inspector-body");
  await inspector.getByLabel("Format").selectOption("ass");
  await inspector.getByRole("button", { name: "Apply preset" }).click();
  await inspector.getByLabel("Safe area").click();
  await expect(page.getByTestId("subtitle-safe-area")).toBeVisible();

  await inspector.getByRole("button", { name: "Export", exact: true }).click();

  await expect(
    page.getByText("ASS exported: D:/Diplomat/exports/project-demo.bilingual.ass")
  ).toBeVisible();

  await inspector.getByRole("button", { name: "Render video" }).click();
  await expect(inspector.getByText("Burn-in export completed")).toBeVisible();
  await expect(inspector.getByText("100%")).toBeVisible();
});
