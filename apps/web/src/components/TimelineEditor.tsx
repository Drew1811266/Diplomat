import { Badge, Box, Group, Stack, Text } from "@mantine/core";
import type { SubtitleLine, WaveformResponse } from "@diplomat/shared";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { workstationSurfaces } from "../app/theme";
import { TimelineClock } from "../editor/timeline/TimelineClock";
import { buildTimelineTicks } from "../editor/timeline/timelineTicks";
import { getVisibleSubtitleLineEntries } from "../editor/timeline/visibleSubtitleRange";
import type { TimingIssue } from "../lib/timingValidation";

type InteractionMode = "move" | "resize-start" | "resize-end";

type TimelineInteraction = {
  mode: InteractionMode;
  line: SubtitleLine;
  previewLine: SubtitleLine;
  startClientX: number;
};

type TimelineViewport = {
  scrollLeft: number;
  width: number;
};

type TimelineEditorProps = {
  durationMs: number;
  currentTimeMs: number;
  lines: SubtitleLine[];
  waveform?: WaveformResponse | null;
  selectedLineId: string | null;
  activeLineId?: string | null;
  timingIssuesByLineId?: Record<string, TimingIssue[]>;
  onSelectLine: (lineId: string) => void;
  onSeek: (timeMs: number) => void;
  onChangeLine: (line: SubtitleLine) => void;
};

