import { Box, Group, Text } from "@mantine/core";

type TimelineStripProps = {
  durationMs: number;
  lineCount: number;
};

function formatSeconds(durationMs: number) {
  return `${Math.max(0, Math.round(durationMs / 1000))}s`;
}

export function TimelineStrip({ durationMs, lineCount }: TimelineStripProps) {
  const filledPercent = Math.min(100, Math.max(0, lineCount * 4));

  return (
    <Box
      component="section"
      role="region"
      aria-label="Timeline"
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
          {lineCount} subtitle rows
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
