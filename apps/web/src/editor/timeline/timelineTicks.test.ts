import { describe, expect, it } from "vitest";
import { buildTimelineTicks, chooseTimelineTickInterval } from "./timelineTicks";

describe("timelineTicks", () => {
  it("chooses smaller intervals as the timeline gets wider", () => {
    const compact = chooseTimelineTickInterval({
      durationMs: 60_000,
      contentWidthPx: 720
    });
    const expanded = chooseTimelineTickInterval({
      durationMs: 60_000,
      contentWidthPx: 2_400
    });

    expect(expanded).toBeLessThan(compact);
  });

  it("builds ticks with approximately readable pixel spacing", () => {
    const ticks = buildTimelineTicks({
      durationMs: 60_000,
      contentWidthPx: 1_200
    });

    expect(ticks[0]).toMatchObject({ timeMs: 0, x: 0 });
    expect(ticks.at(-1)?.timeMs).toBe(60_000);
    expect(ticks.length).toBeGreaterThan(6);
    const gaps = ticks.slice(1).map((tick, index) => tick.x - ticks[index]!.x);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(80);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(160);
  });
});
