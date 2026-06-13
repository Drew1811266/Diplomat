import { expect, test } from "./fixtures";

test("shows a recent project and switches interface language", async ({ page, workerApi }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Project Center" })).toBeVisible();
  await expect(page.getByText(workerApi.projects[0].name, { exact: true })).toBeVisible();
  await expect(page.getByRole("status").getByText("Worker ready")).toBeVisible();

  await page.getByText("中文", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "项目中心" })).toBeVisible();
  await expect(page.getByRole("status").getByText("Worker 已就绪")).toBeVisible();
  await expect(page.getByRole("button", { name: "打开" })).toBeVisible();

  await page.getByText("EN", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Project Center" })).toBeVisible();
});
