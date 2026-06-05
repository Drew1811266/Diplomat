import { z } from "zod";
import { SubtitleDocumentSchema } from "./subtitle";

const LanguageCodeSchema = z.string().min(2).max(12);

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1),
  sourceVideoPath: z.string().min(1),
  sourceLanguage: LanguageCodeSchema,
  targetLanguage: LanguageCodeSchema.nullable()
});

export const ProjectResponseSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  sourceVideoPath: z.string().min(1),
  projectDir: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  sourceLanguage: LanguageCodeSchema,
  targetLanguage: LanguageCodeSchema.nullable()
});

export const AnalyzeProjectResponseSchema = z.object({
  projectId: z.string().min(1),
  status: z.literal("completed"),
  subtitlePath: z.string().min(1),
  lineCount: z.number().int().nonnegative(),
  document: SubtitleDocumentSchema
});

export const SubtitleDocumentRequestSchema = z.object({
  document: SubtitleDocumentSchema
});

export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type AnalyzeProjectResponse = z.infer<typeof AnalyzeProjectResponseSchema>;
export type SubtitleDocumentRequest = z.infer<typeof SubtitleDocumentRequestSchema>;
