import { Badge, Box, Group, Stack, Text } from "@mantine/core";
import type { SubtitleLine, WaveformResponse } from "@diplomat/shared";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TimingIssue } from "../lib/timingValidation";

type InteractionMode = "move" | "resize-start" | "resize-end";

type TimelineInteraction = {
  mode: InteractionMode;
  line: SubtitleLine;
  startClientX: number;
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
  const safeDurationMs = Math.max(1, durationMs);
  const trackWidth = Math.max(minTrackWidth, safeDurationMs * pixelsPerMillisecond * zoom);
  const playheadPercent = clamp((currentTimeMs / safeDurationMs) * 100, 0, 100);

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
    const coordinateWidth = Math.max(1, trackWidth, rect.width);
    const offset = clamp(clientX - rect.left + (element.scrollLeft ?? 0), 0, coordinateWidth);
    return snap((offset / coordinateWidth) * safeDurationMs);
  }

  function capturePointer(element: Element, pointerId: number) {
    if ("setPointerCapture" in element) {
      element.setPointerCapture(pointerId);
    }
  }

  function deltaFromClientX(clientX: number, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const deltaPx = clientX - interaction!.startClientX;
    return snap((deltaPx / Math.max(1, rect.width)) * safeDurationMs);
  }

  function updateInteraction(clientX: number, element: HTMLElement) {
    if (!interaction) {
      return;
    }
    const deltaMs = deltaFromClientX(clientX, element);
    const { line } = interaction;
    if (interaction.mode === "move") {
      const duration = line.endMs - line.startMs;
      const nextStart = clamp(line.startMs + deltaMs, 0, Math.max(0, safeDurationMs - duration));
      onChangeLine({ ...line, startMs: nextStart, endMs: nextStart + duration });
      return;
    }
    if (interaction.mode === "resize-start") {
      onChangeLine({
        ...line,
        startMs: clamp(line.startMs + deltaMs, 0, line.endMs - minDurationMs)
      });
      return;
    }
    onChangeLine({
      ...line,
      endMs: clamp(line.endMs + deltaMs, line.startMs + minDurationMs, safeDurationMs)
    });
  }

  return (
    <Box
      component="section"
      role="region"
      aria-label={t("timelineEditor.region")}
      bg="#0b1220"
      c="white"
      px="sm"
      py={8}
      style={{
        borderTop: "1px solid #1e293b",
        minHeight: 156,
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        gap: 8
      }}
    >
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text size="xs" fw={800} c="#e2e8f0">
            {t("timelineEditor.title")}
          </Text>
          <Text size="xs" c="#94a3b8" ff="monospace">
            {formatTime(currentTimeMs)} / {formatTime(durationMs)}
          </Text>
        </Stack>
        <Group gap={6} wrap="nowrap">
          <Text component="label" size="xs" fw={700} c="#cbd5e1" htmlFor="timeline-zoom">
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
        data-testid="timeline-track"
        onPointerDown={(event) => {
          if (event.currentTarget === event.target) {
            onSeek(timeFromClientX(event.clientX, event.currentTarget));
          }
        }}
        onPointerMove={(event) => updateInteraction(event.clientX, event.currentTarget)}
        onPointerUp={() => setInteraction(null)}
        style={{
          minHeight: 104,
          overflowX: "auto",
          overflowY: "hidden",
          position: "relative",
          border: "1px solid #334155",
          borderRadius: 6,
          background: "#111827"
        }}
      >
        <Box
          style={{
            position: "relative",
            width: trackWidth,
            minHeight: 104
          }}
        >
          <svg
            data-testid="timeline-waveform"
            width={trackWidth}
            height={92}
            aria-hidden
            style={{ display: "block" }}
          >
            <line x1={0} x2={trackWidth} y1={46} y2={46} stroke="#334155" strokeWidth={1} />
            {waveformBars.map((bar) => (
              <rect
                key={bar.index}
                x={bar.x}
                y={bar.y}
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
            style={{
              position: "absolute",
              left: `${playheadPercent}%`,
              top: 0,
              bottom: 0,
              width: 2,
              background: "#f43f5e",
              boxShadow: "0 0 0 1px rgba(244, 63, 94, 0.35)"
            }}
          />

          {lines.map((line, index) => {
            const selected = line.id === selectedLineId;
            const active = line.id === activeLineId;
            const issues = timingIssuesByLineId[line.id] ?? [];
            const left = `${(line.startMs / safeDurationMs) * 100}%`;
            const width = `${Math.max(
              0.4,
              ((line.endMs - line.startMs) / safeDurationMs) * 100
            )}%`;
            const top = 58 + (index % 2) * 19;
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
                  setInteraction({ mode: "move", line, startClientX: event.clientX });
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSeek(line.startMs);
                }}
                style={{
                  position: "absolute",
                  left,
                  top,
                  width,
                  height: 22,
                  minWidth: 18,
                  cursor: "grab",
                  borderRadius: 4,
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
                  lh="22px"
                  style={{ pointerEvents: "none" }}
                >
                  {line.id}
                </Text>
                {issues.length ? (
                  <Badge
                    size="xs"
                    color="red"
                    variant="filled"
                    style={{
                      position: "absolute",
                      right: 10,
                      top: 3,
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
  );
}
