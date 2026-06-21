import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { useUiStore } from "../state/uiStore";
import { failedProjectFixture, projectFixture, translatedProjectFixture } from "../test/fixtures";
import { renderWithProviders } from "../test/render";
import { ProjectCenterPage } from "./ProjectCenterPage";

const desktopMock = vi.hoisted(() => ({
  isDesktopRuntime: vi.fn<() => boolean>(() => false),
  listenForDroppedVideoFiles: vi.fn<
    (handler: (path: string) => void) => Promise<() => void>
  >(async () => vi.fn()),
  openPathInFileManager: vi.fn<(path: string) => Promise<void>>(async () => undefined),
  pickProjectBackupFile: vi.fn<() => Promise<string | null>>(async () => null),
  pickVideoFile: vi.fn<() => Promise<string | null>>(async () => null)
}));

vi.mock("../desktop", () => desktopMock);

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}

function errorResponse(status: number, detail: string): Response {
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

function makeManyProjects(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    ...projectFixture,
    projectId: `project-${index + 1}`,
    name: `Project ${index + 1}`,
    sourceVideoPath: `D:/media/project-${index + 1}.mp4`,
    projectDir: `D:/Diplomat/projects/project-${index + 1}`,
    updatedAt: `2026-06-${String((index % 28) + 1).padStart(2, "0")}T00:00:00+00:00`,
    diagnostics: {
      ...projectFixture.diagnostics,
      exportsDir: `D:/Diplomat/projects/project-${index + 1}/exports`,
      logsDir: `D:/Diplomat/projects/project-${index + 1}/logs`
    }
  }));
}

afterEach(async () => {
  cleanup();
  document
    .querySelectorAll("[data-mantine-shared-portal-node]")
    .forEach((node) => node.remove());
  localStorage.clear();
  useUiStore.getState().resetUiState();
  desktopMock.isDesktopRuntime.mockReset();
  desktopMock.isDesktopRuntime.mockReturnValue(false);
  desktopMock.listenForDroppedVideoFiles.mockReset();
  desktopMock.listenForDroppedVideoFiles.mockResolvedValue(vi.fn());
  desktopMock.openPathInFileManager.mockReset();
  desktopMock.openPathInFileManager.mockResolvedValue(undefined);
  desktopMock.pickProjectBackupFile.mockReset();
  desktopMock.pickProjectBackupFile.mockResolvedValue(null);
  desktopMock.pickVideoFile.mockReset();
  desktopMock.pickVideoFile.mockResolvedValue(null);
  vi.unstubAllGlobals();
  await appI18n.changeLanguage("en");
});

