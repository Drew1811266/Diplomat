import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  ModelCatalogResponse,
  SubtitleDocument,
  TaskResponse,
  WaveformResponse
} from "@diplomat/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { useUiStore } from "../state/uiStore";
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

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("PointerEvent", window.MouseEvent);
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

type ActiveProjectFetchOptions = {
  projectError?: { status: number; detail: string };
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
  cancelTask?: TaskResponse;
  retryTask?: TaskResponse;
  taskResponses?: TaskResponse[];
  subtitleDocuments?: SubtitleDocument[];
  modelCatalog?: ModelCatalogResponse;
  waveform?: WaveformResponse | null;
};

function stubActiveProjectFetch(options: ActiveProjectFetchOptions = {}) {
  let currentDocument: SubtitleDocument = options.subtitleDocuments?.[0] ?? liveSubtitleDocument;
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
        json: async () => projectFixture
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
      return {
        ok: true,
        status: 200,
        json: async () => currentDocument
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

    if (url.endsWith("/projects/project-demo/exports/srt") && init?.method === "POST") {
      if (options.exportError) {
        return errorResponse(options.exportError);
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          projectId: "project-demo",
          exportPath: "D:/Diplomat/projects/project-demo/demo.srt",
          mode: "bilingual"
        })
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
  stubMatchMedia(false);
  await appI18n.changeLanguage("en");
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  useUiStore.getState().resetUiState();
  await appI18n.changeLanguage("en");
});

