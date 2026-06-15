import { z } from "zod";
import { TranslationGlossaryEntrySchema } from "./subtitle";

export const TaskStatusSchema = z.enum([
  "queued",
  "running",
  "canceling",
  "canceled",
  "failed",
  "completed"
]);

export const TaskTypeSchema = z.enum(["analysis", "translation", "waveform", "export"]);

export const AnalysisJobRequestSchema = z.object({
  provider: z.enum(["fake", "faster-whisper"]).default("fake"),
  modelId: z.string().nullable().default(null),
  modelNameOrPath: z.string().nullable().default(null),
  device: z.string().min(1).default("cpu"),
  computeType: z.string().min(1).default("int8"),
  sourceLanguage: z.string().min(2).max(12).nullable().default(null),
  initialPrompt: z.string().nullable().default(null)
});

export const TranslationModeSchema = z.enum(["missing_only", "overwrite_all"]);
export const TranslationProviderSchema = z.enum([
  "fake",
  "libretranslate",
  "ct2-marian",
  "local-llm"
]);

export const TranslationJobRequestSchema = z.object({
  provider: TranslationProviderSchema.default("fake"),
  modelId: z.string().nullable().default(null),
  modelNameOrPath: z.string().nullable().default(null),
  sourceLanguage: z.string().min(2).max(12),
  targetLanguage: z.string().min(2).max(12),
  mode: TranslationModeSchema.default("missing_only"),
  device: z.string().min(1).default("cpu"),
  computeType: z.string().min(1).default("int8"),
  batchSize: z.number().int().positive().default(8),
  endpoint: z.string().nullable().default(null),
  apiKeyEnv: z.string().nullable().default(null),
  glossary: z.array(TranslationGlossaryEntrySchema).default([])
});

export const TranslationSettingsResponseSchema = TranslationJobRequestSchema.extend({
  projectId: z.string().min(1),
  updatedAt: z.string().min(1)
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
export type TranslationMode = z.infer<typeof TranslationModeSchema>;
export type TranslationProvider = z.infer<typeof TranslationProviderSchema>;
export type TranslationJobRequestInput = z.input<typeof TranslationJobRequestSchema>;
export type TranslationJobRequest = z.infer<typeof TranslationJobRequestSchema>;
export type TranslationSettingsResponse = z.infer<typeof TranslationSettingsResponseSchema>;
export type TaskResponse = z.infer<typeof TaskResponseSchema>;
export type TaskEvent = TaskResponse;
