import { describe, expect, it } from "vitest";
import { TaskEventSchema } from "../src/task";

describe("TaskEventSchema", () => {
  it("accepts a running task progress event", () => {
    const event = TaskEventSchema.parse({
      taskId: "task-1",
      type: "transcribe_chunks",
      status: "running",
      progress: 0.5,
      message: "Transcribing chunk 3 of 6",
      errorCode: null,
      diagnosticLogPath: null
    });

    expect(event.status).toBe("running");
    expect(event.progress).toBe(0.5);
  });

  it("rejects progress outside 0..1", () => {
    expect(() =>
      TaskEventSchema.parse({
        taskId: "task-1",
        type: "transcribe_chunks",
        status: "running",
        progress: 1.5,
        message: "bad progress",
        errorCode: null,
        diagnosticLogPath: null
      })
    ).toThrow();
  });
});
