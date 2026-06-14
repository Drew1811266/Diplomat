import { describe, expect, it } from "vitest";
import { ReleaseReadinessResponseSchema } from "../src";

describe("release readiness contracts", () => {
  it("parses release readiness reports with blockers and warnings", () => {
    const report = ReleaseReadinessResponseSchema.parse({
      version: "0.3.0",
      generatedAt: "2026-06-14T00:00:00+00:00",
      ready: false,
      summary: { pass: 1, warning: 1, blocker: 1 },
      checks: [
        {
          id: "version_metadata",
          label: "Version metadata",
          severity: "pass",
          message: "All version metadata matches 0.3.0.",
          remediation: null
        },
        {
          id: "model_registry_checksums",
          label: "Model registry checksums",
          severity: "blocker",
          message: "Placeholder checksums remain.",
          remediation: "Replace placeholders with audited package checksums."
        },
        {
          id: "ffmpeg_available",
          label: "FFmpeg",
          severity: "warning",
          message: "FFmpeg is not bundled in development.",
          remediation: "Verify release binary distribution."
        }
      ]
    });

    expect(report.ready).toBe(false);
    expect(report.summary.blocker).toBe(1);
    expect(report.checks.map((check) => check.severity)).toEqual([
      "pass",
      "blocker",
      "warning"
    ]);
  });
});
