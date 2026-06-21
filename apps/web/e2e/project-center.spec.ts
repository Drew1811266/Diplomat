import { expect, test } from "./fixtures";

test("shows a recent project and switches interface language", async ({ page, workerApi }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Project Library" })).toBeVisible();
  await expect(page.getByText(workerApi.projects[0].name, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New Project" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Project library actions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import backup" })).toHaveCount(0);
  await expect(
    page.getByRole("banner").getByRole("button", { name: "Open runtime settings" })
  ).toContainText("Local runtime · Ready");
  await expect(page.getByText(/Worker ready/i)).not.toBeVisible();

  await page.getByRole("banner").getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByText("中文", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "系统设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: "项目库" })).toBeVisible();
  await expect(page.getByRole("button", { name: "语言" })).toHaveAttribute("aria-current", "page");

  await page.getByText("EN", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "System Settings" })).toBeVisible();

  await page.getByRole("button", { name: "Project Library" }).click();
  await expect(page.getByRole("heading", { name: "Project Library" })).toBeVisible();
});

test("creates an empty project container before media is imported from the workbench", async ({
  page
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "New Project" }).click();
  const creationDialog = page.getByRole("dialog", { name: "New Project" });
  await expect(creationDialog.getByLabel("Project name")).toBeVisible();
  await expect(creationDialog.getByLabel("Source video path")).toHaveCount(0);

  await creationDialog.getByLabel("Project name").fill("Client campaign");
  await creationDialog.getByRole("button", { name: "Save Project" }).click();

  await expect(page.getByRole("main", { name: "Workbench" })).toBeVisible();
  await expect(page.getByText("Client campaign")).toBeVisible();

  const mediaBin = page.getByRole("region", { name: "Project media" });
  await expect(mediaBin).toBeVisible();
  await expect(mediaBin.getByText("Drop videos here")).toBeVisible();
  await expect(mediaBin.getByRole("button", { name: "Import video" })).toBeVisible();
  await expect(mediaBin.getByText("created.mp4")).toHaveCount(0);
  await expect(mediaBin.getByText("D:/media/created.mp4")).toHaveCount(0);
});
