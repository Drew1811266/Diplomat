import { z } from "zod";
import { SubtitleDocumentSchema } from "./subtitle";

const LanguageCodeSchema = z.string().min(2).max(12);

export const ProjectStatusSchema = z.enum([
  "not_transcribed",
  "transcribed",
  "translated",
  "dirty_draft",
  "exported",
  "failed",
  "corrupted",
  "migration_failed"
]);

export const ProjectWarningCodeSchema = z.enum([
  "source_missing",
  "project_dir_missing",
  "subtitle_corrupted",
  "unsafe_project_path",
  "migration_failed"
]);

export const ProjectWarningSchema = z.object({
  code: ProjectWarningCodeSchema,
  message: z.string().min(1)
});

export const ProjectDiagnosticsSchema = z.object({
  status: ProjectStatusSchema,
  warnings: z.array(ProjectWarningSchema),
  sourceVideoExists: z.boolean(),
  projectDirExists: z.boolean(),
  diskUsageBytes: z.number().int().nonnegative(),
  cacheUsageBytes: z.number().int().nonnegative(),
  exportUsageBytes: z.number().int().nonnegative(),
  exportCount: z.number().int().nonnegative(),
  subtitleLineCount: z.number().int().nonnegative(),
  translatedLineCount: z.number().int().nonnegative(),
  activeTaskCount: z.number().int().nonnegative(),
  failedTaskCount: z.number().int().nonnegative(),
  latestTaskStatus: z.string().nullable(),
  exportsDir: z.string().min(1),
  cacheDir: z.string().min(1),
  logsDir: z.string().min(1),
  backupsDir: z.string().min(1)
});

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1),
  sourceVideoPath: z.string().min(1),
  sourceLanguage: LanguageCodeSchema,
  targetLanguage: LanguageCodeSchema.nullable().default(null)
});

export const ProjectResponseSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  sourceVideoPath: z.string().min(1),
  projectDir: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  sourceLanguage: z.string(),
  targetLanguage: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  hasSubtitleDocument: z.boolean(),
  diagnostics: ProjectDiagnosticsSchema
});

export const ProjectListResponseSchema = z.object({
  projects: z.array(ProjectResponseSchema)
});

export const ProjectMaintenanceActionSchema = z.enum([
  "delete",
  "cleanup_cache",
  "cleanup_exports",
  "import"
]);

export const ProjectMaintenanceResponseSchema = z.object({
  projectId: z.string().min(1),
  action: ProjectMaintenanceActionSchema,
  filesAffected: z.number().int().nonnegative(),
  bytesAffected: z.number().int().nonnegative(),
  message: z.string().min(1)
});

export const ProjectBackupResponseSchema = z.object({
  projectId: z.string().min(1),
  packagePath: z.string().min(1),
  bytesWritten: z.number().int().nonnegative(),
  message: z.string().min(1)
});

export const ProjectImportRequestSchema = z.object({
  packagePath: z.string().min(1),
  restoreName: z.string().min(1).nullable().default(null)
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

export const SubtitleDraftResponseSchema = z.object({
  projectId: z.string().min(1),
  updatedAt: z.string().min(1),
  lineCount: z.number().int().nonnegative(),
  document: SubtitleDocumentSchema
});

export const SubtitleSnapshotReasonSchema = z.enum([
  "manual",
  "analysis_overwrite",
  "translation_overwrite",
  "batch_timing",
  "burn_in_export_preparation",
  "restore"
]);

export const SubtitleSnapshotSummarySchema = z.object({
  snapshotId: z.string().min(1),
  projectId: z.string().min(1),
  reason: SubtitleSnapshotReasonSchema,
  label: z.string().min(1).nullable(),
  createdAt: z.string().min(1),
  lineCount: z.number().int().nonnegative()
});

export const SubtitleSnapshotResponseSchema = SubtitleSnapshotSummarySchema.extend({
  document: SubtitleDocumentSchema
});

export const SubtitleSnapshotListResponseSchema = z.object({
  projectId: z.string().min(1),
  snapshots: z.array(SubtitleSnapshotSummarySchema)
});

export const SubtitleSnapshotCreateRequestSchema = z.object({
  reason: SubtitleSnapshotReasonSchema.default("manual"),
  label: z.string().min(1).nullable().default(null),
  document: SubtitleDocumentSchema.nullable().default(null)
});

export const WaveformPeakSchema = z
  .object({
    index: z.number().int().nonnegative(),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    min: z.number().min(-1).max(1),
    max: z.number().min(-1).max(1)
  })
  .refine((peak) => peak.endMs >= peak.startMs, {
    message: "waveform peak endMs must be greater than or equal to startMs"
  });

export const WaveformResponseSchema = z
  .object({
    projectId: z.string().min(1),
    durationMs: z.number().int().nonnegative(),
    sampleRate: z.number().int().positive(),
    peakCount: z.number().int().nonnegative(),
    peaks: z.array(WaveformPeakSchema)
  })
  .refine((payload) => payload.peakCount === payload.peaks.length, {
    message: "waveform peakCount must match peaks length"
  });

export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectWarningCode = z.infer<typeof ProjectWarningCodeSchema>;
export type ProjectWarning = z.infer<typeof ProjectWarningSchema>;
export type ProjectDiagnostics = z.infer<typeof ProjectDiagnosticsSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;
export type ProjectMaintenanceAction = z.infer<typeof ProjectMaintenanceActionSchema>;
export type ProjectMaintenanceResponse = z.infer<typeof ProjectMaintenanceResponseSchema>;
export type ProjectBackupResponse = z.infer<typeof ProjectBackupResponseSchema>;
export type ProjectImportRequest = z.infer<typeof ProjectImportRequestSchema>;
export type AnalyzeProjectResponse = z.infer<typeof AnalyzeProjectResponseSchema>;
export type SubtitleDocumentRequest = z.infer<typeof SubtitleDocumentRequestSchema>;
export type SubtitleDraftResponse = z.infer<typeof SubtitleDraftResponseSchema>;
export type SubtitleSnapshotReason = z.infer<typeof SubtitleSnapshotReasonSchema>;
export type SubtitleSnapshotSummary = z.infer<typeof SubtitleSnapshotSummarySchema>;
export type SubtitleSnapshotResponse = z.infer<typeof SubtitleSnapshotResponseSchema>;
export type SubtitleSnapshotListResponse = z.infer<typeof SubtitleSnapshotListResponseSchema>;
export type SubtitleSnapshotCreateRequest = z.infer<typeof SubtitleSnapshotCreateRequestSchema>;
export type WaveformPeak = z.infer<typeof WaveformPeakSchema>;
export type WaveformResponse = z.infer<typeof WaveformResponseSchema>;
