import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  ModelCatalogResponse,
  ProjectResponse,
  SubtitleDraftResponse,
  SubtitleDocument,
  SubtitleSnapshotSummary,
  TaskResponse,
  TranslationSettingsResponse,
  WaveformResponse
} from "@diplomat/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { WORKSPACE_LAYOUT_STORAGE_KEY, useUiStore } from "../state/uiStore";
import {
  analyzedDocumentFixture,
  completedAnalysisTaskFixture,
  completedTranslationTaskFixture,
  modelCatalogFixture,
  projectFixture,
  runningAnalysisTaskFixture
} from "../test/fixtures";
import { renderWithProviders } from "../test/render";
import { WorkbenchPage } from "./WorkbenchPage";

const desktopMock = vi.hoisted(() => ({
  listenForDroppedVideoFiles: vi.fn<
    (handler: (paths: string[]) => void) => Promise<() => void>
  >(async () => vi.fn()),
  openPathInFileManager: vi.fn<(path: string) => Promise<void>>(async () => undefined),
  pickVideoFiles: vi.fn<() => Promise<string[]>>(async () => []),
  pickVideoFile: vi.fn<() => Promise<string | null>>(async () => null)
}));

vi.mock("../desktop", () => desktopMock);

function openWorkbenchInspector(mode: "analysis" | "translation" | "style" | "export") {
  const workspace =
    mode === "analysis"
      ? "transcription"
      : mode === "translation"
        ? "translation"
        : mode === "style"
          ? "style"
          : "delivery";

  act(() => {
    useUiStore.getState().setEditorWorkspace(workspace);
    useUiStore.getState().setInspectorMode(mode);
  });
}

const liveSubtitleDocument = {
  ...analyzedDocumentFixture,
  lines: [
    {
      ...analyzedDocumentFixture.lines[0],
      sourceText: "查询字幕文本",
      translatedText: "Query translation"
    }
  ]
};

const refreshedSubtitleDocument = {
  ...liveSubtitleDocument,
  lines: [
    {
      ...liveSubtitleDocument.lines[0],
      sourceText: "Server refreshed subtitle"
    }
  ]
};

const twoLineSubtitleDocument: SubtitleDocument = {
  ...liveSubtitleDocument,
  lines: [
    {
      ...liveSubtitleDocument.lines[0],
      sourceText: "First subtitle text",
      endMs: 1800,
      words: [{ text: "First subtitle text", startMs: 1000, endMs: 1800, confidence: 0.95 }]
    },
    {
      ...liveSubtitleDocument.lines[0],
      id: "line-2",
      startMs: 1900,
      endMs: 3200,
      sourceText: "Second subtitle text",
      translatedText: "Second translation",
      words: [{ text: "Second subtitle text", startMs: 1900, endMs: 3200, confidence: 0.93 }],
      translationStatus: "translated",
      translationOrigin: { provider: "fake", model: "fake-v1" }
    }
  ]
};

const serverDraftDocument: SubtitleDocument = {
  ...liveSubtitleDocument,
  lines: [
    {
      ...liveSubtitleDocument.lines[0],
      sourceText: "Recovered server draft"
    }
  ]
};

const serverDraftFixture: SubtitleDraftResponse = {
  projectId: "project-demo",
  updatedAt: "2026-06-14T00:00:00+00:00",
  lineCount: serverDraftDocument.lines.length,
  document: serverDraftDocument
};

const manualSnapshotFixture: SubtitleSnapshotSummary = {
  snapshotId: "snapshot-manual-1",
  projectId: "project-demo",
  reason: "manual",
  label: "Manual checkpoint",
  createdAt: "2026-06-14T00:01:00+00:00",
  lineCount: liveSubtitleDocument.lines.length
};

const waveformFixture: WaveformResponse = {
  projectId: "project-demo",
  durationMs: 12_000,
  sampleRate: 8000,
  peakCount: 2,
  peaks: [
    { index: 0, startMs: 0, endMs: 6000, min: -0.4, max: 0.7 },
    { index: 1, startMs: 6000, endMs: 12_000, min: -0.6, max: 0.5 }
  ]
};

async function expectTextVisibleAtLeastOnce(text: string) {
  expect(await screen.findAllByText(text)).not.toHaveLength(0);
}

const queuedWaveformTaskFixture: TaskResponse = {
  taskId: "waveform-task-1",
  projectId: "project-demo",
  type: "waveform",
  status: "queued",
  progress: 0,
  message: "Waveform queued",
  startedAt: null,
  updatedAt: "2026-06-07T00:00:01+00:00",
  completedAt: null,
  errorCode: null,
  errorMessage: null,
  diagnosticLogPath: null
};

const queuedExportTaskFixture: TaskResponse = {
  taskId: "export-task-1",
  projectId: "project-demo",
  type: "export",
  status: "queued",
  progress: 0,
  message: "Queued burn-in export",
  startedAt: null,
  updatedAt: "2026-06-14T00:00:00+00:00",
  completedAt: null,
  errorCode: null,
  errorMessage: null,
  diagnosticLogPath: null
};

const translationSettingsFixture: TranslationSettingsResponse = {
  projectId: "project-demo",
  provider: "fake",
  modelId: null,
  modelNameOrPath: null,
  sourceLanguage: "zh",
  targetLanguage: "en",
  mode: "missing_only",
  device: "cpu",
  computeType: "int8",
  batchSize: 8,
  endpoint: null,
  apiKeyEnv: null,
  glossary: [],
  updatedAt: "2026-06-14T00:00:00+00:00"
};

const modelCatalogWithInstalledTranslation: ModelCatalogResponse = {
  models: modelCatalogFixture.models.map((model) =>
    model.modelId === "translation.opus-mt.zh-en"
      ? {
          ...model,
          installation: {
            ...model.installation,
            status: "installed",
            installedPath: "D:/Diplomat/models/opus-zh-en",
            downloadedBytes: model.downloadSizeBytes,
            installedAt: "2026-06-14T00:05:00+00:00"
          },
          availability: {
            usable: true,
            reason: null
          }
        }
      : model
  )
};

type TestMediaAsset = {
  assetId: string;
  name: string;
  sourceVideoPath: string;
  kind: "video";
  durationMs: number;
  importedAt: string;
  active: boolean;
  exists: boolean;
};

type ProjectResponseWithMedia = ProjectResponse & {
  mediaAssets?: TestMediaAsset[];
};

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("PointerEvent", window.MouseEvent);
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
}

type ActiveProjectFetchOptions = {
  projectError?: { status: number; detail: string };
  mediaUpdateError?: { status: number; detail: string };
  subtitleError?: { status: number; detail: string };
  saveError?: { status: number; detail: string };
  analysisError?: { status: number; detail: string };
  translationError?: { status: number; detail: string };
  exportError?: { status: number; detail: string };
  cancelError?: { status: number; detail: string };
  retryError?: { status: number; detail: string };
  waveformError?: { status: number; detail: string };
  analysisTask?: TaskResponse;
  translationTask?: TaskResponse;
  waveformTask?: TaskResponse;
  exportTask?: TaskResponse;
  cancelTask?: TaskResponse;
  retryTask?: TaskResponse;
  taskResponses?: TaskResponse[];
  subtitleDocuments?: SubtitleDocument[];
  draft?: SubtitleDraftResponse | null;
  snapshots?: SubtitleSnapshotSummary[];
  snapshotDocument?: SubtitleDocument;
  modelCatalog?: ModelCatalogResponse;
  project?: ProjectResponse;
  translationSettings?: TranslationSettingsResponse;
  waveform?: WaveformResponse | null;
};

