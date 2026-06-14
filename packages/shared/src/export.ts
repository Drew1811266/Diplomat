import { z } from "zod";
import { SubtitleStyleSchema } from "./subtitle";

export const SubtitleExportFormatSchema = z.enum(["srt", "vtt", "ass"]);
export const SubtitleExportModeSchema = z.enum(["source", "target", "bilingual"]);

export const ExportValidationCodeSchema = z.enum([
  "negative_time",
  "end_before_start",
  "too_short",
  "overlap_previous",
  "overlap_next",
  "overlong_text"
]);

export const ExportValidationIssueSchema = z.object({
  lineId: z.string().min(1),
  code: ExportValidationCodeSchema,
  severity: z.enum(["warning", "error"]),
  message: z.string().min(1)
});

export const SubtitleExportRequestSchema = z.object({
  format: SubtitleExportFormatSchema.default("srt"),
  mode: SubtitleExportModeSchema.default("bilingual"),
  stylePresetId: z.string().min(1).nullable().default(null),
  style: SubtitleStyleSchema.nullable().default(null)
});

export const SubtitleExportResponseSchema = z.object({
  projectId: z.string().min(1),
  exportPath: z.string().min(1),
  format: SubtitleExportFormatSchema,
  mode: SubtitleExportModeSchema,
  warnings: z.array(ExportValidationIssueSchema).default([])
});

export const StylePresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  style: SubtitleStyleSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const StylePresetListResponseSchema = z.object({
  projectId: z.string().min(1),
  activePresetId: z.string().min(1).nullable(),
  presets: z.array(StylePresetSchema)
});

export const StylePresetCreateRequestSchema = z.object({
  name: z.string().min(1),
  style: SubtitleStyleSchema
});

export const StylePresetUpdateRequestSchema = z.object({
  name: z.string().min(1).optional(),
  style: SubtitleStyleSchema.optional()
});

export const StylePresetApplyResponseSchema = z.object({
  projectId: z.string().min(1),
  activePresetId: z.string().min(1),
  style: SubtitleStyleSchema
});

export const SrtExportModeSchema = SubtitleExportModeSchema;

export const SrtExportRequestSchema = z.object({
  mode: SrtExportModeSchema.default("bilingual")
});

export const SrtExportResponseSchema = z.object({
  projectId: z.string().min(1),
  exportPath: z.string().min(1),
  mode: SrtExportModeSchema
});

export type SubtitleExportFormat = z.infer<typeof SubtitleExportFormatSchema>;
export type SubtitleExportMode = z.infer<typeof SubtitleExportModeSchema>;
export type ExportValidationCode = z.infer<typeof ExportValidationCodeSchema>;
export type ExportValidationIssue = z.infer<typeof ExportValidationIssueSchema>;
export type SubtitleExportRequest = z.infer<typeof SubtitleExportRequestSchema>;
export type SubtitleExportResponse = z.infer<typeof SubtitleExportResponseSchema>;
export type StylePreset = z.infer<typeof StylePresetSchema>;
export type StylePresetListResponse = z.infer<typeof StylePresetListResponseSchema>;
export type StylePresetCreateRequest = z.infer<typeof StylePresetCreateRequestSchema>;
export type StylePresetUpdateRequest = z.infer<typeof StylePresetUpdateRequestSchema>;
export type StylePresetApplyResponse = z.infer<typeof StylePresetApplyResponseSchema>;
export type SrtExportMode = z.infer<typeof SrtExportModeSchema>;
export type SrtExportRequest = z.infer<typeof SrtExportRequestSchema>;
export type SrtExportResponse = z.infer<typeof SrtExportResponseSchema>;
