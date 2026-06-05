import { describe, expect, it } from "vitest";
import { SrtExportRequestSchema, SrtExportResponseSchema } from "../src/export";

describe("SrtExportRequestSchema", () => {
  it("defaults the export mode to bilingual", () => {
    const request = SrtExportRequestSchema.parse({});

    expect(request.mode).toBe("bilingual");
  });

  it("rejects an invalid export mode", () => {
    expect(() => SrtExportRequestSchema.parse({ mode: "audio" })).toThrow();
  });
});

describe("SrtExportResponseSchema", () => {
  it("accepts a valid SRT export response", () => {
    const response = SrtExportResponseSchema.parse({
      projectId: "project-1",
      exportPath: "D:/Diplomat/projects/project-1/export.srt",
      mode: "target"
    });

    expect(response.projectId).toBe("project-1");
    expect(response.mode).toBe("target");
  });
});
