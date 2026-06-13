import { Badge, Box, Button, Group, Table, Text } from "@mantine/core";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { SubtitleLine, TranslationStatus } from "@diplomat/shared";

export type SubtitleGridFilter = "all" | "missing";

type SubtitleGridProps = {
  lines: SubtitleLine[];
  selectedLineId: string | null;
  filter: SubtitleGridFilter;
  onFilterChange: (filter: SubtitleGridFilter) => void;
  onSelectLine: (lineId: string) => void;
};

const translationStatusColor: Record<TranslationStatus, string> = {
  not_requested: "gray",
  queued: "blue",
  translated: "green",
  edited: "yellow",
  failed: "red"
};

function formatTimestamp(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
    milliseconds
  ).padStart(3, "0")}`;
}

function isMissingTranslation(line: SubtitleLine) {
  return !line.translatedText.trim() || line.translationStatus === "failed";
}

export function SubtitleGrid({
  lines,
  selectedLineId,
  filter,
  onFilterChange,
  onSelectLine
}: SubtitleGridProps) {
  const { t } = useTranslation();
  const visibleLines = filter === "missing" ? lines.filter(isMissingTranslation) : lines;

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, lineId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectLine(lineId);
    }
  }

  return (
    <Box
      component="section"
      role="region"
      aria-label={t("subtitleGrid.region")}
      bg="#ffffff"
      style={{
        minHeight: 0,
        borderTop: "1px solid #cbd5e1",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "38px minmax(0, 1fr)"
      }}
    >
      <Group
        h={38}
        px="sm"
        justify="space-between"
        wrap="nowrap"
        style={{ borderBottom: "1px solid #e2e8f0" }}
      >
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <Text id="subtitle-grid-title" size="sm" fw={700} c="#0f172a" truncate>
            {t("workbench.subtitleGrid")}
          </Text>
          <Badge size="sm" variant="light" color="gray">
            {t("subtitleGrid.rows", { count: visibleLines.length })}
          </Badge>
        </Group>
        <Group gap={6} wrap="nowrap" aria-label={t("subtitleGrid.filters.label")}>
          <Button
            type="button"
            size="compact-xs"
            variant={filter === "all" ? "filled" : "light"}
            color={filter === "all" ? "teal" : "gray"}
            onClick={() => onFilterChange("all")}
          >
            {t("subtitleGrid.filters.all")}
          </Button>
          <Button
            type="button"
            size="compact-xs"
            variant={filter === "missing" ? "filled" : "light"}
            color={filter === "missing" ? "teal" : "gray"}
            onClick={() => onFilterChange("missing")}
          >
            {t("subtitleGrid.filters.missing")}
          </Button>
        </Group>
      </Group>

      <Box data-testid="subtitle-grid-body" style={{ minHeight: 0, overflow: "auto" }}>
        {visibleLines.length ? (
          <Table
            stickyHeader
            striped
            highlightOnHover
            withColumnBorders
            aria-label={t("workbench.subtitleGrid")}
            verticalSpacing={4}
            horizontalSpacing="xs"
            fz="xs"
            style={{ minWidth: 840 }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={116}>{t("subtitleGrid.columns.id")}</Table.Th>
                <Table.Th w={92}>{t("subtitleGrid.columns.start")}</Table.Th>
                <Table.Th w={92}>{t("subtitleGrid.columns.end")}</Table.Th>
                <Table.Th>{t("subtitleGrid.columns.source")}</Table.Th>
                <Table.Th>{t("subtitleGrid.columns.translation")}</Table.Th>
                <Table.Th w={92}>{t("subtitleGrid.columns.review")}</Table.Th>
                <Table.Th w={118}>{t("subtitleGrid.columns.status")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visibleLines.map((line) => {
                const selected = line.id === selectedLineId;

                return (
                  <Table.Tr
                    key={line.id}
                    data-testid={`subtitle-row-${line.id}`}
                    aria-selected={selected}
                    tabIndex={0}
                    onClick={() => onSelectLine(line.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, line.id)}
                    style={{
                      cursor: "pointer",
                      background: selected ? "#ccfbf1" : undefined,
                      boxShadow: selected ? "inset 3px 0 0 #0f766e" : undefined
                    }}
                  >
                    <Table.Td>
                      <Button
                        type="button"
                        size="compact-xs"
                        variant="subtle"
                        color={selected ? "teal" : "gray"}
                        aria-label={t("subtitleGrid.selectLine", { id: line.id })}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectLine(line.id);
                        }}
                      >
                        {line.id}
                      </Button>
                    </Table.Td>
                    <Table.Td ff="monospace">{formatTimestamp(line.startMs)}</Table.Td>
                    <Table.Td ff="monospace">{formatTimestamp(line.endMs)}</Table.Td>
                    <Table.Td style={{ maxWidth: 280, overflowWrap: "anywhere" }}>
                      {line.sourceText || t("subtitleGrid.noSourceText")}
                    </Table.Td>
                    <Table.Td c={line.translatedText ? "#0f172a" : "dimmed"} style={{ maxWidth: 280, overflowWrap: "anywhere" }}>
                      {line.translatedText || t("subtitleGrid.noTranslatedText")}
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light" color="gray">
                        {t(`subtitleGrid.reviewStatus.${line.reviewStatus}`)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light" color={translationStatusColor[line.translationStatus]}>
                        {t(`subtitleGrid.translationStatus.${line.translationStatus}`)}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        ) : (
          <Box p="md">
            <Text size="sm" fw={700} c="#334155">
              {lines.length ? t("subtitleGrid.noFilterMatches") : t("subtitleGrid.empty")}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
