import { describe, expect, it } from "vitest";
import {
  AnalysisJobRequestSchema,
  TaskListResponseSchema,
  TaskTypeSchema,
  TaskResponseSchema,
  TranslationJobRequestSchema,
  TranslationSettingsResponseSchema
} from "../src/task";

describe("TaskResponseSchema", () => {
  it("accepts waveform tasks", () => {
    expect(TaskTypeSchema.parse("waveform")).toBe("waveform");
  });

  it("accepts a running analysis task", () => {
    const task = TaskResponseSchema.parse({
      taskId: "task-1",
      projectId: "project-1",
      type: "analysis",
      status: "running",
      progress: 0.5,
      message: "Transcribing audio",
      startedAt: "2026-06-07T00:00:00+00:00",
      updatedAt: "2026-06-07T00:00:01+00:00",
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      diagnosticLogPath: null
    });

    expect(task.status).toBe("running");
    expect(task.progress).toBe(0.5);
  });

  it("rejects progress outside 0..1", () => {
    expect(() =>
      TaskResponseSchema.parse({
        taskId: "task-1",
        projectId: "project-1",
        type: "analysis",
        status: "running",
        progress: 1.5,
        message: "bad progress",
        startedAt: "2026-06-07T00:00:00+00:00",
        updatedAt: "2026-06-07T00:00:01+00:00",
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        diagnosticLogPath: null
      })
    ).toThrow();
  });
});

describe("TaskListResponseSchema", () => {
  it("accepts real task queue responses", () => {
    const response = TaskListResponseSchema.parse({
      tasks: [
        {
          taskId: "task-1",
          projectId: "project-1",
          type: "analysis",
          status: "running",
          progress: 0.42,
          message: "Transcribing audio",
          startedAt: "2026-06-07T00:00:00+00:00",
          updatedAt: "2026-06-07T00:00:01+00:00",
          completedAt: null,
          errorCode: null,
          errorMessage: null,
          diagnosticLogPath: null
        },
        {
          taskId: "task-2",
          projectId: "project-2",
          type: "translation",
          status: "failed",
          progress: 0.65,
          message: "Model is not installed",
          startedAt: "2026-06-07T00:02:00+00:00",
          updatedAt: "2026-06-07T00:03:00+00:00",
          completedAt: "2026-06-07T00:03:00+00:00",
          errorCode: "MODEL_NOT_INSTALLED",
          errorMessage: "Model is not installed.",
          diagnosticLogPath: "D:/Diplomat/projects/project-2/logs/task-2.log"
        }
      ]
    });

    expect(response.tasks).toHaveLength(2);
    expect(response.tasks[1]?.status).toBe("failed");
  });
});

describe("AnalysisJobRequestSchema", () => {
  it("accepts faster-whisper model settings", () => {
    const request = AnalysisJobRequestSchema.parse({
      provider: "faster-whisper",
      modelId: "asr.faster-whisper.small",
      modelNameOrPath: "small",
      device: "cpu",
      computeType: "int8",
      sourceLanguage: "zh",
      initialPrompt: ""
    });

    expect(request.provider).toBe("faster-whisper");
    expect(request.modelId).toBe("asr.faster-whisper.small");
    expect(request.modelNameOrPath).toBe("small");
  });

  it("accepts VibeVoice ASR model settings", () => {
    const request = AnalysisJobRequestSchema.parse({
      provider: "vibevoice-asr",
      modelId: "asr.microsoft.vibevoice-asr",
      device: "cuda",
      computeType: "bfloat16"
    });

    expect(request.provider).toBe("vibevoice-asr");
    expect(request.computeType).toBe("bfloat16");
  });

  it("normalizes optional fake settings", () => {
    const request = AnalysisJobRequestSchema.parse({
      provider: "fake",
      sourceLanguage: "en"
    });

    expect(request).toEqual({
      provider: "fake",
      modelId: null,
      modelNameOrPath: null,
      device: "cpu",
      computeType: "int8",
      sourceLanguage: "en",
      initialPrompt: null
    });
  });
});

describe("TranslationJobRequestSchema", () => {
  it("parses translation job requests with defaults", () => {
    expect(
      TranslationJobRequestSchema.parse({
        sourceLanguage: "en",
        targetLanguage: "zh"
      })
    ).toEqual({
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
      batchSize: 8,
      glossary: []
    });
  });

  it("accepts curated local translation model settings", () => {
    const request = TranslationJobRequestSchema.parse({
      provider: "ct2-marian",
      modelId: "translation.opus-mt.zh-en",
      sourceLanguage: "zh",
      targetLanguage: "en",
      mode: "missing_only",
      device: "cuda",
      computeType: "float16",
      batchSize: 16
    });

    expect(request).toMatchObject({
      provider: "ct2-marian",
      modelId: "translation.opus-mt.zh-en",
      modelNameOrPath: null,
      sourceLanguage: "zh",
      targetLanguage: "en",
      device: "cuda",
      computeType: "float16",
      batchSize: 16
    });
  });

  it("parses translation glossary entries on job requests", () => {
    const request = TranslationJobRequestSchema.parse({
      sourceLanguage: "en",
      targetLanguage: "zh",
      glossary: [
        {
          id: "term-1",
          sourceText: "GPU",
          targetText: "GPU",
          sourceLanguage: "en",
          targetLanguage: "zh",
          caseSensitive: false
        }
      ]
    });

    expect(request.glossary[0]?.sourceText).toBe("GPU");
  });
});

describe("TranslationSettingsResponseSchema", () => {
  it("parses translation settings responses", () => {
    const settings = TranslationSettingsResponseSchema.parse({
      projectId: "project-1",
      provider: "fake",
      modelId: null,
      modelNameOrPath: null,
      sourceLanguage: "en",
      targetLanguage: "zh",
      mode: "overwrite_all",
      device: "cpu",
      computeType: "int8",
      endpoint: null,
      apiKeyEnv: null,
      batchSize: 8,
      updatedAt: "2026-06-07T00:00:00+00:00"
    });

    expect(settings.projectId).toBe("project-1");
    expect(settings.mode).toBe("overwrite_all");
  });
});