describe("WorkbenchPage", () => {
  it("shows an empty workbench state when no active project is selected", () => {
    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByText("No project selected")).toBeInTheDocument();
    expect(screen.getByText("0 subtitle rows")).toBeInTheDocument();
    expect(screen.queryByText("原始字幕文本")).not.toBeInTheDocument();
  });

  it("shows project query errors instead of treating the workbench as empty", async () => {
    stubActiveProjectFetch({ projectError: { status: 500, detail: "Project unavailable" } });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("Could not load project.", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText("Worker request failed: 500: Project unavailable")).toBeInTheDocument();
    expect(screen.queryByText("No subtitle rows are available to export.")).not.toBeInTheDocument();
  });

  it("shows subtitle query errors instead of treating the workbench as empty", async () => {
    stubActiveProjectFetch({ subtitleError: { status: 404, detail: "Subtitle missing" } });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("Could not load subtitle document.")).toBeInTheDocument();
    expect(screen.getByText("Worker request failed: 404: Subtitle missing")).toBeInTheDocument();
    expect(screen.queryByText("No subtitle rows are available to export.")).not.toBeInTheDocument();
  });

  it("renders the media-centered workbench regions", async () => {
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByRole("toolbar", { name: "Project tools" })).toBeInTheDocument();
    expect(screen.getByLabelText("Video preview")).toBeInTheDocument();
    expect(await screen.findByLabelText("Video preview media")).toHaveAttribute(
      "src",
      "http://127.0.0.1:8765/projects/project-demo/media/source"
    );
    expect(await screen.findByLabelText("Subtitle Grid")).toBeInTheDocument();
    expect(screen.getByLabelText("Inspector")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Timeline editor" })).toBeInTheDocument();
  });

  it("clicks subtitle rows to select and seek the preview", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch({ waveform: waveformFixture });

    renderWithProviders(<WorkbenchPage />);

    const media = (await screen.findByLabelText("Video preview media")) as HTMLVideoElement;
    await user.click(await screen.findByRole("button", { name: "Select line line-1" }));

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
    expect(await screen.findByText("Queued · Waveform queued · 0%")).toBeInTheDocument();
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
    expect(screen.getByText("00:01.250")).toBeInTheDocument();
  });

  it("stacks the inspector below media panes on narrow screens", () => {
    stubMatchMedia(true);

    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByTestId("workbench-body")).toHaveAttribute("data-layout", "stacked");
  });

  it("keeps growing subtitle and inspector content independently scrollable", () => {
    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByTestId("subtitle-grid-body")).toHaveStyle({ overflow: "auto" });
    expect(screen.getByTestId("inspector-body")).toHaveStyle({ overflow: "auto" });
  });

  it("selects a subtitle row, returns to line inspector mode, and updates preview overlay", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch();
    useUiStore.getState().setInspectorMode("translation");

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select line line-1" }));

    expect(screen.getByRole("heading", { name: "Line" })).toBeInTheDocument();
    expect(screen.getByLabelText("Source text")).toHaveValue("查询字幕文本");
    expect(within(screen.getByLabelText("Video preview")).getByText("查询字幕文本")).toBeInTheDocument();
  });

  it("switches inspector modes from the toolbar", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(screen.getByRole("heading", { name: "Analysis" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Installed ASR model" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Translate" }));
    expect(screen.getByRole("heading", { name: "Translation" })).toBeInTheDocument();
    expect(screen.getByLabelText("Target language")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("heading", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Export mode" })).toBeInTheDocument();
  });

  it("blocks export after local subtitle edits until the draft is saved", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select line line-1" }));
    await user.clear(screen.getByLabelText("Source text"));
    await user.type(screen.getByLabelText("Source text"), "Edited source");

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

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select line line-1" }));
    expect(screen.getByLabelText("Source text")).toHaveValue("查询字幕文本");

    await user.clear(screen.getByLabelText("Source text"));
    await user.type(screen.getByLabelText("Source text"), "Edited from query");

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

  it("keeps the local draft when a background subtitle refetch returns newer data", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch({
      analysisTask: runningAnalysisTaskFixture,
      taskResponses: [completedAnalysisTaskFixture],
      subtitleDocuments: [liveSubtitleDocument, refreshedSubtitleDocument],
      modelCatalog: modelCatalogFixture
    });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select line line-1" }));
    await user.clear(screen.getByLabelText("Source text"));
    await user.type(screen.getByLabelText("Source text"), "Local draft survives refetch");

    await user.click(screen.getByRole("button", { name: "Analyze" }));
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

    await user.click(screen.getByRole("button", { name: "Select line line-1" }));
    expect(screen.getByLabelText("Source text")).toHaveValue("Local draft survives refetch");
    expect(screen.queryByText("Server refreshed subtitle")).not.toBeInTheDocument();
  });

  it("keeps draft edits and shows an error when saving subtitles fails", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch({ saveError: { status: 500, detail: "Save failed" } });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select line line-1" }));
    await user.clear(screen.getByLabelText("Source text"));
    await user.type(screen.getByLabelText("Source text"), "Unsaved after failed PUT");

    const toolbar = screen.getByRole("toolbar", { name: "Project tools" });
    const toolbarSave = within(toolbar).getByRole("button", { name: "Save" });
    await user.click(toolbarSave);

    expect(await screen.findByText("Worker request failed: 500: Save failed")).toBeInTheDocument();
    expect(screen.getByLabelText("Source text")).toHaveValue("Unsaved after failed PUT");
    expect(toolbarSave).toBeEnabled();
  });

  it("starts analysis and translation jobs and exports through worker mutations", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch({ modelCatalog: modelCatalogWithInstalledTranslation });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Analyze" }));
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

    await user.click(screen.getByRole("button", { name: "Translate" }));
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
        expect.stringMatching(/\/projects\/project-demo\/exports\/srt$/),
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

  it("starts analysis with an installed curated ASR model when one is selected", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch({ modelCatalog: modelCatalogFixture });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Analyze" }));
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

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await user.selectOptions(
      within(screen.getByLabelText("Inspector")).getByRole("combobox", {
        name: "Installed ASR model"
      }),
      "asr.faster-whisper.medium"
    );
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Start" }));
    expect(await screen.findByText("Worker request failed: 500: Analysis failed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Translate" }));
    await user.selectOptions(
      within(screen.getByLabelText("Inspector")).getByRole("combobox", {
        name: "Translation model"
      }),
      "translation.opus-mt.zh-en"
    );
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Start" }));
    expect(await screen.findByText("Worker request failed: 500: Translation failed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Export" }));
    expect(await screen.findByText("Worker request failed: 500: Export failed")).toBeInTheDocument();
  });

  it("blocks export while the latest local task is active", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch({
      modelCatalog: modelCatalogFixture,
      analysisTask: runningAnalysisTaskFixture,
      taskResponses: [runningAnalysisTaskFixture]
    });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Analyze" }));
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

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Analyze" }));
    const inspector = screen.getByLabelText("Inspector");
    await user.selectOptions(
      within(inspector).getByRole("combobox", {
        name: "Installed ASR model"
      }),
      "asr.faster-whisper.medium"
    );
    await user.click(within(inspector).getByRole("button", { name: "Start" }));

    expect(await screen.findByText("Running · Transcribing audio · 35%")).toBeInTheDocument();
    expect(within(inspector).getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(within(inspector).getByRole("button", { name: "Retry" })).toBeDisabled();

    await user.click(within(inspector).getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/tasks\/task-1\/cancel$/),
        expect.objectContaining({ method: "POST" })
      )
    );
    expect(await screen.findByText("Canceled · Analysis canceled · 35%")).toBeInTheDocument();
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
    expect(await screen.findByText("Queued · Analysis queued · 0%")).toBeInTheDocument();
  });

  it("uses localized task-active export blocking copy", async () => {
    const user = userEvent.setup();
    await appI18n.changeLanguage("zh");
    stubActiveProjectFetch({
      modelCatalog: modelCatalogFixture,
      analysisTask: runningAnalysisTaskFixture,
      taskResponses: [runningAnalysisTaskFixture]
    });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "分析" }));
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
