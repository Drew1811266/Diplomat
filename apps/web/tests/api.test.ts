import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type CreateProjectInput,
  cancelTask,
  createAnalysisJob,
  createProject,
  exportSrt,
  fetchProject,
  fetchSubtitleDocument,
  fetchTask,
  listProjects,
  retryTask,
  runProjectAnalysis,
  saveSubtitleDocument
} from "../src/api";
import type { SubtitleDocument } from "@diplomat/shared";

const baseUrl = "http://worker.test";

const projectResponse = {
  projectId: "project-1",
  name: "Launch interview",
  sourceVideoPath: "D:/media/interview.mp4",
  projectDir: "D:/Diplomat/projects/project-1",
  durationMs: 124_000,
  sourceLanguage: "zh",
  targetLanguage: "en",
  createdAt: "2026-06-07T00:00:00+00:00",
  updatedAt: "2026-06-07T00:01:00+00:00",
  hasSubtitleDocument: false
};

const subtitleDocument: SubtitleDocument = {
  schemaVersion: "diplomat.subtitle.v1",
  projectId: "project-1",
  mediaId: "media-1",
  durationMs: 10_000,
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
      endMs: 2500,
      speakerId: "speaker-1",
      sourceLanguage: "zh",
      targetLanguage: "en",
      sourceText: "你好",
      translatedText: "Hello",
      words: [{ text: "你好", startMs: 1000, endMs: 2500, confidence: 0.94 }],
      styleOverrides: {},
      reviewStatus: "draft",
      aiOrigin: { engine: "fake-asr", model: "fake-v1" },
      notes: ""
    }
  ]
};

const taskResponse = {
  taskId: "task-1",
  projectId: "project-1",
  type: "analysis",
  status: "running",
  progress: 0.25,
  message: "Extracting audio",
  startedAt: "2026-06-07T00:00:00+00:00",
  updatedAt: "2026-06-07T00:00:01+00:00",
  completedAt: null,
  errorCode: null,
  errorMessage: null,
  diagnosticLogPath: null
};

