import { z } from "zod";

export const ReleaseReadinessSeveritySchema = z.enum(["pass", "warning", "blocker"]);

export const ReleaseReadinessCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  severity: ReleaseReadinessSeveritySchema,
  message: z.string().min(1),
  remediation: z.string().min(1).nullable()
});

export const ReleaseReadinessSummarySchema = z.object({
  pass: z.number().int().nonnegative(),
  warning: z.number().int().nonnegative(),
  blocker: z.number().int().nonnegative()
});

export const ReleaseReadinessResponseSchema = z.object({
  version: z.string().min(1),
  generatedAt: z.string().min(1),
  ready: z.boolean(),
  summary: ReleaseReadinessSummarySchema,
  checks: z.array(ReleaseReadinessCheckSchema)
});

export type ReleaseReadinessSeverity = z.infer<typeof ReleaseReadinessSeveritySchema>;
export type ReleaseReadinessCheck = z.infer<typeof ReleaseReadinessCheckSchema>;
export type ReleaseReadinessSummary = z.infer<typeof ReleaseReadinessSummarySchema>;
export type ReleaseReadinessResponse = z.infer<typeof ReleaseReadinessResponseSchema>;
