import { Box, Center, Stack, Text } from "@mantine/core";
import type { SubtitleLine } from "@diplomat/shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

type VideoPreviewPanelProps = {
  mediaUrl?: string | null;
  sourceVideoPath?: string | null;
  selectedLine: SubtitleLine | null;
  seekRequestMs?: number | null;
  onTimeUpdate?: (timeMs: number) => void;
};

export function VideoPreviewPanel({
  mediaUrl,
  sourceVideoPath,
  selectedLine,
  seekRequestMs = null,
  onTimeUpdate
}: VideoPreviewPanelProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resolvedMediaUrl = mediaUrl ?? sourceVideoPath ?? null;

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
              {t("workbench.noProject")}
            </Text>
          </Stack>
        </Center>
      )}

      {selectedLine ? (
        <Center
          style={{
            position: "absolute",
            left: "14%",
            right: "14%",
            bottom: 24,
            pointerEvents: "none"
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
              background: "rgba(15, 23, 42, 0.86)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.32)"
            }}
          >
            <Text size="sm" fw={700} ta="center" c="white" lineClamp={2}>
              {selectedLine.sourceText}
            </Text>
            {selectedLine.translatedText ? (
              <Text size="xs" ta="center" c="teal.1" lineClamp={2}>
                {selectedLine.translatedText}
              </Text>
            ) : null}
          </Stack>
        </Center>
      ) : null}
    </Box>
  );
}
