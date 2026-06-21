import { demoSubtitleDocument, expect, test } from "./fixtures";

test("keeps project browsing and existing subtitle editing available while runtime health is offline", async ({
  page,
  workerApi
}) => {
  workerApi.healthStatus = "offline";

  await page.goto("/");

  const header = page.getByRole("banner");
  await expect(
    header.getByRole("button", { name: "Open runtime settings" })
  ).toContainText("Local runtime · Offline");
  await expect(page.getByRole("heading", { name: "Project Library" })).toBeVisible();
  await expect(page.getByText("Demo", { exact: true })).toBeVisible();
  await expect(page.getByText(/Worker is not reachable|127\.0\.0\.1|localhost/i)).toHaveCount(0);

  await page.getByTestId("project-row-project-demo").getByRole("button", { name: "Open" }).click();

  await expect(page.getByRole("main", { name: "Workbench" })).toBeVisible();
  await expect(page.getByText("2 subtitle rows")).toBeVisible();
  await page.getByRole("button", { name: "Select line line-1" }).click();
  await expect(page.getByLabel("Source text")).toHaveValue(
    demoSubtitleDocument.lines[0].sourceText
  );
  await expect(page.getByText(/Worker is not reachable|127\.0\.0\.1|localhost/i)).toHaveCount(0);
});
