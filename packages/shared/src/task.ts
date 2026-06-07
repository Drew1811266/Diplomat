import { z } from "zod";

export const TaskStatusSchema = z.enum([
  "queued",
  "running",
  "canceling",
  "canceled",
  "failed",
  "completed"
]);

export const TaskTypeSchema = z.enum(["analysis", "translation", "export"]);

export const AnalysisJobRequestSchema = z.object({
  provider: z.enum(["fake", "faster-whisper"]).default("fake"),
  modelNameOrPath: z.string().nullable().default(null),
  device: z.string().min(1).default("cpu"),
  computeType: z.string().min(1).default("int8"),
  sourceLanguage: z.string().min(2).max(12).nullable().default(null),
  initialPrompt: z.string().nullable().default(null)
});

export const TaskResponseSchema = z.object({
  taskId: z.string().min(1),
  projectId: z.string().min(1),
  type: TaskTypeSchema,
  status: TaskStatusSchema,
  progress: z.number().min(0).max(1),
  message: z.string(),
  startedAt: z.string().nullable(),
  updatedAt: z.string().min(1),
  completedAt: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  diagnosticLogPath: z.string().nullable()
});

export const TaskEventSchema = TaskResponseSchema;

export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskType = z.infer<typeof TaskTypeSchema>;
export type AnalysisJobRequestInput = z.input<typeof AnalysisJobRequestSchema>;
export type AnalysisJobRequest = z.infer<typeof AnalysisJobRequestSchema>;
export type TaskResponse = z.infer<typeof TaskResponseSchema>;
export type TaskEvent = TaskResponse;
