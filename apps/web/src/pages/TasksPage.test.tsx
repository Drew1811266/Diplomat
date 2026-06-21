import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { useUiStore } from "../state/uiStore";
import { renderWithProviders } from "../test/render";
import {
  completedTranslationTaskFixture,
  failedProjectFixture,
  projectFixture,
  runningAnalysisTaskFixture
} from "../test/fixtures";
import { stubFetchWithRoutes } from "../test/serverMocks";
import { TasksPage } from "./TasksPage";

const runningTask = {
  ...runningAnalysisTaskFixture,
  progress: 0.42,
  message: "Transcribing interview audio"
};

const failedTask = {
  ...completedTranslationTaskFixture,
  taskId: "task-2",
  projectId: "project-failed",
  status: "failed" as const,
  progress: 0.65,
  message: "Model is not installed",
  completedAt: "2026-06-07T00:05:00+00:00",
  errorCode: "MODEL_NOT_INSTALLED",
  errorMessage: "Install the translation model before retrying.",
  diagnosticLogPath: "D:/Diplomat/projects/project-failed/logs/task-2.log"
};

function stubTasksPageFetch() {
  return stubFetchWithRoutes([
    {
      match: (url, init) => url.endsWith("/tasks") && init?.method === undefined,
      response: { tasks: [runningTask, failedTask] }
    },
    {
      match: (url, init) => url.endsWith("/projects") && init?.method === undefined,
      response: { projects: [projectFixture, failedProjectFixture] }
    },
    {
      match: (url, init) => url.endsWith("/tasks/task-1/cancel") && init?.method === "POST",
      response: { ...runningTask, status: "canceling", message: "Canceling task" }
    },
    {
      match: (url, init) => url.endsWith("/tasks/task-2/retry") && init?.method === "POST",
      response: { ...failedTask, taskId: "task-3", status: "queued", message: "Queued retry" }
    }
  ]);
}

function makeManyTasks(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const taskNumber = index + 1;
    return {
      ...runningTask,
      taskId: `task-${taskNumber}`,
      message: `Generated task ${taskNumber}`,
      progress: 0.2,
      updatedAt: `2026-06-07T00:${String(taskNumber % 60).padStart(2, "0")}:00+00:00`
    };
  });
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

