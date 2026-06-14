import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import {
  isDesktopRuntime,
  openPathInFileManager,
  runtimeStatus,
  startWorker,
  stopWorker
} from "../desktop";
import { useUiStore } from "../state/uiStore";
import { renderWithProviders } from "../test/render";
import { SettingsPage } from "./SettingsPage";

vi.mock("../desktop", async () => {
  const actual = await vi.importActual<typeof import("../desktop")>("../desktop");
  return {
    ...actual,
    isDesktopRuntime: vi.fn(() => false),
    runtimeStatus: vi.fn(async () => null),
    startWorker: vi.fn(async () => null),
    stopWorker: vi.fn(async () => null),
    openPathInFileManager: vi.fn(async () => undefined)
  };
});

const desktopRuntimeStatus = {
  mode: "desktop",
  workerLauncher: "development",
  worker: {
    status: "running",
    endpoint: "http://127.0.0.1:8765",
    owner: "diplomat",
    message: "Diplomat Worker is reachable."
  },
  directories: {
    data: "C:/Users/Drew/AppData/Local/Diplomat/data",
    projects: "C:/Users/Drew/AppData/Local/Diplomat/data/projects",
    models: "C:/Users/Drew/AppData/Local/Diplomat/models",
    downloads: "C:/Users/Drew/AppData/Local/Diplomat/downloads",
    exports: "C:/Users/Drew/AppData/Local/Diplomat/exports",
    cache: "C:/Users/Drew/AppData/Local/Diplomat/cache",
    logs: "C:/Users/Drew/AppData/Local/Diplomat/logs",
    diagnostics: "C:/Users/Drew/AppData/Local/Diplomat/diagnostics"
  },
  ffmpeg: {
    status: "available",
    path: "ffmpeg",
    version: "ffmpeg version 7.1",
    message: "ffmpeg is available."
  },
  ffprobe: {
    status: "missing",
    path: "ffprobe",
    version: null,
    message: "ffprobe was not found."
  },
  diagnostics: {
    workerStdoutLog: "C:/Users/Drew/AppData/Local/Diplomat/logs/worker.stdout.log",
    workerStderrLog: "C:/Users/Drew/AppData/Local/Diplomat/logs/worker.stderr.log"
  }
};

const releaseReadinessResponse = {
  version: "0.3.0",
  generatedAt: "2026-06-14T00:00:00+00:00",
  ready: false,
  summary: {
    pass: 2,
    warning: 1,
    blocker: 1
  },
  checks: [
    {
      id: "model_registry_checksums",
      label: "Model registry checksums",
      severity: "blocker",
      message: "Model registry contains placeholder checksums.",
      remediation: "Replace placeholders with audited SHA256 checksums."
    },
    {
      id: "help_center",
      label: "Help Center",
      severity: "pass",
      message: "Help Center is available.",
      remediation: null
    }
  ]
};

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/release/readiness")) {
        return {
          ok: true,
          status: 200,
          json: async () => releaseReadinessResponse
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    })
  );
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

beforeEach(async () => {
  stubMatchMedia();
  stubResizeObserver();
  stubFetch();
  localStorage.clear();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

describe("SettingsPage", () => {
  it("renders compact desktop settings sections with accessible form labels", () => {
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    expect(screen.getByRole("main", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByLabelText("Interface language")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Runtime" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Defaults" })).toBeInTheDocument();
    expect(screen.getByLabelText("Worker URL")).toHaveValue("http://127.0.0.1:8765");
    expect(
      screen.getByText("Desktop runtime controls are unavailable in browser mode.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Default source language")).toHaveValue("zh");
    expect(screen.getByLabelText("Default target language")).toHaveValue("en");
    expect(screen.getByLabelText("Default export mode")).toHaveValue("bilingual");
  });

  it("updates the settings heading immediately after switching languages", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByLabelText("中文"));

    expect(await screen.findByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByLabelText("界面语言")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "主题" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "默认值" })).toBeInTheDocument();
    expect(screen.getByLabelText("默认导出模式")).toHaveValue("bilingual");
  });

  it("renders browser-mode runtime fallback when Tauri is unavailable", () => {
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    expect(
      screen.getByText("Desktop runtime controls are unavailable in browser mode.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Worker URL")).toHaveValue("http://127.0.0.1:8765");
  });

  it("renders release readiness blockers and remediation", async () => {
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    expect(await screen.findByRole("heading", { name: "Release readiness" })).toBeInTheDocument();
    expect(await screen.findByText("Release blocked")).toBeInTheDocument();
    expect(await screen.findByText("1 blocker")).toBeInTheDocument();
    expect(screen.getByText("Model registry checksums")).toBeInTheDocument();
    expect(screen.getByText(/Replace placeholders with audited SHA256 checksums/)).toBeInTheDocument();
  });

  it("renders desktop runtime diagnostics and controls", async () => {
    vi.mocked(isDesktopRuntime).mockReturnValue(true);
    vi.mocked(runtimeStatus).mockResolvedValue(desktopRuntimeStatus);

    renderWithProviders(<SettingsPage />);

    expect(await screen.findByLabelText("Worker endpoint")).toHaveValue(
      "http://127.0.0.1:8765"
    );
    expect(screen.getByLabelText("Worker status")).toHaveValue("running");
    expect(screen.getByLabelText("Worker launcher")).toHaveValue("development");
    expect(screen.getByLabelText("FFmpeg status")).toHaveValue("available");
    expect(screen.getByLabelText("FFprobe status")).toHaveValue("missing");
    expect(screen.getByLabelText("Data directory")).toHaveValue(
      "C:/Users/Drew/AppData/Local/Diplomat/data"
    );
    expect(screen.getByRole("button", { name: "Start Worker" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop Worker" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open logs" })).toBeInTheDocument();
  });

  it("starts and stops the worker from settings", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(true);
    vi.mocked(runtimeStatus).mockResolvedValue(desktopRuntimeStatus);
    vi.mocked(startWorker).mockResolvedValue(desktopRuntimeStatus.worker);
    vi.mocked(stopWorker).mockResolvedValue({
      ...desktopRuntimeStatus.worker,
      status: "stopped",
      owner: "none",
      message: "Worker process managed by this desktop session is stopped."
    });

    renderWithProviders(<SettingsPage />);

    await user.click(await screen.findByRole("button", { name: "Start Worker" }));
    await user.click(screen.getByRole("button", { name: "Stop Worker" }));

    expect(startWorker).toHaveBeenCalledTimes(1);
    expect(stopWorker).toHaveBeenCalledTimes(1);
  });

  it("opens the log directory from settings", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(true);
    vi.mocked(runtimeStatus).mockResolvedValue(desktopRuntimeStatus);

    renderWithProviders(<SettingsPage />);

    await user.click(await screen.findByRole("button", { name: "Open logs" }));

    expect(openPathInFileManager).toHaveBeenCalledWith(
      "C:/Users/Drew/AppData/Local/Diplomat/logs"
    );
  });
});
