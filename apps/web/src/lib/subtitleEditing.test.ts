import { describe, expect, it } from "vitest";
import type { SubtitleDocument, SubtitleLine } from "@diplomat/shared";
import {
  isEditableShortcutTarget,
  mergeSubtitleLine,
  offsetSubtitleLines,
  redoHistory,
  splitSubtitleLine,
  undoHistory,
  updateHistory
} from "./subtitleEditing";

function line(overrides: Partial<SubtitleLine>): SubtitleLine {
  return {
    id: "line-1",
    startMs: 1000,
    endMs: 2500,
    speakerId: null,
    sourceLanguage: "zh",
    targetLanguage: "en",
    sourceText: "第一句 第二句",
    translatedText: "First sentence Second sentence",
    words: [],
    styleOverrides: {},
    reviewStatus: "draft",
    aiOrigin: { engine: "fake-asr", model: "fake-v1" },
    translationStatus: "not_requested",
    translationOrigin: null,
    translationError: null,
    notes: "",
    ...overrides
  };
}

function documentWith(lines: SubtitleLine[]): SubtitleDocument {
  return {
    schemaVersion: "diplomat.subtitle.v1",
    projectId: "project-1",
    mediaId: "media-1",
    durationMs: 10_000,
    speakers: [],
    styles: [],
    lines
  };
}

describe("subtitle editing helpers", () => {
  it("splits the selected subtitle line at the playhead", () => {
    const original = documentWith([line({ id: "line-1" })]);
    const next = splitSubtitleLine(original, "line-1", 1400);

    expect(next.lines).toHaveLength(2);
    expect(next.lines[0]).toMatchObject({ id: "line-1", startMs: 1000, endMs: 1400 });
    expect(next.lines[1]).toMatchObject({ id: "line-1-split-1", startMs: 1400, endMs: 2500 });
    expect(next.lines[1]?.sourceText).toBe("第二句");
  });

  it("merges with the next line", () => {
    const original = documentWith([
      line({ id: "line-1", startMs: 1000, endMs: 1600, sourceText: "First" }),
      line({ id: "line-2", startMs: 1600, endMs: 2500, sourceText: "Second" })
    ]);

    const next = mergeSubtitleLine(original, "line-1", "next");

    expect(next.lines).toHaveLength(1);
    expect(next.lines[0]).toMatchObject({
      id: "line-1",
      startMs: 1000,
      endMs: 2500,
      sourceText: "First Second"
    });
  });

  it("offsets only lines after the playhead", () => {
    const original = documentWith([
      line({ id: "line-1", startMs: 500, endMs: 1000 }),
      line({ id: "line-2", startMs: 1600, endMs: 2500 })
    ]);

    const next = offsetSubtitleLines(original, {
      scope: "after_playhead",
      selectedLineId: "line-1",
      currentTimeMs: 1500,
      offsetMs: 250
    });

    expect(next.lines[0]).toMatchObject({ startMs: 500, endMs: 1000 });
    expect(next.lines[1]).toMatchObject({ startMs: 1850, endMs: 2750 });
  });

  it("clamps negative offsets at zero while preserving duration", () => {
    const original = documentWith([line({ id: "line-1", startMs: 100, endMs: 700 })]);

    const next = offsetSubtitleLines(original, {
      scope: "selected",
      selectedLineId: "line-1",
      currentTimeMs: 0,
      offsetMs: -250
    });

    expect(next.lines[0]).toMatchObject({ startMs: 0, endMs: 600 });
  });

  it("updates undo and redo history", () => {
    const original = documentWith([line({ sourceText: "Original" })]);
    const edited = documentWith([line({ sourceText: "Edited" })]);

    const pushed = updateHistory(
      { past: [], present: original, future: [] },
      edited
    );
    const undone = undoHistory(pushed);
    const redone = redoHistory(undone);

    expect(pushed.past).toHaveLength(1);
    expect(undone.present.lines[0]?.sourceText).toBe("Original");
    expect(redone.present.lines[0]?.sourceText).toBe("Edited");
  });

  it("blocks shortcuts in editable targets", () => {
    const textarea = document.createElement("textarea");
    const input = document.createElement("input");
    const button = document.createElement("button");
    const region = document.createElement("section");
    region.setAttribute("contenteditable", "true");

    expect(isEditableShortcutTarget(textarea)).toBe(true);
    expect(isEditableShortcutTarget(input)).toBe(true);
    expect(isEditableShortcutTarget(button)).toBe(true);
    expect(isEditableShortcutTarget(region)).toBe(true);
    expect(isEditableShortcutTarget(document.createElement("div"))).toBe(false);
  });
});
