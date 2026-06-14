import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type CreateProjectInput,
  cancelTask,
  cancelModelDownload,
  applyStylePreset,
  createAnalysisJob,
  createProject,
  createStylePreset,
  createSubtitleSnapshot,
  createTranslationJob,
  createWaveformJob,
  deleteSubtitleDraft,
  deleteStylePreset,
  deleteModel,
  downloadModel,
  exportSubtitles,
  exportSrt,
  fetchModel,
  fetchProject,
  fetchSubtitleDraft,
  fetchSubtitleDocument,
  fetchTask,
  fetchWaveform,
  fetchWorkerHealth,
  fetchTranslationSettings,
  listStylePresets,
  listProjects,
  listModels,
  projectMediaUrl,
  retryTask,
  retryModelDownload,
  runProjectAnalysis,
  listSubtitleSnapshots,
  restoreSubtitleSnapshot,
  updateStylePreset,
  saveSubtitleDraft,
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
      lineSpacing: 1.15,
      backgroundBar: false,
      backgroundColor: "#000000cc",
      safeAreaMargin: 32
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

  it("builds project media URLs for worker-served source video", () => {
    expect(projectMediaUrl("project-1", baseUrl)).toBe(
      `${baseUrl}/projects/project-1/media/source`
    );
  });

  it("fetchWaveform gets and parses cached waveform data", async () => {
    const response = {
      projectId: "project-1",
      durationMs: 1000,
      sampleRate: 8000,
      peakCount: 2,
      peaks: [
        { index: 0, startMs: 0, endMs: 500, min: -0.25, max: 0.75 },
        { index: 1, startMs: 500, endMs: 1000, min: -0.5, max: 0.5 }
      ]
    };
    const fetchMock = stubJsonResponse(response);

    await expect(fetchWaveform("project-1", baseUrl)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/waveform`, undefined);
  });

  it("createWaveformJob posts to the waveform job endpoint", async () => {
    const response = { ...taskResponse, type: "waveform", status: "queued", progress: 0 };
    const fetchMock = stubJsonResponse(response);

    await expect(createWaveformJob("project-1", baseUrl)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/waveform-jobs`, {
      method: "POST"
    });
  });

  it("fetchTranslationSettings gets settings", async () => {
    const response = {
      projectId: "project-1",
      provider: "fake",
      modelId: null,
      modelNameOrPath: null,
      sourceLanguage: "en",
      targetLanguage: "zh",
      mode: "missing_only",
      device: "cpu",
      computeType: "int8",
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
      provider: "ct2-marian",
      modelId: "translation.opus-mt.en-zh",
      modelNameOrPath: null,
      sourceLanguage: "en",
      targetLanguage: "zh",
      mode: "missing_only",
      device: "cuda",
      computeType: "float16",
      endpoint: null,
      apiKeyEnv: null,
      updatedAt: "2026-06-07T00:00:00+00:00"
    };
    const fetchMock = stubJsonResponse(response);

    await expect(
      saveTranslationSettings(
        "project-1",
        {
          provider: "ct2-marian",
          modelId: "translation.opus-mt.en-zh",
          sourceLanguage: "en",
          targetLanguage: "zh",
          device: "cuda",
          computeType: "float16"
        },
        baseUrl
      )
    ).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/translation-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "ct2-marian",
        modelId: "translation.opus-mt.en-zh",
        modelNameOrPath: null,
        sourceLanguage: "en",
        targetLanguage: "zh",
        mode: "missing_only",
        device: "cuda",
        computeType: "float16",
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
        modelId: null,
        modelNameOrPath: null,
        sourceLanguage: "en",
        targetLanguage: "zh",
        mode: "missing_only",
        device: "cpu",
        computeType: "int8",
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
          provider: "ct2-marian",
          modelId: "translation.opus-mt.zh-en",
          sourceLanguage: "zh",
          targetLanguage: "en",
          mode: "overwrite_all",
          device: "cuda",
          computeType: "float16"
        },
        baseUrl
      )
    ).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/tasks/task-1/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "ct2-marian",
        modelId: "translation.opus-mt.zh-en",
        modelNameOrPath: null,
        sourceLanguage: "zh",
        targetLanguage: "en",
        mode: "overwrite_all",
        device: "cuda",
        computeType: "float16",
        endpoint: null,
        apiKeyEnv: null
      })
    });
  });

  it("fetchSubtitleDocument gets the subtitle URL and parses the response", async () => {
    const fetchMock = stubJsonResponse(subtitleDocument);

    await expect(fetchSubtitleDocument("project-1", baseUrl)).resolves.toEqual(subtitleDocument);

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/subtitle`, undefined);
  });

  it("fetchSubtitleDraft gets and parses an autosaved draft", async () => {
    const response = {
      projectId: "project-1",
      updatedAt: "2026-06-14T00:00:00+00:00",
      lineCount: 1,
      document: subtitleDocument
    };
    const fetchMock = stubJsonResponse(response);

    await expect(fetchSubtitleDraft("project-1", baseUrl)).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/projects/project-1/subtitle/draft`,
      undefined
    );
  });

  it("saveSubtitleDraft puts JSON to the draft URL", async () => {
    const response = {
      projectId: "project-1",
      updatedAt: "2026-06-14T00:00:00+00:00",
      lineCount: 1,
      document: subtitleDocument
    };
    const fetchMock = stubJsonResponse(response);

    await expect(saveSubtitleDraft("project-1", subtitleDocument, baseUrl)).resolves.toEqual(
      response
    );

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/subtitle/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: subtitleDocument })
    });
  });

  it("deleteSubtitleDraft deletes the draft URL", async () => {
    const response = {
      projectId: "project-1",
      action: "clear_draft",
      filesAffected: 1,
      bytesAffected: 0,
      message: "Subtitle draft cleared."
    };
    const fetchMock = stubJsonResponse(response);

    await expect(deleteSubtitleDraft("project-1", baseUrl)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/subtitle/draft`, {
      method: "DELETE"
    });
  });

  it("creates, lists, and restores subtitle snapshots", async () => {
    const snapshotSummary = {
      snapshotId: "snapshot-20260614000000000000-abcd1234",
      projectId: "project-1",
      reason: "manual",
      label: "Manual checkpoint",
      createdAt: "2026-06-14T00:00:00+00:00",
      lineCount: 1
    };
    const snapshotResponse = { ...snapshotSummary, document: subtitleDocument };
    const fetchMock = stubJsonResponse(snapshotResponse);

    await expect(
      createSubtitleSnapshot(
        "project-1",
        { reason: "manual", label: "Manual checkpoint", document: subtitleDocument },
        baseUrl
      )
    ).resolves.toEqual(snapshotResponse);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${baseUrl}/projects/project-1/subtitle/snapshots`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "manual",
          label: "Manual checkpoint",
          document: subtitleDocument
        })
      }
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ projectId: "project-1", snapshots: [snapshotSummary] })
    } as Response);
    await expect(listSubtitleSnapshots("project-1", baseUrl)).resolves.toEqual({
      projectId: "project-1",
      snapshots: [snapshotSummary]
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${baseUrl}/projects/project-1/subtitle/snapshots`,
      undefined
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => subtitleDocument
    } as Response);
    await expect(
      restoreSubtitleSnapshot("project-1", snapshotSummary.snapshotId, baseUrl)
    ).resolves.toEqual(subtitleDocument);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${baseUrl}/projects/project-1/subtitle/snapshots/${snapshotSummary.snapshotId}/restore`,
      { method: "POST" }
    );
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

  it("exportSubtitles posts JSON to the general subtitle export URL and parses warnings", async () => {
    const response = {
      projectId: "project-1",
      exportPath: "D:/Diplomat/projects/project-1/subtitle-bilingual.ass",
      format: "ass",
      mode: "bilingual",
      warnings: [
        {
          lineId: "line-1",
          code: "too_short",
          severity: "warning",
          message: "Cue is shorter than 300ms."
        }
      ]
    };
    const fetchMock = stubJsonResponse(response);

    await expect(
      exportSubtitles("project-1", { format: "ass", mode: "bilingual" }, baseUrl)
    ).resolves.toEqual({
      ...response,
      warnings: response.warnings
    });

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/exports/subtitles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "ass",
        mode: "bilingual",
        stylePresetId: null,
        style: null
      })
    });
  });

  it("style preset helpers use project style preset routes", async () => {
    const style = subtitleDocument.styles[0]!;
    const preset = {
      id: "preset-default",
      name: "Default",
      style,
      createdAt: "2026-06-14T00:00:00+00:00",
      updatedAt: "2026-06-14T00:00:00+00:00"
    };
    const list = {
      projectId: "project-1",
      activePresetId: preset.id,
      presets: [preset]
    };
    const apply = {
      projectId: "project-1",
      activePresetId: preset.id,
      style
    };
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => list } as Response)
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => preset } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => preset } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => apply } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => list } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(listStylePresets("project-1", baseUrl)).resolves.toEqual(list);
    await expect(createStylePreset("project-1", { name: "Default", style }, baseUrl)).resolves.toEqual(
      preset
    );
    await expect(
      updateStylePreset("project-1", preset.id, { name: "Default Updated" }, baseUrl)
    ).resolves.toEqual(preset);
    await expect(applyStylePreset("project-1", preset.id, baseUrl)).resolves.toEqual(apply);
    await expect(deleteStylePreset("project-1", preset.id, baseUrl)).resolves.toEqual(list);

    expect(fetchMock).toHaveBeenNthCalledWith(1, `${baseUrl}/projects/project-1/style-presets`, undefined);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${baseUrl}/projects/project-1/style-presets`,
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `${baseUrl}/projects/project-1/style-presets/${preset.id}`,
      expect.objectContaining({ method: "PATCH" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      `${baseUrl}/projects/project-1/style-presets/${preset.id}/apply`,
      { method: "POST" }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      `${baseUrl}/projects/project-1/style-presets/${preset.id}`,
      { method: "DELETE" }
    );
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
