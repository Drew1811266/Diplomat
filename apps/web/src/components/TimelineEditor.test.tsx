import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SubtitleLine, WaveformResponse } from "@diplomat/shared";
import { analyzedDocumentFixture } from "../test/fixtures";
import { renderWithProviders } from "../test/render";
import { TimelineEditor } from "./TimelineEditor";

const baseLine = analyzedDocumentFixture.lines[0]!;

function stubMatchMedia() {
  vi.stubGlobal("PointerEvent", window.MouseEvent);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

function line(overrides: Partial<SubtitleLine>): SubtitleLine {
  return {
    ...baseLine,
    id: overrides.id ?? "line-1",
    startMs: overrides.startMs ?? 1000,
    endMs: overrides.endMs ?? 2000,
    sourceText: overrides.sourceText ?? "字幕文本",
    translatedText: overrides.translatedText ?? "",
    ...overrides
  };
}

const waveform: WaveformResponse = {
  projectId: "project-1",
  durationMs: 5000,
  sampleRate: 8000,
  peakCount: 2,
  peaks: [
    { index: 0, startMs: 0, endMs: 2500, min: -0.25, max: 0.75 },
    { index: 1, startMs: 2500, endMs: 5000, min: -0.5, max: 0.5 }
  ]
};

function makeManyLines(count: number): SubtitleLine[] {
  return Array.from({ length: count }, (_, index) =>
    line({
      id: `line-${index + 1}`,
      startMs: index * 1000,
      endMs: index * 1000 + 600,
      sourceText: `Subtitle ${index + 1}`
    })
  );
}

function renderTimeline(overrides: Partial<Parameters<typeof TimelineEditor>[0]> = {}) {
  const props = {
    durationMs: 5000,
    currentTimeMs: 1000,
    lines: [line({ id: "line-1", startMs: 1000, endMs: 2000 })],
    waveform,
    selectedLineId: "line-1",
    activeLineId: "line-1",
    timingIssuesByLineId: {},
    onSelectLine: vi.fn(),
    onSeek: vi.fn(),
    onChangeLine: vi.fn(),
    ...overrides
  };
  renderWithProviders(<TimelineEditor {...props} />);
  const track = screen.getByTestId("timeline-track");
  vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1000,
    bottom: 160,
    width: 1000,
    height: 160,
    toJSON: () => ({})
  });
  return props;
}

beforeEach(() => {
  stubMatchMedia();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TimelineEditor", () => {
  it("renders waveform, zoom control, playhead, and subtitle blocks", () => {
    renderTimeline();

    expect(screen.getByRole("region", { name: "Timeline editor" })).toBeVisible();
    expect(screen.getByLabelText("Zoom timeline")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-waveform")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-playhead")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Timeline block line-1" })).toBeInTheDocument();
  });

  it("clicks the timeline background to request seek", () => {
    const props = renderTimeline();

    fireEvent.pointerDown(screen.getByTestId("timeline-track"), {
      clientX: 500,
      pointerId: 1
    });

    expect(props.onSeek).toHaveBeenCalledWith(3150);
  });

  it("selects and moves subtitle blocks with snapped drag deltas", () => {
    const props = renderTimeline();
    const block = screen.getByRole("button", { name: "Timeline block line-1" });

    fireEvent.pointerDown(block, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(screen.getByTestId("timeline-track"), { clientX: 220, pointerId: 1 });
    fireEvent.pointerMove(screen.getByTestId("timeline-track"), { clientX: 240, pointerId: 1 });

    expect(props.onChangeLine).not.toHaveBeenCalled();

    fireEvent.pointerUp(screen.getByTestId("timeline-track"), { clientX: 220, pointerId: 1 });

    expect(props.onSelectLine).toHaveBeenCalledWith("line-1");
    expect(props.onChangeLine).toHaveBeenCalledTimes(1);
    expect(props.onChangeLine).toHaveBeenCalledWith(
      expect.objectContaining({ id: "line-1", startMs: 1250, endMs: 2250 })
    );
  });

  it("resizes subtitle block edges independently", () => {
    const props = renderTimeline();

    fireEvent.pointerDown(screen.getByLabelText("Resize start for line-1"), {
      clientX: 200,
      pointerId: 1
    });
    fireEvent.pointerMove(screen.getByTestId("timeline-track"), { clientX: 220, pointerId: 1 });
    fireEvent.pointerUp(screen.getByTestId("timeline-track"), { clientX: 220, pointerId: 1 });

    fireEvent.pointerDown(screen.getByLabelText("Resize end for line-1"), {
      clientX: 400,
      pointerId: 2
    });
    fireEvent.pointerMove(screen.getByTestId("timeline-track"), { clientX: 420, pointerId: 2 });
    fireEvent.pointerUp(screen.getByTestId("timeline-track"), { clientX: 420, pointerId: 2 });

    expect(props.onChangeLine).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: "line-1", startMs: 1150, endMs: 2000 })
    );
    expect(props.onChangeLine).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: "line-1", startMs: 1000, endMs: 2150 })
    );
  });

  it("renders only the subtitle blocks near the visible timeline viewport", () => {
    renderTimeline({
      durationMs: 60_000,
      currentTimeMs: 0,
      lines: makeManyLines(100),
      waveform: null,
      selectedLineId: null,
      activeLineId: null
    });

    const track = screen.getByTestId("timeline-track");
    Object.defineProperty(track, "scrollLeft", { value: 0, configurable: true });

    fireEvent.scroll(track);

    expect(screen.getByTestId("timeline-block-line-1")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-block-line-80")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^timeline-block-/)).toHaveLength(9);
  });
});
