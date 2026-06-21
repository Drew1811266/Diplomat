type TimelineClockOptions = {
  durationMs: number;
  contentWidthPx: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export class TimelineClock {
  readonly durationMs: number;
  readonly contentWidthPx: number;
  readonly pixelsPerMs: number;

  constructor(options: TimelineClockOptions) {
    this.durationMs = Math.max(1, options.durationMs);
    this.contentWidthPx = Math.max(1, options.contentWidthPx);
    this.pixelsPerMs = this.contentWidthPx / this.durationMs;
  }

  timeToX(timeMs: number) {
    return clamp(timeMs, 0, this.durationMs) * this.pixelsPerMs;
  }

  xToTime(xPx: number) {
    return clamp(xPx / this.pixelsPerMs, 0, this.durationMs);
  }

  deltaPxToMs(deltaPx: number) {
    return deltaPx / this.pixelsPerMs;
  }
}
