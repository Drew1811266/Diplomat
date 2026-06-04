import { z } from "zod";

export const TaskStatusSchema = z.enum([
  "queued",
  "running",
  "paused",
  "failed",
  "completed",
  "canceled"
]);

export const TaskTypeSchema = z.enum([
  "preflight",
  "extract_audio",
  "chunk_audio",
  "transcribe_chunks",
  "diarize",
  "translate",
  "build_subtitle_draft",
  "export"
]);

export const TaskEventSchema = z.object({
  taskId: z.string().min(1),
  type: TaskTypeSchema,
  status: TaskStatusSchema,
  progress: z.number().min(0).max(1),
  message: z.string(),
  errorCode: z.string().nullable(),
  diagnosticLogPath: z.string().nullable()
});

export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskType = z.infer<typeof TaskTypeSchema>;
export type TaskEvent = z.infer<typeof TaskEventSchema>;
