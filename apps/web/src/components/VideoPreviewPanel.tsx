import { Box, Button, Center, Stack, Text } from "@mantine/core";
import type { SubtitleLine, SubtitleStyle } from "@diplomat/shared";
import { useEffect, useRef, type ReactNode } from "react";
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
  previewStyle?: SubtitleStyle | null;
  showSafeArea?: boolean;
  seekRequestMs?: number | null;
  onEmptyAction?: () => void;
  onTimeUpdate?: (timeMs: number) => void;
};

export function VideoPreviewPanel({
  emptyDescription,
  emptyActionIcon,
  emptyActionLabel,
  mediaUrl,
  sourceVideoPath,
  selectedLine,
  previewStyle = null,
  showSafeArea = false,
  seekRequestMs = null,
  onEmptyAction,
  onTimeUpdate
}: VideoPreviewPanelProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resolvedMediaUrl = mediaUrl ?? sourceVideoPath ?? null;
  const normalizedStyle = subtitleStyleWithDefaults(previewStyle);
  const orderedPreviewLines =
    normalizedStyle.bilingualLayout.replace("-", "_") === "target_top" ||
    normalizedStyle.bilingualLayout === "target-above-source"
      ? [
          { key: "target", text: selectedLine?.translatedText ?? "", color: normalizedStyle.secondaryColor },
          { key: "source", text: selectedLine?.sourceText ?? "", color: normalizedStyle.primaryColor }
        ]
      : [
          { key: "source", text: selectedLine?.sourceText ?? "", color: normalizedStyle.primaryColor },
          { key: "target", text: selectedLine?.translatedText ?? "", color: normalizedStyle.secondaryColor }
        ];

  useEffect(() => {
    if (seekRequestMs === null || !videoRef.current) {
      return;
    }
    videoRef.current.currentTime = Math.max(0, seekRequestMs) / 1000;
  }, [seekRequestMs]);

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
          controls
          onTimeUpdate={(event) =>
            onTimeUpdate?.(Math.round(event.currentTarget.currentTime * 1000))
          }
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            background: "#000",
            objectFit: "contain"
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

      {selectedLine ? (
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
    </Box>
  );
}
