import { describe, expect, it } from "vitest";
import type { SubtitleLine } from "@diplomat/shared";
import { getVisibleSubtitleLineEntries } from "./visibleSubtitleRange";

function line(id: string, startMs: number, endMs: number): SubtitleLine {
  return {
    id,
    startMs,
    endMs,
    speakerId: null,
    sourceLanguage: "en",
    targetLanguage: "zh",
    sourceText: id,
    translatedText: "",
    words: [],
    styleOverrides: {},
    aiOrigin: { engine: "test", model: "test" },
    translationStatus: "not_requested",
    translationOrigin: null,
    translationError: null,
    reviewStatus: "draft",
    notes: "",
    translationQualityIssues: []
  };
}

describe("getVisibleSubtitleLineEntries", () => {
  it("returns subtitle lines that overlap the visible range plus overscan", () => {
    const lines = [
      line("outside-before", 0, 900),
      line("overscan-before", 1300, 1800),
      line("visible", 2200, 3000),
      line("overscan-after", 4400, 5000),
      line("outside-after", 4700, 5200)
    ];

    const entries = getVisibleSubtitleLineEntries(lines, {
      startMs: 2000,
      endMs: 4000,
      overscanMs: 500
    });

    expect(entries.map((entry) => entry.line.id)).toEqual(["overscan-before", "visible", "overscan-after"]);
    expect(entries.map((entry) => entry.originalIndex)).toEqual([1, 2, 3]);
  });

  it("normalizes reversed ranges and ignores negative overscan", () => {
    const lines = [line("before", 0, 900), line("inside", 1000, 2000), line("after", 2200, 3000)];

    const entries = getVisibleSubtitleLineEntries(lines, {
      startMs: 2100,
      endMs: 900,
      overscanMs: -1000
    });

    expect(entries.map((entry) => entry.line.id)).toEqual(["inside"]);
  });
});
