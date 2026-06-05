import { z } from "zod";

export const SrtExportModeSchema = z.enum(["source", "target", "bilingual"]);

export const SrtExportRequestSchema = z.object({
  mode: SrtExportModeSchema.default("bilingual")
});

export const SrtExportResponseSchema = z.object({
  projectId: z.string().min(1),
  exportPath: z.string().min(1),
  mode: SrtExportModeSchema
});

export type SrtExportMode = z.infer<typeof SrtExportModeSchema>;
export type SrtExportRequest = z.infer<typeof SrtExportRequestSchema>;
export type SrtExportResponse = z.infer<typeof SrtExportResponseSchema>;
