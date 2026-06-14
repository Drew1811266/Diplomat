import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type CreateProjectInput,
  cancelTask,
  cancelModelDownload,
  createAnalysisJob,
  createProject,
  createTranslationJob,
  deleteModel,
  downloadModel,
  exportSrt,
  fetchModel,
  fetchProject,
  fetchSubtitleDocument,
  fetchTask,
  fetchWorkerHealth,
  fetchTranslationSettings,
  listProjects,
  listModels,
  retryTask,
  retryModelDownload,
  runProjectAnalysis,
  saveTranslationSettings,
  saveSubtitleDocument
} from "../src/api";
import type { SubtitleDocument } from "@diplomat/shared";
import { modelCatalogFixture } from "../src/test/fixtures";

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
  hasSubtitleDocument: false,
  diagnostics: {
    status: "not_transcribed",
    warnings: [],
    sourceVideoExists: true,
    projectDirExists: true,
    diskUsageBytes: 4096,
    cacheUsageBytes: 0,
    exportUsageBytes: 0,
    exportCount: 0,
    subtitleLineCount: 0,
    translatedLineCount: 0,
    activeTaskCount: 0,
    failedTaskCount: 0,
    latestTaskStatus: null,
    exportsDir: "D:/Diplomat/projects/project-1/exports",
    cacheDir: "D:/Diplomat/projects/project-1/cache",
    logsDir: "D:/Diplomat/projects/project-1/logs",
    backupsDir: "D:/Diplomat/projects/project-1/backups"
  }
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
      translationStatus: "not_requested",
      translationOrigin: null,
      translationError: null,
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

  it("listModels gets and parses curated model catalog entries", async () => {
    const fetchMock = stubJsonResponse(modelCatalogFixture);

    await expect(listModels(baseUrl)).resolves.toEqual(modelCatalogFixture);
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/models`, undefined);
  });

  it("fetchModel gets one model catalog entry", async () => {
    const response = modelCatalogFixture.models[0]!;
    const fetchMock = stubJsonResponse(response);

    await expect(fetchModel("asr.faster-whisper.small", baseUrl)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/models/asr.faster-whisper.small`,
      undefined
    );
  });

  it("model actions call download, cancel, retry, and delete endpoints", async () => {
    const response = {
      modelId: "asr.faster-whisper.small",
      status: "queued",
      downloadedBytes: 0,
      totalBytes: 244_000_000,
      message: "Model download queued."
    };
    const fetchMock = stubJsonResponse(response);

    await expect(downloadModel("asr.faster-whisper.small", baseUrl)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${baseUrl}/models/asr.faster-whisper.small/download`,
      { method: "POST" }
    );

    await expect(cancelModelDownload("asr.faster-whisper.small", baseUrl)).resolves.toEqual(
      response
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${baseUrl}/models/asr.faster-whisper.small/cancel`,
      { method: "POST" }
    );

    await expect(retryModelDownload("asr.faster-whisper.small", baseUrl)).resolves.toEqual(
      response
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${baseUrl}/models/asr.faster-whisper.small/retry`,
      { method: "POST" }
    );

    const deleteResponse = {
      modelId: "asr.faster-whisper.small",
      filesDeleted: 2,
      bytesDeleted: 244_000_000,
      message: "Model deleted."
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => deleteResponse
    } as Response);
    await expect(deleteModel("asr.faster-whisper.small", baseUrl)).resolves.toEqual(
      deleteResponse
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${baseUrl}/models/asr.faster-whisper.small`,
      { method: "DELETE" }
    );
  });

  it("uses configured worker base URL when no base URL argument is provided", async () => {
    vi.stubEnv("VITE_DIPLOMAT_WORKER_BASE_URL", "http://env-worker.test");
    const fetchMock = stubJsonResponse({ name: "diplomat-worker", status: "ok", version: "0.2.0" });

    await expect(fetchWorkerHealth()).resolves.toEqual({
      name: "diplomat-worker",
      status: "ok",
      version: "0.2.0"
    });

    expect(fetchMock).toHaveBeenCalledWith("http://env-worker.test/health", undefined);
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
      createAnalysisJob(
        "project-1",
        { provider: "faster-whisper", modelId: "asr.faster-whisper.small", sourceLanguage: "zh" },
        baseUrl
      )
    ).resolves.toEqual(taskResponse);

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/analysis-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "faster-whisper",
        modelId: "asr.faster-whisper.small",
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

  it("fetchTranslationSettings gets settings", async () => {
    const response = {
      projectId: "project-1",
      provider: "fake",
      sourceLanguage: "en",
      targetLanguage: "zh",
      mode: "missing_only",
      endpoint: null,
      apiKeyEnv: null,
      updatedAt: "2026-06-07T00:00:00+00:00"
    };
    const fetchMock = stubJsonResponse(response);

    await expect(fetchTranslationSettings("project-1", baseUrl)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/projects/project-1/translation-settings`,
      undefined
    );
  });

  it("saveTranslationSettings puts normalized request body", async () => {
    const response = {
      projectId: "project-1",
      provider: "fake",
      sourceLanguage: "en",
      targetLanguage: "zh",
      mode: "missing_only",
      endpoint: null,
      apiKeyEnv: null,
      updatedAt: "2026-06-07T00:00:00+00:00"
    };
    const fetchMock = stubJsonResponse(response);

    await expect(
      saveTranslationSettings("project-1", { sourceLanguage: "en", targetLanguage: "zh" }, baseUrl)
    ).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/translation-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "fake",
        sourceLanguage: "en",
        targetLanguage: "zh",
        mode: "missing_only",
        endpoint: null,
        apiKeyEnv: null
      })
    });
  });

  it("createTranslationJob posts request body", async () => {
    const response = { ...taskResponse, type: "translation", status: "queued", progress: 0 };
    const fetchMock = stubJsonResponse(response);

    await expect(
      createTranslationJob(
        "project-1",
        { sourceLanguage: "en", targetLanguage: "zh" },
        baseUrl
      )
    ).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/translation-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "fake",
        sourceLanguage: "en",
        targetLanguage: "zh",
        mode: "missing_only",
        endpoint: null,
        apiKeyEnv: null
      })
    });
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

  it("retryTask posts replacement analysis config when provided", async () => {
    const response = { ...taskResponse, taskId: "task-2", status: "queued", progress: 0 };
    const fetchMock = stubJsonResponse(response);

    await expect(
      retryTask(
        "task-1",
        {
          provider: "faster-whisper",
          modelId: "asr.faster-whisper.medium",
          sourceLanguage: "en"
        },
        baseUrl
      )
    ).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/tasks/task-1/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "faster-whisper",
        modelId: "asr.faster-whisper.medium",
        modelNameOrPath: null,
        device: "cpu",
        computeType: "int8",
        sourceLanguage: "en",
        initialPrompt: null
      })
    });
  });

  it("retryTask posts replacement translation config when provided", async () => {
    const response = {
      ...taskResponse,
      taskId: "task-2",
      type: "translation",
      status: "queued",
      progress: 0
    };
    const fetchMock = stubJsonResponse(response);

    await expect(
      retryTask(
        "task-1",
        {
          provider: "libretranslate",
          sourceLanguage: "zh",
          targetLanguage: "en",
          mode: "overwrite_all",
          endpoint: "http://localhost:5000",
          apiKeyEnv: "LIBRETRANSLATE_API_KEY"
        },
        baseUrl
      )
    ).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/tasks/task-1/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "libretranslate",
        sourceLanguage: "zh",
        targetLanguage: "en",
        mode: "overwrite_all",
        endpoint: "http://localhost:5000",
        apiKeyEnv: "LIBRETRANSLATE_API_KEY"
      })
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
