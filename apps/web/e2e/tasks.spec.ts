import type { TaskResponse } from "@diplomat/shared";
import { demoProject, expect, test } from "./fixtures";

const runningTask: TaskResponse = {
  taskId: "task-running",
  projectId: demoProject.projectId,
  type: "analysis",
  status: "running",
  progress: 0.42,
  message: "Transcribing interview audio",
  startedAt: "2026-06-07T00:00:00+00:00",
  updatedAt: "2026-06-07T00:01:00+00:00",
  completedAt: null,
  errorCode: null,
  errorMessage: null,
  diagnosticLogPath: null
};

const failedTask: TaskResponse = {
  taskId: "task-failed",
  projectId: demoProject.projectId,
  type: "translation",
  status: "failed",
  progress: 0.65,
  message: "Model is not installed",
  startedAt: "2026-06-07T00:02:00+00:00",
  updatedAt: "2026-06-07T00:03:00+00:00",
  completedAt: "2026-06-07T00:03:00+00:00",
  errorCode: "MODEL_NOT_INSTALLED",
  errorMessage: "Install the translation model before retrying.",
  diagnosticLogPath: "D:/Diplomat/projects/project-demo/logs/task-failed.log"
};

test("opens task center details and recovers a failed pipeline stage", async ({
  page,
  workerApi
}) => {
  workerApi.tasks.set(runningTask.taskId, runningTask);
  workerApi.tasks.set(failedTask.taskId, failedTask);

  await page.goto("/");
  await page
    .getByTestId("diplomat-ui-shell")
    .getByRole("button", { name: "Task Queue" })
    .click();
  await page.getByRole("button", { name: "Open task queue" }).click();

  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Task Queue" }).getByText("Transcribing interview audio")
  ).toBeVisible();

  await page.getByRole("button", { name: "View details for task task-failed" }).click();

  const details = page.getByRole("region", { name: "Task details" });
  await expect(details).toContainText("Translation");
  await expect(details).toContainText("Failed 65%");
  await expect(details).toContainText("Install the translation model before retrying.");
  await expect(details.getByRole("button", { name: "Recover from checkpoint" })).toBeVisible();
  await expect(details.getByRole("button", { name: "Open diagnostic log" })).toBeVisible();

  await details.getByRole("button", { name: "Recover from checkpoint" }).click();

  await expect(details).toContainText("Completed");
});
