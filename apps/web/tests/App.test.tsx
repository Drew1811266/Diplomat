import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ProjectResponse, TaskResponse } from "@diplomat/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { appI18n } from "../src/app/i18n";
import { LANGUAGE_STORAGE_KEY, useUiStore } from "../src/state/uiStore";
import {
  analyzedDocumentFixture,
  modelCatalogFixture,
  projectFixture,
  runningAnalysisTaskFixture
} from "../src/test/fixtures";
import { renderWithProviders } from "../src/test/render";

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}

function jsonErrorResponse(status: number, detail: string): Response {
  return {
    ok: false,
    status,
    json: async () => ({ detail })
  } as Response;
}

function stubMatchMedia() {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

function stubResizeObserver() {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    }))
  );
}

function stubStartupFetch(
  options: { health?: "ok" | "offline"; project?: ProjectResponse; tasks?: TaskResponse[] } = {}
) {
  const project = options.project ?? projectFixture;

  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        if (options.health === "offline") {
          return jsonErrorResponse(503, "Local runtime unavailable");
        }
        return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.3.0" });
      }
      if (url.endsWith("/projects")) {
        return jsonResponse({ projects: [project] });
      }
      if (url.endsWith("/models")) {
        return jsonResponse(modelCatalogFixture);
      }
      if (url.endsWith("/tasks")) {
        return jsonResponse({ tasks: options.tasks ?? [runningAnalysisTaskFixture] });
      }
      if (url.endsWith("/projects/project-demo")) {
        return jsonResponse(project);
      }
      if (url.endsWith("/projects/project-demo/subtitle")) {
        return jsonResponse(analyzedDocumentFixture);
      }
      if (url.endsWith("/release/readiness")) {
        return jsonResponse({
          version: "0.3.0",
          generatedAt: "2026-06-14T00:00:00+00:00",
          ready: false,
          summary: { pass: 2, warning: 1, blocker: 1 },
          checks: [
            {
              id: "model_registry_checksums",
              label: "Model registry checksums",
              severity: "blocker",
              message: "Model registry contains placeholder checksums.",
              remediation: "Replace placeholders with audited SHA256 checksums."
            }
          ]
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    })
  );
}

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