function stubActiveProjectFetch(options: ActiveProjectFetchOptions = {}) {
  let currentProject: ProjectResponseWithMedia = options.project ?? projectFixture;
  let currentDocument: SubtitleDocument = options.subtitleDocuments?.[0] ?? liveSubtitleDocument;
  let currentDraft: SubtitleDraftResponse | null = options.draft ?? null;
  let currentSnapshots = [...(options.snapshots ?? [])];
  let currentTranslationSettings: TranslationSettingsResponse =
    options.translationSettings ?? translationSettingsFixture;
  let restoredSnapshotDocument = options.snapshotDocument ?? currentDocument;
  let subtitleGetCount = 0;
  let taskFetchCount = 0;

  function errorResponse(error: { status: number; detail: string }): Response {
    return {
      ok: false,
      status: error.status,
      json: async () => ({ detail: error.detail })
    } as Response;
  }

  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);

    if (url.endsWith("/models") && init?.method === undefined) {
      return {
        ok: true,
        status: 200,
        json: async () => options.modelCatalog ?? { models: [] }
      } as Response;
    }

    if (url.endsWith("/projects/project-demo") && init?.method === undefined) {
      if (options.projectError) {
        return errorResponse(options.projectError);
      }

      return {
        ok: true,
        status: 200,
        json: async () => currentProject
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/media/source") && init?.method === "PUT") {
      if (options.mediaUpdateError) {
        return errorResponse(options.mediaUpdateError);
      }

      const body = JSON.parse(String(init.body)) as { sourceVideoPath: string };
      const importedAt = "2026-06-14T00:00:00+00:00";
      const currentAssets = currentProject.mediaAssets ?? [];
      const existingAsset = currentAssets.find(
        (asset) => asset.sourceVideoPath === body.sourceVideoPath
      );
      const nextAsset =
        existingAsset ??
        ({
          assetId: `media-${currentAssets.length + 1}`,
          name: body.sourceVideoPath.split(/[\\/]/).pop() ?? body.sourceVideoPath,
          sourceVideoPath: body.sourceVideoPath,
          kind: "video",
          durationMs: 65_000,
          importedAt,
          active: true,
          exists: true
        } satisfies TestMediaAsset);
      const nextAssets = existingAsset
        ? currentAssets
        : [...currentAssets, nextAsset];
      currentProject = {
        ...currentProject,
        sourceVideoPath: body.sourceVideoPath,
        durationMs: 65_000,
        mediaAssets: nextAssets.map((asset) => ({
          ...asset,
          active: asset.sourceVideoPath === body.sourceVideoPath
        })),
        diagnostics: {
          ...currentProject.diagnostics,
          sourceVideoExists: true,
          warnings: []
        }
      };

      return {
        ok: true,
        status: 200,
        json: async () => currentProject
      } as Response;
    }

    if (
      url.match(/\/projects\/project-demo\/media\/assets\/[^/]+$/) &&
      init?.method === "DELETE"
    ) {
      const assetId = decodeURIComponent(url.split("/").at(-1) ?? "");
      const currentAssets = currentProject.mediaAssets ?? [];
      const deletedAsset = currentAssets.find((asset) => asset.assetId === assetId);
      const nextAssets = currentAssets.filter((asset) => asset.assetId !== assetId);
      const deletedActiveAsset =
        Boolean(deletedAsset?.active) ||
        deletedAsset?.sourceVideoPath === currentProject.sourceVideoPath;
      currentProject = {
        ...currentProject,
        sourceVideoPath: deletedActiveAsset ? null : currentProject.sourceVideoPath,
        durationMs: deletedActiveAsset ? 0 : currentProject.durationMs,
        mediaAssets: nextAssets.map((asset) => ({ ...asset, active: false })),
        diagnostics: {
          ...currentProject.diagnostics,
          sourceVideoExists: deletedActiveAsset
            ? false
            : currentProject.diagnostics.sourceVideoExists
        }
      };

      return {
        ok: true,
        status: 200,
        json: async () => currentProject
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/subtitle") && init?.method === undefined) {
      if (options.subtitleError) {
        return errorResponse(options.subtitleError);
      }

      const document =
        options.subtitleDocuments?.[
          Math.min(subtitleGetCount, options.subtitleDocuments.length - 1)
        ] ?? currentDocument;
      subtitleGetCount += 1;

      return {
        ok: true,
        status: 200,
        json: async () => document
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/subtitle") && init?.method === "PUT") {
      if (options.saveError) {
        return errorResponse(options.saveError);
      }

      const body = JSON.parse(String(init.body)) as { document: typeof liveSubtitleDocument };
      currentDocument = body.document;
      currentDraft = null;
      return {
        ok: true,
        status: 200,
        json: async () => currentDocument
      } as Response;
    }

    if (
      url.endsWith("/projects/project-demo/translation-settings") &&
      init?.method === undefined
    ) {
      return {
        ok: true,
        status: 200,
        json: async () => currentTranslationSettings
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/translation-settings") && init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as Omit<
        TranslationSettingsResponse,
        "projectId" | "updatedAt"
      >;
      currentTranslationSettings = {
        ...body,
        projectId: "project-demo",
        updatedAt: "2026-06-14T00:05:00+00:00"
      };

      return {
        ok: true,
        status: 200,
        json: async () => currentTranslationSettings
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/subtitle/draft") && init?.method === undefined) {
      if (!currentDraft) {
        return errorResponse({ status: 404, detail: "Draft missing" });
      }

      return {
        ok: true,
        status: 200,
        json: async () => currentDraft
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/subtitle/draft") && init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as { document: SubtitleDocument };
      currentDraft = {
        projectId: "project-demo",
        updatedAt: "2026-06-14T00:02:00+00:00",
        lineCount: body.document.lines.length,
        document: body.document
      };

      return {
        ok: true,
        status: 200,
        json: async () => currentDraft
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/subtitle/draft") && init?.method === "DELETE") {
      currentDraft = null;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          projectId: "project-demo",
          action: "clear_draft",
          filesAffected: 1,
          bytesAffected: 128,
          message: "Draft cleared"
        })
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/subtitle/snapshots") && init?.method === undefined) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ projectId: "project-demo", snapshots: currentSnapshots })
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/subtitle/snapshots") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as {
        reason: SubtitleSnapshotSummary["reason"];
        label: string | null;
        document: SubtitleDocument | null;
      };
      restoredSnapshotDocument = body.document ?? currentDocument;
      const summary: SubtitleSnapshotSummary = {
        snapshotId: `snapshot-${currentSnapshots.length + 1}`,
        projectId: "project-demo",
        reason: body.reason,
        label: body.label,
        createdAt: "2026-06-14T00:03:00+00:00",
        lineCount: restoredSnapshotDocument.lines.length
      };
      currentSnapshots = [summary, ...currentSnapshots];

      return {
        ok: true,
        status: 201,
        json: async () => ({ ...summary, document: restoredSnapshotDocument })
      } as Response;
    }

    if (/\/projects\/project-demo\/subtitle\/snapshots\/[^/]+\/restore$/.test(url) && init?.method === "POST") {
      currentDocument = restoredSnapshotDocument;
      currentDraft = null;

      return {
        ok: true,
        status: 200,
        json: async () => currentDocument
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/style-presets") && init?.method === undefined) {
      const style = currentDocument.styles[0] ?? analyzedDocumentFixture.styles[0]!;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          projectId: "project-demo",
          activePresetId: "preset-default",
          presets: [
            {
              id: "preset-default",
              name: style.name,
              style,
              createdAt: "2026-06-14T00:00:00+00:00",
              updatedAt: "2026-06-14T00:00:00+00:00"
            }
          ]
        })
      } as Response;
    }

    if (/\/projects\/project-demo\/style-presets\/[^/]+\/apply$/.test(url) && init?.method === "POST") {
      const style = currentDocument.styles[0] ?? analyzedDocumentFixture.styles[0]!;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          projectId: "project-demo",
          activePresetId: "preset-default",
          style: { ...style, fontSize: 48, primaryColor: "#ffeecc" }
        })
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/analysis-jobs") && init?.method === "POST") {
      if (options.analysisError) {
        return errorResponse(options.analysisError);
      }

      return {
        ok: true,
        status: 200,
        json: async () => options.analysisTask ?? completedAnalysisTaskFixture
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/translation-jobs") && init?.method === "POST") {
      if (options.translationError) {
        return errorResponse(options.translationError);
      }

      return {
        ok: true,
        status: 200,
        json: async () => options.translationTask ?? completedTranslationTaskFixture
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/waveform") && init?.method === undefined) {
      if (options.waveformError) {
        return errorResponse(options.waveformError);
      }

      if (options.waveform === null || options.waveform === undefined) {
        return errorResponse({ status: 404, detail: "Waveform missing" });
      }

      return {
        ok: true,
        status: 200,
        json: async () => options.waveform
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/waveform-jobs") && init?.method === "POST") {
      return {
        ok: true,
        status: 202,
        json: async () => options.waveformTask ?? queuedWaveformTaskFixture
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/exports/subtitles") && init?.method === "POST") {
      if (options.exportError) {
        return errorResponse(options.exportError);
      }
      const body = JSON.parse(String(init.body)) as { format: string; mode: string };

      return {
        ok: true,
        status: 200,
        json: async () => ({
          projectId: "project-demo",
          exportPath: `D:/Diplomat/projects/project-demo/demo.${body.format}`,
          format: body.format,
          mode: body.mode,
          warnings: []
        })
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/exports/video") && init?.method === "POST") {
      if (options.exportError) {
        return errorResponse(options.exportError);
      }

      return {
        ok: true,
        status: 202,
        json: async () => options.exportTask ?? queuedExportTaskFixture
      } as Response;
    }

    if (/\/tasks\/[^/]+$/.test(url) && init?.method === undefined) {
      const task =
        options.taskResponses?.[
          Math.min(taskFetchCount, options.taskResponses.length - 1)
        ] ?? (url.endsWith("/waveform-task-1") ? queuedWaveformTaskFixture : completedAnalysisTaskFixture);
      taskFetchCount += 1;

      return {
        ok: true,
        status: 200,
        json: async () => task
      } as Response;
    }

    if (/\/tasks\/[^/]+\/cancel$/.test(url) && init?.method === "POST") {
      if (options.cancelError) {
        return errorResponse(options.cancelError);
      }

      return {
        ok: true,
        status: 200,
        json: async () =>
          options.cancelTask ?? {
            ...runningAnalysisTaskFixture,
            status: "canceled",
            progress: 0.35,
            message: "Analysis canceled",
            completedAt: "2026-06-07T00:00:02+00:00"
          }
      } as Response;
    }

    if (/\/tasks\/[^/]+\/retry$/.test(url) && init?.method === "POST") {
      if (options.retryError) {
        return errorResponse(options.retryError);
      }

      return {
        ok: true,
        status: 200,
        json: async () =>
          options.retryTask ?? {
            ...runningAnalysisTaskFixture,
            status: "queued",
            progress: 0,
            message: "Analysis queued",
            completedAt: null
          }
      } as Response;
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  useUiStore.getState().setActiveProjectId("project-demo");
  return fetchMock;
}

beforeEach(async () => {
  localStorage.clear();
  useUiStore.getState().resetUiState();
  stubMatchMedia(false);
  await appI18n.changeLanguage("en");
});

afterEach(async () => {
  cleanup();
  desktopMock.listenForDroppedVideoFiles.mockReset();
  desktopMock.listenForDroppedVideoFiles.mockResolvedValue(vi.fn());
  desktopMock.openPathInFileManager.mockReset();
  desktopMock.openPathInFileManager.mockResolvedValue(undefined);
  desktopMock.pickVideoFiles.mockReset();
  desktopMock.pickVideoFiles.mockResolvedValue([]);
  desktopMock.pickVideoFile.mockReset();
  desktopMock.pickVideoFile.mockResolvedValue(null);
  vi.unstubAllGlobals();
  localStorage.clear();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

describe("WorkbenchPage", () => {
  it("marks the editor surface with the selected workspace", async () => {
    stubMatchMedia(false);
    useUiStore.getState().setActiveProjectId("project-demo");
    useUiStore.getState().setEditorWorkspace("translation");
    stubActiveProjectFetch({ waveform: waveformFixture });

    renderWithProviders(<WorkbenchPage />);

    const workbench = await screen.findByRole("main", { name: "Workbench" });
    expect(workbench).toHaveAttribute("data-editor-workspace", "translation");
    expect(
      within(workbench).getByRole("heading", { level: 1, name: "Workbench" })
    ).toBeInTheDocument();
  });

  it("shows an empty workbench state when no active project is selected", () => {
    renderWithProviders(<WorkbenchPage />);

    const workbench = screen.getByRole("main", { name: "Workbench" });
    expect(workbench).toBeInTheDocument();
    expect(
      within(workbench).getByRole("heading", { level: 1, name: "Workbench" })
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Workbench empty state" })).toBeInTheDocument();
    expect(screen.getByText("No project selected")).toBeInTheDocument();
    expect(
      screen.getByText("Create or open a project from Project Library before importing video.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Project tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Editor commands" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Video preview")).not.toBeInTheDocument();
    expect(screen.queryByText("原始字幕文本")).not.toBeInTheDocument();
  });

  it("shows project query errors instead of treating the workbench as empty", async () => {
    stubActiveProjectFetch({ projectError: { status: 500, detail: "Project unavailable" } });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("Could not load project.", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText("Project details could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByText(/Local runtime request failed/)).not.toBeInTheDocument();
    expect(screen.queryByText("No subtitle rows are available to export.")).not.toBeInTheDocument();
  });

  it("shows subtitle query errors instead of treating the workbench as empty", async () => {
    stubActiveProjectFetch({ subtitleError: { status: 404, detail: "Subtitle missing" } });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("Could not load subtitle document.")).toBeInTheDocument();
    expect(screen.getByText("Subtitle document could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByText(/Local runtime request failed/)).not.toBeInTheDocument();
    expect(screen.queryByText("No subtitle rows are available to export.")).not.toBeInTheDocument();
  });

  it("renders the preview-first workbench with right inspector tabs and bottom timeline", async () => {
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByRole("toolbar", { name: "Project tools" })).toBeInTheDocument();
    expect(screen.getByLabelText("Video preview")).toBeInTheDocument();
    expect(await screen.findByLabelText("Video preview media")).toHaveAttribute(
      "src",
      "http://127.0.0.1:8765/projects/project-demo/media/source"
    );
    expect(screen.getByTestId("workbench-preview-inspector-grid")).toHaveStyle({
      gridTemplateColumns: "minmax(0, 1fr) 420px"
    });
    expect(screen.getByRole("tablist", { name: "Workbench inspector tabs" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Subtitles" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByLabelText("Subtitle Grid")).toBeInTheDocument();
    expect(screen.getByLabelText("Inspector")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Timeline editor" })).toBeInTheDocument();
  });

  it("does not render the redundant project context band above the preview", async () => {
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByTestId("workbench-preview-inspector-grid")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Project context" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Media" }));
    expect(screen.getByRole("region", { name: "Project media" })).toBeInTheDocument();
  });

  it("uses app-native preview controls instead of browser video chrome", async () => {
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    const media = await screen.findByLabelText("Video preview media");
    const preview = screen.getByRole("region", { name: "Video preview" });
    expect(media).not.toHaveAttribute("controls");
    expect(screen.getByRole("button", { name: "Play preview" })).toBeVisible();
    expect(screen.getByRole("slider", { name: "Preview scrubber" })).toBeVisible();
    expect(within(preview).getByText(/00:00\.000 \/ 00:12\.000/)).toBeVisible();
  });

  it("switches project workflow controls through right-side inspector tabs", async () => {
    const user = userEvent.setup();
    useUiStore.getState().setEditorWorkspace("translation");
    useUiStore.getState().setInspectorMode("line");
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    const inspectorTabs = await screen.findByRole("tablist", {
      name: "Workbench inspector tabs"
    });
    expect(within(inspectorTabs).getByRole("tab", { name: "Subtitles" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await user.click(within(inspectorTabs).getByRole("tab", { name: "Translate" }));

    expect(screen.getByRole("heading", { name: "Project translation settings" })).toBeVisible();
  });

  it("opens empty projects in the full workbench with media import inside the inspector", async () => {
    const emptyProject: ProjectResponse = {
      ...projectFixture,
      sourceVideoPath: null,
      mediaAssets: [],
      durationMs: 0,
      diagnostics: {
        ...projectFixture.diagnostics,
        sourceVideoExists: false,
        warnings: []
      }
    };
    stubActiveProjectFetch({ project: emptyProject, waveform: null });

    renderWithProviders(<WorkbenchPage />);

    await screen.findByTestId("workbench-body");
    expect(screen.queryByTestId("workbench-media-start")).not.toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Project tools" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Project context")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Video preview")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.queryByText("No project selected")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Media" })).toHaveAttribute("aria-selected", "true")
    );
    const mediaBin = await screen.findByRole("region", { name: "Project media" });
    expect(within(mediaBin).getByRole("button", { name: "Import video" })).toBeInTheDocument();
    expect(within(mediaBin).getByText("Drop videos here")).toBeInTheDocument();
    expect(screen.getByTestId("project-media-empty-dropzone")).toHaveStyle({
      minHeight: "220px"
    });
  });

  it("keeps editor panels available for empty project containers", async () => {
    const emptyProject: ProjectResponse = {
      ...projectFixture,
      sourceVideoPath: null,
      mediaAssets: [],
      durationMs: 0,
      diagnostics: {
        ...projectFixture.diagnostics,
        sourceVideoExists: false,
        warnings: []
      }
    };
    stubActiveProjectFetch({ project: emptyProject, waveform: null });

    renderWithProviders(<WorkbenchPage />);

    await screen.findByTestId("workbench-body");
    const mediaBin = await screen.findByRole("region", { name: "Project media" });
    expect(within(mediaBin).getByText("Drop videos here")).toBeVisible();
    expect(within(mediaBin).getByRole("button", { name: "Import video" })).toBeVisible();
    expect(screen.getByRole("toolbar", { name: "Project tools" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Project context")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Video preview")).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Editor commands" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByTestId("project-media-empty-dropzone")).toHaveStyle({
      minHeight: "220px"
    });
  });

  it("imports a selected video from the empty project media call to action", async () => {
    const user = userEvent.setup();
    const emptyProject: ProjectResponse = {
      ...projectFixture,
      sourceVideoPath: null,
      mediaAssets: [],
      durationMs: 0,
      diagnostics: {
        ...projectFixture.diagnostics,
        sourceVideoExists: false,
        warnings: []
      }
    };
    desktopMock.pickVideoFile.mockResolvedValue("D:/media/onboarding-source.mp4");
    const fetchMock = stubActiveProjectFetch({ project: emptyProject, waveform: null });

    renderWithProviders(<WorkbenchPage />);

    await screen.findByTestId("workbench-body");
    expect(screen.getByLabelText("Video preview")).toBeInTheDocument();
    const mediaBin = await screen.findByRole("region", { name: "Project media" });
    await user.click(within(mediaBin).getByRole("button", { name: "Import video" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/media\/source$/),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ sourceVideoPath: "D:/media/onboarding-source.mp4" })
        })
      )
    );
  });

  it("shows media import errors directly on the empty project import surface", async () => {
    const user = userEvent.setup();
    const emptyProject: ProjectResponse = {
      ...projectFixture,
      sourceVideoPath: null,
      mediaAssets: [],
      durationMs: 0,
      diagnostics: {
        ...projectFixture.diagnostics,
        sourceVideoExists: false,
        warnings: []
      }
    };
    desktopMock.pickVideoFile.mockResolvedValue("D:/media/onboarding-source.mp4");
    stubActiveProjectFetch({
      project: emptyProject,
      waveform: null,
      mediaUpdateError: {
        status: 400,
        detail: "Unable to probe source video: FFprobe executable not found: ffprobe"
      }
    });

    renderWithProviders(<WorkbenchPage />);

    await screen.findByTestId("workbench-body");
    const mediaBin = await screen.findByRole("region", { name: "Project media" });
    await user.click(within(mediaBin).getByRole("button", { name: "Import video" }));

    expect(
      await screen.findByText("Unable to probe source video: FFprobe executable not found: ffprobe")
    ).toBeVisible();
    expect(screen.queryByTestId("workbench-media-start")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Media" })).toHaveAttribute("aria-selected", "true");
  });

  it("imports a selected video into the current project from the workbench", async () => {
    const user = userEvent.setup();
    const emptyProject: ProjectResponse = {
      ...projectFixture,
      sourceVideoPath: null,
      mediaAssets: [],
      durationMs: 0,
      diagnostics: {
        ...projectFixture.diagnostics,
        sourceVideoExists: false,
        warnings: []
      }
    };
    desktopMock.pickVideoFile.mockResolvedValue("D:/media/new-source.mp4");
    const fetchMock = stubActiveProjectFetch({ project: emptyProject, waveform: null });

    renderWithProviders(<WorkbenchPage />);

    await screen.findByTestId("workbench-body");
    const mediaBin = await screen.findByRole("region", { name: "Project media" });
    await user.click(within(mediaBin).getByRole("button", { name: "Import video" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/media\/source$/),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ sourceVideoPath: "D:/media/new-source.mp4" })
        })
      )
    );
    const updatedMediaBin = await screen.findByRole("region", { name: "Project media" });
    expect(await within(updatedMediaBin).findByText("new-source.mp4")).toBeVisible();
    expect(within(updatedMediaBin).queryByText("D:/media/new-source.mp4")).not.toBeInTheDocument();
    expect(within(updatedMediaBin).getByText("new-source.mp4")).toHaveAttribute(
      "title",
      "D:/media/new-source.mp4"
    );
  });

  it("imports every video selected from the desktop media picker", async () => {
    const user = userEvent.setup();
    const emptyProject: ProjectResponse = {
      ...projectFixture,
      sourceVideoPath: null,
      mediaAssets: [],
      durationMs: 0,
      diagnostics: {
        ...projectFixture.diagnostics,
        sourceVideoExists: false,
        warnings: []
      }
    };
    desktopMock.pickVideoFiles.mockResolvedValue([
      "D:/media/interview-a.mp4",
      "D:/media/interview-b.mp4"
    ]);
    const fetchMock = stubActiveProjectFetch({ project: emptyProject, waveform: null });

    renderWithProviders(<WorkbenchPage />);

    await screen.findByTestId("workbench-body");
    const mediaBin = await screen.findByRole("region", { name: "Project media" });
    await user.click(within(mediaBin).getByRole("button", { name: "Import video" }));

    await waitFor(() => {
      const mediaImports = fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith("/projects/project-demo/media/source") && init?.method === "PUT"
      );
      expect(mediaImports).toHaveLength(2);
      expect(mediaImports.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
        { sourceVideoPath: "D:/media/interview-a.mp4" },
        { sourceVideoPath: "D:/media/interview-b.mp4" }
      ]);
    });

    const updatedMediaBin = await screen.findByRole("region", { name: "Project media" });
    expect(await within(updatedMediaBin).findByText("interview-a.mp4")).toBeVisible();
    expect(await within(updatedMediaBin).findByText("interview-b.mp4")).toBeVisible();
  });

  it("imports every dropped desktop video into the project media bin", async () => {
    const dropCapture: { handler?: (paths: string[]) => void } = {};
    const emptyProject: ProjectResponse = {
      ...projectFixture,
      sourceVideoPath: null,
      mediaAssets: [],
      durationMs: 0,
      diagnostics: {
        ...projectFixture.diagnostics,
        sourceVideoExists: false,
        warnings: []
      }
    };
    desktopMock.listenForDroppedVideoFiles.mockImplementation(async (handler) => {
      dropCapture.handler = handler;
      return vi.fn();
    });
    const fetchMock = stubActiveProjectFetch({ project: emptyProject, waveform: null });

    renderWithProviders(<WorkbenchPage />);

    await screen.findByRole("main", { name: "Workbench" });
    expect(dropCapture.handler).toBeDefined();
    dropCapture.handler?.(["D:/media/drop-a.mp4", "D:/media/drop-b.mp4"]);

    await waitFor(() => {
      const mediaImports = fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith("/projects/project-demo/media/source") && init?.method === "PUT"
      );
      expect(mediaImports).toHaveLength(2);
      expect(mediaImports.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
        { sourceVideoPath: "D:/media/drop-a.mp4" },
        { sourceVideoPath: "D:/media/drop-b.mp4" }
      ]);
    });

    const mediaBin = await screen.findByRole("region", { name: "Project media" });
    expect(await within(mediaBin).findByText("drop-a.mp4")).toBeVisible();
    expect(await within(mediaBin).findByText("drop-b.mp4")).toBeVisible();
  });

  it("manages multiple project videos from the workbench media bin", async () => {
    const user = userEvent.setup();
    const projectWithAssets: ProjectResponseWithMedia = {
      ...projectFixture,
      sourceVideoPath: "D:/media/clip-b.mp4",
      mediaAssets: [
        {
          assetId: "media-a",
          name: "clip-a.mp4",
          sourceVideoPath: "D:/media/clip-a.mp4",
          kind: "video",
          durationMs: 60_000,
          importedAt: "2026-06-14T00:00:00+00:00",
          active: false,
          exists: true
        },
        {
          assetId: "media-b",
          name: "clip-b.mp4",
          sourceVideoPath: "D:/media/clip-b.mp4",
          kind: "video",
          durationMs: 65_000,
          importedAt: "2026-06-14T00:01:00+00:00",
          active: true,
          exists: true
        }
      ]
    };
    const fetchMock = stubActiveProjectFetch({ project: projectWithAssets });

    renderWithProviders(<WorkbenchPage />);

    await user.click(await screen.findByRole("tab", { name: "Media" }));
    const mediaBin = await screen.findByRole("region", { name: "Project media" });
    expect(await within(mediaBin).findByText("clip-a.mp4")).toBeVisible();
    expect(await within(mediaBin).findByText("clip-b.mp4")).toBeVisible();
    expect(within(mediaBin).queryByText("D:/media/clip-a.mp4")).not.toBeInTheDocument();
    expect(within(mediaBin).queryByText("D:/media/clip-b.mp4")).not.toBeInTheDocument();
    expect(await within(mediaBin).findByText("Active")).toBeVisible();

    await user.click(within(mediaBin).getByRole("button", { name: "Use clip-a.mp4" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/media\/source$/),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ sourceVideoPath: "D:/media/clip-a.mp4" })
        })
      )
    );

    await user.click(within(mediaBin).getByRole("button", { name: "Remove clip-a.mp4" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/media\/assets\/media-a$/),
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("clicks subtitle rows to select and seek the preview", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch({ waveform: waveformFixture });

    renderWithProviders(<WorkbenchPage />);

    const media = (await screen.findByLabelText("Video preview media")) as HTMLVideoElement;
    await user.click(await screen.findByRole("button", { name: "Select line 1" }));

    expect(screen.getByLabelText("Source text")).toHaveValue("查询字幕文本");
    expect(media.currentTime).toBe(1);
  });

  it("highlights the active subtitle row from playback time", async () => {
    stubActiveProjectFetch({ waveform: waveformFixture });

    renderWithProviders(<WorkbenchPage />);

    const media = (await screen.findByLabelText("Video preview media")) as HTMLVideoElement;
    media.currentTime = 1.2;
    fireEvent.timeUpdate(media);

    expect(await screen.findByTestId("subtitle-row-line-1")).toHaveAttribute("data-active", "true");
  });

  it("starts waveform generation from the timeline panel", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch({ waveform: null });

    renderWithProviders(<WorkbenchPage />);

    await user.click(await screen.findByRole("button", { name: "Generate waveform" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/waveform-jobs$/),
        expect.objectContaining({ method: "POST" })
      )
    );
    expect(await screen.findByText("Waveform queued")).toBeInTheDocument();
    expect(screen.getByLabelText("Task progress")).toBeInTheDocument();
  });

  it("drags timeline blocks into a subtitle draft that can be saved", async () => {
    stubActiveProjectFetch({ waveform: waveformFixture });

    renderWithProviders(<WorkbenchPage />);

    const track = await screen.findByTestId("timeline-track");
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 160,
      width: 1000,
      height: 160,
      toJSON: () => ({})
    });

    fireEvent.pointerDown(screen.getByRole("button", { name: "Timeline block line-1" }), {
      clientX: 200,
      pointerId: 1
    });
    fireEvent.pointerMove(track, { clientX: 220, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 220, pointerId: 1 });

    const toolbar = screen.getByRole("toolbar", { name: "Project tools" });
    expect(within(toolbar).getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByText("00:01.150")).toBeInTheDocument();
  });

  it("renders a professional timeline ruler, track header, and readable subtitle clips", async () => {
    stubActiveProjectFetch({
      subtitleDocuments: [twoLineSubtitleDocument],
      waveform: waveformFixture
    });

    renderWithProviders(<WorkbenchPage />);

    const timeline = await screen.findByRole("region", { name: "Timeline editor" });
    expect(timeline).toBeVisible();
    expect(screen.getByTestId("timeline-ruler")).toBeVisible();
    expect(within(timeline).getByText("Subtitles")).toBeVisible();
    expect(screen.getByTestId("timeline-playhead")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("timeline-block-line-1")).toHaveTextContent("First subtitle text");
  });

  it("stacks the inspector below media panes on narrow screens", () => {
    stubMatchMedia(true);
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByTestId("workbench-body")).toHaveAttribute("data-layout", "stacked");
  });

  it("keeps growing subtitle and inspector content independently scrollable", () => {
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByTestId("workbench-media-stack")).toHaveStyle({
      gridTemplateRows: "minmax(0, 1fr) auto 240px"
    });
    expect(screen.getByTestId("subtitle-grid-body")).toHaveStyle({ overflow: "auto" });
    expect(screen.getByTestId("inspector-body")).toHaveStyle({ overflow: "auto" });
  });

  it("uses the active workspace layout for inspector width and bottom dock height", () => {
    stubActiveProjectFetch();
    useUiStore.getState().setEditorWorkspace("translation");
    useUiStore.getState().setWorkspaceLayout("translation", {
      inspectorWidth: 384,
      bottomDockHeight: 260
    });

    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByTestId("workbench-preview-inspector-grid")).toHaveStyle({
      gridTemplateColumns: "minmax(0, 1fr) 384px"
    });
    expect(screen.getByTestId("workbench-media-stack")).toHaveStyle({
      gridTemplateRows: "minmax(0, 1fr) auto 260px"
    });
  });

  it("resizes editor panels and persists the dimensions for the current workspace", () => {
    stubActiveProjectFetch();
    useUiStore.getState().setEditorWorkspace("translation");

    renderWithProviders(<WorkbenchPage />);

    const inspectorResize = screen.getByRole("separator", { name: "Resize inspector panel" });
    fireEvent.pointerDown(inspectorResize, { clientX: 1000, pointerId: 1 });
    fireEvent.pointerMove(inspectorResize, { clientX: 960, pointerId: 1 });
    fireEvent.pointerUp(inspectorResize, { pointerId: 1 });

    expect(useUiStore.getState().workspaceLayouts.translation.inspectorWidth).toBe(460);
    expect(screen.getByTestId("workbench-preview-inspector-grid")).toHaveStyle({
      gridTemplateColumns: "minmax(0, 1fr) 460px"
    });

    const timelineResize = screen.getByRole("separator", { name: "Resize timeline panel" });
    fireEvent.pointerDown(timelineResize, { clientY: 700, pointerId: 1 });
    fireEvent.pointerMove(timelineResize, { clientY: 660, pointerId: 1 });
    fireEvent.pointerUp(timelineResize, { pointerId: 1 });

    expect(useUiStore.getState().workspaceLayouts.translation.bottomDockHeight).toBe(280);
    expect(screen.getByTestId("workbench-media-stack")).toHaveStyle({
      gridTemplateRows: "minmax(0, 1fr) auto 280px"
    });
  });

  it("defers persisted layout writes until a panel resize gesture ends", () => {
    stubActiveProjectFetch();
    useUiStore.getState().setEditorWorkspace("translation");

    renderWithProviders(<WorkbenchPage />);

    const inspectorResize = screen.getByRole("separator", { name: "Resize inspector panel" });
    fireEvent.pointerDown(inspectorResize, { clientX: 1000, pointerId: 1 });
    fireEvent.pointerMove(inspectorResize, { clientX: 960, pointerId: 1 });

    expect(useUiStore.getState().workspaceLayouts.translation.inspectorWidth).toBe(460);
    expect(screen.getByTestId("workbench-preview-inspector-grid")).toHaveStyle({
      gridTemplateColumns: "minmax(0, 1fr) 460px"
    });
    expect(localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY)).toBeNull();

    fireEvent.pointerUp(inspectorResize, { pointerId: 1 });

    expect(
      JSON.parse(localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) ?? "{}").translation
        .inspectorWidth
    ).toBe(460);

    localStorage.removeItem(WORKSPACE_LAYOUT_STORAGE_KEY);

    const timelineResize = screen.getByRole("separator", { name: "Resize timeline panel" });
    fireEvent.pointerDown(timelineResize, { clientY: 700, pointerId: 1 });
    fireEvent.pointerMove(timelineResize, { clientY: 660, pointerId: 1 });

    expect(useUiStore.getState().workspaceLayouts.translation.bottomDockHeight).toBe(280);
    expect(screen.getByTestId("workbench-media-stack")).toHaveStyle({
      gridTemplateRows: "minmax(0, 1fr) auto 280px"
    });
    expect(localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY)).toBeNull();

    fireEvent.pointerUp(timelineResize, { pointerId: 1 });

    expect(
      JSON.parse(localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) ?? "{}").translation
        .bottomDockHeight
    ).toBe(280);
  });

  it("restores default panel dimensions when resize handles are double clicked", () => {
    stubActiveProjectFetch();
    useUiStore.getState().setEditorWorkspace("translation");
    useUiStore.getState().setWorkspaceLayout("translation", {
      inspectorWidth: 420,
      bottomDockHeight: 320
    });

    renderWithProviders(<WorkbenchPage />);

    fireEvent.doubleClick(screen.getByRole("separator", { name: "Resize inspector panel" }));
    expect(useUiStore.getState().workspaceLayouts.translation.inspectorWidth).toBe(420);
    expect(screen.getByTestId("workbench-preview-inspector-grid")).toHaveStyle({
      gridTemplateColumns: "minmax(0, 1fr) 420px"
    });

    fireEvent.doubleClick(screen.getByRole("separator", { name: "Resize timeline panel" }));
    expect(useUiStore.getState().workspaceLayouts.translation.bottomDockHeight).toBe(240);
    expect(screen.getByTestId("workbench-media-stack")).toHaveStyle({
      gridTemplateRows: "minmax(0, 1fr) auto 240px"
    });
  });

  it("collapses and restores inspector and timeline panels from the workbench", () => {
    stubActiveProjectFetch();
    useUiStore.getState().setEditorWorkspace("translation");

    renderWithProviders(<WorkbenchPage />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse inspector" }));

    expect(useUiStore.getState().workspaceLayouts.translation.inspectorCollapsed).toBe(true);
    expect(screen.queryByLabelText("Inspector")).not.toBeInTheDocument();
    expect(screen.getByTestId("workbench-preview-inspector-grid")).toHaveStyle({
      gridTemplateColumns: "minmax(0, 1fr) 32px"
    });

    fireEvent.click(screen.getByRole("button", { name: "Expand inspector" }));
    expect(useUiStore.getState().workspaceLayouts.translation.inspectorCollapsed).toBe(false);
    expect(screen.getByLabelText("Inspector")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse timeline" }));

    expect(useUiStore.getState().workspaceLayouts.translation.bottomCollapsed).toBe(true);
    expect(screen.getByTestId("workbench-media-stack")).toHaveStyle({
      gridTemplateRows: "minmax(0, 1fr) auto 32px"
    });

    fireEvent.click(screen.getByRole("button", { name: "Expand timeline" }));
    expect(useUiStore.getState().workspaceLayouts.translation.bottomCollapsed).toBe(false);
  });

  it("selects a subtitle row, returns to line inspector mode, and updates preview overlay", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch();
    useUiStore.getState().setInspectorMode("translation");

    renderWithProviders(<WorkbenchPage />);

    await user.click(await screen.findByRole("tab", { name: "Subtitles" }));
    await expectTextVisibleAtLeastOnce("查询字幕文本");
    await user.click(screen.getByRole("button", { name: "Select line 1" }));

    expect(screen.getByRole("heading", { name: "Subtitle line" })).toBeInTheDocument();
    expect(screen.getByLabelText("Source text")).toHaveValue("查询字幕文本");
    expect(within(screen.getByLabelText("Video preview")).getByText("查询字幕文本")).toBeInTheDocument();
  });

  it("does not duplicate workflow navigation inside the workbench command toolbar", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");

    const projectTools = screen.getByRole("toolbar", { name: "Project tools" });
    expect(within(projectTools).queryByRole("button", { name: "Analyze" })).not.toBeInTheDocument();
    expect(
      within(projectTools).queryByRole("button", { name: "Translate" })
    ).not.toBeInTheDocument();

    openWorkbenchInspector("translation");
    expect(screen.getByRole("heading", { name: "Project translation settings" })).toBeInTheDocument();

    await user.click(within(projectTools).getByRole("button", { name: "Export" }));
    expect(screen.getByRole("heading", { name: "Project export settings" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Workbench" })).toHaveAttribute(
      "data-editor-workspace",
      "delivery"
    );
    expect(screen.getByRole("combobox", { name: "Export mode" })).toBeInTheDocument();
  });

  it("keeps style and delivery workspaces as separate production stages", async () => {
    stubActiveProjectFetch();
    openWorkbenchInspector("style");

    renderWithProviders(<WorkbenchPage />);

    const inspector = screen.getByRole("region", { name: "Inspector" });
    expect(await within(inspector).findByRole("heading", { name: "Project style settings" })).toBeInTheDocument();

    expect(within(inspector).getByLabelText("Font family")).toBeInTheDocument();
    expect(within(inspector).getByLabelText("Safe area")).toBeInTheDocument();
    expect(within(inspector).queryByRole("combobox", { name: "Format" })).not.toBeInTheDocument();
    expect(
      within(inspector).queryByRole("combobox", { name: "Export mode" })
    ).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("button", { name: "Export" })).not.toBeInTheDocument();

    act(() => {
      useUiStore.getState().setEditorWorkspace("delivery");
      useUiStore.getState().setInspectorMode("export");
    });

    expect(within(inspector).getByRole("heading", { name: "Project export settings" })).toBeInTheDocument();
    expect(within(inspector).getByRole("combobox", { name: "Format" })).toBeInTheDocument();
    expect(within(inspector).getByRole("combobox", { name: "Export mode" })).toBeInTheDocument();
    expect(within(inspector).getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(within(inspector).getByRole("button", { name: "Render video" })).toBeInTheDocument();
    expect(within(inspector).queryByLabelText("Font family")).not.toBeInTheDocument();
    expect(within(inspector).queryByLabelText("Safe area")).not.toBeInTheDocument();
    expect(within(inspector).queryByLabelText("Preset name")).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("button", { name: "Apply preset" })).not.toBeInTheDocument();
  });

  it.each([
    ["analysis", "Project analysis settings"],
    ["translation", "Project translation settings"],
    ["style", "Project style settings"],
    ["export", "Project export settings"]
  ] as const)("labels %s inspector controls as current-project settings", async (mode, heading) => {
    stubActiveProjectFetch();
    openWorkbenchInspector(mode);

    renderWithProviders(<WorkbenchPage />);

    const inspector = screen.getByRole("region", { name: "Inspector" });
    expect(await within(inspector).findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(within(inspector).getByText("Current project")).toBeInTheDocument();
    expect(
      within(inspector).getByText("Applies only to the open project. System defaults stay in Settings.")
    ).toBeInTheDocument();
  });

  it("loads project translation settings into the translation inspector", async () => {
    stubActiveProjectFetch({
      translationSettings: {
        ...translationSettingsFixture,
        sourceLanguage: "en",
        targetLanguage: "zh"
      }
    });
    useUiStore.getState().setInspectorMode("translation");

    renderWithProviders(<WorkbenchPage />);

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Source language" })).toHaveValue("en")
    );
    const sourceLanguage = screen.getByRole("combobox", { name: "Source language" });
    const targetLanguage = screen.getByRole("combobox", { name: "Target language" });
    expect(targetLanguage).toHaveValue("zh");
    expect(within(sourceLanguage).getByRole("option", { name: "English (en)" })).toBeInTheDocument();
    expect(within(targetLanguage).getByRole("option", { name: "Chinese (zh)" })).toBeInTheDocument();
  });

  it("persists translation language direction as current project settings", async () => {
    stubActiveProjectFetch({
      translationSettings: {
        ...translationSettingsFixture,
        sourceLanguage: "en",
        targetLanguage: "zh"
      }
    });
    useUiStore.getState().setInspectorMode("translation");

    renderWithProviders(<WorkbenchPage />);

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Target language" })).toHaveValue("zh")
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Target language" }), {
      target: { value: "ja" }
    });

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/translation-settings$/),
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining('"targetLanguage":"ja"')
        })
      )
    );
  });

  it("opens current project settings from the right inspector tabs without entering system settings", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch({
      translationSettings: {
        ...translationSettingsFixture,
        sourceLanguage: "en",
        targetLanguage: "zh"
      }
    });

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");
    await user.click(screen.getByRole("tab", { name: "Project" }));

    const inspector = screen.getByRole("region", { name: "Inspector" });
    expect(within(inspector).getByRole("heading", { name: "Current project settings" })).toBeInTheDocument();
    expect(within(inspector).getByText("Current project")).toBeInTheDocument();
    const projectSourceLanguage = within(inspector).getByRole("combobox", {
      name: "Source language"
    });
    const projectTargetLanguage = within(inspector).getByRole("combobox", {
      name: "Target language"
    });
    expect(projectSourceLanguage).toHaveValue("en");
    expect(projectTargetLanguage).toHaveValue("zh");
    expect(within(projectSourceLanguage).getByRole("option", { name: "English (en)" })).toBeInTheDocument();
    expect(within(projectTargetLanguage).getByRole("option", { name: "Chinese (zh)" })).toBeInTheDocument();
    expect(within(inspector).getByLabelText("Export mode")).toHaveValue("bilingual");
    expect(useUiStore.getState().inspectorMode).toBe("settings-lite");

    await user.selectOptions(within(inspector).getByLabelText("Export mode"), "target");
    expect(within(inspector).getByLabelText("Export mode")).toHaveValue("target");

    await user.selectOptions(projectTargetLanguage, "ja");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/translation-settings$/),
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining('"targetLanguage":"ja"')
        })
      )
    );
  });

  it("blocks export after local subtitle edits until the draft is saved", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");
    await user.click(screen.getByRole("button", { name: "Select line 1" }));
    await user.clear(screen.getByLabelText("Source text"));
    await user.type(screen.getByLabelText("Source text"), "Edited source");
    fireEvent.blur(screen.getByLabelText("Source text"));

    const toolbar = screen.getByRole("toolbar", { name: "Project tools" });
    const toolbarSave = within(toolbar).getByRole("button", { name: "Save" });
    expect(toolbarSave).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Export" }));

    const inspector = screen.getByLabelText("Inspector");
    expect(within(inspector).getByRole("button", { name: "Export" })).toBeDisabled();
    expect(within(inspector).getByText("Save subtitle edits before exporting.")).toBeInTheDocument();

    await user.click(toolbarSave);

    expect(toolbarSave).toBeDisabled();
    expect(within(inspector).getByRole("button", { name: "Export" })).toBeEnabled();
    expect(
      within(inspector).queryByText("Save subtitle edits before exporting.")
    ).not.toBeInTheDocument();
  });

  it("loads project subtitle data, edits a selected row, and saves the draft through fetch", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");

    await user.click(screen.getByRole("button", { name: "Select line 1" }));
    expect(screen.getByLabelText("Source text")).toHaveValue("查询字幕文本");

    await user.clear(screen.getByLabelText("Source text"));
    await user.type(screen.getByLabelText("Source text"), "Edited from query");
    fireEvent.blur(screen.getByLabelText("Source text"));

    const toolbar = screen.getByRole("toolbar", { name: "Project tools" });
    await user.click(within(toolbar).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/subtitle$/),
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining("Edited from query")
        })
      )
    );

    const saveCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).endsWith("/projects/project-demo/subtitle") && init?.method === "PUT"
    );
    expect(saveCall).toBeDefined();
    expect(JSON.parse(String(saveCall?.[1]?.body))).toMatchObject({
      document: {
        projectId: "project-demo",
        lines: [expect.objectContaining({ id: "line-1", sourceText: "Edited from query" })]
      }
    });
    expect(within(toolbar).getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("restores a server draft into the local editor", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch({ draft: serverDraftFixture });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("Autosaved draft")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restore draft" }));
    await user.click(screen.getByRole("button", { name: "Select line 1" }));

    expect(screen.getByLabelText("Source text")).toHaveValue("Recovered server draft");
    expect(within(screen.getByRole("toolbar", { name: "Project tools" })).getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("autosaves local subtitle edits to the server draft endpoint", async () => {
    const fetchMock = stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");
    fireEvent.click(screen.getByRole("button", { name: "Select line 1" }));
    fireEvent.change(screen.getByLabelText("Source text"), {
      target: { value: "Autosaved source" }
    });
    fireEvent.blur(screen.getByLabelText("Source text"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/subtitle\/draft$/),
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining("Autosaved source")
        })
      )
    );
  });

  it("stable save persists the subtitle document and clears draft recovery state", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");
    await user.click(screen.getByRole("button", { name: "Select line 1" }));
    fireEvent.change(screen.getByLabelText("Source text"), {
      target: { value: "Stable saved source" }
    });
    fireEvent.blur(screen.getByLabelText("Source text"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/subtitle\/draft$/),
        expect.objectContaining({ method: "PUT" })
      )
    );

    const toolbar = screen.getByRole("toolbar", { name: "Project tools" });
    await user.click(within(toolbar).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/subtitle$/),
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining("Stable saved source")
        })
      )
    );
    expect(within(toolbar).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.queryByRole("region", { name: "Recovery" })).not.toBeInTheDocument();
  });

  it("undoes and redoes text edits from the editor command bar", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");
    await user.click(screen.getByRole("button", { name: "Select line 1" }));
    fireEvent.change(screen.getByLabelText("Source text"), {
      target: { value: "Undo target" }
    });
    fireEvent.blur(screen.getByLabelText("Source text"));

    expect(screen.getByLabelText("Source text")).toHaveValue("Undo target");
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByLabelText("Source text")).toHaveValue("查询字幕文本");
    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getByLabelText("Source text")).toHaveValue("Undo target");
  });

  it("splits the selected subtitle line from the command bar", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");
    await user.click(screen.getByRole("button", { name: "Select line 1" }));
    await user.click(screen.getByRole("button", { name: "Split line" }));

    expect(await screen.findByRole("button", { name: "Select line 2" })).toBeInTheDocument();
  });

  it("merges the next subtitle line from the command bar", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch({ subtitleDocuments: [twoLineSubtitleDocument] });

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("First subtitle text");
    await user.click(screen.getByRole("button", { name: "Select line 1" }));
    await user.click(screen.getByRole("button", { name: "Merge next" }));

    expect(screen.queryByRole("button", { name: "Select line 2" })).not.toBeInTheDocument();
  });

  it("creates a batch timing snapshot before applying an offset", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");
    await user.click(screen.getByRole("button", { name: "Select line 1" }));
    const offsetInput = screen.getByRole("textbox", { name: "Offset milliseconds" });
    await user.clear(offsetInput);
    await user.type(offsetInput, "250");
    await user.click(screen.getByRole("button", { name: "Apply offset" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/subtitle\/snapshots$/),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"reason":"batch_timing"')
        })
      )
    );
    expect(screen.getByText("00:01.250")).toBeInTheDocument();
  });

  it("blocks export when a server draft has not been resolved", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch({ draft: serverDraftFixture });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("Autosaved draft")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Export" }));

    const inspector = screen.getByLabelText("Inspector");
    expect(within(inspector).getByRole("button", { name: "Export" })).toBeDisabled();
    expect(within(inspector).getByText("Save subtitle edits before exporting.")).toBeInTheDocument();
  });

  it("restores subtitle snapshots from the recovery panel", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch({
      snapshots: [manualSnapshotFixture],
      snapshotDocument: {
        ...liveSubtitleDocument,
        lines: [
          {
            ...liveSubtitleDocument.lines[0],
            sourceText: "Restored snapshot source"
          }
        ]
      }
    });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("Snapshots")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restore snapshot Manual checkpoint" }));
    await user.click(screen.getByRole("button", { name: "Select line 1" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/subtitle\/snapshots\/snapshot-manual-1\/restore$/),
        expect.objectContaining({ method: "POST" })
      )
    );
    expect(screen.getByLabelText("Source text")).toHaveValue("Restored snapshot source");
  });

  it("uses editor shortcuts outside editable fields but ignores text fields", async () => {
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");
    fireEvent.click(screen.getByRole("button", { name: "Select line 1" }));
    fireEvent.keyDown(screen.getByLabelText("Source text"), { key: "s", code: "KeyS" });
    expect(screen.queryByRole("button", { name: "Select line 2" })).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "s", code: "KeyS" });
    expect(await screen.findByRole("button", { name: "Select line 2" })).toBeInTheDocument();
  });

  it("uses keyboard undo and redo outside editable fields", async () => {
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");
    fireEvent.click(screen.getByRole("button", { name: "Select line 1" }));
    fireEvent.change(screen.getByLabelText("Source text"), {
      target: { value: "Keyboard undo target" }
    });
    fireEvent.blur(screen.getByLabelText("Source text"));

    fireEvent.keyDown(document, { key: "z", code: "KeyZ", ctrlKey: true });
    expect(screen.getByLabelText("Source text")).toHaveValue("查询字幕文本");

    fireEvent.keyDown(document, { key: "y", code: "KeyY", ctrlKey: true });
    expect(screen.getByLabelText("Source text")).toHaveValue("Keyboard undo target");
  });

  it("keeps the local draft when a background subtitle refetch returns newer data", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch({
      analysisTask: runningAnalysisTaskFixture,
      taskResponses: [completedAnalysisTaskFixture],
      subtitleDocuments: [liveSubtitleDocument, refreshedSubtitleDocument],
      modelCatalog: modelCatalogFixture
    });

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");
    await user.click(screen.getByRole("button", { name: "Select line 1" }));
    await user.clear(screen.getByLabelText("Source text"));
    await user.type(screen.getByLabelText("Source text"), "Local draft survives refetch");
    fireEvent.blur(screen.getByLabelText("Source text"));

    openWorkbenchInspector("analysis");
    await user.selectOptions(
      within(screen.getByLabelText("Inspector")).getByRole("combobox", {
        name: "Installed ASR model"
      }),
      "asr.faster-whisper.medium"
    );
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Start" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([input, init]) =>
            String(input).endsWith("/projects/project-demo/subtitle") && init?.method === undefined
        )
      ).toHaveLength(2)
    );

    await user.click(screen.getByRole("tab", { name: "Subtitles" }));
    await user.click(screen.getByRole("button", { name: "Select line 1" }));
    expect(screen.getByLabelText("Source text")).toHaveValue("Local draft survives refetch");
    expect(screen.queryByText("Server refreshed subtitle")).not.toBeInTheDocument();
  });

  it("keeps draft edits and shows an error when saving subtitles fails", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch({ saveError: { status: 500, detail: "Save failed" } });

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");
    await user.click(screen.getByRole("button", { name: "Select line 1" }));
    await user.clear(screen.getByLabelText("Source text"));
    await user.type(screen.getByLabelText("Source text"), "Unsaved after failed PUT");
    fireEvent.blur(screen.getByLabelText("Source text"));

    const toolbar = screen.getByRole("toolbar", { name: "Project tools" });
    const toolbarSave = within(toolbar).getByRole("button", { name: "Save" });
    await user.click(toolbarSave);

    expect(await screen.findByText("Could not save subtitles.")).toBeInTheDocument();
    expect(screen.getByText("Your local edits are still kept in this session.")).toBeInTheDocument();
    expect(screen.queryByText(/Local runtime request failed/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Source text")).toHaveValue("Unsaved after failed PUT");
    expect(toolbarSave).toBeEnabled();
  });

  it("starts analysis and translation jobs and exports through worker mutations", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch({ modelCatalog: modelCatalogWithInstalledTranslation });

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");

    openWorkbenchInspector("analysis");
    await user.selectOptions(
      within(screen.getByLabelText("Inspector")).getByRole("combobox", {
        name: "Installed ASR model"
      }),
      "asr.faster-whisper.medium"
    );
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Start" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/analysis-jobs$/),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"modelId":"asr.faster-whisper.medium"')
        })
      )
    );

    openWorkbenchInspector("translation");
    await user.selectOptions(
      within(screen.getByLabelText("Inspector")).getByRole("combobox", {
        name: "Translation model"
      }),
      "translation.opus-mt.zh-en"
    );
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Start" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/translation-jobs$/),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"modelId":"translation.opus-mt.zh-en"')
        })
      )
    );

    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Export" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/exports\/subtitles$/),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"format":"srt"')
        })
      )
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/exports\/subtitles$/),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"mode":"bilingual"')
        })
      )
    );
    expect(
      await screen.findByText("SRT exported: D:/Diplomat/projects/project-demo/demo.srt")
    ).toBeInTheDocument();
  });

  it("exports the selected ASS format through the subtitle export route", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");

    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.selectOptions(
      within(screen.getByLabelText("Inspector")).getByRole("combobox", { name: "Format" }),
      "ass"
    );
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Export" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/exports\/subtitles$/),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"format":"ass"')
        })
      )
    );
    expect(
      await screen.findByText("ASS exported: D:/Diplomat/projects/project-demo/demo.ass")
    ).toBeInTheDocument();
  });

  it("starts burn-in video export with the active mode and style", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch({
      exportTask: queuedExportTaskFixture,
      taskResponses: [queuedExportTaskFixture]
    });

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");

    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Render video" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/exports\/video$/),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"mode":"bilingual"')
        })
      )
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Queued burn-in export")
    );
  });

  it("blocks export when timing validation has errors", async () => {
    const user = userEvent.setup();
    const overlappingDocument: SubtitleDocument = {
      ...twoLineSubtitleDocument,
      lines: [
        { ...twoLineSubtitleDocument.lines[0]!, startMs: 1000, endMs: 2500 },
        { ...twoLineSubtitleDocument.lines[1]!, startMs: 2000, endMs: 3200 }
      ]
    };
    stubActiveProjectFetch({ subtitleDocuments: [overlappingDocument] });

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("First subtitle text");

    await user.click(screen.getByRole("button", { name: "Export" }));

    const inspector = screen.getByLabelText("Inspector");
    expect(within(inspector).getByText("Fix timing errors before exporting.")).toBeInTheDocument();
    expect(within(inspector).getByRole("button", { name: "Export" })).toBeDisabled();
    expect(within(inspector).getByRole("button", { name: "Render video" })).toBeDisabled();
  });

  it("applies style presets and toggles safe area preview", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch();
    openWorkbenchInspector("style");

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByRole("heading", { name: "Project style settings" })).toBeInTheDocument();

    await user.click(within(screen.getByLabelText("Inspector")).getByLabelText("Safe area"));
    expect(screen.getByTestId("subtitle-safe-area")).toBeInTheDocument();

    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Apply preset" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/style-presets\/preset-default\/apply$/),
        { method: "POST" }
      )
    );
  });

  it("starts analysis with an installed curated ASR model when one is selected", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch({ modelCatalog: modelCatalogFixture });

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");

    openWorkbenchInspector("analysis");
    await user.selectOptions(
      within(screen.getByLabelText("Inspector")).getByRole("combobox", {
        name: "Installed ASR model"
      }),
      "asr.faster-whisper.medium"
    );
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Start" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/analysis-jobs$/),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"modelId":"asr.faster-whisper.medium"')
        })
      )
    );

    const analysisCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith("/projects/project-demo/analysis-jobs") &&
        init?.method === "POST"
    );
    expect(JSON.parse(String(analysisCall?.[1]?.body))).toMatchObject({
      provider: "faster-whisper",
      modelId: "asr.faster-whisper.medium",
      modelNameOrPath: null
    });
  });

  it("shows visible errors for analysis, translation, and export mutation failures", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch({
      modelCatalog: modelCatalogWithInstalledTranslation,
      analysisError: { status: 500, detail: "Analysis failed" },
      translationError: { status: 500, detail: "Translation failed" },
      exportError: { status: 500, detail: "Export failed" }
    });

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");

    openWorkbenchInspector("analysis");
    await user.selectOptions(
      within(screen.getByLabelText("Inspector")).getByRole("combobox", {
        name: "Installed ASR model"
      }),
      "asr.faster-whisper.medium"
    );
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Start" }));
    expect(await screen.findByText("Could not start transcription.")).toBeInTheDocument();
    expect(screen.queryByText(/Local runtime request failed/)).not.toBeInTheDocument();

    openWorkbenchInspector("translation");
    await user.selectOptions(
      within(screen.getByLabelText("Inspector")).getByRole("combobox", {
        name: "Translation model"
      }),
      "translation.opus-mt.zh-en"
    );
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Start" }));
    expect(await screen.findByText("Could not start translation.")).toBeInTheDocument();
    expect(screen.queryByText(/Local runtime request failed/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Export" }));
    expect(await screen.findByText("Could not start export.")).toBeInTheDocument();
    expect(screen.queryByText(/Local runtime request failed/)).not.toBeInTheDocument();
  });

  it("blocks export while the latest local task is active", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch({
      modelCatalog: modelCatalogFixture,
      analysisTask: runningAnalysisTaskFixture,
      taskResponses: [runningAnalysisTaskFixture]
    });

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");

    openWorkbenchInspector("analysis");
    await user.selectOptions(
      within(screen.getByLabelText("Inspector")).getByRole("combobox", {
        name: "Installed ASR model"
      }),
      "asr.faster-whisper.medium"
    );
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Export" }));

    const inspector = screen.getByLabelText("Inspector");
    expect(within(inspector).getByRole("button", { name: "Export" })).toBeDisabled();
    expect(within(inspector).getByText("Wait for analysis or translation to finish.")).toBeInTheDocument();
  });

  it("shows task progress and wires cancel and retry actions", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch({
      modelCatalog: modelCatalogFixture,
      analysisTask: runningAnalysisTaskFixture,
      taskResponses: [runningAnalysisTaskFixture]
    });

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");

    openWorkbenchInspector("analysis");
    const inspector = screen.getByLabelText("Inspector");
    await user.selectOptions(
      within(inspector).getByRole("combobox", {
        name: "Installed ASR model"
      }),
      "asr.faster-whisper.medium"
    );
    await user.click(within(inspector).getByRole("button", { name: "Start" }));

    expect(await screen.findByText("Transcribing audio")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Running");
    expect(screen.getByLabelText("Task progress")).toBeInTheDocument();
    expect(within(inspector).getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(within(inspector).getByRole("button", { name: "Retry" })).toBeDisabled();

    await user.click(within(inspector).getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/tasks\/task-1\/cancel$/),
        expect.objectContaining({ method: "POST" })
      )
    );
    expect(await screen.findByText("Analysis canceled")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Canceled");
    expect(within(inspector).getByRole("button", { name: "Retry" })).toBeEnabled();

    await user.click(within(inspector).getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/tasks\/task-1\/retry$/),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"modelId":"asr.faster-whisper.medium"')
        })
      )
    );
    expect(await screen.findByText("Analysis queued")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Queued");
  });

  it("uses localized task-active export blocking copy", async () => {
    const user = userEvent.setup();
    useUiStore.getState().setLanguage("zh");
    await appI18n.changeLanguage("zh");
    stubActiveProjectFetch({
      modelCatalog: modelCatalogFixture,
      analysisTask: runningAnalysisTaskFixture,
      taskResponses: [runningAnalysisTaskFixture]
    });

    renderWithProviders(<WorkbenchPage />);

    await expectTextVisibleAtLeastOnce("查询字幕文本");

    openWorkbenchInspector("analysis");
    await user.selectOptions(
      within(screen.getByLabelText("检查器")).getByRole("combobox", {
        name: "已安装 ASR 模型"
      }),
      "asr.faster-whisper.medium"
    );
    await user.click(within(screen.getByLabelText("检查器")).getByRole("button", { name: "开始" }));
    await user.click(screen.getByRole("button", { name: "导出" }));

    expect(
      within(screen.getByLabelText("检查器")).getByText("请等待分析或翻译任务完成。")
    ).toBeInTheDocument();
  });

  it("uses localized workbench accessibility labels", async () => {
    useUiStore.getState().setLanguage("zh");
    await appI18n.changeLanguage("zh");
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByRole("main", { name: "工作台" })).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "项目工具" })).toBeInTheDocument();
    expect(screen.getByLabelText("视频预览")).toBeInTheDocument();
    expect(await screen.findByLabelText("字幕表格")).toBeInTheDocument();
    expect(screen.getByLabelText("检查器")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "时间线编辑器" })).toBeInTheDocument();
    expect(await screen.findByText("1 行")).toBeInTheDocument();
  });
});
