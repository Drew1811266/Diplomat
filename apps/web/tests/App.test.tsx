import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { SubtitleDocument } from "@diplomat/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

const analyzedDocument: SubtitleDocument = {
  schemaVersion: "diplomat.subtitle.v1",
  projectId: "project-demo",
  mediaId: "media-demo",
  durationMs: 12_000,
  speakers: [
    {
      id: "speaker-1",
      displayName: "Speaker 1",
      color: "#0D9488",
      styleId: "default",
      mergedInto: null
    }
  ],
  styles: [
    {
      id: "default",
      name: "Default",
      fontFamily: "Arial",
      fontSize: 36,
      primaryColor: "#FFFFFF",
      secondaryColor: "#14B8A6",
      strokeWidth: 3,
      shadow: 1,
      position: "bottom-center",
      marginV: 48,
      alignment: "center",
      bilingualLayout: "source-above-target",
      lineSpacing: 1.15
    }
  ],
  lines: [
    {
      id: "line-1",
      startMs: 1000,
      endMs: 2400,
      speakerId: "speaker-1",
      sourceLanguage: "zh",
      targetLanguage: "en",
      sourceText: "原始字幕文本",
      translatedText: "Original subtitle text",
      words: [{ text: "原始字幕文本", startMs: 1000, endMs: 2400, confidence: 0.95 }],
      styleOverrides: {},
      reviewStatus: "draft",
      aiOrigin: { engine: "mock-asr", model: "mock-v1" },
      notes: ""
    }
  ]
};

const projectMetadata = {
  projectId: "project-demo",
  name: "Demo",
  sourceVideoPath: "D:/media/demo.mp4",
  projectDir: "D:/Diplomat/projects/project-demo",
  durationMs: 12_000,
  sourceLanguage: "zh",
  targetLanguage: "en",
  createdAt: "2026-06-07T00:00:00+00:00",
  updatedAt: "2026-06-07T00:01:00+00:00",
  hasSubtitleDocument: false
};

function jsonResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => payload
  } as Response;
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function stubWorkbenchFetch(
  options: { pauseSave?: boolean; includeRecentProject?: boolean; includeSubtitleFetch?: boolean } = {}
) {
  const savedDocuments: SubtitleDocument[] = [];
  const exportModes: string[] = [];
  const pendingSave = options.pauseSave ? createDeferred<Response>() : null;
  let projectWasCreated = false;
  let subtitleAvailable = Boolean(options.includeSubtitleFetch);

  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/health")) {
      return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.1.0" });
    }

    if (url.endsWith("/projects") && init?.method === undefined) {
      const shouldShowProject = options.includeRecentProject || projectWasCreated;
      return jsonResponse({
        projects: shouldShowProject
          ? [{ ...projectMetadata, hasSubtitleDocument: subtitleAvailable }]
          : []
      });
    }

    if (url.endsWith("/projects") && init?.method === "POST") {
      expect(JSON.parse(init.body as string)).toEqual({
        name: "Demo",
        sourceVideoPath: "D:/media/demo.mp4",
        sourceLanguage: "zh",
        targetLanguage: "en"
      });
      projectWasCreated = true;
      return jsonResponse(projectMetadata);
    }

    if (url.endsWith("/projects/project-demo") && init?.method === undefined) {
      return jsonResponse({ ...projectMetadata, hasSubtitleDocument: subtitleAvailable });
    }

    if (url.endsWith("/projects/project-demo/analyze") && init?.method === "POST") {
      subtitleAvailable = true;
      return jsonResponse({
        projectId: "project-demo",
        status: "completed",
        subtitlePath: "D:/Diplomat/projects/project-demo/subtitles.json",
        lineCount: 1,
        document: analyzedDocument
      });
    }

    if (url.endsWith("/projects/project-demo/subtitle") && init?.method === "PUT") {
      const body = JSON.parse(init.body as string) as { document: SubtitleDocument };
      savedDocuments.push(body.document);
      subtitleAvailable = true;
      if (pendingSave) {
        return pendingSave.promise;
      }
      return jsonResponse(body.document);
    }

    if (url.endsWith("/projects/project-demo/subtitle") && init?.method === undefined) {
      if (!subtitleAvailable) {
        return jsonResponse({ detail: "Subtitle document not found" }, false, 404);
      }
      return jsonResponse(analyzedDocument);
    }

    if (url.endsWith("/projects/project-demo/exports/srt") && init?.method === "POST") {
      const body = JSON.parse(init.body as string) as { mode: string };
      exportModes.push(body.mode);
      return jsonResponse({
        projectId: "project-demo",
        exportPath: `D:/Diplomat/projects/project-demo/export-${body.mode}.srt`,
        mode: body.mode
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, pendingSave, savedDocuments, exportModes };
}

async function createAndAnalyzeDemoProject() {
  render(<App />);

  expect(await screen.findByText("Worker: ok")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Demo" } });
  fireEvent.change(screen.getByLabelText("Source video path"), {
    target: { value: "D:/media/demo.mp4" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Create Project" }));

  expect(await screen.findByText(/Project: Demo/)).toBeInTheDocument();
  expect(screen.getByText("Project created")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

  expect((await screen.findAllByText("原始字幕文本")).length).toBeGreaterThan(0);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("loads recent projects and reopens a project with saved subtitles", async () => {
    stubWorkbenchFetch({ includeRecentProject: true, includeSubtitleFetch: true });
    render(<App />);

    expect(await screen.findByText("Recent Projects")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reopen Demo/ }));

    expect(await screen.findByText(/Project: Demo/)).toBeInTheDocument();
    expect(screen.getByText("Project reopened with subtitles")).toBeInTheDocument();
    expect((await screen.findAllByText("原始字幕文本")).length).toBeGreaterThan(0);
  });

  it("keeps manual path entry available when desktop file picker is unavailable", async () => {
    stubWorkbenchFetch();
    render(<App />);

    expect(await screen.findByLabelText("Source video path")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pick Video" })).not.toBeInTheDocument();
  });

  it("uses desktop file picker when Tauri runtime is available", async () => {
    vi.stubGlobal("__TAURI_INTERNALS__", {
      invoke: vi.fn(async (command: string) =>
        command === "pick_video_file" ? "D:/media/picked.mp4" : null
      )
    });
    stubWorkbenchFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Pick Video" }));

    expect(await screen.findByDisplayValue("D:/media/picked.mp4")).toBeInTheDocument();
    expect(screen.getByText("Video path selected")).toBeInTheDocument();
  });

  it("runs the M2a workbench loop from project creation to SRT export", async () => {
    const { savedDocuments, exportModes } = stubWorkbenchFetch();
    await createAndAnalyzeDemoProject();

    expect(screen.getByText("Analysis completed")).toBeInTheDocument();

    const subtitleList = screen.getByRole("list", { name: "Subtitle lines" });
    fireEvent.click(within(subtitleList).getByRole("button", { name: /line-1/ }));
    fireEvent.change(screen.getByLabelText("Source text"), {
      target: { value: "Edited source text" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Subtitle" }));

    expect(await screen.findByText("Saved subtitle edits")).toBeInTheDocument();
    expect(savedDocuments.at(-1)?.lines[0]?.sourceText).toBe("Edited source text");

    fireEvent.click(screen.getByRole("button", { name: "Export SRT" }));

    expect(await screen.findByText("SRT export completed")).toBeInTheDocument();
    expect(exportModes).toEqual(["bilingual"]);
    expect(
      screen.getByText("SRT exported: D:/Diplomat/projects/project-demo/export-bilingual.srt")
    ).toBeInTheDocument();
  });

  it("blocks stale SRT export when subtitle edits are unsaved", async () => {
    const { savedDocuments, exportModes } = stubWorkbenchFetch();
    await createAndAnalyzeDemoProject();

    fireEvent.click(screen.getByRole("button", { name: "Export SRT" }));

    expect(await screen.findByText("SRT export completed")).toBeInTheDocument();
    expect(
      screen.getByText("SRT exported: D:/Diplomat/projects/project-demo/export-bilingual.srt")
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("SRT mode"), { target: { value: "source" } });
    expect(
      screen.queryByText("SRT exported: D:/Diplomat/projects/project-demo/export-bilingual.srt")
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("SRT mode"), { target: { value: "bilingual" } });
    fireEvent.click(screen.getByRole("button", { name: "Export SRT" }));
    expect(
      await screen.findByText("SRT exported: D:/Diplomat/projects/project-demo/export-bilingual.srt")
    ).toBeInTheDocument();

    const subtitleList = screen.getByRole("list", { name: "Subtitle lines" });
    fireEvent.click(within(subtitleList).getByRole("button", { name: /line-1/ }));
    fireEvent.change(screen.getByLabelText("Source text"), {
      target: { value: "Changed after export" }
    });

    const exportButton = screen.getByRole("button", { name: "Export SRT" });
    expect(exportButton).toBeDisabled();
    expect(screen.getByText("Unsaved subtitle edits")).toBeInTheDocument();
    expect(screen.getByText("Save subtitle edits before exporting.")).toBeInTheDocument();
    expect(
      screen.queryByText("SRT exported: D:/Diplomat/projects/project-demo/export-bilingual.srt")
    ).not.toBeInTheDocument();

    fireEvent.click(exportButton);
    expect(exportModes).toEqual(["bilingual", "bilingual"]);

    fireEvent.click(screen.getByRole("button", { name: "Save Subtitle" }));
    expect(await screen.findByText("Saved subtitle edits")).toBeInTheDocument();
    expect(savedDocuments.at(-1)?.lines[0]?.sourceText).toBe("Changed after export");
    expect(screen.getByRole("button", { name: "Export SRT" })).toBeEnabled();
  });

  it("locks subtitle editor fields while save is in flight", async () => {
    const { pendingSave } = stubWorkbenchFetch({ pauseSave: true });
    await createAndAnalyzeDemoProject();

    fireEvent.change(screen.getByLabelText("Source text"), {
      target: { value: "Queued save text" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Subtitle" }));

    expect(screen.getByLabelText("Start ms")).toBeDisabled();
    expect(screen.getByLabelText("End ms")).toBeDisabled();
    expect(screen.getByLabelText("Source text")).toBeDisabled();
    expect(screen.getByLabelText("Translated text")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save Subtitle" })).toBeDisabled();

    pendingSave?.resolve(
      jsonResponse({
        ...analyzedDocument,
        lines: [{ ...analyzedDocument.lines[0]!, sourceText: "Queued save text" }]
      })
    );

    expect(await screen.findByText("Saved subtitle edits")).toBeInTheDocument();
  });
});