describe("App", () => {
  it("starts in the project center shell", async () => {
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch();

    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "Project Library" })).toBeVisible();
    expect(screen.getByTestId("diplomat-ui-shell")).toHaveAttribute("data-ui-version", "v2");
    expect(screen.getByTestId("diplomat-ui-shell")).toHaveAttribute(
      "data-feature-ui-v2",
      "enabled"
    );
    expect(screen.getByTestId("diplomat-ui-shell")).toHaveAttribute(
      "data-feature-ui-v2-source",
      "default"
    );
    expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual([
      "Project Library"
    ]);
    const header = screen.getByRole("banner");
    expect(screen.getByRole("navigation", { name: "System utilities" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Activity navigation" })).not.toBeInTheDocument();
    expect(within(header).getByText("Project Library")).toBeVisible();
    expect(within(header).queryByText("Subtitle Workbench")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Editor workspaces" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Project workspaces" })).not.toBeInTheDocument();
    expect(within(header).queryByText("Projects")).not.toBeInTheDocument();
    expect(within(header).queryByText("/")).not.toBeInTheDocument();
    expect(within(header).queryByLabelText("Interface language")).not.toBeInTheDocument();
    expect(within(header).queryByRole("button", { name: "Project Library" })).not.toBeInTheDocument();
    expect(within(header).queryByRole("button", { name: "Workbench" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Model Manager" })).not.toBeInTheDocument();
    const backgroundTaskButton = await within(header).findByRole("button", {
      name: "Task Queue"
    });
    expect(backgroundTaskButton).toHaveTextContent("Task Queue");
    expect(backgroundTaskButton).toHaveTextContent("1");
    expect(backgroundTaskButton).not.toHaveTextContent("active");
    expect(within(header).queryByText("Background tasks")).not.toBeInTheDocument();
    expect(within(header).queryByText("1 active")).not.toBeInTheDocument();
    const statusBar = screen.getByRole("contentinfo", { name: "Status bar" });
    expect(statusBar).toBeVisible();
    expect(within(statusBar).getByText("Project Library")).toBeVisible();
    expect(within(statusBar).getByText("No project selected")).toBeVisible();
    expect(
      within(statusBar).queryByRole("button", { name: "Open current page" })
    ).not.toBeInTheDocument();
    expect(
      within(statusBar).queryByRole("button", { name: "Open project context" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Diplomat")).toBeVisible();
    expect(await screen.findByText("Demo")).toBeVisible();
  });

  it("does not render a global activity navigation strip", async () => {
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch();

    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "Project Library" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Activity navigation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Workbench" })).not.toBeInTheDocument();
  });

  it("opens the global task popover and jumps to the task queue", async () => {
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch();

    renderWithProviders(<App />);

    const tasksButton = await screen.findByRole("button", { name: "Task Queue" });
    expect(tasksButton).toHaveTextContent("Task Queue");
    expect(await within(tasksButton).findByText("1")).toBeVisible();
    expect(tasksButton).not.toHaveTextContent("active");

    fireEvent.click(tasksButton);

    await waitFor(() => expect(screen.getByText("Transcribing audio")).toBeVisible());
    expect(screen.getByText("35%")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Open task queue" }));

    expect(await screen.findByRole("main", { name: "Tasks" })).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual([
      "Tasks"
    ]);
  });

  it("localizes common backend task messages in the global task popover", async () => {
    const failedModelTask: TaskResponse = {
      ...runningAnalysisTaskFixture,
      taskId: "task-model-missing",
      status: "failed",
      progress: 0,
      message: "Model is not installed",
      errorMessage: "Install the translation model before retrying."
    };
    stubMatchMedia();
    stubResizeObserver();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "zh");
    useUiStore.getState().resetUiState();
    await appI18n.changeLanguage("en");
    stubStartupFetch({ tasks: [failedModelTask] });

    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "项目库" })).toBeVisible();
    fireEvent.click(await screen.findByRole("button", { name: "任务队列" }));

    expect(await screen.findByText("模型未安装")).toBeVisible();
    expect(screen.queryByText("Model is not installed")).not.toBeInTheDocument();
  });

  it("applies the persisted interface language without a global language switcher", async () => {
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "zh");
    useUiStore.getState().resetUiState();
    await appI18n.changeLanguage("en");

    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "项目库" })).toBeVisible();
    const header = screen.getByRole("banner");
    expect(within(header).getByText("项目库")).toBeVisible();
    expect(within(header).queryByText("字幕工作台")).not.toBeInTheDocument();
    expect(within(header).queryByLabelText("界面语言")).not.toBeInTheDocument();
    expect(within(header).queryByRole("button", { name: "项目库" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "设置" })).toBeVisible();
  });

  it("navigates to settings from the system utility controls", async () => {
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch();

    renderWithProviders(<App />);
    await screen.findByRole("heading", { name: "Project Library" });
    expect(screen.queryByRole("navigation", { name: "Activity navigation" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("main", { name: "System Settings" })).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual([
      "System Settings"
    ]);
  });

  it("opens a global command palette with Ctrl Shift P and runs settings commands", async () => {
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch();

    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "Project Library" })).toBeVisible();
    fireEvent.keyDown(document, { key: "P", code: "KeyP", ctrlKey: true, shiftKey: true });

    const dialog = await screen.findByRole("dialog", { name: "Command palette" });
    expect(within(dialog).getByRole("searchbox", { name: "Search commands" })).toBeVisible();

    fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search commands" }), {
      target: { value: "model" }
    });
    expect(within(dialog).queryByRole("button", { name: "Project Library" })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Models" }));

    expect(await screen.findByRole("main", { name: "System Settings" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Models" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
  });

  it("opens the matching help article from a workbench panel help button", async () => {
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch();

    renderWithProviders(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    expect(await screen.findByRole("main", { name: "Workbench" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Open help for Subtitle line" }));

    expect(await screen.findByRole("main", { name: "Help Center" })).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual([
      "Help Center"
    ]);
    expect(screen.getByRole("article", { name: "Timing and QA" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Timing and QA" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("opens runtime settings from the status bar", async () => {
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch();

    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "Project Library" })).toBeVisible();
    const statusBar = screen.getByRole("contentinfo", { name: "Status bar" });

    fireEvent.click(within(statusBar).getByRole("button", { name: "Open runtime settings" }));

    expect(await screen.findByRole("main", { name: "System Settings" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Runtime" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("heading", { name: "Runtime" })).toBeVisible();
  });

  it("uses live runtime health in the global shell", async () => {
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch({ health: "offline" });

    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "Project Library" })).toBeVisible();
    const header = screen.getByRole("banner");
    const statusBar = screen.getByRole("contentinfo", { name: "Status bar" });

    await waitFor(() =>
      expect(
        within(header).getByRole("button", { name: "Open runtime settings" })
      ).toHaveTextContent("Local runtime · Offline")
    );
    expect(
      within(statusBar).getByRole("button", { name: "Open runtime settings" })
    ).toHaveTextContent("Local runtime · Offline");
  });

  it("shows project context in the status bar without adding another navigation control", async () => {
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch();

    renderWithProviders(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    expect(await screen.findByRole("main", { name: "Workbench" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("main", { name: "System Settings" })).toBeVisible();
    expect(within(screen.getByRole("banner")).getByText("System Settings")).toBeVisible();

    const statusBar = screen.getByRole("contentinfo", { name: "Status bar" });
    expect(within(statusBar).getByText("System Settings")).toBeVisible();
    expect(within(statusBar).getByText("Transcribe")).toBeVisible();
    expect(
      within(statusBar).queryByRole("button", { name: "Open project context" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Workbench" }));
    expect(await screen.findByRole("main", { name: "Workbench" })).toBeVisible();
    expect(useUiStore.getState().activeProjectId).toBe("project-demo");
  });

  it("navigates top-level modes, editor workspaces, and opens projects into the editor", async () => {
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch();

    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "Project Library" })).toBeVisible();

    expect(screen.queryByRole("button", { name: "Workbench" })).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    expect(await screen.findByRole("main", { name: "Workbench" })).toBeVisible();
    expect(useUiStore.getState().activeProjectId).toBe("project-demo");
    expect(screen.queryByRole("navigation", { name: "Activity navigation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Project Library" })).toBeVisible();

    const projectWorkspaceNav = await screen.findByRole("navigation", { name: "Project workspaces" });
    fireEvent.click(within(projectWorkspaceNav).getByRole("button", { name: "Translate" }));
    expect(useUiStore.getState().editorWorkspace).toBe("translation");
    expect(await screen.findByRole("main", { name: "Workbench" })).toBeVisible();

    const backgroundTasksButton = screen.getByRole("button", { name: "Task Queue" });
    fireEvent.click(backgroundTasksButton);
    fireEvent.click(await screen.findByRole("button", { name: "Open task queue" }));
    expect(await screen.findByRole("main", { name: "Tasks" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Project workspaces" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(await screen.findByRole("main", { name: "Help Center" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Project workspaces" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("main", { name: "System Settings" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Language" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.queryByRole("heading", { name: "Models" })).not.toBeInTheDocument();
    const settingsCategoriesNav = screen.getByRole("navigation", { name: "Settings categories" });
    fireEvent.click(within(settingsCategoriesNav).getByRole("button", { name: "Models" }));
    expect(await screen.findByRole("heading", { name: "Models" })).toBeVisible();
    expect(within(settingsCategoriesNav).getByRole("button", { name: "Models" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.queryByRole("navigation", { name: "Project workspaces" })).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Workbench" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Project Library" }));
    expect(await screen.findByRole("heading", { name: "Project Library" })).toBeVisible();
  });

  it("hides editor workspace navigation until an opened project has media", async () => {
    const emptyMediaProject: ProjectResponse = {
      ...projectFixture,
      sourceVideoPath: null,
      durationMs: 0,
      mediaAssets: [],
      diagnostics: {
        ...projectFixture.diagnostics,
        sourceVideoExists: false,
        diskUsageBytes: 0
      }
    };
    stubMatchMedia();
    stubResizeObserver();
    stubStartupFetch({ project: emptyMediaProject });

    renderWithProviders(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    expect(await screen.findByRole("main", { name: "Workbench" })).toBeVisible();
    expect(await screen.findByTestId("workbench-media-start")).toBeVisible();

    const header = screen.getByRole("banner");
    expect(screen.queryByRole("navigation", { name: "Project workspaces" })).not.toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Project Library" })).toBeVisible();
    expect(within(header).queryByRole("button", { name: "Translate" })).not.toBeInTheDocument();
  });
});
