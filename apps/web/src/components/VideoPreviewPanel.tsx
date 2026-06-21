import { ActionIcon, Box, Button, Center, Group, Stack, Text } from "@mantine/core";
import type { SubtitleLine, SubtitleStyle } from "@diplomat/shared";
import { IconArrowsMaximize, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  previewContainerStyle,
  previewStyleToCss,
  safeAreaStyle,
  subtitleStyleWithDefaults
} from "../lib/subtitleStyles";

type VideoPreviewPanelProps = {
  emptyDescription?: string;
  emptyActionIcon?: ReactNode;
  emptyActionLabel?: string;
  mediaUrl?: string | null;
  sourceVideoPath?: string | null;
  selectedLine: SubtitleLine | null;
  activeLine?: SubtitleLine | null;
  playing?: boolean;
  previewStyle?: SubtitleStyle | null;
  showSafeArea?: boolean;
  currentTimeMs?: number;
  durationMs?: number;
  seekRequestMs?: number | null;
  onEmptyAction?: () => void;
  onTimeUpdate?: (timeMs: number) => void;
};

type PreviewFitMode = "fit" | "fill";

function formatTimecode(ms: number) {
  const safeMs = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = safeMs % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
    milliseconds
  ).padStart(3, "0")}`;
}

export function VideoPreviewPanel({
  emptyDescription,
  emptyActionIcon,
  emptyActionLabel,
  mediaUrl,
  sourceVideoPath,
  selectedLine,
  activeLine = null,
  playing: controlledPlaying,
  previewStyle = null,
  showSafeArea = false,
  currentTimeMs = 0,
  durationMs = 0,
  seekRequestMs = null,
  onEmptyAction,
  onTimeUpdate
}: VideoPreviewPanelProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [localTimeMs, setLocalTimeMs] = useState(currentTimeMs);
  const [localDurationMs, setLocalDurationMs] = useState(durationMs);
  const [localPlaying, setLocalPlaying] = useState(false);
  const [fitMode, setFitMode] = useState<PreviewFitMode>("fit");
  const playing = controlledPlaying ?? localPlaying;
  const previewLine = playing ? activeLine : selectedLine ?? activeLine;
  const resolvedMediaUrl = mediaUrl ?? sourceVideoPath ?? null;
  const normalizedStyle = subtitleStyleWithDefaults(previewStyle);
  const displayedDurationMs = Math.max(durationMs, localDurationMs, 0);
  const displayedTimeMs = Math.min(Math.max(localTimeMs, 0), displayedDurationMs || localTimeMs);
  const orderedPreviewLines =
    normalizedStyle.bilingualLayout.replace("-", "_") === "target_top" ||
    normalizedStyle.bilingualLayout === "target-above-source"
      ? [
          { key: "target", text: previewLine?.translatedText ?? "", color: normalizedStyle.secondaryColor },
          { key: "source", text: previewLine?.sourceText ?? "", color: normalizedStyle.primaryColor }
        ]
      : [
          { key: "source", text: previewLine?.sourceText ?? "", color: normalizedStyle.primaryColor },
          { key: "target", text: previewLine?.translatedText ?? "", color: normalizedStyle.secondaryColor }
        ];

  useEffect(() => {
    if (seekRequestMs === null || !videoRef.current) {
      return;
    }
    const nextTimeMs = Math.max(0, seekRequestMs);
    videoRef.current.currentTime = nextTimeMs / 1000;
    setLocalTimeMs(nextTimeMs);
  }, [seekRequestMs]);

  useEffect(() => {
    setLocalTimeMs(currentTimeMs);
  }, [currentTimeMs]);

  useEffect(() => {
    setLocalDurationMs(durationMs);
  }, [durationMs]);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      try {
        await video.play();
        setLocalPlaying(true);
      } catch {
        setLocalPlaying(false);
      }
      return;
    }
    video.pause();
    setLocalPlaying(false);
  }

  function seekTo(nextTimeMs: number) {
    const video = videoRef.current;
    const safeTimeMs = Math.max(0, Math.min(nextTimeMs, displayedDurationMs || nextTimeMs));
    if (video) {
      video.currentTime = safeTimeMs / 1000;
    }
    setLocalTimeMs(safeTimeMs);
    onTimeUpdate?.(safeTimeMs);
  }

  return (
    <Box
      component="section"
      role="region"
      aria-label={t("workbench.labels.videoPreview")}
      bg="#070b14"
      c="white"
      style={{
        position: "relative",
        aspectRatio: "16 / 9",
        width: "100%",
        maxHeight: "100%",
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)"
      }}
    >
      {resolvedMediaUrl ? (
        <video
          ref={videoRef}
          aria-label={t("workbench.labels.videoPreviewMedia")}
          src={resolvedMediaUrl}
          onLoadedMetadata={(event) => {
            const nextDurationMs = Number.isFinite(event.currentTarget.duration)
              ? Math.round(event.currentTarget.duration * 1000)
              : durationMs;
            setLocalDurationMs(nextDurationMs);
          }}
          onPlay={() => setLocalPlaying(true)}
          onPause={() => setLocalPlaying(false)}
          onTimeUpdate={(event) => {
            const nextTimeMs = Math.round(event.currentTarget.currentTime * 1000);
            setLocalTimeMs(nextTimeMs);
            onTimeUpdate?.(nextTimeMs);
          }}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            background: "#000",
            objectFit: fitMode === "fit" ? "contain" : "cover"
          }}
        />
      ) : (
        <Center h="100%">
          <Stack gap={4} align="center">
            <Text size="sm" fw={700} c="gray.4">
              {t("workbench.previewUnavailable")}
            </Text>
            <Text size="xs" c="gray.6">
              {emptyDescription ?? t("workbench.noProject")}
            </Text>
            {emptyActionLabel ? (
              <Button
                type="button"
                size="compact-xs"
                color="teal"
                variant="light"
                leftSection={emptyActionIcon}
                onClick={onEmptyAction}
              >
                {emptyActionLabel}
              </Button>
            ) : null}
          </Stack>
        </Center>
      )}

      {showSafeArea ? <Box data-testid="subtitle-safe-area" style={safeAreaStyle(normalizedStyle)} /> : null}

      {previewLine ? (
        <Box
          style={{
            position: "absolute",
            display: "flex",
            pointerEvents: "none",
            ...previewContainerStyle(normalizedStyle)
          }}
        >
          <Stack
            gap={2}
            align="center"
            px="sm"
            py={6}
            style={{
              maxWidth: "100%",
              borderRadius: 4,
              boxShadow: "0 8px 28px rgba(0,0,0,0.32)",
              ...previewStyleToCss(normalizedStyle)
            }}
          >
            {orderedPreviewLines
              .filter((line) => line.text.trim())
              .map((line) => (
                <Text
                  key={line.key}
                  fw={700}
                  ta={normalizedStyle.alignment.includes("left") ? "left" : normalizedStyle.alignment.includes("right") ? "right" : "center"}
                  c={line.color}
                  lineClamp={2}
                  style={{ fontSize: normalizedStyle.fontSize }}
                >
                  {line.text}
                </Text>
              ))}
          </Stack>
        </Box>
      ) : null}

      {resolvedMediaUrl ? (
        <Group
          gap="xs"
          wrap="nowrap"
          px="sm"
          py={8}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            background: "linear-gradient(180deg, rgba(3,7,18,0), rgba(3,7,18,0.84))"
          }}
        >
          <ActionIcon
            type="button"
            variant="filled"
            color="teal"
            size="md"
            aria-label={playing ? t("videoPreview.pause") : t("videoPreview.play")}
            onClick={() => void togglePlayback()}
          >
            {playing ? (
              <IconPlayerPause size={16} aria-hidden />
            ) : (
              <IconPlayerPlay size={16} aria-hidden />
            )}
          </ActionIcon>
          <Text size="xs" ff="monospace" c="white" style={{ minWidth: 132 }}>
            {formatTimecode(displayedTimeMs)} / {formatTimecode(displayedDurationMs)}
          </Text>
          <input
            type="range"
            min={0}
            max={Math.max(1, displayedDurationMs)}
            step={50}
            value={Math.min(displayedTimeMs, Math.max(1, displayedDurationMs))}
            aria-label={t("videoPreview.scrubber")}
            onChange={(event) => seekTo(Number(event.currentTarget.value))}
            style={{ flex: 1, minWidth: 80 }}
          />
          <ActionIcon
            type="button"
            variant="subtle"
            color="gray"
            size="md"
            aria-label={t("videoPreview.toggleFit")}
            onClick={() => setFitMode((mode) => (mode === "fit" ? "fill" : "fit"))}
            style={{ color: "#f8fafc" }}
          >
            <IconArrowsMaximize size={16} aria-hidden />
          </ActionIcon>
        </Group>
      ) : null}
    </Box>
  );
}
