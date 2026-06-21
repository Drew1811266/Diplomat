import { demoSubtitleDocument, expect, test } from "./fixtures";

test("opens the demo project and exports subtitles from the workbench", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("project-row-project-demo").getByRole("button", { name: "Open" }).click();

  await expect(page.getByRole("main", { name: "Workbench" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select line line-1" })).toBeVisible();
  await expect(page.getByText("2 subtitle rows")).toBeVisible();
  await expect(page.getByRole("region", { name: "Current production stage" })).toContainText(
    "Transcription"
  );
  await expect(page.getByRole("region", { name: "Current production stage" })).toContainText(
    "Create or review subtitles"
  );

  await page.getByRole("button", { name: "Select line line-1" }).click();

  await expect(page.getByTestId("subtitle-row-line-1")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Source text")).toHaveValue(
    demoSubtitleDocument.lines[0].sourceText
  );

  const inspector = page.getByTestId("inspector-body");

  await page
    .getByRole("navigation", { name: "Project workspaces" })
    .getByRole("button", { name: "Translate" })
    .click();
  await expect(page.getByRole("region", { name: "Current production stage" })).toContainText(
    "Fill missing translations"
  );
  await page.getByRole("button", { name: "Open translation controls" }).click();
  await expect(page.getByRole("heading", { name: "Project translation settings" })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Project workspaces" })
    .getByRole("button", { name: "Style" })
    .click();
  await expect(page.getByRole("heading", { name: "Project style settings" })).toBeVisible();
  await inspector.getByRole("button", { name: "Apply preset" }).click();
  await inspector.getByLabel("Safe area").click();
  await expect(page.getByTestId("subtitle-safe-area")).toBeVisible();

  await page
    .getByRole("navigation", { name: "Project workspaces" })
    .getByRole("button", { name: "Deliver" })
    .click();
  await expect(page.getByRole("heading", { name: "Project export settings" })).toBeVisible();
  await expect(inspector.getByLabel("Safe area")).toHaveCount(0);

  await inspector.getByLabel("Format").selectOption("ass");
  await inspector.getByRole("button", { name: "Export", exact: true }).click();

  await expect(
    page.getByText("ASS exported: D:/Diplomat/exports/project-demo.bilingual.ass")
  ).toBeVisible();

  await inspector.getByRole("button", { name: "Render video" }).click();
  await expect(inspector.getByText("Burn-in export completed")).toBeVisible();
  await expect(inspector.getByText("100%")).toBeVisible();
});
