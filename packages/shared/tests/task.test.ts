import { describe, expect, it } from "vitest";
import { AnalysisJobRequestSchema, TaskResponseSchema } from "../src/task";

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
      modelNameOrPath: "small",
      device: "cpu",
      computeType: "int8",
      sourceLanguage: "zh",
      initialPrompt: ""
    });

    expect(request.provider).toBe("faster-whisper");
    expect(request.modelNameOrPath).toBe("small");
  });

  it("normalizes optional fake settings", () => {
    const request = AnalysisJobRequestSchema.parse({
      provider: "fake",
      sourceLanguage: "en"
    });

    expect(request).toEqual({
      provider: "fake",
      modelNameOrPath: null,
      device: "cpu",
      computeType: "int8",
      sourceLanguage: "en",
      initialPrompt: null
    });
  });
});
