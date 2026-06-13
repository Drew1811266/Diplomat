import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appI18n } from "../app/i18n";
import { useUiStore } from "../state/uiStore";
import {
  analyzedDocumentFixture,
  completedAnalysisTaskFixture,
  completedTranslationTaskFixture,
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

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

type ActiveProjectFetchOptions = {
  analysisTask?: typeof completedAnalysisTaskFixture;
  translationTask?: typeof completedTranslationTaskFixture;
};

function stubActiveProjectFetch(options: ActiveProjectFetchOptions = {}) {
  let currentDocument = liveSubtitleDocument;
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);

    if (url.endsWith("/projects/project-demo") && init?.method === undefined) {
      return {
        ok: true,
        status: 200,
        json: async () => projectFixture
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/subtitle") && init?.method === undefined) {
      return {
        ok: true,
        status: 200,
        json: async () => currentDocument
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/subtitle") && init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as { document: typeof liveSubtitleDocument };
      currentDocument = body.document;
      return {
        ok: true,
        status: 200,
        json: async () => currentDocument
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/analysis-jobs") && init?.method === "POST") {
      return {
        ok: true,
        status: 200,
        json: async () => options.analysisTask ?? completedAnalysisTaskFixture
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/translation-jobs") && init?.method === "POST") {
      return {
        ok: true,
        status: 200,
        json: async () => options.translationTask ?? completedTranslationTaskFixture
      } as Response;
    }

    if (url.endsWith("/projects/project-demo/exports/srt") && init?.method === "POST") {
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

  it("renders the media-centered workbench regions", async () => {
    stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    expect(screen.getByRole("toolbar", { name: "Project tools" })).toBeInTheDocument();
    expect(screen.getByLabelText("Video preview")).toBeInTheDocument();
    expect(await screen.findByLabelText("Subtitle Grid")).toBeInTheDocument();
    expect(screen.getByLabelText("Inspector")).toBeInTheDocument();
    expect(screen.getByLabelText("Timeline")).toBeInTheDocument();
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
    expect(screen.getByRole("combobox", { name: "Provider" })).toBeInTheDocument();

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

  it("starts analysis and translation jobs and exports through worker mutations", async () => {
    const user = userEvent.setup();
    const fetchMock = stubActiveProjectFetch();

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Start" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/analysis-jobs$/),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"provider":"fake"')
        })
      )
    );

    await user.click(screen.getByRole("button", { name: "Translate" }));
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Start" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/projects\/project-demo\/translation-jobs$/),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"targetLanguage":"en"')
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

  it("blocks export while the latest local task is active", async () => {
    const user = userEvent.setup();
    stubActiveProjectFetch({ analysisTask: runningAnalysisTaskFixture });

    renderWithProviders(<WorkbenchPage />);

    expect(await screen.findByText("查询字幕文本")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await user.click(within(screen.getByLabelText("Inspector")).getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Export" }));

    const inspector = screen.getByLabelText("Inspector");
    expect(within(inspector).getByRole("button", { name: "Export" })).toBeDisabled();
    expect(within(inspector).getByText("Wait for analysis or translation to finish.")).toBeInTheDocument();
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
    expect(screen.getByLabelText("时间线")).toBeInTheDocument();
    expect(await screen.findByText("1 行字幕")).toBeInTheDocument();
  });
});
