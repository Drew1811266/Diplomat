import { describe, expect, it } from "vitest";
import {
  BurnInExportRequestSchema,
  StylePresetCreateRequestSchema,
  StylePresetListResponseSchema,
  SubtitleExportRequestSchema,
  SubtitleExportResponseSchema,
  SrtExportRequestSchema,
  SrtExportResponseSchema
} from "../src/export";

const style = {
  id: "default",
  name: "Default",
  fontFamily: "Arial",
  fontSize: 42,
  primaryColor: "#ffffff",
  secondaryColor: "#14b8a6",
  strokeWidth: 2,
  shadow: 1,
  position: "bottom",
  marginV: 48,
  alignment: "center",
  bilingualLayout: "source_top",
  lineSpacing: 1.1,
  backgroundBar: true,
  backgroundColor: "#000000cc",
  safeAreaMargin: 32
};

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

describe("SubtitleExportRequestSchema", () => {
  it("parses general subtitle export requests and warning responses", () => {
    const request = SubtitleExportRequestSchema.parse({
      format: "ass",
      mode: "bilingual",
      stylePresetId: "preset-default",
      style
    });

    const response = SubtitleExportResponseSchema.parse({
      projectId: "project-demo",
      exportPath: "D:/Diplomat/projects/project-demo/exports/subtitle-bilingual.ass",
      format: request.format,
      mode: request.mode,
      warnings: [
        {
          lineId: "line-1",
          code: "too_short",
          severity: "warning",
          message: "Cue is shorter than 300ms."
        }
      ]
    });

    expect(response.format).toBe("ass");
    expect(response.warnings[0]?.code).toBe("too_short");
  });

  it("defaults to SRT bilingual export without a preset or inline style", () => {
    const request = SubtitleExportRequestSchema.parse({});

    expect(request.format).toBe("srt");
    expect(request.mode).toBe("bilingual");
    expect(request.stylePresetId).toBeNull();
    expect(request.style).toBeNull();
  });
});

describe("StylePreset schemas", () => {
  it("parses style preset requests and list responses", () => {
    const create = StylePresetCreateRequestSchema.parse({ name: "Broadcast", style });
    const list = StylePresetListResponseSchema.parse({
      projectId: "project-demo",
      activePresetId: "preset-default",
      presets: [
        {
          id: "preset-default",
          name: create.name,
          style,
          createdAt: "2026-06-14T00:00:00+00:00",
          updatedAt: "2026-06-14T00:00:00+00:00"
        }
      ]
    });

    expect(list.presets[0]?.style.backgroundBar).toBe(true);
  });
});

describe("BurnInExportRequestSchema", () => {
  it("parses burn-in export requests with defaults", () => {
    const request = BurnInExportRequestSchema.parse({});

    expect(request.mode).toBe("bilingual");
    expect(request.stylePresetId).toBeNull();
    expect(request.style).toBeNull();
    expect(request.outputPath).toBeNull();
    expect(request.videoCodec).toBe("libx264");
    expect(request.crf).toBe(18);
    expect(request.preset).toBe("medium");
  });

  it("parses burn-in export requests with an inline style", () => {
    const request = BurnInExportRequestSchema.parse({
      mode: "target",
      stylePresetId: "preset-broadcast",
      outputPath: "D:/Diplomat/exports/custom.mp4",
      style,
      videoCodec: "libx264",
      crf: 20,
      preset: "fast"
    });

    expect(request.mode).toBe("target");
    expect(request.style?.fontFamily).toBe(style.fontFamily);
  });
});
