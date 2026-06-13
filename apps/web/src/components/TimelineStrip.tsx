import { Box, Group, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

type TimelineStripProps = {
  durationMs: number;
  lineCount: number;
};

function formatSeconds(durationMs: number) {
  return `${Math.max(0, Math.round(durationMs / 1000))}s`;
}

export function TimelineStrip({ durationMs, lineCount }: TimelineStripProps) {
  const { t } = useTranslation();
  const filledPercent = Math.min(100, Math.max(0, lineCount * 4));

  return (
    <Box
      component="section"
      role="region"
      aria-label={t("workbench.labels.timeline")}
      px="sm"
      py={8}
      bg="#f8fafc"
      style={{
        height: 72,
        minHeight: 72,
        borderTop: "1px solid #cbd5e1"
      }}
    >
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Text size="xs" c="dimmed" ff="monospace">
          00:00
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {t("workbench.timeline.subtitleRows", { count: lineCount })}
        </Text>
        <Text size="xs" c="dimmed" ff="monospace">
          {formatSeconds(durationMs)}
        </Text>
      </Group>
      <Box
        mt={7}
        h={20}
        bg="#e2e8f0"
        style={{
          position: "relative",
          borderRadius: 4,
          overflow: "hidden"
        }}
      >
        <Box
          h="100%"
          bg="#5eead4"
          style={{
            width: `${filledPercent}%`,
            minWidth: lineCount > 0 ? 10 : 0,
            borderRadius: 4
          }}
        />
      </Box>
    </Box>
  );
}
