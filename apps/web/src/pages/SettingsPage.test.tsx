import { cleanup, screen, waitFor, within } from "@testing-library/react";
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
import { PROJECT_DEFAULTS_STORAGE_KEY, useUiStore } from "../state/uiStore";
import { modelCatalogFixture } from "../test/fixtures";
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
    models: "D:/Software Project/Diplomat/models",
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

function readBlobText(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}

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
      if (url.endsWith("/models")) {
        return {
          ok: true,
          status: 200,
          json: async () => modelCatalogFixture
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
  vi.clearAllMocks();
  vi.mocked(isDesktopRuntime).mockReturnValue(false);
  vi.mocked(runtimeStatus).mockResolvedValue(null);
  vi.mocked(startWorker).mockResolvedValue(null);
  vi.mocked(stopWorker).mockResolvedValue(null);
  vi.mocked(openPathInFileManager).mockResolvedValue(undefined);
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
  it("renders compact desktop settings as a single active category", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    expect(screen.getByRole("main", { name: "System Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "System Settings" })).toHaveAttribute(
      "data-size",
      "h3"
    );
    expect(screen.getByTestId("settings-layout")).toHaveAttribute(
      "data-sidebar-width",
      "272"
    );
    expect(screen.getByRole("navigation", { name: "Settings categories" })).toBeInTheDocument();
    const everydaySettings = screen.getByRole("group", { name: "Everyday settings" });
    const advancedTools = screen.getByRole("group", { name: "Advanced tools" });
    expect(screen.getByRole("button", { name: "Language" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(everydaySettings).getByRole("button", { name: "Appearance" })).toBeInTheDocument();
    expect(within(everydaySettings).getByRole("button", { name: "Language" })).toBeInTheDocument();
    expect(within(everydaySettings).getByRole("button", { name: "Runtime" })).toBeInTheDocument();
    expect(within(everydaySettings).getByRole("button", { name: "Models" })).toBeInTheDocument();
    expect(
      within(everydaySettings).getByRole("button", { name: "Keyboard shortcuts" })
    ).toBeInTheDocument();
    expect(
      within(everydaySettings).getByRole("button", { name: "New project defaults" })
    ).toBeInTheDocument();
    expect(within(everydaySettings).queryByRole("button", { name: "General" })).not.toBeInTheDocument();
    expect(within(everydaySettings).queryByRole("button", { name: "Privacy" })).not.toBeInTheDocument();
    expect(within(everydaySettings).queryByRole("button", { name: "About" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Subtitles & translation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Processing & performance" })).not.toBeInTheDocument();
    expect(within(everydaySettings).queryByRole("button", { name: "Release" })).not.toBeInTheDocument();
    expect(within(everydaySettings).queryByRole("button", { name: "Diagnostics" })).not.toBeInTheDocument();
    expect(within(everydaySettings).queryByRole("button", { name: "Advanced" })).not.toBeInTheDocument();
    const advancedToolsToggle = within(advancedTools).getByRole("button", {
      name: "Advanced tools"
    });
    expect(advancedToolsToggle).toHaveAttribute("aria-expanded", "false");
    expect(within(advancedTools).queryByRole("button", { name: "Advanced" })).not.toBeInTheDocument();
    expect(within(advancedTools).queryByRole("button", { name: "Diagnostics" })).not.toBeInTheDocument();
    expect(within(advancedTools).queryByRole("button", { name: "Release" })).not.toBeInTheDocument();

    await user.click(advancedToolsToggle);

    expect(advancedToolsToggle).toHaveAttribute("aria-expanded", "true");
    expect(within(advancedTools).getByRole("button", { name: "General" })).toBeInTheDocument();
    expect(within(advancedTools).getByRole("button", { name: "Privacy" })).toBeInTheDocument();
    expect(within(advancedTools).getByRole("button", { name: "Advanced" })).toBeInTheDocument();
    expect(within(advancedTools).getByRole("button", { name: "Diagnostics" })).toBeInTheDocument();
    expect(within(advancedTools).getByRole("button", { name: "About" })).toBeInTheDocument();
    expect(within(advancedTools).getByRole("button", { name: "Release" })).toBeInTheDocument();
    expect(screen.getByLabelText("Interface language")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Theme" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Runtime" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Models" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "New project defaults" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Models" }));

    expect(screen.getByRole("button", { name: "Models" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(await screen.findByRole("heading", { name: "Models" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recommended setup" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Model Catalog" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Advanced model catalog" }));
    expect(screen.getByRole("heading", { name: "Model Catalog" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Runtime" })).not.toBeInTheDocument();
  });

  it("separates language and appearance into system settings categories", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Language" }));

    expect(screen.getByRole("heading", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByLabelText("Interface language")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Theme" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Appearance" }));

    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Theme" })).toHaveTextContent("Light");
    expect(screen.getByRole("group", { name: "Density" })).toHaveTextContent("Compact");
    expect(screen.getByRole("group", { name: "Interface scale" })).toHaveTextContent("100%");
    expect(screen.getByRole("group", { name: "Subtitle editor font size" })).toHaveTextContent(
      "14 px"
    );
    expect(screen.getByRole("group", { name: "Theme" })).toHaveTextContent("Current state");
    expect(screen.getByRole("group", { name: "Density" })).toHaveTextContent("Current state");
    expect(screen.queryByRole("textbox", { name: "Theme" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset workspace layout" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Interface language")).not.toBeInTheDocument();
  });

  it("visually separates read-only status values from editable settings", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Appearance" }));

    expect(screen.getByRole("group", { name: "Theme" })).toHaveTextContent("Current state");
    expect(screen.queryByRole("textbox", { name: "Theme" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New project defaults" }));

    expect(screen.getByRole("combobox", { name: "Default source language" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Default target language" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Default source language" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Default target language" })).not.toBeInTheDocument();
    expect(screen.queryByText("Current state")).not.toBeInTheDocument();
  });

  it("labels read-only settings categories as current system state instead of editable preferences", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Appearance" }));

    expect(screen.getByRole("status", { name: "Read-only system state" })).toHaveTextContent(
      "These values show the current app state. Editable preferences appear as form controls."
    );

    await user.click(screen.getByRole("button", { name: "New project defaults" }));

    expect(screen.queryByRole("status", { name: "Read-only system state" })).not.toBeInTheDocument();
  });

  it("confirms before resetting the persisted workspace layout from appearance settings", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);
    useUiStore.getState().setWorkspaceLayout("translation", {
      inspectorWidth: 420,
      bottomDockHeight: 320,
      inspectorCollapsed: true
    });

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Appearance" }));
    await user.click(screen.getByRole("button", { name: "Reset workspace layout" }));

    const dialog = await screen.findByRole("dialog", { name: "Reset workspace layout" });
    expect(within(dialog).getByText("This resets panel sizes and collapsed docks for every workspace.")).toBeInTheDocument();
    expect(useUiStore.getState().workspaceLayouts.translation.inspectorWidth).toBe(420);

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Reset workspace layout" })).not.toBeInTheDocument();
    expect(useUiStore.getState().workspaceLayouts.translation.inspectorWidth).toBe(420);

    await user.click(screen.getByRole("button", { name: "Reset workspace layout" }));
    await user.click(
      within(await screen.findByRole("dialog", { name: "Reset workspace layout" })).getByRole(
        "button",
        { name: "Reset layout" }
      )
    );

    expect(useUiStore.getState().workspaceLayouts.translation).toEqual({
      inspectorWidth: 336,
      bottomDockHeight: 210,
      inspectorCollapsed: false,
      bottomCollapsed: false
    });
  });

  it("shows searchable keyboard shortcuts as system settings", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));

    expect(screen.getByRole("heading", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search commands")).toBeInTheDocument();
    expect(screen.getByText("Split selected line")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+Enter")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search commands"), "export");

    expect(screen.getByText("Export subtitles")).toBeInTheDocument();
    expect(screen.queryByText("Split selected line")).not.toBeInTheDocument();
  });

  it("rebinding keyboard shortcuts detects conflicts before saving", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));

    const splitRow = screen.getByText("Split selected line").closest("tr");
    expect(splitRow).not.toBeNull();
    await user.click(within(splitRow as HTMLElement).getByRole("button", { name: "Rebind" }));

    const bindingInput = screen.getByLabelText("Shortcut binding for Split selected line");
    expect(bindingInput).toHaveValue("Ctrl+Enter");

    await user.clear(bindingInput);
    await user.type(bindingInput, "Ctrl+Z");

    expect(screen.getByText("Ctrl+Z is already assigned to Undo edit.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save shortcut" })).toBeDisabled();

    await user.clear(bindingInput);
    await user.type(bindingInput, "Ctrl+Alt+S");
    await user.click(screen.getByRole("button", { name: "Save shortcut" }));

    expect(screen.queryByLabelText("Shortcut binding for Split selected line")).not.toBeInTheDocument();
    expect(screen.getByText("Ctrl+Alt+S")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset shortcuts" }));

    expect(screen.getByText("Ctrl+Enter")).toBeInTheDocument();
    expect(screen.queryByText("Ctrl+Alt+S")).not.toBeInTheDocument();
  });

  it("persists rebound keyboard shortcuts until reset", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    const splitRow = screen.getByText("Split selected line").closest("tr");
    expect(splitRow).not.toBeNull();
    await user.click(within(splitRow as HTMLElement).getByRole("button", { name: "Rebind" }));

    const bindingInput = screen.getByLabelText("Shortcut binding for Split selected line");
    await user.clear(bindingInput);
    await user.type(bindingInput, "Ctrl+Alt+S");
    await user.click(screen.getByRole("button", { name: "Save shortcut" }));
    expect(screen.getByText("Ctrl+Alt+S")).toBeInTheDocument();

    cleanup();
    useUiStore.getState().resetUiState();
    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    expect(screen.getByText("Ctrl+Alt+S")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset shortcuts" }));

    expect(screen.getByText("Ctrl+Enter")).toBeInTheDocument();

    cleanup();
    useUiStore.getState().resetUiState();
    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    expect(screen.getByText("Ctrl+Enter")).toBeInTheDocument();
    expect(screen.queryByText("Ctrl+Alt+S")).not.toBeInTheDocument();
  });

  it("exports rebound keyboard shortcuts as a JSON config", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:diplomat-shortcuts");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    const splitRow = screen.getByText("Split selected line").closest("tr");
    expect(splitRow).not.toBeNull();
    await user.click(within(splitRow as HTMLElement).getByRole("button", { name: "Rebind" }));
    const bindingInput = screen.getByLabelText("Shortcut binding for Split selected line");
    await user.clear(bindingInput);
    await user.type(bindingInput, "Ctrl+Alt+S");
    await user.click(screen.getByRole("button", { name: "Save shortcut" }));

    await user.click(screen.getByRole("button", { name: "Export shortcuts" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const exportedBlob = createObjectURL.mock.calls[0]![0];
    await expect(readBlobText(exportedBlob)).resolves.toContain(
      '"settings.shortcutCommands.splitLine": "Ctrl+Alt+S"'
    );
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:diplomat-shortcuts");
  });

  it("imports keyboard shortcut bindings from a JSON config", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    const shortcutFile = new File(
      [
        JSON.stringify({
          version: 1,
          shortcuts: {
            "settings.shortcutCommands.splitLine": "Ctrl+Alt+S",
            "settings.shortcutCommands.undoEdit": "Ctrl+Alt+Z"
          }
        })
      ],
      "diplomat-shortcuts.json",
      { type: "application/json" }
    );

    await user.upload(screen.getByLabelText("Import shortcuts"), shortcutFile);

    expect(await screen.findByText("Ctrl+Alt+S")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+Alt+Z")).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem("diplomat.shortcutBindings") ?? "{}")
    ).toMatchObject({
      "settings.shortcutCommands.splitLine": "Ctrl+Alt+S",
      "settings.shortcutCommands.undoEdit": "Ctrl+Alt+Z"
    });
  });

  it("keeps only non-placeholder system settings categories as scoped pages", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    expect(screen.queryByRole("button", { name: "Processing & performance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Subtitles & translation" })).not.toBeInTheDocument();
    const everydaySettings = screen.getByRole("group", { name: "Everyday settings" });
    expect(within(everydaySettings).queryByRole("button", { name: "Privacy" })).not.toBeInTheDocument();
    expect(within(everydaySettings).queryByRole("button", { name: "About" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Advanced tools" }));
    expect(screen.getByRole("button", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Privacy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Advanced" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Diagnostics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About" })).toBeInTheDocument();

    expect(screen.queryByRole("group", { name: "Default source language" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Default target language" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Default export mode" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Privacy" }));
    expect(screen.getByRole("heading", { name: "Privacy" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Default processing" })).toHaveTextContent(
      "Local device"
    );

    await user.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.getByRole("heading", { name: "Advanced" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Raw local runtime endpoint" })).toHaveTextContent(
      "http://127.0.0.1:8765"
    );
    expect(screen.queryByText(/Worker endpoint/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Diagnostics" }));
    expect(screen.getByRole("heading", { name: "Diagnostics" })).toBeInTheDocument();
    expect(screen.getByText("Desktop diagnostics are unavailable in browser mode.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "About" }));
    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Version" })).toHaveTextContent("0.40.0");
  });

  it("edits persistent default project preferences only inside the new project defaults category", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "New project defaults" }));

    expect(screen.queryByLabelText("Local runtime URL")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New project defaults" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Used when creating new projects only. Current project language and export settings are edited in the Workbench inspectors."
      )
    ).toBeInTheDocument();
    const defaultSourceLanguage = screen.getByRole("combobox", {
      name: "Default source language"
    });
    const defaultTargetLanguage = screen.getByRole("combobox", {
      name: "Default target language"
    });
    expect(defaultSourceLanguage).toHaveValue("zh");
    expect(defaultTargetLanguage).toHaveValue("en");
    expect(within(defaultSourceLanguage).getByRole("option", { name: "Chinese (zh)" })).toBeInTheDocument();
    expect(within(defaultTargetLanguage).getByRole("option", { name: "English (en)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Default export mode")).toHaveValue("bilingual");

    await user.selectOptions(defaultSourceLanguage, "en");
    await user.selectOptions(defaultTargetLanguage, "ja");
    await user.selectOptions(screen.getByLabelText("Default export mode"), "target");

    expect(useUiStore.getState().projectDefaults).toEqual({
      sourceLanguage: "en",
      targetLanguage: "ja",
      exportMode: "target"
    });
    expect(JSON.parse(localStorage.getItem(PROJECT_DEFAULTS_STORAGE_KEY) ?? "{}")).toEqual({
      sourceLanguage: "en",
      targetLanguage: "ja",
      exportMode: "target"
    });
  });

  it("updates the settings heading immediately after switching languages", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Language" }));
    await user.click(screen.getByLabelText("中文"));

    expect(await screen.findByRole("heading", { name: "系统设置" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "系统设置" })).toBeInTheDocument();
    expect(screen.getByLabelText("界面语言")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "外观" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新项目默认值" }));

    expect(screen.getByRole("heading", { name: "新项目默认值" })).toBeInTheDocument();
    expect(
      screen.getByText("只在创建新项目时使用。当前项目的语言和导出设置请在工作台检查器中调整。")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("默认导出模式")).toHaveValue("bilingual");
  });

  it("renders browser-mode runtime fallback when Tauri is unavailable", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Runtime" }));

    expect(
      screen.getByText("Desktop runtime controls are unavailable in browser mode.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Local runtime URL" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Local runtime URL" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Advanced details" }));

    expect(await screen.findByRole("group", { name: "Local runtime URL" })).toHaveTextContent(
      "http://127.0.0.1:8765"
    );
  });

  it("renders release readiness blockers and remediation", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Advanced tools" }));
    await user.click(screen.getByRole("button", { name: "Release" }));

    expect(await screen.findByRole("heading", { name: "Release readiness" })).toBeInTheDocument();
    expect(await screen.findByText("Release blocked")).toBeInTheDocument();
    expect(await screen.findByText("1 blocker")).toBeInTheDocument();
    expect(screen.getByText("Model registry checksums")).toBeInTheDocument();
    expect(screen.getByText(/Replace placeholders with audited SHA256 checksums/)).toBeInTheDocument();
  });

  it("renders desktop runtime diagnostics and controls", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(true);
    vi.mocked(runtimeStatus).mockResolvedValue(desktopRuntimeStatus);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Runtime" }));

    expect(await screen.findByText("Diplomat local runtime is reachable.")).toBeInTheDocument();
    expect(screen.queryByText(/Diplomat Worker/)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Local runtime endpoint" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Local runtime launcher" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "FFmpeg status" })).toHaveTextContent("available");
    expect(screen.getByRole("group", { name: "FFprobe status" })).toHaveTextContent("missing");
    expect(screen.getByRole("group", { name: "Data directory" })).toHaveTextContent(
      "C:/Users/Drew/AppData/Local/Diplomat/data"
    );
    expect(screen.getByRole("group", { name: "Models directory" })).toHaveTextContent(
      "D:/Software Project/Diplomat/models"
    );
    expect(screen.getByRole("group", { name: "Models directory" })).not.toHaveTextContent(
      "C:/Users/Drew/AppData/Local/Diplomat/models"
    );
    expect(screen.queryByRole("textbox", { name: "Local runtime endpoint" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Local runtime status" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start local runtime" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop local runtime" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open logs" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Advanced details" }));

    expect(await screen.findByRole("group", { name: "Local runtime endpoint" })).toHaveTextContent(
      "http://127.0.0.1:8765"
    );
    expect(screen.getByRole("group", { name: "Local runtime launcher" })).toHaveTextContent(
      "development"
    );
    expect(screen.getByRole("group", { name: "Local runtime status" })).toHaveTextContent("running");
  });

  it("keeps worker terminology out of user-facing settings diagnostics", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(true);
    vi.mocked(runtimeStatus).mockResolvedValue(desktopRuntimeStatus);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Advanced tools" }));
    await user.click(screen.getByRole("button", { name: "Diagnostics" }));

    expect(await screen.findByRole("group", { name: "Runtime diagnostics" })).toHaveTextContent(
      "Diplomat local runtime is reachable."
    );
    expect(screen.getByRole("group", { name: "Local runtime stdout log" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Local runtime stderr log" })).toBeInTheDocument();
    expect(screen.queryByText(/Worker/)).not.toBeInTheDocument();
  });

  it("starts and stops the worker from settings", async () => {
    const user = userEvent.setup();
    const startWorkerMock = vi.mocked(startWorker);
    const stopWorkerMock = vi.mocked(stopWorker);
    vi.mocked(isDesktopRuntime).mockReturnValue(true);
    vi.mocked(runtimeStatus).mockResolvedValue(desktopRuntimeStatus);
    startWorkerMock.mockResolvedValue(desktopRuntimeStatus.worker);
    stopWorkerMock.mockResolvedValue({
      ...desktopRuntimeStatus.worker,
      status: "stopped",
      owner: "none",
      message: "Worker process managed by this desktop session is stopped."
    });

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Runtime" }));

    await user.click(await screen.findByRole("button", { name: "Start local runtime" }));
    await user.click(screen.getByRole("button", { name: "Stop local runtime" }));

    expect(startWorkerMock).toHaveBeenCalledTimes(1);
    expect(stopWorkerMock).toHaveBeenCalledTimes(1);
  });

  it("restarts the local runtime from settings", async () => {
    const user = userEvent.setup();
    const startWorkerMock = vi.mocked(startWorker);
    const stopWorkerMock = vi.mocked(stopWorker);
    vi.mocked(isDesktopRuntime).mockReturnValue(true);
    vi.mocked(runtimeStatus).mockResolvedValue(desktopRuntimeStatus);
    startWorkerMock.mockResolvedValue(desktopRuntimeStatus.worker);
    stopWorkerMock.mockResolvedValue({
      ...desktopRuntimeStatus.worker,
      status: "stopped",
      owner: "none",
      message: "Worker process managed by this desktop session is stopped."
    });

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Runtime" }));
    await user.click(await screen.findByRole("button", { name: "Restart local runtime" }));

    await waitFor(() => expect(startWorkerMock).toHaveBeenCalledTimes(1));
    expect(stopWorkerMock).toHaveBeenCalledTimes(1);
    expect(stopWorkerMock.mock.invocationCallOrder[0]).toBeLessThan(
      startWorkerMock.mock.invocationCallOrder[0]
    );
  });

  it("runs runtime diagnostics from settings", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(true);
    vi.mocked(runtimeStatus).mockResolvedValue(desktopRuntimeStatus);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Runtime" }));
    const diagnosticsButton = await screen.findByRole("button", { name: "Run diagnostics" });
    vi.mocked(runtimeStatus).mockClear();

    await user.click(diagnosticsButton);

    await waitFor(() => expect(runtimeStatus).toHaveBeenCalledTimes(1));
  });

  it("opens the log directory from settings", async () => {
    const user = userEvent.setup();
    vi.mocked(isDesktopRuntime).mockReturnValue(true);
    vi.mocked(runtimeStatus).mockResolvedValue(desktopRuntimeStatus);

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Runtime" }));

    await user.click(await screen.findByRole("button", { name: "Open logs" }));

    expect(openPathInFileManager).toHaveBeenCalledWith(
      "C:/Users/Drew/AppData/Local/Diplomat/logs"
    );
  });
});