describe("TasksPage", () => {
  it("renders the task center as a compact queue surface", async () => {
    await appI18n.changeLanguage("en");
    vi.stubGlobal("fetch", stubTasksPageFetch());

    renderWithProviders(<TasksPage />);

    expect(await screen.findByRole("heading", { name: "Tasks" })).toHaveAttribute(
      "data-size",
      "h3"
    );
    const table = await screen.findByRole("table", { name: "Task Queue" });
    await within(table).findByText("Transcribing interview audio");
    expect(screen.getByTestId("tasks-inline-summary")).toHaveTextContent("Total 2");
    expect(screen.getByTestId("tasks-inline-summary")).toHaveTextContent("Active 1");
    expect(screen.getByTestId("tasks-inline-summary")).toHaveTextContent("Failed 1");
    expect(screen.getByTestId("tasks-queue-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("tasks-metric-cards")).not.toBeInTheDocument();
  });

  it("renders real task queue rows with project context and recovery actions", async () => {
    await appI18n.changeLanguage("en");
    const fetchMock = stubTasksPageFetch();
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<TasksPage />);

    const table = await screen.findByRole("table", { name: "Task Queue" });
    await within(table).findByText("Transcribing interview audio");
    expect(within(table).getByText("Transcribing interview audio")).toBeInTheDocument();
    expect(within(table).getByText("Model is not installed")).toBeInTheDocument();
    expect(within(table).getByText("Demo")).toBeInTheDocument();
    expect(within(table).getByText("Failed Demo")).toBeInTheDocument();
    expect(within(table).getByText("42%")).toBeInTheDocument();
    expect(within(table).getByText("65%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel task task-1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry task task-2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open logs for task task-2" })).toBeInTheDocument();
  });

  it("shows selected task details with pipeline stage recovery actions", async () => {
    const user = userEvent.setup();
    await appI18n.changeLanguage("en");
    const fetchMock = stubTasksPageFetch();
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<TasksPage />);

    const table = await screen.findByRole("table", { name: "Task Queue" });
    await within(table).findByText("Transcribing interview audio");
    expect(screen.getByRole("region", { name: "Task details" })).toHaveTextContent(
      "ASR transcription"
    );
    expect(screen.getByRole("region", { name: "Task details" })).toHaveTextContent("Running 42%");

    await user.click(screen.getByRole("button", { name: "View details for task task-2" }));

    const details = screen.getByRole("region", { name: "Task details" });
    expect(details).toHaveTextContent("Failed Demo");
    expect(details).toHaveTextContent("Translation");
    expect(details).toHaveTextContent("Failed 65%");
    expect(details).toHaveTextContent("Install the translation model before retrying.");
    expect(within(details).getByRole("button", { name: "Recover from checkpoint" })).toBeVisible();
    expect(within(details).getByRole("button", { name: "Open diagnostic log" })).toBeVisible();

    await user.click(within(details).getByRole("button", { name: "Recover from checkpoint" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/tasks\/task-2\/retry$/),
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("filters the real queue by task search text", async () => {
    await appI18n.changeLanguage("en");
    vi.stubGlobal("fetch", stubTasksPageFetch());

    renderWithProviders(<TasksPage />);

    const table = await screen.findByRole("table", { name: "Task Queue" });
    await within(table).findByText("Transcribing interview audio");
    await userEvent.type(screen.getByRole("textbox", { name: "Search tasks" }), "model");

    await waitFor(() => {
      expect(screen.queryByText("Transcribing interview audio")).not.toBeInTheDocument();
    });
    expect(within(table).getByText("Model is not installed")).toBeInTheDocument();
  });

  it("filters the real queue by project", async () => {
    await appI18n.changeLanguage("en");
    vi.stubGlobal("fetch", stubTasksPageFetch());

    renderWithProviders(<TasksPage />);

    const table = await screen.findByRole("table", { name: "Task Queue" });
    await within(table).findByText("Transcribing interview audio");
    await userEvent.selectOptions(screen.getByLabelText("Project"), "project-failed");

    await waitFor(() => {
      expect(screen.queryByText("Transcribing interview audio")).not.toBeInTheDocument();
    });
    expect(within(table).getByText("Model is not installed")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("shows a friendly task loading error instead of runtime technical details", async () => {
    await appI18n.changeLanguage("en");
    vi.stubGlobal(
      "fetch",
      stubFetchWithRoutes([
        {
          match: (url, init) => url.endsWith("/tasks") && init?.method === undefined,
          ok: false,
          status: 503,
          response: {
            detail:
              "Worker is not reachable at http://127.0.0.1:8765. Start the local runtime from Settings."
          }
        },
        {
          match: (url, init) => url.endsWith("/projects") && init?.method === undefined,
          response: { projects: [projectFixture] }
        }
      ])
    );

    renderWithProviders(<TasksPage />);

    expect(await screen.findByText("Could not load tasks.")).toBeVisible();
    expect(screen.queryByText(/Worker is not reachable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/127\.0\.0\.1/)).not.toBeInTheDocument();
  });

  it("localizes common backend task messages in Chinese and keeps search usable", async () => {
    useUiStore.getState().setLanguage("zh");
    await appI18n.changeLanguage("zh");
    vi.stubGlobal("fetch", stubTasksPageFetch());

    renderWithProviders(<TasksPage />);

    const table = await screen.findByRole("table", { name: "任务队列" });
    expect(await within(table).findByText("模型未安装")).toBeInTheDocument();
    expect(within(table).getByText("请先安装翻译模型再重试。")).toBeInTheDocument();
    expect(screen.queryByText("Model is not installed")).not.toBeInTheDocument();
    expect(screen.queryByText("Install the translation model before retrying.")).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "搜索任务" }), "模型");

    await waitFor(() => {
      expect(screen.queryByText("Transcribing interview audio")).not.toBeInTheDocument();
    });
    expect(within(table).getByText("模型未安装")).toBeInTheDocument();
  });

  it("virtualizes long task queues instead of rendering every task row", async () => {
    await appI18n.changeLanguage("en");
    vi.stubGlobal(
      "fetch",
      stubFetchWithRoutes([
        {
          match: (url, init) => url.endsWith("/tasks") && init?.method === undefined,
          response: { tasks: makeManyTasks(500) }
        },
        {
          match: (url, init) => url.endsWith("/projects") && init?.method === undefined,
          response: { projects: [projectFixture] }
        }
      ])
    );

    renderWithProviders(<TasksPage />);

    const table = await screen.findByRole("table", { name: "Task Queue" });
    expect(await within(table).findByText("Generated task 1")).toBeInTheDocument();
    expect(screen.getByText("80/500 visible")).toBeInTheDocument();
    expect(screen.queryByText("Generated task 500")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^task-row-/)).toHaveLength(80);
  });
});
