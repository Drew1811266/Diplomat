import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("runs the M2a workbench loop from project creation to SRT export", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ name: "diplomat-worker", status: "ok", version: "0.1.0" });
      }

      if (url.endsWith("/projects") && init?.method === "POST") {
        expect(JSON.parse(init.body as string)).toEqual({
          name: "Demo",
          sourceVideoPath: "D:/media/demo.mp4",
          sourceLanguage: "zh",
          targetLanguage: "en"
        });
        return jsonResponse({
          projectId: "project-demo",
          name: "Demo",
          sourceVideoPath: "D:/media/demo.mp4",
          projectDir: "D:/Diplomat/projects/project-demo",
          durationMs: 12_000,
          sourceLanguage: "zh",
          targetLanguage: "en"
        });
      }

      if (url.endsWith("/projects/project-demo/analyze") && init?.method === "POST") {
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
        expect(body.document.lines[0]?.sourceText).toBe("Edited source text");
        return jsonResponse(body.document);
      }

      if (url.endsWith("/projects/project-demo/exports/srt") && init?.method === "POST") {
        expect(JSON.parse(init.body as string)).toEqual({ mode: "bilingual" });
        return jsonResponse({
          projectId: "project-demo",
          exportPath: "D:/Diplomat/projects/project-demo/export-bilingual.srt",
          mode: "bilingual"
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

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
    expect(screen.getByText("Analysis completed")).toBeInTheDocument();

    const subtitleList = screen.getByRole("list", { name: "Subtitle lines" });
    fireEvent.click(within(subtitleList).getByRole("button", { name: /line-1/ }));
    fireEvent.change(screen.getByLabelText("Source text"), {
      target: { value: "Edited source text" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Subtitle" }));

    expect(await screen.findByText("Saved subtitle edits")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export SRT" }));

    expect(await screen.findByText("SRT export completed")).toBeInTheDocument();
    expect(
      screen.getByText("SRT exported: D:/Diplomat/projects/project-demo/export-bilingual.srt")
    ).toBeInTheDocument();
  });
});
