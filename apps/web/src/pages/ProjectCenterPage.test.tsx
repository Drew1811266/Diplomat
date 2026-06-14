import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { ProjectCenterPage } from "./ProjectCenterPage";
import { failedProjectFixture, projectFixture, translatedProjectFixture } from "../test/fixtures";
import { renderWithProviders } from "../test/render";

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

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await appI18n.changeLanguage("en");
});

describe("ProjectCenterPage", () => {
  it("shows worker status, actions, and recent projects", async () => {
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

    expect(await screen.findByRole("heading", { name: "Project Center" })).toBeVisible();
    expect((await screen.findAllByText("Worker ready"))[0]).toBeVisible();
    expect(await screen.findByText("Demo")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create Project" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Import Video" })).toBeVisible();
  });

  it("shows project query errors instead of the empty project state", async () => {
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
      "project index offline"
    );
    expect(screen.queryByText("No recent projects")).not.toBeInTheDocument();
  });

  it("creates a project from the browser fallback path and opens it", async () => {
    const user = userEvent.setup();
    const onOpenProject = vi.fn();
    const createdProject = {
      ...projectFixture,
      projectId: "project-new",
      name: "Interview",
      sourceVideoPath: "D:/media/interview.mp4"
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

    await screen.findByRole("heading", { name: "Project Center" });
    await user.click(screen.getByRole("button", { name: "Import Video" }));

    await user.clear(screen.getByLabelText("Project name"));
    await user.type(screen.getByLabelText("Project name"), "Interview");
    await user.type(screen.getByLabelText("Source video path"), "D:/media/interview.mp4");
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects$/),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "Interview",
            sourceVideoPath: "D:/media/interview.mp4",
            sourceLanguage: "zh",
            targetLanguage: "en"
          })
        })
      )
    );
    expect(onOpenProject).toHaveBeenCalledWith("project-new");
  });

  it("localizes recent project table headers", async () => {
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

    expect(await screen.findByRole("columnheader", { name: "项目" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "来源" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "语言" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "字幕" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "时长" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Project" })).not.toBeInTheDocument();
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

    await screen.findByRole("heading", { name: "Project Center" });
    await user.type(
      screen.getByLabelText("Backup package path"),
      "D:/backups/demo.diplomat-project.zip"
    );
    await user.type(screen.getByLabelText("Restore name"), "Restored Demo");
    await user.click(screen.getByRole("button", { name: "Import backup" }));

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
});
