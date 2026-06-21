type TimelineTickOptions = {
  durationMs: number;
  contentWidthPx: number;
};

export type TimelineTick = {
  timeMs: number;
  x: number;
};

const tickIntervalsMs = [
  50,
  100,
  250,
  500,
  1_000,
  2_000,
  5_000,
  10_000,
  30_000,
  60_000,
  120_000,
  300_000,
  600_000
];

const targetTickSpacingPx = 100;
const minReadableTickSpacingPx = 80;
const maxReadableTickSpacingPx = 160;

export function chooseTimelineTickInterval(options: TimelineTickOptions) {
  const durationMs = Math.max(1, options.durationMs);
  const contentWidthPx = Math.max(1, options.contentWidthPx);
  const msPerPixel = durationMs / contentWidthPx;

  const readableIntervals = tickIntervalsMs.filter((intervalMs) => {
    const spacingPx = intervalMs / msPerPixel;
    return spacingPx >= minReadableTickSpacingPx && spacingPx <= maxReadableTickSpacingPx;
  });

  const candidates = readableIntervals.length ? readableIntervals : tickIntervalsMs;
  return candidates.reduce((best, intervalMs) => {
    const bestDistance = Math.abs(best / msPerPixel - targetTickSpacingPx);
    const currentDistance = Math.abs(intervalMs / msPerPixel - targetTickSpacingPx);
    return currentDistance < bestDistance ? intervalMs : best;
  }, candidates[0]!);
}

export function buildTimelineTicks(options: TimelineTickOptions): TimelineTick[] {
  const durationMs = Math.max(1, Math.round(options.durationMs));
  const contentWidthPx = Math.max(1, options.contentWidthPx);
  const intervalMs = chooseTimelineTickInterval({ durationMs, contentWidthPx });
  const ticks: TimelineTick[] = [];

  for (let timeMs = 0; timeMs <= durationMs; timeMs += intervalMs) {
    ticks.push({
      timeMs,
      x: (timeMs / durationMs) * contentWidthPx
    });
  }

  const lastTick = ticks.at(-1);
  if (!lastTick || lastTick.timeMs !== durationMs) {
    ticks.push({
      timeMs: durationMs,
      x: contentWidthPx
    });
  }

  return ticks;
}
