import { describe, expect, it } from "vitest";
import type { SubtitleLine } from "@diplomat/shared";
import { analyzedDocumentFixture } from "../test/fixtures";
import { validateSubtitleTiming } from "./timingValidation";

const baseLine = analyzedDocumentFixture.lines[0]!;

function line(overrides: Partial<SubtitleLine>): SubtitleLine {
  return {
    ...baseLine,
    id: overrides.id ?? "line-1",
    startMs: overrides.startMs ?? 0,
    endMs: overrides.endMs ?? 1000,
    sourceText: overrides.sourceText ?? "字幕文本",
    translatedText: overrides.translatedText ?? "",
    ...overrides
  };
}

describe("validateSubtitleTiming", () => {
  it("flags negative and reversed timing", () => {
    const result = validateSubtitleTiming([
      line({ id: "line-negative", startMs: -10, endMs: 500 }),
      line({ id: "line-reversed", startMs: 2000, endMs: 1000 })
    ]);

    expect(result.byLineId["line-negative"]?.map((issue) => issue.code)).toContain(
      "negative_time"
    );
    expect(result.byLineId["line-reversed"]?.map((issue) => issue.code)).toContain(
      "end_before_start"
    );
  });

  it("flags too-short and overlong subtitle lines", () => {
    const result = validateSubtitleTiming(
      [
        line({
          id: "line-fast",
          startMs: 1000,
          endMs: 1200,
          sourceText: "A very long subtitle line that cannot be read comfortably"
        })
      ],
      { minDurationMs: 300, maxCharsPerSecond: 18 }
    );

    const codes = result.byLineId["line-fast"]?.map((issue) => issue.code) ?? [];
    expect(codes).toContain("too_short");
    expect(codes).toContain("overlong_text");
  });

  it("flags overlaps on both neighboring lines", () => {
    const result = validateSubtitleTiming([
      line({ id: "line-a", startMs: 1000, endMs: 2400 }),
      line({ id: "line-b", startMs: 2300, endMs: 3600 })
    ]);

    expect(result.byLineId["line-a"]?.map((issue) => issue.code)).toContain("overlap_next");
    expect(result.byLineId["line-b"]?.map((issue) => issue.code)).toContain(
      "overlap_previous"
    );
  });

  it("returns no issues for readable non-overlapping lines", () => {
    const result = validateSubtitleTiming([
      line({ id: "line-a", startMs: 1000, endMs: 2500, sourceText: "短句" }),
      line({ id: "line-b", startMs: 2600, endMs: 4300, sourceText: "第二句字幕" })
    ]);

    expect(result.issues).toHaveLength(0);
    expect(result.byLineId).toEqual({});
  });
});