function stubJsonResponse(payload: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      ({
        ok,
        status,
        json: async () => payload
      }) as Response
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("worker API helpers", () => {
  it("createProject sends POST JSON and parses the response", async () => {
    const response = projectResponse;
    const fetchMock = stubJsonResponse(response);

    await expect(
      createProject(
        {
          name: "Launch interview",
          sourceVideoPath: "D:/media/interview.mp4",
          sourceLanguage: "zh",
          targetLanguage: "en"
        },
        baseUrl
      )
    ).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Launch interview",
        sourceVideoPath: "D:/media/interview.mp4",
        sourceLanguage: "zh",
        targetLanguage: "en"
      })
    });
  });

  it("createProject normalizes an omitted target language to null", async () => {
    const response = {
      ...projectResponse,
      projectId: "project-review",
      name: "Source-only review",
      sourceVideoPath: "D:/media/review.mp4",
      projectDir: "D:/Diplomat/projects/project-1",
      durationMs: 124_000,
      sourceLanguage: "ja",
      targetLanguage: null
    };
    const input: CreateProjectInput = {
      name: "Source-only review",
      sourceVideoPath: "D:/media/review.mp4",
      sourceLanguage: "ja"
    };
    const fetchMock = stubJsonResponse(response);

    await expect(createProject(input, baseUrl)).resolves.toEqual(response);

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Source-only review",
      sourceVideoPath: "D:/media/review.mp4",
      sourceLanguage: "ja",
      targetLanguage: null
    });
  });

  it("listProjects gets and parses recent projects", async () => {
    const response = { projects: [projectResponse] };
    const fetchMock = stubJsonResponse(response);

    await expect(listProjects(baseUrl)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects`, undefined);
  });

  it("fetchProject gets and parses one project", async () => {
    const fetchMock = stubJsonResponse(projectResponse);

    await expect(fetchProject("project-1", baseUrl)).resolves.toEqual(projectResponse);
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1`, undefined);
  });

  it("runProjectAnalysis posts to the project analyze URL and parses the response", async () => {
    const response = {
      projectId: "project-1",
      status: "completed",
      subtitlePath: "D:/Diplomat/projects/project-1/subtitles.json",
      lineCount: 1,
      document: subtitleDocument
    };
    const fetchMock = stubJsonResponse(response);

    await expect(runProjectAnalysis("project-1", baseUrl)).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/analyze`, {
      method: "POST"
    });
  });

  it("createAnalysisJob posts model config and parses the task response", async () => {
    const fetchMock = stubJsonResponse(taskResponse);

    await expect(
      createAnalysisJob("project-1", { provider: "fake", sourceLanguage: "zh" }, baseUrl)
    ).resolves.toEqual(taskResponse);

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/analysis-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "fake",
        modelNameOrPath: null,
        device: "cpu",
        computeType: "int8",
        sourceLanguage: "zh",
        initialPrompt: null
      })
    });
  });

  it("fetchTask gets and parses task state", async () => {
    const fetchMock = stubJsonResponse(taskResponse);

    await expect(fetchTask("task-1", baseUrl)).resolves.toEqual(taskResponse);
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/tasks/task-1`, undefined);
  });

  it("cancelTask posts to the cancel endpoint", async () => {
    const response = { ...taskResponse, status: "canceled", progress: 0 };
    const fetchMock = stubJsonResponse(response);

    await expect(cancelTask("task-1", baseUrl)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/tasks/task-1/cancel`, {
      method: "POST"
    });
  });

  it("retryTask posts to the retry endpoint", async () => {
    const response = { ...taskResponse, taskId: "task-2", status: "queued", progress: 0 };
    const fetchMock = stubJsonResponse(response);

    await expect(retryTask("task-1", baseUrl)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/tasks/task-1/retry`, {
      method: "POST"
    });
  });

  it("fetchSubtitleDocument gets the subtitle URL and parses the response", async () => {
    const fetchMock = stubJsonResponse(subtitleDocument);

    await expect(fetchSubtitleDocument("project-1", baseUrl)).resolves.toEqual(subtitleDocument);

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/subtitle`, undefined);
  });

  it("saveSubtitleDocument puts JSON to the subtitle URL and parses the response", async () => {
    const fetchMock = stubJsonResponse(subtitleDocument);

    await expect(saveSubtitleDocument("project-1", subtitleDocument, baseUrl)).resolves.toEqual(
      subtitleDocument
    );

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/subtitle`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: subtitleDocument })
    });
  });

  it("exportSrt posts JSON to the SRT export URL and parses the response", async () => {
    const response = {
      projectId: "project-1",
      exportPath: "D:/Diplomat/projects/project-1/export.srt",
      mode: "target"
    };
    const fetchMock = stubJsonResponse(response);

    await expect(exportSrt("project-1", "target", baseUrl)).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/exports/srt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "target" })
    });
  });

  it("throws the worker request status for non-OK responses", async () => {
    stubJsonResponse({ error: "nope" }, false, 503);

    await expect(runProjectAnalysis("project-1", baseUrl)).rejects.toThrow(
      "Worker request failed: 503"
    );
  });

  it("formats network failures as worker connection errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => {
        throw new TypeError("Failed to fetch");
      })
    );

    await expect(listProjects(baseUrl)).rejects.toThrow(
      "Worker is not reachable at http://worker.test"
    );
  });

  it("includes FastAPI detail in non-OK error messages", async () => {
    stubJsonResponse(
      { detail: "Source video does not contain an audio stream" },
      false,
      400
    );

    await expect(runProjectAnalysis("project-1", baseUrl)).rejects.toThrow(
      "Worker request failed: 400: Source video does not contain an audio stream"
    );
  });

  it("rejects invalid response payloads", async () => {
    stubJsonResponse({ projectId: "", name: "Bad response" });

    await expect(
      createProject(
        {
          name: "Launch interview",
          sourceVideoPath: "D:/media/interview.mp4",
          sourceLanguage: "zh",
          targetLanguage: "en"
        },
        baseUrl
      )
    ).rejects.toThrow();
  });
});