const minTrackWidth = 720;
const pixelsPerMillisecond = 0.16;
const snapMs = 50;
const minDurationMs = 300;
const trackHeaderWidth = 112;
const subtitleRenderOverscanMs = 2000;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function snap(value: number) {
  return Math.round(value / snapMs) * snapMs;
}

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
    milliseconds
  ).padStart(3, "0")}`;
}

export function TimelineEditor({
  durationMs,
  currentTimeMs,
  lines,
  waveform = null,
  selectedLineId,
  activeLineId = null,
  timingIssuesByLineId = {},
  onSelectLine,
  onSeek,
  onChangeLine
}: TimelineEditorProps) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [interaction, setInteraction] = useState<TimelineInteraction | null>(null);
  const [timelineViewport, setTimelineViewport] = useState<TimelineViewport>({ scrollLeft: 0, width: 0 });
  const safeDurationMs = Math.max(1, durationMs);
  const trackWidth = Math.max(minTrackWidth, safeDurationMs * pixelsPerMillisecond * zoom);
  const timelineClock = useMemo(
    () => new TimelineClock({ durationMs: safeDurationMs, contentWidthPx: trackWidth }),
    [safeDurationMs, trackWidth]
  );
  const playheadPercent = clamp((currentTimeMs / safeDurationMs) * 100, 0, 100);
  const rulerTicks = useMemo(() => {
    return buildTimelineTicks({ durationMs: safeDurationMs, contentWidthPx: trackWidth });
  }, [safeDurationMs, trackWidth]);
  const visibleSubtitleEntries = useMemo(() => {
    if (timelineViewport.width <= 0) {
      return lines.map((line, originalIndex) => ({ line, originalIndex }));
    }

    return getVisibleSubtitleLineEntries(lines, {
      startMs: timelineClock.xToTime(timelineViewport.scrollLeft),
      endMs: timelineClock.xToTime(timelineViewport.scrollLeft + timelineViewport.width),
      overscanMs: subtitleRenderOverscanMs
    });
  }, [lines, timelineClock, timelineViewport.scrollLeft, timelineViewport.width]);

  const waveformBars = useMemo(() => {
    if (!waveform?.peaks.length) {
      return [];
    }
    return waveform.peaks.map((peak) => {
      const x = (peak.startMs / safeDurationMs) * trackWidth;
      const width = Math.max(2, ((peak.endMs - peak.startMs) / safeDurationMs) * trackWidth);
      const high = 46 - Math.max(0, peak.max) * 42;
      const low = 46 + Math.abs(Math.min(0, peak.min)) * 42;
      return { ...peak, x, width, y: high, height: Math.max(2, low - high) };
    });
  }, [safeDurationMs, trackWidth, waveform]);

  function timeFromClientX(clientX: number, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const offset = clamp(clientX - rect.left + (element.scrollLeft ?? 0), 0, trackWidth);
    return snap(timelineClock.xToTime(offset));
  }

  function capturePointer(element: Element, pointerId: number) {
    if ("setPointerCapture" in element) {
      element.setPointerCapture(pointerId);
    }
  }

  function deltaFromClientX(clientX: number) {
    const deltaPx = clientX - interaction!.startClientX;
    return snap(timelineClock.deltaPxToMs(deltaPx));
  }

  function updateTimelineViewport(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const nextViewport = {
      scrollLeft: element.scrollLeft ?? 0,
      width: rect.width
    };

    setTimelineViewport((currentViewport) => {
      if (
        currentViewport.scrollLeft === nextViewport.scrollLeft &&
        currentViewport.width === nextViewport.width
      ) {
        return currentViewport;
      }
      return nextViewport;
    });
  }

  function interactionPreviewLine(line: SubtitleLine) {
    return interaction?.line.id === line.id ? interaction.previewLine : line;
  }

  function hasTimingChange(first: SubtitleLine, second: SubtitleLine) {
    return first.startMs !== second.startMs || first.endMs !== second.endMs;
  }

  function updateInteraction(clientX: number) {
    if (!interaction) {
      return;
    }
    const deltaMs = deltaFromClientX(clientX);
    const { line } = interaction;
    let previewLine: SubtitleLine;
    if (interaction.mode === "move") {
      const duration = line.endMs - line.startMs;
      const nextStart = clamp(line.startMs + deltaMs, 0, Math.max(0, safeDurationMs - duration));
      previewLine = { ...line, startMs: nextStart, endMs: nextStart + duration };
      setInteraction({ ...interaction, previewLine });
      return;
    }
    if (interaction.mode === "resize-start") {
      previewLine = {
        ...line,
        startMs: clamp(line.startMs + deltaMs, 0, line.endMs - minDurationMs)
      };
      setInteraction({ ...interaction, previewLine });
      return;
    }
    previewLine = {
      ...line,
      endMs: clamp(line.endMs + deltaMs, line.startMs + minDurationMs, safeDurationMs)
    };
    setInteraction({ ...interaction, previewLine });
  }

  function finishInteraction() {
    if (!interaction) {
      return;
    }
    if (hasTimingChange(interaction.line, interaction.previewLine)) {
      onChangeLine(interaction.previewLine);
    }
    setInteraction(null);
  }

  return (
    <Box
      component="section"
      role="region"
      aria-label={t("timelineEditor.region")}
      bg={workstationSurfaces.panelAlt}
      c={workstationSurfaces.text}
      px="sm"
      py={8}
      style={{
        borderTop: `1px solid ${workstationSurfaces.outline}`,
        minHeight: 156,
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        gap: 8
      }}
    >
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text size="xs" fw={800} c={workstationSurfaces.text}>
            {t("timelineEditor.title")}
          </Text>
          <Text size="xs" c={workstationSurfaces.textMuted} ff="monospace">
            {formatTime(currentTimeMs)} / {formatTime(durationMs)}
          </Text>
        </Stack>
        <Group gap={6} wrap="nowrap">
          <Text component="label" size="xs" fw={700} c={workstationSurfaces.textMuted} htmlFor="timeline-zoom">
            {t("timelineEditor.zoom")}
          </Text>
          <input
            id="timeline-zoom"
            aria-label={t("timelineEditor.zoom")}
            type="range"
            min="1"
            max="4"
            step="0.5"
            value={zoom}
            onChange={(event) => setZoom(Number(event.currentTarget.value))}
            style={{ width: 120 }}
          />
        </Group>
      </Group>

      <Box
        style={{
          minHeight: 128,
          display: "grid",
          gridTemplateColumns: `${trackHeaderWidth}px minmax(0, 1fr)`,
          border: "1px solid #cbd5e1",
          borderRadius: 6,
          background: "#0f172a",
          overflow: "hidden"
        }}
      >
        <Box
          px="xs"
          py={8}
          style={{
            borderRight: "1px solid #334155",
            background: "#111827"
          }}
        >
          <Text size="xs" fw={900} c="gray.2">
            {t("timelineEditor.subtitleTrack")}
          </Text>
          <Text size="xs" c="gray.5" mt={4}>
            {t("timelineEditor.clipCount", { count: lines.length })}
          </Text>
        </Box>

        <Box
          data-testid="timeline-track"
          onScroll={(event) => updateTimelineViewport(event.currentTarget)}
          onPointerDown={(event) => {
            if (event.currentTarget === event.target) {
              updateTimelineViewport(event.currentTarget);
              onSeek(timeFromClientX(event.clientX, event.currentTarget));
            }
          }}
          onPointerMove={(event) => updateInteraction(event.clientX)}
          onPointerUp={finishInteraction}
          style={{
            minHeight: 128,
            overflowX: "auto",
            overflowY: "hidden",
            position: "relative",
            background: "#111827"
          }}
        >
          <Box
            style={{
              position: "relative",
              width: trackWidth,
              minHeight: 128
            }}
          >
            <Box
              data-testid="timeline-ruler"
              aria-hidden
              style={{
                position: "relative",
                height: 28,
                borderBottom: "1px solid #334155",
                background: "#0f172a"
              }}
            >
              {rulerTicks.map((tick) => (
                <Box
                  key={tick.timeMs}
                  data-testid="timeline-ruler-tick"
                  style={{
                    position: "absolute",
                    left: tick.x,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: "#475569"
                  }}
                >
                  <Text
                    size="xs"
                    c="gray.5"
                    ff="monospace"
                    style={{
                      position: "absolute",
                      left: 4,
                      top: 5,
                      whiteSpace: "nowrap"
                    }}
                  >
                    {formatTime(tick.timeMs)}
                  </Text>
                </Box>
              ))}
            </Box>

            <svg
              data-testid="timeline-waveform"
              width={trackWidth}
              height={96}
              aria-hidden
              style={{ display: "block" }}
            >
              <line x1={0} x2={trackWidth} y1={48} y2={48} stroke="#334155" strokeWidth={1} />
              {waveformBars.map((bar) => (
                <rect
                  key={bar.index}
                  x={bar.x}
                  y={bar.y + 2}
                  width={bar.width}
                  height={bar.height}
                  fill="#38bdf8"
                  opacity={0.75}
                  rx={1}
                />
              ))}
            </svg>

            <Box
              data-testid="timeline-playhead"
              aria-hidden="true"
              style={{
                position: "absolute",
                left: `${playheadPercent}%`,
                top: 0,
                bottom: 0,
                width: 2,
                background: "#f43f5e",
                boxShadow: "0 0 0 1px rgba(244, 63, 94, 0.35)"
              }}
            >
              <Box
                style={{
                  position: "absolute",
                  top: 0,
                  left: -5,
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: "#f43f5e"
                }}
              />
            </Box>

            {visibleSubtitleEntries.map(({ line, originalIndex }) => {
              const previewLine = interactionPreviewLine(line);
              const selected = line.id === selectedLineId;
              const active = line.id === activeLineId;
              const issues = timingIssuesByLineId[line.id] ?? [];
              const left = `${(previewLine.startMs / safeDurationMs) * 100}%`;
              const width = `${Math.max(
                0.4,
                ((previewLine.endMs - previewLine.startMs) / safeDurationMs) * 100
              )}%`;
              const top = 74 + (originalIndex % 2) * 24;
              return (
                <Box
                  key={line.id}
                  role="button"
                  tabIndex={0}
                  aria-label={t("timelineEditor.blockLabel", { id: line.id })}
                  data-testid={`timeline-block-${line.id}`}
                  data-active={active ? "true" : undefined}
                  data-selected={selected ? "true" : undefined}
                  data-has-issues={issues.length > 0 ? "true" : undefined}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    capturePointer(event.currentTarget, event.pointerId);
                    onSelectLine(line.id);
                    setInteraction({
                      mode: "move",
                      line,
                      previewLine: line,
                      startClientX: event.clientX
                    });
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSeek(previewLine.startMs);
                  }}
                  style={{
                    position: "absolute",
                    left,
                    top,
                    width,
                    height: 26,
                    minWidth: 18,
                    cursor: "grab",
                    borderRadius: 5,
                    border: issues.length
                      ? "1px solid #f87171"
                      : selected
                        ? "1px solid #5eead4"
                        : "1px solid #64748b",
                    background: selected ? "#0f766e" : active ? "#134e4a" : "#1f2937",
                    color: "#f8fafc",
                    overflow: "hidden",
                    boxShadow: selected ? "0 0 0 2px rgba(94, 234, 212, 0.18)" : undefined
                  }}
                >
                  <button
                    type="button"
                    aria-label={t("timelineEditor.resizeStart", { id: line.id })}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      capturePointer(event.currentTarget, event.pointerId);
                      onSelectLine(line.id);
                      setInteraction({
                        mode: "resize-start",
                        line,
                        previewLine: line,
                        startClientX: event.clientX
                      });
                    }}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 8,
                      minHeight: 0,
                      padding: 0,
                      border: 0,
                      borderRadius: 0,
                      background: "rgba(255,255,255,0.28)",
                      cursor: "ew-resize"
                    }}
                  />
                  <Text
                    size="xs"
                    fw={800}
                    truncate
                    px={12}
                    lh="26px"
                    style={{ pointerEvents: "none" }}
                  >
                    {previewLine.sourceText.trim() || line.id}
                  </Text>
                  {issues.length ? (
                    <Badge
                      size="xs"
                      color="red"
                      variant="filled"
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 5,
                        height: 16,
                        pointerEvents: "none"
                      }}
                    >
                      {issues.length}
                    </Badge>
                  ) : null}
                  <button
                    type="button"
                    aria-label={t("timelineEditor.resizeEnd", { id: line.id })}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      capturePointer(event.currentTarget, event.pointerId);
                      onSelectLine(line.id);
                      setInteraction({
                        mode: "resize-end",
                        line,
                        previewLine: line,
                        startClientX: event.clientX
                      });
                    }}
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 8,
                      minHeight: 0,
                      padding: 0,
                      border: 0,
                      borderRadius: 0,
                      background: "rgba(255,255,255,0.28)",
                      cursor: "ew-resize"
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