describe("ProjectCenterPage", () => {
  it("renders project library as a startup center with recent project cards", async () => {
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });
        }
        if (url.endsWith("/projects")) {
          return jsonResponse({ projects: [projectFixture] });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ProjectCenterPage onOpenProject={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Project Library" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Project start" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Recent project cards" })).toBeVisible();
    expect(
      screen.queryByText(
        "Create and open project containers. Import videos from the workbench after opening a project."
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Local runtime ready")).not.toBeInTheDocument();
    expect(screen.queryByText(/Worker/i)).not.toBeInTheDocument();
    expect(await screen.findByText("Demo")).toBeVisible();
    expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Status filter" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Status filter")).toBeVisible();
    expect(screen.getByRole("button", { name: "New Project" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Project library actions" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Import backup" })).not.toBeInTheDocument();
    expect(screen.queryByText("Recover")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Import backup" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Backup package path")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Restore name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import Video" })).not.toBeInTheDocument();
  });

  it("keeps project browsing available without page-level runtime health", async () => {
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          throw new Error("runtime port unavailable");
        }
        if (url.endsWith("/projects")) {
          return jsonResponse({ projects: [projectFixture] });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ProjectCenterPage onOpenProject={vi.fn()} />);

    expect(await screen.findByText("Demo")).toBeVisible();
    expect(screen.queryByText("Local runtime offline")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")?.textContent ?? "").not.toContain(
      "runtime port unavailable"
    );
  });

  it("opens a project when the project row is double clicked", async () => {
    const user = userEvent.setup();
    const onOpenProject = vi.fn();
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });
        }
        if (url.endsWith("/projects")) {
          return jsonResponse({ projects: [projectFixture] });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ProjectCenterPage onOpenProject={onOpenProject} />);

    const projectRow = await screen.findByTestId("project-row-project-demo");
    expect(projectRow).toHaveAttribute("title", "Double-click to open Demo");

    await user.dblClick(projectRow);

    expect(onOpenProject).toHaveBeenCalledWith("project-demo");
  });

  it("guides an empty project library toward creating a project container", async () => {
    const user = userEvent.setup();
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });
        }
        if (url.endsWith("/projects")) {
          return jsonResponse({ projects: [] });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ProjectCenterPage onOpenProject={vi.fn()} />);

    expect(await screen.findByText("No recent projects")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create project container" }));

    const creationDialog = await screen.findByRole("dialog", { name: "New Project" });

    await waitFor(() =>
      expect(
        within(creationDialog).getByText(
          "Name the project now. Import or replace project videos from the workbench."
        )
      ).toBeVisible()
    );
    expect(screen.queryByLabelText("Source video path")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import Video" })).not.toBeInTheDocument();
  });

  it("shows friendly project query errors instead of technical runtime details", async () => {
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });
        }
        if (url.endsWith("/projects")) {
          return errorResponse(500, "project index offline");
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ProjectCenterPage onOpenProject={vi.fn()} />);

    expect(await screen.findByRole("alert", undefined, { timeout: 3000 })).toHaveTextContent(
      "Project library could not be loaded."
    );
    expect(screen.queryByText(/Local runtime request failed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/project index offline/)).not.toBeInTheDocument();
    expect(screen.queryByText("No recent projects")).not.toBeInTheDocument();
  });

  it("creates a project from only a project name", async () => {
    const user = userEvent.setup();
    desktopMock.isDesktopRuntime.mockReturnValue(true);
    useUiStore.getState().setProjectDefaults({
      sourceLanguage: "en",
      targetLanguage: "ja",
      exportMode: "target"
    });
    const onOpenProject = vi.fn();
    const createdProject = {
      ...projectFixture,
      projectId: "project-empty",
      name: "Client campaign",
      sourceVideoPath: null,
      durationMs: 0,
      diagnostics: {
        ...projectFixture.diagnostics,
        sourceVideoExists: false,
        warnings: []
      }
    };
    stubMatchMedia();
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });
      }
      if (url.endsWith("/projects") && init?.method === undefined) {
        return jsonResponse({ projects: [] });
      }
      if (url.endsWith("/projects") && init?.method === "POST") {
        return jsonResponse(createdProject);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<ProjectCenterPage onOpenProject={onOpenProject} />);

    await screen.findByRole("heading", { name: "Project Library" });
    expect(screen.getByPlaceholderText("Name, language, or project ID")).toBeVisible();
    expect(screen.queryByPlaceholderText(/source path/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New Project" }));
    const creationDialog = await screen.findByRole("dialog", { name: "New Project" });
    await user.clear(within(creationDialog).getByLabelText("Project name"));
    await user.type(within(creationDialog).getByLabelText("Project name"), "Client campaign");
    await user.click(within(creationDialog).getByRole("button", { name: "Save Project" }));

    expect(within(creationDialog).getByLabelText("Project name")).toBeVisible();
    expect(screen.queryByLabelText("Source video path")).not.toBeInTheDocument();
    expect(screen.queryByText("Source video path is required.")).not.toBeInTheDocument();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects$/),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "Client campaign",
            sourceVideoPath: null,
            sourceLanguage: "en",
            targetLanguage: "ja"
          })
        })
      )
    );
    expect(onOpenProject).toHaveBeenCalledWith("project-empty");
  });

  it("localizes recent project card labels", async () => {
    useUiStore.getState().setLanguage("zh");
    await appI18n.changeLanguage("zh");
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });
        }
        if (url.endsWith("/projects")) {
          return jsonResponse({ projects: [projectFixture] });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ProjectCenterPage onOpenProject={vi.fn()} />);

    const cardRegion = await screen.findByRole("region", { name: "最近项目卡片" });
    expect(await within(cardRegion).findByText("Demo")).toBeVisible();
    expect(within(cardRegion).getByText("语言")).toBeVisible();
    expect(within(cardRegion).getByText("字幕")).toBeVisible();
    expect(within(cardRegion).getByText("时长")).toBeVisible();
    expect(within(cardRegion).getByText("更新时间")).toBeVisible();
    expect(screen.queryByRole("columnheader", { name: "来源" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Project" })).not.toBeInTheDocument();
  });

  it("treats project library rows as project containers instead of media import status", async () => {
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });
        }
        if (url.endsWith("/projects")) {
          return jsonResponse({
            projects: [
              projectFixture,
              {
                ...projectFixture,
                projectId: "project-empty-media",
                name: "Empty Media",
                sourceVideoPath: null
              }
            ]
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ProjectCenterPage onOpenProject={vi.fn()} />);

    expect(await screen.findByText("Demo")).toBeVisible();
    expect(screen.queryByRole("columnheader", { name: "Source" })).not.toBeInTheDocument();
    expect(screen.queryByText("demo.mp4")).not.toBeInTheDocument();
    expect(screen.queryByText("D:/media/demo.mp4")).not.toBeInTheDocument();
    expect(screen.getByText("Empty Media")).toBeVisible();
    expect(screen.queryByText("No video imported")).not.toBeInTheDocument();
  });

  it("filters projects by search text and derived status", async () => {
    const user = userEvent.setup();
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });
        }
        if (url.endsWith("/projects")) {
          return jsonResponse({
            projects: [projectFixture, translatedProjectFixture, failedProjectFixture]
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ProjectCenterPage onOpenProject={vi.fn()} />);

    expect(await screen.findByText("Translated Demo")).toBeVisible();
    await user.type(screen.getByLabelText("Search projects"), "Failed");

    expect(screen.getByText("Failed Demo")).toBeVisible();
    expect(screen.queryByText("Translated Demo")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search projects"));
    await user.selectOptions(screen.getByLabelText("Status filter"), "translated");

    expect(screen.getByText("Translated Demo")).toBeVisible();
    expect(screen.queryByText("Failed Demo")).not.toBeInTheDocument();
  });

  it("virtualizes long project lists instead of rendering every project row", async () => {
    stubMatchMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });
        }
        if (url.endsWith("/projects")) {
          return jsonResponse({ projects: makeManyProjects(500) });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    renderWithProviders(<ProjectCenterPage onOpenProject={vi.fn()} />);

    expect(await screen.findByText("Project 1")).toBeVisible();
    expect(screen.getByText("80/500 visible")).toBeInTheDocument();
    expect(screen.queryByText("Project 499")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^project-row-/)).toHaveLength(80);
  });

  it("runs cleanup, backup, and delete project actions", async () => {
    const user = userEvent.setup();
    stubMatchMedia();
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });
      }
      if (url.endsWith("/projects") && init?.method === undefined) {
        return jsonResponse({ projects: [projectFixture] });
      }
      if (url.endsWith("/projects/project-demo/cleanup/cache")) {
        return jsonResponse({
          projectId: "project-demo",
          action: "cleanup_cache",
          filesAffected: 1,
          bytesAffected: 5,
          message: "Project cache cleaned."
        });
      }
      if (url.endsWith("/projects/project-demo/backup")) {
        return jsonResponse({
          projectId: "project-demo",
          packagePath: "D:/Diplomat/projects/project-demo/backups/demo.diplomat-project.zip",
          bytesWritten: 1024,
          message: "Project backup created."
        });
      }
      if (url.endsWith("/projects/project-demo?deleteFiles=true")) {
        return jsonResponse({
          projectId: "project-demo",
          action: "delete",
          filesAffected: 2,
          bytesAffected: 4096,
          message: "Project deleted."
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<ProjectCenterPage onOpenProject={vi.fn()} />);

    await screen.findByText("Demo");
    await user.click(screen.getByRole("button", { name: "Project actions for Demo" }));
    await user.click(await screen.findByText("Clean cache"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/cleanup\/cache$/),
        expect.objectContaining({ method: "POST" })
      )
    );

    await user.click(screen.getByRole("button", { name: "Project actions for Demo" }));
    await user.click(await screen.findByText("Backup project"));
    expect(await screen.findByText(/demo\.diplomat-project\.zip/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Project actions for Demo" }));
    await user.click(await screen.findByText("Delete project"));
    const deleteDialog = await screen.findByRole("dialog", { name: "Delete project" });
    await waitFor(() => expect(deleteDialog).toBeVisible());
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\?deleteFiles=true$/),
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("imports a backup package and opens the restored project", async () => {
    const user = userEvent.setup();
    const onOpenProject = vi.fn();
    const restoredProject = {
      ...projectFixture,
      projectId: "project-restored",
      name: "Restored Demo"
    };
    stubMatchMedia();
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });
      }
      if (url.endsWith("/projects") && init?.method === undefined) {
        return jsonResponse({ projects: [] });
      }
      if (url.endsWith("/projects/import") && init?.method === "POST") {
        return jsonResponse(restoredProject);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<ProjectCenterPage onOpenProject={onOpenProject} />);

    await screen.findByRole("heading", { name: "Project Library" });
    await user.click(screen.getByRole("button", { name: "Project library actions" }));
    await user.click(await screen.findByText("Import backup"));
    const importDialog = await screen.findByRole("dialog", { name: "Import backup" });
    await user.type(
      within(importDialog).getByLabelText("Backup package path"),
      "D:/backups/demo.diplomat-project.zip"
    );
    await user.type(within(importDialog).getByLabelText("Restore name"), "Restored Demo");
    await user.click(within(importDialog).getByRole("button", { name: "Import backup" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/import$/),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            packagePath: "D:/backups/demo.diplomat-project.zip",
            restoreName: "Restored Demo"
          })
        })
      )
    );
    expect(onOpenProject).toHaveBeenCalledWith("project-restored");
  });

  it("uses the desktop file picker for backup packages instead of requiring a typed path", async () => {
    const user = userEvent.setup();
    const onOpenProject = vi.fn();
    const restoredProject = {
      ...projectFixture,
      projectId: "project-picked-backup",
      name: "Picked Backup"
    };
    desktopMock.isDesktopRuntime.mockReturnValue(true);
    desktopMock.pickProjectBackupFile.mockResolvedValue("D:/backups/picked.diplomat-project.zip");
    stubMatchMedia();
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });
      }
      if (url.endsWith("/projects") && init?.method === undefined) {
        return jsonResponse({ projects: [] });
      }
      if (url.endsWith("/projects/import") && init?.method === "POST") {
        return jsonResponse(restoredProject);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<ProjectCenterPage onOpenProject={onOpenProject} />);

    await screen.findByRole("heading", { name: "Project Library" });
    await user.click(screen.getByRole("button", { name: "Project library actions" }));
    await user.click(await screen.findByText("Import backup"));
    const importDialog = await screen.findByRole("dialog", { name: "Import backup" });

    expect(within(importDialog).queryByLabelText("Backup package path")).not.toBeInTheDocument();

    await user.click(within(importDialog).getByRole("button", { name: "Choose backup package" }));

    expect(desktopMock.pickProjectBackupFile).toHaveBeenCalledTimes(1);
    expect(within(importDialog).getByText("picked.diplomat-project.zip")).toBeInTheDocument();

    await user.click(within(importDialog).getByRole("button", { name: "Import backup" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/import$/),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            packagePath: "D:/backups/picked.diplomat-project.zip",
            restoreName: null
          })
        })
      )
    );
    expect(onOpenProject).toHaveBeenCalledWith("project-picked-backup");
  });
});
