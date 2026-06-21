import { describe, expect, it } from "vitest";
import { TimelineClock } from "./TimelineClock";

describe("TimelineClock", () => {
  it("converts between time and x using content width", () => {
    const clock = new TimelineClock({ durationMs: 10_000, contentWidthPx: 1_000 });

    expect(clock.timeToX(5_000)).toBe(500);
    expect(clock.xToTime(250)).toBe(2_500);
  });

  it("converts pixel deltas independently from viewport width", () => {
    const clock = new TimelineClock({ durationMs: 10_000, contentWidthPx: 2_000 });

    expect(clock.deltaPxToMs(100)).toBe(500);
  });

  it("clamps x positions to duration", () => {
    const clock = new TimelineClock({ durationMs: 10_000, contentWidthPx: 1_000 });

    expect(clock.xToTime(-50)).toBe(0);
    expect(clock.xToTime(1_500)).toBe(10_000);
  });
});
