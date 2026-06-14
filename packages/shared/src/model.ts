import { z } from "zod";

export const ModelTaskSchema = z.enum(["asr", "translation"]);
export const ModelTierSchema = z.enum(["light", "high_quality"]);
export const ModelRuntimeSchema = z.enum(["faster-whisper", "ct2-marian", "local-llm"]);
export const ModelInstallStatusSchema = z.enum([
  "not_installed",
  "queued",
  "downloading",
  "verifying",
  "installed",
  "failed",
  "canceled"
]);

export const ModelRegistryEntrySchema = z.object({
  modelId: z.string().min(1),
  name: z.string().min(1),
  task: ModelTaskSchema,
  tier: ModelTierSchema,
  runtime: ModelRuntimeSchema,
  provider: z.string().min(1),
  version: z.string().min(1),
  languages: z.array(z.string().min(2).max(12)),
  languagePairs: z.array(z.tuple([z.string().min(2).max(12), z.string().min(2).max(12)])),
  modelSizeBytes: z.number().int().nonnegative(),
  downloadSizeBytes: z.number().int().nonnegative(),
  diskRequirementBytes: z.number().int().nonnegative(),
  recommendedHardware: z.string().min(1),
  licenseName: z.string().min(1),
  licenseUrl: z.string().min(1),
  sourceUrl: z.string().min(1),
  checksumAlgorithm: z.literal("sha256"),
  checksum: z.string().min(64),
  termsSummary: z.string().min(1)
});

export const ModelInstallationSchema = z.object({
  modelId: z.string().min(1),
  status: ModelInstallStatusSchema,
  installedPath: z.string().nullable(),
  downloadedBytes: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  checksum: z.string().min(1),
  errorMessage: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  installedAt: z.string().nullable()
});

export const ModelAvailabilitySchema = z.object({
  usable: z.boolean(),
  reason: z.string().nullable()
});

export const ModelCatalogEntrySchema = ModelRegistryEntrySchema.extend({
  installation: ModelInstallationSchema,
  availability: ModelAvailabilitySchema
});

export const ModelCatalogResponseSchema = z.object({
  models: z.array(ModelCatalogEntrySchema)
});

export const ModelDownloadResponseSchema = z.object({
  modelId: z.string().min(1),
  status: ModelInstallStatusSchema,
  downloadedBytes: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  message: z.string().min(1)
});

export const ModelDeleteResponseSchema = z.object({
  modelId: z.string().min(1),
  filesDeleted: z.number().int().nonnegative(),
  bytesDeleted: z.number().int().nonnegative(),
  message: z.string().min(1)
});

export type ModelTask = z.infer<typeof ModelTaskSchema>;
export type ModelTier = z.infer<typeof ModelTierSchema>;
export type ModelRuntime = z.infer<typeof ModelRuntimeSchema>;
export type ModelInstallStatus = z.infer<typeof ModelInstallStatusSchema>;
export type ModelRegistryEntry = z.infer<typeof ModelRegistryEntrySchema>;
export type ModelInstallation = z.infer<typeof ModelInstallationSchema>;
export type ModelAvailability = z.infer<typeof ModelAvailabilitySchema>;
export type ModelCatalogEntry = z.infer<typeof ModelCatalogEntrySchema>;
export type ModelCatalogResponse = z.infer<typeof ModelCatalogResponseSchema>;
export type ModelDownloadResponse = z.infer<typeof ModelDownloadResponseSchema>;
export type ModelDeleteResponse = z.infer<typeof ModelDeleteResponseSchema>;
