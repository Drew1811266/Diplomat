import { describe, expect, it } from "vitest";
import {
  AnalysisJobRequestSchema,
  TaskResponseSchema,
  TranslationJobRequestSchema,
  TranslationSettingsResponseSchema
} from "../src/task";

describe("TaskResponseSchema", () => {
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
      apiKeyEnv: null
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
      computeType: "float16"
    });

    expect(request).toMatchObject({
      provider: "ct2-marian",
      modelId: "translation.opus-mt.zh-en",
      modelNameOrPath: null,
      sourceLanguage: "zh",
      targetLanguage: "en",
      device: "cuda",
      computeType: "float16"
    });
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
      updatedAt: "2026-06-07T00:00:00+00:00"
    });

    expect(settings.projectId).toBe("project-1");
    expect(settings.mode).toBe("overwrite_all");
  });
});
